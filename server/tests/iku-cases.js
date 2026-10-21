import assert from 'node:assert/strict';
import {seedIku} from '../../db/scripts/seed-pimpinan.js';
export async function ikuCases(t,{owner,base,anonymous,prp,baa,admin,viewer,report}){
 await t.test('IKU: seed tepat 19 numeric, hierarki, sumber, flags dan ledger idempotent',async()=>{
  const rows=(await owner.query("SELECT * FROM v_dashboard_iku WHERE tahun=2026 AND periode='T2' ORDER BY urutan")).rows;
  assert.equal(rows.length,19);assert.equal(rows.filter(x=>x.perlu_verifikasi).length,4);
  const by=code=>rows.find(x=>x.kode===code);
  for(const [code,percent]of [['IKU 1',94.1],['IKU 1 b.',195.6],['IKU 12',66.7]])assert.equal(Number(Number(by(code).persen_capaian).toFixed(1)),percent);
  assert.equal(by('IKU 3').realisasi,'0.905');assert.equal(Number(by('Sub IKU 9.2.3').realisasi),0);
  assert.deepEqual(rows.filter(x=>x.perlu_verifikasi).map(x=>x.kode),['IKU 1 b.','IKU 3','Sub IKU 9.1','Sub IKU 9.2']);
  assert.equal(by('Sub IKU 9.2.1').induk_id,by('Sub IKU 9.2').indikator_id);
  assert.ok(rows.every(x=>x.sumber==='iku.kemdiktisaintek.go.id T2 2026'&&x.status_sumber==='Sudah Diajukan'));
  const before=(await owner.query('SELECT * FROM iku_capaian ORDER BY id')).rows;await seedIku(owner);assert.deepEqual((await owner.query('SELECT * FROM iku_capaian ORDER BY id')).rows,before);
  assert.equal((await owner.query("SELECT perlu_verifikasi FROM definisi_formulir WHERE domain='iku-capaian'")).rows[0].perlu_verifikasi,true);
 });
 await t.test('Dashboard Pimpinan: IKU/KPI privat, akreditasi publik dan URL lama redirect',async()=>{
  for(const path of ['/dashboard/iku','/dashboard/kpi'])assert.equal((await anonymous.call(path)).status,401);
  assert.equal((await anonymous.call('/dashboard/akreditasi')).status,200);
  for(const path of ['/monitoring-iku.html','/monitoring-kpi.html','/monitoring-%69ku.html','/MONITORING-KPI.HTML']){
   const json=await fetch(base+path,{redirect:'manual'});assert.equal(json.status,401);assert.equal(json.headers.get('cache-control'),'no-store');
   const html=await fetch(base+path,{redirect:'manual',headers:{accept:'text/html'}});assert.equal(html.status,302);assert.match(html.headers.get('location'),/^\/login.html\?next=/);
  }
  for(const path of ['/capaian-iku-universitas.html','/capaian-iku-fakultas.html','/capaian-%69ku-universitas.html']){const r=await fetch(base+path+'?tahun=2026',{redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/monitoring-kpi.html?tahun=2026');}
  assert.equal((await viewer.call('/dashboard/iku?tahun=2026&periode=T2')).body.data.length,19);
  assert.equal((await viewer.call('/dashboard/iku?periode=T5')).status,422);
  assert.deepEqual((await viewer.call('/dashboard/iku?tahun=2000&periode=T1')).body.data,[]);
  // requireLogin cannot be weakened by changing policy visibility.
  await owner.query("UPDATE visibilitas_modul SET akses='public' WHERE kode_modul='iku'");
  try{assert.equal((await anonymous.call('/dashboard/iku')).status,401);}finally{await owner.query("UPDATE visibilitas_modul SET akses='authenticated' WHERE kode_modul='iku'");}
 });
 await t.test('IKU: PRP workflow, four-eyes, rejected, revisi berversi, approved-only dan audit',async()=>{
  const indicator=(await owner.query("SELECT id FROM iku_indikator WHERE kode='IKU 1'")).rows[0].id;
  const values={periode_laporan_id:report,tahun:2099,periode:'T2',indikator_id:indicator,baseline:65.36,target:69.48,realisasi:65.36,status_sumber:'Sudah Diajukan',catatan_verifikasi:'Konfirmasi PRP'};
  anonymous.csrf=(await anonymous.call('/auth/csrf')).body.data.csrf;
  assert.equal((await anonymous.call('/data/iku-capaian','POST',values)).status,401);
  assert.equal((await baa.call('/data/iku-capaian','POST',values)).status,403);
  assert.equal((await viewer.call('/data/iku-capaian','POST',values)).status,403);
  assert.equal((await prp.call('/data/iku-capaian','POST',values,false)).status,403);
  assert.equal((await prp.call('/data/iku-capaian','POST',{...values,perlu_verifikasi:false})).status,422);
  assert.equal((await prp.call('/data/iku-capaian','POST',{...values,indikator_id:'999999999'})).status,422);
  const created=await prp.call('/data/iku-capaian','POST',values);assert.equal(created.status,201);let row=created.body.data;
  const dashboard=()=>viewer.call('/dashboard/iku?tahun=2099&periode=T2');
  assert.deepEqual((await dashboard()).body.data,[]);
  row=(await prp.call(`/data/iku-capaian/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;
  assert.equal(row.status,'submitted');assert.deepEqual((await dashboard()).body.data,[]);
  assert.equal((await prp.call(`/verification/iku-capaian/${row.id}/approve`,'POST',{row_version:row.row_version})).status,403);
  assert.equal((await prp.call(`/data/iku-capaian/${row.id}`,'PATCH',{row_version:row.row_version,realisasi:99})).status,409);
  row=(await admin.call(`/verification/iku-capaian/${row.id}/reject`,'POST',{row_version:row.row_version,review_note:'Periksa sumber'})).body.data;
  assert.equal(row.status,'rejected');assert.deepEqual((await dashboard()).body.data,[]);
  row=(await prp.call(`/data/iku-capaian/${row.id}`,'PATCH',{row_version:row.row_version,realisasi:70})).body.data;
  row=(await prp.call(`/data/iku-capaian/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;
  row=(await admin.call(`/verification/iku-capaian/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;
  assert.equal(row.status,'approved');assert.equal((await dashboard()).body.meta.ringkasan.mencapai,1);
  assert.equal((await prp.call(`/data/iku-capaian/${row.id}`,'PATCH',{row_version:row.row_version,realisasi:999})).status,409);
  let revision=(await prp.call(`/data/iku-capaian/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;
  assert.equal(revision.versi,2);assert.equal(revision.previous_approved_id,row.id);
  revision=(await prp.call(`/data/iku-capaian/${revision.id}`,'PATCH',{row_version:revision.row_version,realisasi:1,target:0,catatan_verifikasi:null})).body.data;
  assert.equal(Number((await dashboard()).body.data[0].realisasi),70);
  revision=(await prp.call(`/data/iku-capaian/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;
  revision=(await admin.call(`/verification/iku-capaian/${revision.id}/approve`,'POST',{row_version:revision.row_version})).body.data;
  assert.equal(revision.status,'approved');const published=(await dashboard()).body;assert.equal(published.data.length,1);assert.equal(published.data[0].persen_capaian,null);assert.equal(published.data[0].perlu_verifikasi,false);assert.equal(published.meta.ringkasan.tanpa_rasio,1);
  const history=(await owner.query('SELECT status,is_current_approved,realisasi FROM iku_capaian WHERE id=$1',[row.id])).rows[0];assert.equal(history.status,'approved');assert.equal(history.is_current_approved,false);assert.equal(Number(history.realisasi),70);
  const audit=(await owner.query("SELECT aksi FROM audit_log WHERE tabel='iku_capaian' AND row_id=$1",[revision.id])).rows;assert.ok(audit.some(x=>x.aksi==='approve'));
  let own=(await admin.call('/data/iku-capaian','POST',{...values,periode:'T3'})).body.data;
  own=(await admin.call(`/data/iku-capaian/${own.id}/submit`,'POST',{row_version:own.row_version})).body.data;
  assert.equal((await admin.call(`/verification/iku-capaian/${own.id}/approve`,'POST',{row_version:own.row_version})).status,403);
  assert.equal((await admin.call(`/verification/iku-capaian/${own.id}/approve`,'POST',{row_version:own.row_version,override:true})).status,403);
  assert.equal((await admin.call(`/verification/iku-capaian/${own.id}/approve`,'POST',{row_version:own.row_version,override:true,override_reason:'Pengecualian tes terotorisasi'})).status,200);
  assert.ok((await owner.query("SELECT 1 FROM audit_log WHERE tabel='iku_capaian' AND row_id=$1 AND aksi='approve_override' AND is_override AND override_reason IS NOT NULL",[own.id])).rows.length);
 });
}
