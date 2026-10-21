import {request,query,apiSource} from './api.js';
import {filterBar} from './filter-bar.js';
import {panel,render,table,plot,error} from './ui.js';
import {financeCategories} from './finance-schema.js';
const root=document.getElementById('page-content');
async function boot(){root.replaceChildren();const f=await filterBar(root,{report:true,year:true});
 const common=[{label:'Komponen',key:'kategori_label'},{label:'Satuan',key:'satuan'}],cols=(...keys)=>keys.map(([key,label])=>({key,label,number:true}));
 const groups=[['rasio','Rasio Keuangan — Tabel 2.12',[...cols(['target','Target'],['realisasi','Realisasi']),{label:'Status sumber',key:'status_sumber'}]],['pendapatan','Pendapatan — Tabel 2.13',cols(['target','Target (Rp)'],['realisasi','Realisasi (Rp)'],['capaian_laporan','Capaian laporan (%)'])],['biaya','Biaya — Tabel 2.14',cols(['target','Anggaran (Rp)'],['realisasi','Realisasi (Rp)'],['capaian_laporan','Realisasi laporan (%)'])],['laporan','Laporan Keuangan — Tabel 4.19',cols(['realisasi','Periode ini (Rp)'],['periode_sebelumnya','Periode sebelumnya (Rp; kode tidak disebutkan)'],['perubahan','Kenaikan / penurunan (Rp)'])]].map(([key,title,columns])=>({key,columns,p:panel('finance-'+key,title)}));
 const charts=financeCategories.map(([key,label,group,unit])=>({key,group,p:panel('finance-chart-'+key,label+' ('+unit+')')}));root.append(...groups.map(x=>x.p),...charts.map(x=>x.p));
 const load=()=>{const data=request('/dashboard/keuangan'+query(f.collect()));const select=async test=>{const r=await data,rows=r.data.filter(test),ids=new Set(rows.map(x=>x.sumber_id));return {...r,[apiSource]:r[apiSource],data:rows,meta:{...r.meta,sumber:r.meta.sumber.filter(s=>rows.some(x=>x.nomor_tabel===s.nomor_tabel))}};};
 return Promise.all([...groups.map(({key,p,columns})=>render(p,()=>select(x=>x.kelompok===key),r=>table(p,[...common,...columns,{label:'Sumber / halaman',value:x=>x.nomor_tabel?'Tabel '+x.nomor_tabel+' · PDF '+x.halaman_pdf+'/cetak '+x.halaman_cetak:x.sumber}],r.data),f.context())),...charts.map(({key,group,p})=>render(p,()=>select(x=>x.kategori===key),r=>{const x=r.data[0];plot(p,group==='laporan'?['Periode ini','Periode sebelumnya']:['Target','Realisasi'],[{label:x.satuan,data:group==='laporan'?[x.realisasi,x.periode_sebelumnya]:[x.target,x.realisasi]}]);},f.context()))]);};
 f.form.addEventListener('change',load);f.form.addEventListener('submit',e=>{e.preventDefault();load();});await load();}
boot().catch(e=>{const p=panel('finance-error','Keuangan');root.append(p);error(p,e);});
