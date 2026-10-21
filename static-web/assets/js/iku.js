import {request,requireUser,query} from './api.js';
import {el,failure} from './ui.js';
import {ikuBand} from './iku-schema.js';
const $=id=>document.getElementById(id),number=(v,d=3)=>v===null?'—':new Intl.NumberFormat('id-ID',{maximumFractionDigits:d,minimumFractionDigits:d===1?1:0}).format(Number(v));
const updated=v=>v?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))+' WIB':'—';
let sequence=0;
function render({data:rows,meta}){
 $('iku-year').value=meta.tahun;$('iku-period').value=meta.periode;
 $('iku-years').replaceChildren(...[...new Set(meta.tersedia.map(x=>x.tahun))].map(y=>{const o=el('option');o.value=y;return o;}));
 const s=meta.ringkasan;$('iku-summary').replaceChildren(...[['Jumlah indikator',number(s.jumlah,0)],['Rata-rata capaian',number(s.rata_rata,1)+(s.rata_rata===null?'':'%')],['Mencapai target',number(s.mencapai,0)],['Di bawah target',number(s.di_bawah,0)]].map(([label,value])=>{const c=el('article',null,'kpi-card');c.append(el('p',label),el('strong',value));return c;}));
 $('iku-heading').textContent='Indikator Wajib - '+rows.length+' indikator';
 $('iku-meta').textContent=[...new Set(rows.map(x=>x.sumber))].join('; ')+' · '+meta.tahun+' '+meta.periode+' · Status sumber: '+([...new Set(rows.map(x=>x.status_sumber).filter(Boolean))].join('; ')||'—')+' · Pembaruan internal: '+updated(meta.diperbarui_pada);
 $('iku-table').replaceChildren();
 if(!rows.length){$('iku-status').textContent=meta.message;$('iku-panel').dataset.state='empty';return;}
 const table=el('table'),caption=el('caption','Realisasi IKU terhadap target tahun '+meta.tahun+' · '+meta.periode),thead=el('thead'),head=el('tr'),tbody=el('tbody');
 for(const label of ['No','Kode','Indikator','Satuan','Baseline','Target','Realisasi','% dari target','Pembaruan']){const th=el('th',label);th.scope='col';head.append(th);}thead.append(head);table.append(caption,thead,tbody);
 let group;const byId=new Map(rows.map(x=>[String(x.indikator_id),x]));
 rows.forEach((row,index)=>{
  if(group!==row.grup_iku){group=row.grup_iku;const tr=el('tr',null,'iku-group'),th=el('th',group);th.colSpan=9;th.scope='rowgroup';tr.append(th);tbody.append(tr);}
  const tr=el('tr');tr.dataset.kode=row.kode;tr.append(el('td',String(index+1)),el('td',row.kode));
  const label=el('th',null,'iku-label');label.scope='row';let depth=0,parent=row.induk_id;while(parent&&depth<3){depth++;parent=byId.get(String(parent))?.induk_id;}label.classList.add('iku-depth-'+depth);label.append(el('span',row.uraian));
  if(row.perlu_verifikasi){const badge=el('span','Perlu verifikasi','iku-badge warning');label.append(el('br'),badge,el('small',row.catatan_verifikasi,'iku-quality'));}
  tr.append(label,el('td',row.satuan),el('td',number(row.baseline)),el('td',number(row.target)),el('td',number(row.realisasi)));
  const ratio=el('td'),band=ikuBand(row.persen_capaian),value=row.persen_capaian===null?null:Number(row.persen_capaian),badge=el('span',number(value,1)+(value===null?'':'%'),'iku-badge '+band);
  ratio.append(badge,el('small',value===null?'Target belum tersedia / nol':band==='success'?'Mencapai target':band==='warning'?'Mendekati target':'Di bawah target'));
  if(value!==null){const bar=el('progress');bar.max=100;bar.value=Math.min(100,value);bar.className=band;bar.setAttribute('aria-label',row.kode+' '+number(value,1)+'% dari target');ratio.append(bar);}
  tr.append(ratio,el('td',updated(row.diperbarui_pada)));tbody.append(tr);
 });
 $('iku-table').append(table);$('iku-status').textContent=rows.length+' indikator ditampilkan. '+rows.filter(x=>x.perlu_verifikasi).length+' perlu verifikasi.'+(s.tanpa_rasio?' '+s.tanpa_rasio+' belum dapat dihitung.':'');$('iku-panel').dataset.state='ready';
}
async function load(initial=false){const current=++sequence;$('iku-reload').disabled=true;$('iku-status').textContent='Memuat data…';$('iku-panel').dataset.state='loading';$('iku-table').replaceChildren();$('iku-summary').replaceChildren();$('iku-meta').textContent='';
 try{const f=initial?{}:{tahun:$('iku-year').value,periode:$('iku-period').value};if(!initial&&!$('iku-year').checkValidity())throw Error('Tahun harus antara 2000 dan 2200.');const result=await request('/dashboard/iku'+query(f));if(current===sequence)render(result);}catch(e){if(current!==sequence)return;$('iku-panel').dataset.state='error';$('iku-heading').textContent='Indikator Wajib';failure($('iku-status'),e,()=>load());}finally{if(current===sequence)$('iku-reload').disabled=false;}}
async function boot(){if(!await requireUser())return;for(const id of ['iku-year','iku-period'])$(id).addEventListener('change',()=>load());$('iku-reload').addEventListener('click',()=>load());await load(true);}
boot().catch(e=>failure($('iku-status'),e,()=>location.reload()));
