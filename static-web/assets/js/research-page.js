import {request,query} from './api.js';
import {filterBar} from './filter-bar.js';
import {panel,render,table,plot,el,error} from './ui.js';
import {formDefinitions} from './input-schema.js';
const root=document.getElementById('page-content'),name=document.body.dataset.page;
async function boot(){root.replaceChildren();const f=await filterBar(root,{report:true,year:true}),chart=panel('research-chart',formDefinitions[name].title+' per Kategori'),detail=panel('research-table','Data '+formDefinitions[name].title);root.append(chart,detail);
 const columns=formDefinitions[name].columns;
 const load=()=>{const data=request('/dashboard/'+name+query(f.collect()));return Promise.all([
 render(chart,()=>data,r=>plot(chart,r.data.map(x=>x.kategori_label+' / '+x.tahun),columns.filter(x=>x.key!=='dana').map(x=>({label:x.label,data:r.data.map(row=>row[x.key])}))),f.context()),
 render(detail,()=>data,r=>{if(r.meta.catatan)detail.querySelector('.panel-content').append(el('p',r.meta.catatan,'note'));if(name!=='hki')detail.querySelector('.panel-content').append(el('p','Nominal dana tidak tersedia pada laporan; sel kosong berarti belum ada data.','note'));table(detail,[{label:'Tahun',key:'tahun'},{label:'Kategori',key:'kategori_label'},...columns.map(x=>({label:x.label,key:x.key,number:true}))],r.data);},f.context())]);};
 f.form.addEventListener('change',load);f.form.addEventListener('submit',e=>{e.preventDefault();load();});await load();}
boot().catch(e=>{const p=panel('research-error','Data LPPM');root.append(p);error(p,e);});
