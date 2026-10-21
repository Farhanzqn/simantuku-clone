import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function homeSummaryUiCases(t,{owner,base,users,password,call,evaluate,wait,goto,ready,login,capture}){
 await t.test('Beranda: delapan kartu sesuai API, publik/login, skeleton, error/retry dan reduced motion',async()=>{
  await call('Network.clearBrowserCookies');await goto('/');await ready('dashboard-status');
  const actual=await evaluate(`(async()=>{
   const get=async path=>(await(await fetch('/api/dashboard/'+path)).json());
   const [s,p,a,t,m]=await Promise.all(['summary','prodi','akreditasi','tendik-total','pmb-peminat'].map(get));
   const fmt=n=>n===null?'-':new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(n);
   return {shown:[...document.querySelectorAll('.home-card-value')].map(e=>e.textContent),expected:[fmt(s.data.dosen.total),fmt(s.data.mahasiswa.total),fmt(p.data.length),fmt(t.data.total),fmt(m.data.total),fmt(s.data.lulusan.total),fmt(a.meta.prodi.filter(p=>p.peringkat?.trim()).length),a.meta.institusi[0]?.peringkat??'-'],tendikKeys:Object.keys(t.data)};
  })()`);
  assert.deepEqual(actual.shown,actual.expected);assert.deepEqual(actual.tendikKeys,['total']);
  assert.equal(await evaluate("[...document.querySelectorAll('.home-card')].every(e=>getComputedStyle(e).backgroundImage.includes('linear-gradient')&&getComputedStyle(e.querySelector('.home-kpi-icon')).width==='36px'&&e.querySelector('.home-card-period').getBoundingClientRect().bottom<=e.querySelector('.home-card-value').getBoundingClientRect().top)"),true,'Original gradient, icon size and period before value');
  for(const route of ['tendik','pegawai-internal','formasi','pegawai-formasi','pegawai-pergerakan'])assert.equal((await fetch(base+'/api/dashboard/'+route)).status,401);
  const anonymousCards=actual.shown;
  await goto('/login.html');await login(users[0],password);await goto('/');await ready('dashboard-status');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.home-card-value')].map(e=>e.textContent)"),anonymousCards,'The amended visibility decision gives the same eight cards after login');
  await call('Network.clearBrowserCookies');await goto('/');await ready('dashboard-status');
  await evaluate("window.homeFetch=window.fetch;window.fetch=(...args)=>new Promise(r=>setTimeout(r,800)).then(()=>window.homeFetch(...args));document.querySelector('#dashboard-retry').click()");
  await wait("document.querySelector('.home-card').dataset.state==='loading'");
  assert.equal(await evaluate("document.querySelector('#dashboard-cards').getAttribute('aria-busy')"),'true');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.home-card-value')).animationName"),'home-skeleton');
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.home-card-value')).animationName"),'none');
  await call('Emulation.setEmulatedMedia',{features:[]});
  await ready('dashboard-status');await evaluate('window.fetch=window.homeFetch');
  await evaluate("window.fetch=(...args)=>String(args[0]).includes('/tendik-total')?Promise.reject(new TypeError('Offline')):window.homeFetch(...args);document.querySelector('#dashboard-retry').click()");
  await wait("document.querySelector('[data-card=tendik]').dataset.state==='error'");
  assert.equal(await evaluate("document.querySelector('[data-card=tendik] .home-card-value').textContent"),'-');
  assert.equal(await evaluate("document.querySelector('[data-card=dosen]').dataset.state"),'ready');
  assert.match(await evaluate("document.querySelector('#dashboard-status').textContent"),/Sebagian data/);
  await evaluate("window.fetch=window.homeFetch;document.querySelector('#dashboard-retry').focus()");
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await ready('dashboard-status');
  assert.equal(await evaluate("document.activeElement.id"),'dashboard-retry');
  await evaluate("window.fetch=(...args)=>Promise.reject(new TypeError('Offline'));document.querySelector('#dashboard-retry').click()");await wait("document.querySelectorAll('.home-card[data-state=error]').length===8");
  assert.equal(await evaluate("[...document.querySelectorAll('.home-card-value')].every(e=>e.textContent==='-')"),true);
  await evaluate("window.fetch=window.homeFetch;document.querySelector('#dashboard-retry').click()");await ready('dashboard-status');
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate("[...document.querySelectorAll('.home-card')].every(e=>getComputedStyle(e).animationName==='none'&&getComputedStyle(e).transitionDuration==='0s'&&getComputedStyle(e).transform==='none')"),true);
  await call('Emulation.setEmulatedMedia',{features:[]});
  const contrast=await evaluate(`(()=>{
   const luminance=c=>{const rgb=(c.trim().startsWith('#')?c.trim().slice(1).match(/../g).map(n=>parseInt(n,16)):c.match(/[\\d.]+/g).slice(0,3).map(Number)).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
   const ratio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   return Math.min(...[...document.querySelectorAll('.home-card h2,.home-card-value,.home-card-note,.home-card-source')].map(e=>ratio(luminance(getComputedStyle(e).color),luminance(getComputedStyle(e.closest('.home-card')).getPropertyValue('--card-soft')))));
  })()`);assert.ok(contrast>=4.5,'Card contrast '+contrast);t.diagnostic('Home card text contrast minimum '+contrast.toFixed(2)+':1');
 });
 await t.test('PPA: form Peminat satu baris institusi, sumber approved, tanpa tulis saat dibuka',async()=>{
  const before=JSON.stringify((await owner.query('SELECT * FROM pmb_peminat ORDER BY id')).rows);
  await goto('/login.html');await login(users[5],password);await goto('/input/ppa.html');
  await wait("!!document.querySelector('[data-domain=pmb-peminat]')");await evaluate("document.querySelector('[data-domain=pmb-peminat]').click()");
  await wait("document.querySelectorAll('#entry-table tbody tr').length===1&&document.querySelector('[data-field=jumlah_peminat]')?.value==='21172'");
  assert.match(await evaluate("document.querySelector('#entry-table').textContent"),/Institusi ITPLN/);
  assert.equal(await evaluate("document.querySelector('[name=academic] option:checked').textContent.includes('20261')"),true);
  assert.equal(JSON.stringify((await owner.query('SELECT * FROM pmb_peminat ORDER BY id')).rows),before);
  for(const width of [1440,360]){await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===360});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('peminat-form-'+width);}
  await call('Network.clearBrowserCookies');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 });
 await t.test('Beranda: akreditasi institusi NULL dan approved melalui workflow _test',async()=>{
  const report=(await owner.query("INSERT INTO periode_laporan(kode,tahun,semester,mulai,selesai,urutan) VALUES($1,2199,'S1','2199-01-01','2199-06-30',(SELECT max(urutan)+1 FROM periode_laporan)) RETURNING id",['home-'+randomUUID()])).rows[0].id;
  const path='/?periode_laporan_id='+report,rank='Peringkat uji '+randomUUID().slice(0,6);
  const institution=()=>evaluate("document.querySelector('[data-card=akreditasi_institusi] .home-card-value').textContent");
  const api=async(path,body)=>evaluate(`import('/assets/js/api.js').then(m=>m.request(${JSON.stringify(path)},{method:'POST',body:${JSON.stringify(body)}})).then(r=>r.data)`);
  try{
   await call('Network.clearBrowserCookies');await goto(path);await ready('dashboard-status');assert.equal(await institution(),'-');
   assert.equal(await evaluate("document.querySelector('[data-card=tendik] .home-card-value').textContent"),'-');
   await goto('/login.html');await login(users[4],password);
   let row=await api('/data/akreditasi',{periode_laporan_id:report,butir:'institusi',cakupan:'institusi',nama_sumber:'ITPLN',peringkat:rank,nomor_sk:'SK uji',berlaku_mulai:'2199-01-01',berlaku_sampai:'2200-06-30'});
   assert.equal(row.status,'draft');
   await goto(path);await ready('dashboard-status');assert.equal(await institution(),'-');
   row=await api('/data/akreditasi/'+row.id+'/submit',{row_version:row.row_version});assert.equal(row.status,'submitted');
   await call('Network.clearBrowserCookies');await goto(path);await ready('dashboard-status');assert.equal(await institution(),'-');
   await goto('/login.html');await login(users[3],password);
   row=await api('/verification/akreditasi/'+row.id+'/approve',{row_version:row.row_version,review_note:'Fixture kartu beranda'});assert.equal(row.status,'approved');
   await call('Network.clearBrowserCookies');await goto(path);await ready('dashboard-status');assert.equal(await institution(),rank);
   const note=await evaluate("document.querySelector('[data-card=akreditasi_institusi] .home-card-note').textContent");assert.match(note,/2199/);assert.match(note,/2200/);
   for(const width of [1440,360]){await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===360});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('home-institution-approved-'+width);}
  }finally{await owner.query('DELETE FROM akreditasi_revisi WHERE periode_laporan_id=$1',[report]);await owner.query('DELETE FROM periode_laporan WHERE id=$1',[report]);await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await call('Network.clearBrowserCookies');}
 });
}
