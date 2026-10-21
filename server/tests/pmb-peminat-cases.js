import assert from 'node:assert/strict';
import {seedPeminat} from '../../db/scripts/seed-home-public.js';
export async function peminatCases(t,{owner,pool,anonymous,ppa,baa,prp,report,academic}){
 const path='/dashboard/pmb-peminat?periode_laporan_id='+report;
 const read=async()=>{const r=await anonymous.call(path);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const text=JSON.stringify(r.body);for(const k of ['created_by','approved_by','unit_id','row_version','status','prodi_id'])assert.ok(!text.includes('"'+k+'"'),k);return r.body.data.total;};
 await t.test('Peminat: sumber Tabel 4.1, satu agregat institusi dan seed insert-only',async()=>{
  const source=(await owner.query("SELECT d.*,s.nomor_tabel,s.halaman_pdf,s.halaman_cetak FROM pmb_peminat d JOIN sumber_data s ON s.id=d.sumber_id WHERE d.is_current_approved AND d.tahun_masuk=2026")).rows[0];
  assert.equal(source.jumlah_peminat,21172);assert.equal(source.nomor_tabel,'4.1');assert.equal(source.halaman_pdf,107);assert.equal(source.halaman_cetak,'99');assert.equal(source.versi,1);assert.equal(source.row_version,3);
  const events=(await owner.query("SELECT nilai_baru->>'status' AS status FROM audit_log WHERE tabel='pmb_peminat' AND row_id=$1 ORDER BY id",[source.id])).rows.map(x=>x.status);assert.deepEqual(events,['draft','submitted','approved']);
  const count=(await owner.query('SELECT count(*) AS n FROM audit_log')).rows[0].n;await seedPeminat(owner);assert.equal((await owner.query('SELECT count(*) AS n FROM audit_log')).rows[0].n,count);
  assert.equal((await anonymous.call('/dashboard/pmb-peminat?tahun=2026')).body.data.total,21172);
  assert.equal((await anonymous.call('/dashboard/pmb-peminat?prodi_id=1')).status,422);
  await assert.rejects(pool.query('DELETE FROM pmb_peminat'),{code:'42501'});
 });
 await t.test('Peminat: PPA/CSRF, draft/submitted/reject privat, four-eyes, revisi, NULL dan nol',async()=>{
  assert.equal(await read(),null);
  const body={periode_laporan_id:report,periode_akademik_id:academic,tahun_masuk:2099,tanggal_snapshot:'2099-06-30',jumlah_peminat:42};
  assert.equal((await baa.call('/data/pmb-peminat','POST',body)).status,403);
  assert.equal((await ppa.call('/data/pmb-peminat','POST',body,false)).status,403);
  assert.equal((await ppa.call('/data/pmb-peminat','POST',{...body,prodi_id:1})).status,422);
  assert.equal((await ppa.call('/data/pmb-peminat','POST',{...body,jumlah_peminat:-1})).status,422);
  let r=await ppa.call('/data/pmb-peminat','POST',body);assert.equal(r.status,201);let row=r.body.data;assert.equal(await read(),null);
  row=(await ppa.call(`/data/pmb-peminat/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.equal(await read(),null);
  assert.equal((await ppa.call(`/data/pmb-peminat/${row.id}`,'PATCH',{row_version:row.row_version,jumlah_peminat:99})).status,409);
  assert.equal((await ppa.call(`/verification/pmb-peminat/${row.id}/approve`,'POST',{row_version:row.row_version})).status,403);
  row=(await prp.call(`/verification/pmb-peminat/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;assert.equal(await read(),42);
  let revision=(await ppa.call(`/data/pmb-peminat/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;
  revision=(await ppa.call(`/data/pmb-peminat/${revision.id}`,'PATCH',{row_version:revision.row_version,jumlah_peminat:null})).body.data;
  revision=(await ppa.call(`/data/pmb-peminat/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;assert.equal(await read(),42);
  revision=(await prp.call(`/verification/pmb-peminat/${revision.id}/reject`,'POST',{row_version:revision.row_version,review_note:'Uji sumber belum lengkap'})).body.data;assert.equal(await read(),42);
  revision=(await ppa.call(`/data/pmb-peminat/${revision.id}`,'PATCH',{row_version:revision.row_version,jumlah_peminat:null})).body.data;
  revision=(await ppa.call(`/data/pmb-peminat/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;
  row=(await prp.call(`/verification/pmb-peminat/${revision.id}/approve`,'POST',{row_version:revision.row_version})).body.data;assert.equal(await read(),null);
  revision=(await ppa.call(`/data/pmb-peminat/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;
  revision=(await ppa.call(`/data/pmb-peminat/${revision.id}`,'PATCH',{row_version:revision.row_version,jumlah_peminat:0})).body.data;
  revision=(await ppa.call(`/data/pmb-peminat/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;
  assert.equal((await prp.call(`/verification/pmb-peminat/${revision.id}/approve`,'POST',{row_version:revision.row_version})).status,200);assert.equal(await read(),0);
 });
}
