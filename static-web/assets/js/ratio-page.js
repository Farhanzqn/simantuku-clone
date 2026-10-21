import {request,query,format} from './api.js';
import {filterBar} from './filter-bar.js';
import {el,panel,render,table,plot,error,renderKpiCards} from './ui.js';
const root=document.getElementById('page-content');
async function boot(){root.replaceChildren();const filters=await filterBar(root,{academic:true,report:true,jenjang:true,prodi:true,fakultas:true}),summary=panel('ratio-summary','Ringkasan Institusi / Pilihan Filter',undefined,{unframed:true}),detail=panel('ratio-table','Rasio per Program Studi'),chart=panel('ratio-chart','Mahasiswa per Dosen Tetap');root.append(summary,chart,detail);
 summary.append(summary.querySelector('.panel-meta'));
 const load=()=>{const data=request('/dashboard/rasio-dosen-mahasiswa'+query(filters.collect()));return Promise.all([
  render(summary,async()=>{const r=await data;return {...r,data:[r.meta.institusi]};},r=>{
    const s=r.meta.institusi,content=summary.querySelector('.panel-content');
    const academic=filters.values.periode_akademik_id.selectedOptions[0]?.textContent??'Periode belum tersedia';
    renderKpiCards(content,[
      {label:'Mahasiswa Aktif',value:s.mahasiswa,description:academic},
      {label:'Dosen Tetap',value:s.dosen,description:academic},
      {label:'Rasio Dosen:Mahasiswa',value:s.mahasiswa_per_dosen,prefix:'1 : ',description:'mahasiswa per satu dosen tetap'}
    ]);
    content.append(el('p',r.meta.rumus,'note'));
    if(!s.lengkap)content.append(el('p','Data pasangan tersedia pada '+s.cakupan+' dari '+s.total_prodi+' prodi; rasio gabungan menunggu data lengkap.','note'));
  },filters.context()),
  render(chart,()=>data,r=>plot(chart,r.data.map(x=>x.prodi_nama),[{label:'Mahasiswa per dosen',data:r.data.map(x=>x.mahasiswa_per_dosen)}]),filters.context()),
  render(detail,()=>data,r=>table(detail,[{label:'Program studi',key:'prodi_nama'},{label:'Jenjang',key:'jenjang'},{label:'Mahasiswa aktif',key:'mahasiswa',number:true},{label:'Dosen tetap',key:'dosen',number:true},{label:'Rasio',value:x=>x.mahasiswa_per_dosen!==null?'1 : '+format(x.mahasiswa_per_dosen):'belum ada data'}],r.data),filters.context())]);};
 filters.form.addEventListener('change',load);filters.form.addEventListener('submit',e=>{e.preventDefault();load();});await load();}
boot().catch(e=>{const p=panel('ratio-error','Data belum tersedia');root.append(p);error(p,e);});
