import {filterBar} from './filter-bar.js';
import {cohortNote} from './student-summary.js';
﻿import {difference,request,format,sum,period,query,date} from './api.js';
import {el,link,panel,render,plot,metadata,empty,error,state} from './ui.js';
export async function home(root){
 const status=el('p','Memuat data ITPLN…','home-status');status.id='dashboard-status';status.setAttribute('role','status');const retry=el('button','Muat ulang data','home-retry');retry.id='dashboard-retry';retry.type='button';const bar=el('div',null,'home-toolbar');bar.append(status,retry);
 const grid=el('section',null,'home-cards');grid.id='dashboard-cards';grid.setAttribute('aria-label','Ringkasan statistik ITPLN');const cards=[['dosen','Dosen','BSDM'],['mahasiswa','Mahasiswa aktif','BAA'],['prodi','Program Studi','master'],['tendik','Tenaga kependidikan','BSDM'],['pmb_peminat','Peminat PMB','PPA'],['lulusan','Lulusan institusi','BAA'],['prodi_terakreditasi','Prodi terakreditasi','PJM'],['akreditasi_institusi','Akreditasi institusi','PJM']];
 for(const [key,title]of cards){const c=el('article',null,'home-card');c.dataset.card=key;c.dataset.state='loading';c.append(el('h2',title),el('p','Memuat periode…','home-card-period'),el('p','-','home-card-value'),el('p','Memuat data…','home-card-note'),el('p','Memuat sumber…','home-card-source'));c.append(kpiIcon(key));grid.append(c);}root.append(grid,bar);
 const clusterConfig=[['mahasiswa','Akademik','Mahasiswa','Sebaran mahasiswa menurut angkatan, jenjang dan status.','/statistik-mahasiswa.html'],['dosen','SDM','Dosen','Komposisi dosen menurut status, jabatan fungsional dan pendidikan.','/statistik-dosen.html']];
 const clusters=clusterConfig.map(([id,tag,title,description,href])=>{const section=el('section',null,'home-cluster'),header=el('header',null,'home-cluster-header'),intro=el('div'),heading=el('h2',title,'section-title'),actions=el('div',null,'home-cluster-actions'),count=el('span','Memuat grafik...','badge'),detail=link('Lihat detail \u2192',href),grid=el('div',null,'panel-grid');section.id='klaster-'+id;heading.id=section.id+'-title';section.setAttribute('aria-labelledby',heading.id);count.classList.add('home-cluster-count');intro.append(el('p',tag,'home-cluster-tag'),heading,el('p',description,'home-cluster-description'));actions.append(count,detail);header.append(intro,actions);section.append(header,grid);root.append(section);document.getElementById('home-quick-links')?.append(link(title+' \u2192','#'+section.id));return {section,grid,count};});
 const [mg,dg]=clusters.map(c=>c.grid);
 const clusterBadge=document.getElementById('home-cluster-badge'),chartBadge=document.getElementById('home-chart-badge'),periodBadge=document.getElementById('home-period-badge');
 if(clusterBadge)clusterBadge.textContent=clusters.length+' klaster';
 const updateCounts=()=>{if(chartBadge)chartBadge.textContent=root.querySelectorAll('canvas').length+' grafik tersedia';for(const c of clusters)c.count.textContent=c.grid.querySelectorAll('canvas').length+' grafik \u00b7 '+c.grid.children.length+' panel';};
 const panels={};for(const [id,title,group]of [['angkatan','Mahasiswa per Angkatan',mg],['jenjang','Sebaran Mahasiswa per Jenjang',mg],['status','Komposisi Status Mahasiswa',mg],['mahasiswa-fakultas','Mahasiswa per Fakultas',mg],['tren','Tren Tahunan Mahasiswa',mg],['pegawai','Dosen Tetap dan Tidak Tetap',dg],['jafung','Jabatan Fungsional Dosen',dg],['pendidikan','Pendidikan Dosen',dg],['dosen-fakultas','Dosen per Fakultas',dg]]){panels[id]=panel(id,title);group.append(panels[id]);}
 panels.pendidikan.qualityNotes=false;panels['dosen-fakultas'].qualityNotes=false;
 const group=(rows,key,value)=>{const map=new Map();for(const row of rows)map.set(row[key],row[value]===null?(map.get(row[key])??null):(map.get(row[key])??0)+Number(row[value]));return [...map.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0])));};
 let filters;try{filters=await filterBar(document.getElementById('home-filter-slot')??root,{report:true,allReport:true});}catch(e){
  status.dataset.state='error';status.textContent='Data belum dapat dimuat. Silakan coba lagi.';if(periodBadge)periodBadge.textContent='Periode data belum tersedia';
  for(const c of grid.children){c.dataset.state='error';c.querySelector('.home-card-period').textContent='Data tidak tersedia';c.querySelector('.home-card-note').textContent='Data belum dapat ditampilkan.';c.querySelector('.home-card-source').textContent='Sumber belum dapat dimuat.';}
  for(const p of Object.values(panels))error(p,e);updateCounts();retry.addEventListener('click',()=>location.reload());throw e;
 }
 let sequence=0;
 async function load(){const restoreRetryFocus=document.activeElement===retry,current=++sequence;if(periodBadge)periodBadge.textContent='Memuat periode data...';if(chartBadge)chartBadge.textContent='Memuat grafik...';for(const c of clusters){c.count.textContent='Memuat grafik...';for(const p of c.grid.children)state(p,'loading','Memuat data...');}retry.disabled=true;grid.setAttribute('aria-busy','true');status.dataset.state='loading';status.textContent='Memuat data ITPLN…';for(const c of grid.children){c.dataset.state='loading';c.querySelector('.home-card-value').textContent='-';c.querySelector('.home-card-period').textContent='Memuat periode…';c.querySelector('.home-card-note').textContent='Memuat data…';c.querySelector('.home-card-source').textContent='Memuat sumber…';}
 const selected=filters.collect(),summary=request('/dashboard/summary'+query(selected));
 const totals=(async()=>{
  const results=await Promise.allSettled([summary,request('/dashboard/prodi'+query(selected)),request('/dashboard/akreditasi'+query({periode_laporan_id:selected.periode_laporan_id})),request('/dashboard/tendik-total'+query(selected)),request('/dashboard/pmb-peminat'+query(selected))]);
  if(current!==sequence)return;
  const rows={},failed=new Set();
  if(results[0].status==='fulfilled'){
   Object.assign(rows,results[0].value.data);
   const periods=Object.values(results[0].value.data).filter(r=>r.total!==null).map(r=>r.periode_laporan_kode).filter(Boolean).sort();
   if(periodBadge)periodBadge.textContent=periods.length?'Periode data '+periods.at(-1):'Periode data belum tersedia';
  }else{for(const key of ['dosen','mahasiswa','lulusan'])failed.add(key);if(periodBadge)periodBadge.textContent='Periode data belum tersedia';}
  if(results[1].status==='fulfilled')rows.prodi={total:results[1].value.data.length,sumber:'Master program studi aktif'};else failed.add('prodi');
  if(results[2].status==='fulfilled'){
   const {data,meta}=results[2].value,ranked=meta.prodi.filter(p=>p.peringkat?.trim()),institution=meta.institusi[0];
   const report=data[0]?.periode_laporan_kode;
   rows.prodi_terakreditasi={total:data.some(p=>p.cakupan==='prodi')?ranked.length:null,periode_laporan_kode:report,sumber:'Akreditasi publik PJM'};
   rows.akreditasi_institusi={...institution,total:institution?.peringkat?.trim()||null,periode_laporan_kode:report};
  }else{failed.add('prodi_terakreditasi');failed.add('akreditasi_institusi');}
  if(results[3].status==='fulfilled')rows.tendik={total:results[3].value.data.total,sumber:'Ringkasan institusi BSDM'};else failed.add('tendik');
  if(results[4].status==='fulfilled')rows.pmb_peminat=results[4].value.data;else failed.add('pmb_peminat');
  let count=0;
  for(const [key,,unit]of cards){
   const c=grid.querySelector('[data-card="'+key+'"]'),row=rows[key]??{total:null},valid=row.total!==null&&row.total!==undefined;
   c.dataset.state=failed.has(key)?'error':valid?'ready':'empty';
   c.querySelector('.home-card-value').textContent=valid?(key==='akreditasi_institusi'?row.total:format(row.total)):'-';
   c.querySelector('.home-card-period').textContent=failed.has(key)?'Data tidak tersedia':key==='prodi'?'Master aktif':key==='tendik'?'Total institusi · sesuai filter':period(row)||'Periode belum tersedia';
   c.querySelector('.home-card-source').textContent=failed.has(key)?'Sumber belum dapat dimuat.':'Sumber: '+(row.sumber??'belum ada data terverifikasi')+(key==='pmb_peminat'&&row.nomor_tabel?' \u00b7 Tabel '+row.nomor_tabel+(row.halaman_cetak?' \u00b7 hlm. '+row.halaman_cetak:''):'');
   let note=!valid?'Belum ada data. Menunggu input '+unit:key==='pmb_peminat'?'Peminat lingkup institusi · Tahun masuk '+row.tahun_masuk:key==='lulusan'?'Cakupan institusi · Tahun lulus '+row.tahun_lulus:key==='mahasiswa'?'Mahasiswa dengan status aktif':key==='dosen'?'Agregat dosen per program studi':key==='prodi'?'Jumlah program studi pada master aktif':key==='tendik'?'Tenaga kependidikan lingkup institusi':key==='prodi_terakreditasi'?'Prodi master dengan peringkat terisi':'Peringkat akreditasi lingkup institusi';
   if(key==='akreditasi_institusi'&&valid)note=row.berlaku_mulai||row.berlaku_sampai?'Masa berlaku: '+(row.berlaku_mulai?date(row.berlaku_mulai):'-')+' — '+(row.berlaku_sampai?date(row.berlaku_sampai):'-'):'Masa berlaku belum tersedia';
   c.querySelector('.home-card-note').textContent=failed.has(key)?'Data belum dapat dimuat. Pilih Muat ulang data.':note;
   if(valid)count++;
  }
  status.dataset.state=failed.size?'error':count?'ready':'empty';
  status.textContent=failed.size?'Sebagian data belum dapat dimuat. Silakan muat ulang data.':count?'Data terverifikasi · Sumber tercantum pada panel statistik':'Belum ada data terverifikasi.';
  retry.disabled=false;grid.setAttribute('aria-busy','false');if(restoreRetryFocus&&document.activeElement===document.body)retry.focus({preventScroll:true});
 })();
 const scoped=(row)=>query({periode_laporan_id:row.periode_laporan_id,periode_akademik_id:row.periode_akademik_id});const students=summary.then(({data})=>request('/dashboard/mahasiswa'+query({periode_laporan_id:data.mahasiswa.periode_laporan_id,periode_akademik_id:data.mahasiswa.periode_akademik_id,status:'aktif'}))),staff=summary.then(({data})=>request('/dashboard/dosen'+scoped(data.dosen)));
 const statuses=summary.then(({data})=>request('/dashboard/mahasiswa'+scoped(data.mahasiswa)));
 const context=(root,r,msg)=>{empty(root,msg);metadata(root,r);};
 await Promise.allSettled([totals,render(panels.angkatan,()=>summary.then(({data})=>request('/dashboard/mahasiswa-angkatan'+scoped(data.mahasiswa))),r=>{const g=group(r.data,'angkatan','total');plot(panels.angkatan,g.map(x=>'Angkatan '+x[0]),[{label:'Mahasiswa aktif',data:g.map(x=>x[1])}]);cohortNote(panels.angkatan,r.meta);}),
 render(panels.jenjang,()=>students,r=>{const g=group(r.data,'jenjang','total');plot(panels.jenjang,g.map(x=>x[0]),[{label:'Mahasiswa',data:g.map(x=>x[1])}],'donut');}),
 render(panels.status,()=>statuses,r=>{const g=group(r.data,'status_mhs','total');plot(panels.status,g.map(x=>x[0]),[{label:'Mahasiswa',data:g.map(x=>x[1])}],'donut');panels.status.querySelector('.panel-content').append(el('p',g.length===1&&g[0][0]==='aktif'?'Hanya status aktif tersedia; data cuti dan nonaktif belum tersedia.':'Status ditampilkan sesuai data terverifikasi.','note'));}),
 render(panels['mahasiswa-fakultas'],()=>students,r=>context(panels['mahasiswa-fakultas'],r,'Menunggu pemetaan prodi ke fakultas.')),
 render(panels.tren,()=>students,r=>context(panels.tren,r,'Menunggu data periode sebelumnya.')),
 render(panels.pegawai,()=>summary.then(({data})=>request('/dashboard/pegawai'+scoped(data.dosen))),r=>plot(panels.pegawai,r.data.map(x=>x.kategori==='dosen_tetap'?'Dosen tetap':'Dosen tidak tetap'),[{label:'Dosen',data:r.data.map(x=>x.jumlah)}],'donut')),
 render(panels.jafung,()=>staff,r=>plot(panels.jafung,['Tenaga pengajar','Asisten ahli','Lektor','Lektor kepala','Guru besar'],[{label:'Dosen',data:['tenaga_pengajar','asisten_ahli','lektor','lektor_kepala','guru_besar'].map(k=>sum(r.data,k))}],'donut')),
 render(panels.pendidikan,()=>staff,r=>plot(panels.pendidikan,['S3','Non-S3'],[{label:'Dosen',data:[sum(r.data,'s3'),difference(r.data,'total','s3')]}],'donut')),
 render(panels['dosen-fakultas'],()=>staff,r=>context(panels['dosen-fakultas'],r,'Menunggu pemetaan prodi ke fakultas.'))]);
 if(current===sequence)updateCounts();
 }
 retry.addEventListener('click',load);filters.form.addEventListener('change',load);filters.form.addEventListener('submit',e=>{e.preventDefault();load();});await load();
}

// Ikon dekoratif lokal; tidak memuat aset atau menjalankan logika data.
function kpiIcon(key){
 const paths={dosen:['M4 4h16v12H4z','M8 20h8M12 16v4M8 8h8M8 12h4'],mahasiswa:['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87'],mahasiswa_baru:['M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M20 7v6M17 10h6'],lulusan:['M1 9l11-6 11 6-11 6z','M5 12v6c4 3 10 3 14 0v-6M23 9v8']};
 Object.assign(paths,{pmb_peminat:paths.mahasiswa_baru,prodi:['M3 21h18M5 21V8l7-5 7 5v13M9 21v-5h6v5M9 10h.01M15 10h.01'],tendik:['M8 8a4 4 0 1 0 8 0 4 4 0 0 0-8 0M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2'],prodi_terakreditasi:['M12 3l7 3v6c0 5-7 9-7 9s-7-4-7-9V6z','M8 12l3 3 5-6'],akreditasi_institusi:['M4 3h16v18H4zM8 7h8M8 11h8','M9 17l2 2 4-4']});
 const wrap=el('span',null,'home-kpi-icon');wrap.setAttribute('aria-hidden','true');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');for(const d of paths[key]){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);}wrap.append(svg);return wrap;
}
