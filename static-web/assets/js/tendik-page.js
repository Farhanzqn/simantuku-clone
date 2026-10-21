import {request,query} from './api.js';
import {filterBar} from './filter-bar.js';
import {panel,render,table,plot,error} from './ui.js';
const root=document.getElementById('page-content');
async function boot(){
  root.replaceChildren();const f=await filterBar(root,{academic:true,report:true,jenjang:true,prodi:true});
  const graph=panel('tendik-chart','Tenaga Kependidikan per Program Studi'),detail=panel('tendik-table','Rincian Tendik per Program Studi');root.append(graph,detail);
  const load=()=>{
    const data=request('/dashboard/tendik'+query(f.collect()));
    return Promise.all([
      render(graph,()=>data,r=>plot(graph,r.data.map(x=>x.prodi_nama),[{label:'Laki-laki',data:r.data.map(x=>x.laki)},{label:'Perempuan',data:r.data.map(x=>x.perempuan)}]),f.context()),
      render(detail,()=>data,r=>table(detail,[{label:'Program studi',key:'prodi_nama'},{label:'Jenjang',key:'jenjang'},{label:'Laki-laki',key:'laki',number:true},{label:'Perempuan',key:'perempuan',number:true},{label:'Total',value:x=>x.laki===null||x.perempuan===null?null:Number(x.laki)+Number(x.perempuan),number:true}],r.data),f.context())
    ]);
  };
  f.form.addEventListener('change',load);f.form.addEventListener('submit',e=>{e.preventDefault();load();});await load();
}
boot().catch(e=>{const p=panel('tendik-error','Statistik Tendik');root.append(p);error(p,e);});
