import {request,query,requireUser,format,date} from './api.js';
import {filterBar} from './filter-bar.js';
import {el,panel,render,table} from './ui.js';
import {kpiBand,kpiStatuses,kpiThresholds,kpiCounts,filterKpi} from './kpi-status.js';

const percent=new Intl.NumberFormat('id-ID',{maximumFractionDigits:20});
function statusLabel(band){
 const status=kpiStatuses[band],label=el('span',null,'kpi-status-label'),icon=el('span',status.icon,'kpi-status-icon');
 icon.setAttribute('aria-hidden','true');label.append(icon,el('span',status.label));return label;
}
function drawTable(p,rows,status){
 const visible=filterKpi(rows,status);
 table(p,[
  {label:'No/Kode',key:'indikator_kode'},
  {label:'Indikator',key:'indikator_nama'},
  {label:'Target',value:x=>x.target_nilai!==null?format(x.target_nilai)+' '+x.satuan:x.target_tanggal?date(x.target_tanggal):x.target_teks??'-'},
  {label:'Aktual',value:x=>x.nilai_numerik!==null?format(x.nilai_numerik)+' '+(x.basis_nilai==='reported_percent'?'%':x.satuan):x.nilai_tanggal?date(x.nilai_tanggal):x.nilai_teks??'-'},
  {label:'Capaian vs target',value:x=>kpiBand(x.persen_capaian)==='unknown'?'-':percent.format(Number(x.persen_capaian))+'%'},
  {label:'Keterangan',value:x=>{const wrap=el('div');wrap.append(statusLabel(kpiBand(x.persen_capaian)));const note=x.catatan??(x.arah_terkonfirmasi?null:'Arah penilaian menunggu konfirmasi PRP');if(note)wrap.append(el('small',note,'kpi-row-note'));return wrap;}},
  {label:'Snapshot',value:x=>date(x.tanggal_snapshot)},
  {label:'Detail',export:false,value:()=>{const wrap=el('div'),b=el('button','Lihat','secondary kpi-detail');b.type='button';b.disabled=true;b.setAttribute('aria-disabled','true');b.title='Detail segera tersedia';b.setAttribute('aria-label','Lihat — Detail segera tersedia');wrap.append(b,el('small','Detail segera tersedia'));return wrap;}}
 ],visible);
 const scroll=p.querySelector('.table-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',p.querySelector('h2').textContent+' — tabel, geser untuk kolom lainnya');
 const caption=el('caption',p.querySelector('h2').textContent);scroll.querySelector('table').prepend(caption);
 for(const [index,tr]of [...p.querySelectorAll('tbody tr')].entries()){
  const band=kpiBand(visible[index].persen_capaian);tr.dataset.kode=visible[index].indikator_kode;
  tr.children[4].classList.add('kpi-achievement','kpi-'+band);
 }
 if(!visible.length)p.querySelector('.panel-content').append(el('p','Tidak ada indikator dengan status yang dipilih.','note'));
}
export async function kpiPage(){
 if(!await requireUser())return;
 const root=document.getElementById('page-content'),f=await filterBar(root,{report:true});
 const label=el('label','Status capaian'),select=el('select');select.name='status_capaian';select.append(new Option('Semua status',''));
 for(const [band,status]of Object.entries(kpiStatuses))select.append(new Option(status.label,band));
 label.append(select);f.form.insertBefore(label,f.form.querySelector('button'));
 const overview=el('section',null,'kpi-overview');overview.setAttribute('aria-label','Legenda dan ringkasan status KPI');
 overview.append(el('h2','Status capaian indikator'),el('p','Jumlah seluruh indikator pada periode laporan, sebelum filter status.','note'));
 const legend=el('div',null,'kpi-legend');
 const ranges={success:'≥ '+format(kpiThresholds.tercapai)+'%',warning:'≥ '+format(kpiThresholds.mendekati)+'% dan < '+format(kpiThresholds.tercapai)+'%',danger:'< '+format(kpiThresholds.mendekati)+'%',unknown:'Capaian kosong / NULL'};
 for(const band of Object.keys(kpiStatuses)){const item=el('p',null,'kpi-legend-item kpi-'+band);item.append(statusLabel(band),el('span',ranges[band]));legend.append(item);}
 const summary=el('p','Memuat ringkasan…','kpi-counts');summary.id='kpi-status-summary';summary.setAttribute('role','status');overview.append(legend,summary);root.append(overview);
 const titles={A:'Keberlanjutan',B:'Mahasiswa',C:'Bisnis Internal, Learning & Development',D:'Kepatuhan (Compliance)'};
 const panels=Object.fromEntries(Object.entries(titles).map(([key,title])=>{const p=panel('perspektif-'+key,'Perspektif '+key+' - '+title,'Persen capaian dibanding target. Nilai yang belum dapat dinilai ditampilkan tanpa skor berbobot.');root.append(p);return [key,p];}));
 let cache=null,sequence=0;
 function count(rows){const counts=kpiCounts(rows);summary.replaceChildren(...Object.entries(kpiStatuses).map(([band,status])=>{const item=el('span',status.label+': '+format(counts[band]));item.dataset.band=band;item.dataset.count=counts[band];return item;}));}
 async function draw(data){await Promise.all(Object.entries(panels).map(([perspektif,p])=>render(p,async()=>{
  const r=await data,rows=r.response.data.filter(x=>x.perspektif===perspektif),notes=r.flags.filter(flag=>(flag.row_id!==null&&rows.some(x=>String(x.id)===String(flag.row_id))&&flag.tabel==='kpi_capaian')||(flag.kode==='kpi-arah-d'&&perspektif==='D'));
  return {...r.response,data:rows,meta:{...r.response.meta,catatan_kualitas:notes.map(x=>({kode:x.kode,pesan:x.pesan}))}};
 },r=>drawTable(p,r.data,select.value),f.context())));}
 async function load(){
  const current=++sequence;cache=null;select.disabled=true;summary.textContent='Memuat ringkasan…';overview.setAttribute('aria-busy','true');
  const data=Promise.all([request('/dashboard/kpi'+query(f.collect())),request('/quality-flags?limit=100').then(r=>r.data).catch(()=>[])]).then(([response,flags])=>({response,flags}));
  const drawing=draw(data);
  try{const result=await data;if(current===sequence){cache=result;count(result.response.data);}}
  catch{if(current===sequence)summary.textContent='Ringkasan belum tersedia. Muat ulang data untuk mencoba lagi.';}
  finally{await drawing;if(current===sequence){select.disabled=!cache;overview.setAttribute('aria-busy','false');}}
 }
 select.addEventListener('change',event=>{event.stopPropagation();if(cache)void draw(Promise.resolve(cache));});
 f.form.addEventListener('submit',event=>{event.preventDefault();void load();});
 f.form.addEventListener('change',()=>void load());
 await load();
}
