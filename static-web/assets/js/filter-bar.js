import {request,period} from './api.js';
import {el} from './ui.js';
export function selectedValue(params,key,options,fallback=''){
 const value=params.get(key);return options.some(([v])=>String(v)===value)?value:String(fallback??'');
}
export async function filterBar(root,definitions){
 const config=Array.isArray(definitions)?Object.fromEntries(definitions.map(k=>[k,true])):definitions;
 const [a,l,p]=await Promise.all([request('/master/periode-akademik'),request('/master/periode-laporan'),request('/master/prodi')]);
 const form=el('form',null,'filters'),values={},params=new URLSearchParams(location.search);
 const add=(key,label,options,initial)=>{const wrap=el('label',label),select=el('select');select.name=key;for(const [v,text]of options)select.append(new Option(text,v));select.value=selectedValue(params,key,options,initial??options[0]?.[0]);wrap.append(select);form.append(wrap);values[key]=select;};
 if(config.academic)add('periode_akademik_id','Periode akademik',a.data.map(r=>[r.id,r.semester+' '+r.tahun_ajaran]),config.latestAcademic?[...a.data].sort((x,y)=>y.urutan-x.urutan)[0]?.id:a.data.find(r=>r.aktif)?.id??a.data[0]?.id);
 if(config.report)add('periode_laporan_id','Periode laporan',[...(config.allReport?[['','Semua laporan']]:[]),...l.data.map(r=>[r.id,period(r)])],config.allReport?'':l.data.find(r=>r.aktif)?.id??l.data[0]?.id);
 if(config.status)add('status','Status mahasiswa',[['aktif','Aktif'],['cuti','Cuti'],['nonaktif','Nonaktif']],'aktif');
 if(config.jenjang)add('jenjang','Jenjang',[['','Semua jenjang'],...[...new Set(p.data.map(r=>r.jenjang))].map(j=>[j,j==='PROFESI'?'Profesi':j])]);
 if(config.prodi)add('prodi_id','Program studi',[['','Semua prodi'],...p.data.map(r=>[r.id,r.nama])]);
 // Fakultas muncul hanya setelah master menyediakan pemetaan nyata.
 if(config.fakultas&&p.data.some(r=>r.fakultas))add('fakultas','Fakultas',[['','Semua fakultas'],...[...new Set(p.data.map(r=>r.fakultas).filter(Boolean))].map(v=>[v,v])]);
 if(config.year)add('tahun','Tahun',[['','Semua tahun'],...[...new Set(l.data.map(r=>r.tahun))].sort((x,y)=>y-x).map(y=>[y,y])]);
 if(config.angkatan){const rows=(await request('/dashboard/mahasiswa-angkatan')).data;add('angkatan','Angkatan',[['','Semua angkatan'],...[...new Set(rows.map(r=>r.angkatan))].sort((x,y)=>y-x).map(y=>[y,y])]);}
 if(config.type)add('tipe','Tipe grafik',[['bar','Kolom'],['line','Garis'],['horizontal','Bar'],['donut','Donut'],['area','Area']],'bar');
 for(const filter of config.custom??[])add(filter.key,filter.label,filter.options,filter.initial);
 const button=el('button','Muat ulang','button');button.type='submit';form.append(button);const hero=root.closest('.page-main')?.querySelector('.section-hero');(hero??root).append(form);
 const collect=()=>Object.fromEntries(Object.entries(values).filter(([k])=>k!=='tipe').map(([k,v])=>[k,v.value]));
 const persist=()=>{const url=new URL(location.href);for(const [k,v]of Object.entries(values)){if(v.value)url.searchParams.set(k,v.value);else url.searchParams.delete(k);}history.replaceState(null,'',url.pathname+url.search+url.hash);};
 form.addEventListener('change',persist);form.addEventListener('submit',persist);
 window.addEventListener('popstate',()=>{const search=new URLSearchParams(location.search);for(const [k,v]of Object.entries(values))v.value=selectedValue(search,k,[...v.options].map(o=>[o.value,o.text]),v.options[0]?.value);form.dispatchEvent(new Event('change'));});
 const context=()=>{const v=collect(),academic=a.data.find(r=>String(r.id)===v.periode_akademik_id),report=l.data.find(r=>String(r.id)===v.periode_laporan_id);return [academic?academic.semester+' '+academic.tahun_ajaran:'',report?period(report):''].filter(Boolean).join(' · ');};
 return {form,values,collect,context,type:()=>values.tipe?.value??'bar',prodi:p.data};
}
