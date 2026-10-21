import {request,query} from './api.js';
import {filterBar} from './filter-bar.js';
import {panel,render,table,plot,el,error,link} from './ui.js';
import {formDefinitions} from './input-schema.js';
const root=document.getElementById('page-content'),defs=formDefinitions['produktivitas-dosen'];
async function boot(){root.replaceChildren();const f=await filterBar(root,{report:true,year:true}),note=el('p','Tabel 2.8: satuan tiap indikator berbeda, tidak dijumlahkan. Persentase laporan dan hasil realisasi/target ditampilkan terpisah. Penelitian/PkM mengikuti rincian resmi LPPM; selisih sumber tercatat untuk verifikasi internal. ','note');note.append(link('Penelitian','/penelitian.html'),document.createTextNode(' · '),link('PkM','/pkm.html'));root.append(note);
 const charts=defs.categories.map(([key,label])=>({key,p:panel('productivity-'+key,label)})),detail=panel('productivity-table','Produktivitas Dosen — Agregat Institusi');root.append(...charts.map(x=>x.p),detail);
 const load=()=>{const data=request('/dashboard/produktivitas-dosen'+query(f.collect()));return Promise.all([
 ...charts.map(({key,p})=>render(p,async()=>{const r=await data;return {...r,data:r.data.filter(x=>x.kategori===key)};},r=>plot(p,['Target','Realisasi'],[{label:r.data[0].kategori_label,data:[r.data[0].target,r.data[0].realisasi]}]),f.context())),
 render(detail,()=>data,r=>table(detail,[{label:'Tahun',key:'tahun'},{label:'Indikator / satuan',key:'kategori_label'},...defs.columns.map(x=>({label:x.label,key:x.key,number:true})),{label:'Capaian hitung (%)',key:'capaian_hitung',number:true}],r.data),f.context())]);};
 f.form.addEventListener('change',load);f.form.addEventListener('submit',e=>{e.preventDefault();load();});await load();}
boot().catch(e=>{const p=panel('productivity-error','Produktivitas Dosen');root.append(p);error(p,e);});
