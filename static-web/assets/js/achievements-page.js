import {request,query} from './api.js';
import {filterBar} from './filter-bar.js';
import {panel,render,table,plot,el,error} from './ui.js';
const root=document.getElementById('page-content');
async function boot(){root.replaceChildren();const f=await filterBar(root,{report:true,year:true,prodi:true,jenjang:true}),chart=panel('achievement-chart','Penghargaan per Tingkat'),detail=panel('achievement-table','Prestasi Mahasiswa per Program Studi');root.append(chart,detail);
 const fields=[['jumlah_mahasiswa','Mahasiswa berprestasi'],['nasional','Nasional'],['regional','Regional'],['internasional','Internasional'],['pkm_dikti','PKM DIKTI']];
 const load=()=>{const data=request('/dashboard/prestasi'+query(f.collect()));return Promise.all([
 render(chart,()=>data,r=>{const levels=fields.slice(1,4).filter(([key])=>r.meta.totals[key]!==null);if(levels.length)plot(chart,levels.map(x=>x[1]),[{label:'Jumlah penghargaan',data:levels.map(x=>r.meta.totals[x[0]])}]);else chart.querySelector('.panel-content').append(el('p','Belum ada rincian penghargaan.','note'));},f.context()),
 render(detail,()=>data,r=>{detail.querySelector('.panel-content').append(el('p','Jumlah mahasiswa dan jumlah penghargaan merupakan ukuran berbeda. Sel kosong berarti belum ada data; '+r.meta.tanpa_rincian+' prodi belum mempunyai rincian. Tabel 1.7 (prestasi institusi) tidak dihitung.','note'));table(detail,[{label:'Prodi',key:'prodi_nama'},{label:'Jenjang',key:'jenjang'},{label:'Tahun',key:'tahun'},...fields.map(([key,label])=>({label,key,number:true}))],r.data);},f.context())]);};
 f.form.addEventListener('change',load);f.form.addEventListener('submit',e=>{e.preventDefault();load();});await load();}
boot().catch(e=>{const p=panel('achievement-error','Prestasi Mahasiswa');root.append(p);error(p,e);});
