import {request,query} from './api.js';
import {filterBar} from './filter-bar.js';
import {panel,render,table,plot,el,error} from './ui.js';
import {formDefinitions} from './input-schema.js';
const root=document.getElementById('page-content'),definitions=formDefinitions.kerjasama;
async function boot(){root.replaceChildren();const f=await filterBar(root,{report:true,year:true});root.append(el('p','Keempat cakupan berbeda dan tidak dijumlahkan. Akademik memakai kolom Total; kelembagaan dan horizontal memakai jumlah portofolio. Nilai kontrak tidak ditampilkan pada dashboard publik.','note'));
 const charts=definitions.categories.map(([key,label])=>({key,p:panel('cooperation-'+key,label)})),detail=panel('cooperation-table','Ringkasan Kerja Sama');root.append(...charts.map(x=>x.p),detail);
 const load=()=>{const data=request('/dashboard/kerjasama'+query(f.collect()));return Promise.all([
 ...charts.map(({key,p})=>render(p,async()=>{const r=await data,rows=r.data.filter(x=>x.kategori===key);return {...r,data:rows,meta:{...r.meta,sumber:r.meta.sumber.filter(s=>rows.some(x=>x.sumber_id===s.id))}};},r=>{const row=r.data[0],academic=key.startsWith('akademik-'),cols=academic?definitions.columns.filter(c=>c.key==='jumlah'):definitions.columns.filter(c=>['selesai','berjalan','tahap_penjajakan','proses_penjajakan','dibatalkan'].includes(c.key));plot(p,cols.map(c=>c.label),[{label:academic?'Jumlah pada sel Total tersedia':'Portofolio',data:cols.map(c=>row[c.key])}]);if(row.total_kosong>0)p.querySelector('.panel-content').append(el('p',row.total_kosong+' sel Total belum tersedia. Jumlah yang ditampilkan hanya dari sel terisi.','note'));},f.context())),
 render(detail,()=>data,r=>table(detail,[{label:'Tahun',key:'tahun'},{label:'Cakupan',key:'kategori_label'},...definitions.columns.map(c=>({label:c.label,key:c.key,number:!c.text}))],r.data),f.context())]);};
 f.form.addEventListener('change',load);f.form.addEventListener('submit',e=>{e.preventDefault();load();});await load();}
boot().catch(e=>{const p=panel('cooperation-error','Kerja Sama');root.append(p);error(p,e);});
