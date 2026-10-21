import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function bulkVerificationUiCases(t,{owner,base,users,password,call,evaluate,wait,goto,login,set,capture}){
 await t.test('Verifikasi massal Edge: filter, konfirmasi, four-eyes, konflik, double klik dan reflow 1440/360',async()=>{
  const report=(await owner.query("INSERT INTO periode_laporan(kode,tahun,semester,mulai,selesai,urutan) SELECT $1,coalesce(max(tahun) FILTER(WHERE tahun>=2099),2098)+1,'S1','2099-01-01','2099-06-30',max(urutan)+1 FROM periode_laporan RETURNING id",['bulk-ui-'+randomUUID()])).rows[0].id;
  const indicator=(await owner.query('SELECT id FROM kpi_indikator ORDER BY id LIMIT 1')).rows[0].id;
  const client=async user=>{let cookie='',csrf;const request=async(path,method='GET',body)=>{const r=await fetch(base+'/api'+path,{method,headers:{cookie,...(method!=='GET'?{'content-type':'application/json','x-csrf-token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const payload=await r.json();assert.equal(r.status,method==='POST'&&path==='/data/kpi-input'?201:200,JSON.stringify(payload));return payload.data;};csrf=(await request('/auth/csrf')).csrf;csrf=(await request('/auth/login','POST',{email:user.email,password})).csrf;return request;};
  const admin=await client(users[4]),prp=await client(users[3]);
  const create=async(request=admin)=>{let row=await request('/data/kpi-input','POST',{periode_laporan_id:report,indikator_id:indicator,kode_input:randomUUID(),nilai_numerik:11,satuan:'uji',tanggal_snapshot:'2099-06-30'});return request('/data/kpi-input/'+row.id+'/submit','POST',{row_version:row.row_version});};
  try{
   const rows=[await create(),await create(),await create()],own=await create(prp);
   await call('Network.clearBrowserCookies');await goto('/login.html?next=%2Fverifikasi.html');await login(users[3],password);await goto('/verifikasi.html');await wait("document.querySelector('#review-queue')?.dataset.state==='ready'");
   await set('domain','kpi-input');await set('unit_id',String(rows[0].unit_id));await set('periode_laporan_id',String(report));await wait("document.querySelectorAll('#review-queue tbody tr').length===4 && !document.querySelector('#approve-all').disabled");
   await evaluate("document.querySelector('#approve-all').click()");assert.match(await evaluate("document.querySelector('#bulk-confirmation').textContent"),/3 item/);assert.ok(!(await evaluate("document.querySelector('#bulk-confirmation').textContent")).includes('4 item'));
   assert.equal(await evaluate('document.activeElement.textContent'),'Batal');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait("!document.querySelector('#bulk-confirmation')");
   await evaluate("document.querySelector('#approve-all').click()");
   for(const width of [1440,360]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===360});
    const appearance=await evaluate(`(()=>{const b=[...document.querySelectorAll('.bulk-actions button,.bulk-dialog button')],rgb=s=>s.match(/[\\d.]+/g).slice(0,3).map(Number),lum=c=>rgb(c).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);return {overflow:document.documentElement.scrollWidth>innerWidth,dialogOverflow:document.querySelector('dialog').scrollWidth>document.querySelector('dialog').clientWidth,height:Math.min(...b.map(x=>x.getBoundingClientRect().height)),contrast:Math.min(...b.map(x=>{const s=getComputedStyle(x),a=lum(s.color),c=lum(s.backgroundColor);return (Math.max(a,c)+.05)/(Math.min(a,c)+.05)}))};})()`);
    assert.equal(appearance.overflow,false);assert.equal(appearance.dialogOverflow,false);assert.ok(appearance.height>=48);assert.ok(appearance.contrast>=4.5,JSON.stringify(appearance));await capture('bulk-confirm-'+width);
   }
   await admin('/verification/kpi-input/'+rows[1].id+'/reject','POST',{row_version:rows[1].row_version,review_note:'Berubah saat konfirmasi'});
   await evaluate("window.bulkRealFetch=window.fetch;window.bulkCalls=0;window.fetch=async(...args)=>{if(String(args[0]).includes('/verification/bulk-')){window.bulkCalls++;await new Promise(r=>setTimeout(r,200));}return window.bulkRealFetch(...args);};document.querySelector('#bulk-confirm').click();document.querySelector('#bulk-confirm').click()");
   assert.equal(await evaluate("document.querySelector('#approve-all').disabled&&document.querySelector('#reject-all').disabled&&document.querySelector('#bulk-confirm').disabled"),true);
   await wait("!document.querySelector('#bulk-confirmation') && document.querySelector('#bulk-result').dataset.state==='ready'");assert.equal(await evaluate('window.bulkCalls'),1);await evaluate('window.fetch=window.bulkRealFetch');
   assert.match(await evaluate("document.querySelector('#bulk-result .panel-meta').textContent"),/Berhasil 2, dilewati 1, gagal 0/);assert.match(await evaluate("document.querySelector('#bulk-result').textContent"),/Status bukan lagi submitted/);await wait("document.querySelector('#approve-all').disabled && document.querySelectorAll('#review-queue tbody tr').length===1");
   assert.equal((await owner.query('SELECT status FROM kpi_input WHERE id=$1',[own.id])).rows[0].status,'submitted');
   await create();await create();await evaluate("[...document.querySelectorAll('.filters button')].find(x=>x.textContent==='Muat ulang').click()");await wait("!document.querySelector('#reject-all').disabled");await evaluate("document.querySelector('#reject-all').click()");assert.equal(await evaluate("document.querySelector('#bulk-reason').required"),true);
   await evaluate("document.querySelector('#bulk-confirm').click()");assert.ok(await evaluate("!!document.querySelector('#bulk-confirmation')"));await evaluate("document.querySelector('#bulk-reason').value='   ';document.querySelector('#bulk-confirm').click()");assert.equal(await evaluate("document.querySelector('#bulk-reason').validity.valid"),false);
   await evaluate("document.querySelector('#bulk-reason').value='Sumber perlu diperiksa';document.querySelector('#bulk-reason').dispatchEvent(new Event('input'));document.querySelector('#bulk-confirm').click()");await wait("!document.querySelector('#bulk-confirmation') && document.querySelector('#bulk-result .panel-meta').textContent.includes('Berhasil 2, dilewati 0, gagal 0')");
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('bulk-result-360');
   await set('domain','dosen');await wait("document.querySelector('#review-queue').dataset.state==='empty'");assert.equal(await evaluate("document.querySelector('#approve-all').disabled&&document.querySelector('#reject-all').disabled"),true);
  }finally{
   await owner.query('DELETE FROM kpi_input WHERE periode_laporan_id=$1',[report]);await owner.query('DELETE FROM periode_laporan WHERE id=$1',[report]);await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  }
 });
}
