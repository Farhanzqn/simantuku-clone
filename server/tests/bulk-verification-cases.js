import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {bulkReview} from '../services/bulk-verification.js';

export async function bulkVerificationCases(t,{owner,pool,prp,admin,baa,anonymous,users,report}){
 const domain='kpi-input',filter={domain,periode_laporan_id:String(report)},indicator=(await owner.query('SELECT id FROM kpi_indikator ORDER BY id LIMIT 1')).rows[0].id;
 const item=row=>({domain,id:row.id,row_version:row.row_version});
 async function submitted(client=admin){let r=await client.call('/data/'+domain,'POST',{periode_laporan_id:report,indikator_id:indicator,kode_input:randomUUID(),nilai_numerik:10,satuan:'uji',tanggal_snapshot:'2099-06-30'});assert.equal(r.status,201);r=await client.call(`/data/${domain}/${r.body.data.id}/submit`,'POST',{row_version:r.body.data.row_version});assert.equal(r.status,200);assert.equal(r.body.data.status,'submitted');return r.body.data;}
 const body=rows=>({confirmed:true,filter,items:rows.map(item)});
 await t.test('Massal: daftar/filter eksplisit, approve tanpa alasan dan audit per item + ringkasan',async()=>{
  const rows=[await submitted(),await submitted()],untouched=await submitted();
  const r=await prp.call('/verification/bulk-approve','POST',body(rows));assert.equal(r.status,200);assert.deepEqual(r.body.data.counts,{success:2,skipped:0,failed:0});assert.equal(r.body.data.audit_recorded,true);
  assert.equal((await owner.query('SELECT status FROM kpi_input WHERE id=$1',[untouched.id])).rows[0].status,'submitted');
  const events=(await owner.query('SELECT * FROM audit_log WHERE request_id=$1 ORDER BY id',[r.headers.get('x-request-id')])).rows;assert.equal(events.filter(e=>e.aksi==='approve').length,2);const summary=events.filter(e=>e.aksi==='bulk_approve');assert.equal(summary.length,1);assert.equal(summary[0].user_id,users.prp.id);assert.deepEqual(summary[0].nilai_baru,{total:2,success:2,skipped:0,failed:0,filter,reason:null});
  const mismatch=await prp.call('/verification/bulk-approve','POST',{...body([untouched]),filter:{domain:'dosen'}});assert.equal(mismatch.body.data.results[0].code,'FILTER_CHANGED');
  const queue=await prp.call('/verification/submissions?domain=kpi-input&periode_laporan_id='+report+'&unit_id='+untouched.unit_id);assert.equal(queue.status,200);assert.ok(queue.body.data.some(x=>x.id===untouched.id));
  const wrong=await prp.call('/verification/submissions?domain=kpi-input&periode_laporan_id=1');assert.ok(wrong.body.data.every(x=>x.id!==untouched.id));
 });
 await t.test('Massal: reject wajib alasan, trim/panjang dan audit alasan bersama',async()=>{
  const rows=[await submitted(),await submitted()];for(const review_note of [undefined,'  ','x'.repeat(2001)])assert.equal((await prp.call('/verification/bulk-reject','POST',{...body(rows),review_note})).status,422);
  const r=await prp.call('/verification/bulk-reject','POST',{...body(rows),review_note:'  Periksa sumber  '});assert.equal(r.status,200);assert.deepEqual(r.body.data.counts,{success:2,skipped:0,failed:0});
  const saved=(await owner.query('SELECT status,review_note FROM kpi_input WHERE id=ANY($1::bigint[])',[rows.map(x=>x.id)])).rows;assert.ok(saved.every(x=>x.status==='rejected'&&x.review_note==='Periksa sumber'));
  const audit=(await owner.query('SELECT * FROM audit_log WHERE request_id=$1',[r.headers.get('x-request-id')])).rows;assert.equal(audit.filter(x=>x.aksi==='reject').length,2);assert.equal(audit.find(x=>x.aksi==='bulk_reject').nilai_baru.reason,'Periksa sumber');
 });
 await t.test('Massal: four-eyes kedua aksi, admin sendiri dan override tidak dibuka',async()=>{
  const own=await submitted(prp),adminOwn=await submitted(admin);
  for(const action of ['approve','reject']){const r=await prp.call('/verification/bulk-'+action,'POST',{...body([own]),review_note:'Uji'});assert.equal(r.body.data.results[0].code,'SELF_SUBMISSION');assert.equal(r.body.data.counts.skipped,1);}
  assert.equal((await admin.call('/verification/bulk-approve','POST',body([adminOwn]))).body.data.results[0].code,'SELF_SUBMISSION');
  assert.equal((await admin.call('/verification/bulk-approve','POST',{...body([adminOwn]),override:true,override_reason:'Uji'})).status,422);
 });
 await t.test('Massal: batas, duplikat, hak, anonim, CSRF dan konfirmasi',async()=>{
  const row=await submitted(),b=body([row]);
  const over=await prp.call('/verification/bulk-approve','POST',{...b,items:Array.from({length:101},()=>item(row))});assert.equal(over.status,422);assert.match(over.body.error.message,/100/);
  assert.equal((await prp.call('/verification/bulk-approve','POST',{...b,items:[item(row),item(row)]})).status,422);
  assert.equal((await prp.call('/verification/bulk-approve','POST',{...b,confirmed:false})).status,422);
  assert.equal((await baa.call('/verification/bulk-approve','POST',b)).status,403);
  const token=await anonymous.call('/auth/csrf');anonymous.csrf=token.body.data.csrf;assert.equal((await anonymous.call('/verification/bulk-approve','POST',b)).status,401);
  assert.equal((await anonymous.call('/verification/submissions')).status,401);assert.equal((await anonymous.call('/verification/filters')).status,401);
  assert.equal((await prp.call('/verification/bulk-approve','POST',b,false)).status,403);
 });
 await t.test('Massal: permintaan bersamaan tidak menggandakan approval/audit item',async()=>{
  const row=await submitted(),r=await Promise.all([1,2].map(()=>prp.call('/verification/bulk-approve','POST',body([row]))));assert.ok(r.every(x=>x.status===200));assert.deepEqual(r.map(x=>x.body.data.counts.success).sort(),[0,1]);
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM audit_log WHERE tabel='kpi_input' AND row_id=$1 AND aksi='approve'",[row.id])).rows[0].n,1);
 });
 for(const change of ['version','status'])await t.test('Massal: '+change+' berubah saat request menunggu kunci dilewati',async()=>{
  const rows=[await submitted(),await submitted()],lock=await owner.connect();let pending;
  try{
   await lock.query('BEGIN');await lock.query('SELECT id FROM kpi_input WHERE id=$1 FOR UPDATE',[rows[1].id]);
   pending=prp.call('/verification/bulk-approve','POST',body(rows));
   // The first independent transaction commits while the second item waits.
   let committed=false;for(let n=0;n<100;n++){committed=(await owner.query('SELECT status FROM kpi_input WHERE id=$1',[rows[0].id])).rows[0].status==='approved';if(committed)break;await new Promise(r=>setTimeout(r,20));}assert.equal(committed,true);
   await lock.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','reject',true)",[users.admin.id]);
   if(change==='version')await lock.query("UPDATE kpi_input SET review_note='Versi berubah selama review' WHERE id=$1",[rows[1].id]);
   else await lock.query("UPDATE kpi_input SET status='rejected',review_note='Ditolak reviewer lain',reviewed_by=$2,reviewed_at=now() WHERE id=$1",[rows[1].id,users.admin.id]);
   await lock.query('COMMIT');const r=await pending;assert.equal(r.status,200);assert.deepEqual(r.body.data.counts,{success:1,skipped:1,failed:0});assert.equal(r.body.data.results[1].code,change==='version'?'VERSION_CHANGED':'STATUS_CHANGED');
  }finally{await lock.query('ROLLBACK');lock.release();if(pending)await pending;}
 });
 await t.test('Massal: kegagalan satu transaksi tidak membatalkan keberhasilan lain',async()=>{
  const rows=[await submitted(),await submitted(),await submitted()],req={user:{id:users.prp.id,role:'prp'},requestId:randomUUID()};
  const injected={async connect(){const c=await pool.connect();return {release:()=>c.release(),query(sql,args){if(sql.startsWith('UPDATE kpi_input SET status=')&&String(args[0])===String(rows[1].id))return Promise.reject(new Error('Injected item failure'));return c.query(sql,args);}};}};
  const r=await bulkReview(injected,req,body(rows),true);assert.deepEqual(r.counts,{success:2,skipped:0,failed:1});assert.equal(r.audit_recorded,true);assert.equal(r.results[1].code,'ITEM_FAILED');assert.ok(!JSON.stringify(r).includes('Injected'));
  const saved=(await owner.query('SELECT id,status FROM kpi_input WHERE id=ANY($1::bigint[]) ORDER BY id',[rows.map(x=>x.id)])).rows;assert.deepEqual(saved.map(x=>x.status),['approved','submitted','approved']);
  const audit=(await owner.query('SELECT * FROM audit_log WHERE request_id=$1',[req.requestId])).rows;assert.equal(audit.filter(x=>x.aksi==='approve').length,2);assert.equal(audit.find(x=>x.aksi==='bulk_approve').nilai_baru.failed,1);
 });
 await t.test('Massal: fungsi audit membatasi aktor, aksi, metadata dan izin',async()=>{
  const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','bulk_approve',true),set_config('app.request_id',$2,true)",[users.baa.id,randomUUID()]);await assert.rejects(c.query("SELECT record_bulk_verification_event('bulk_approve',1,1,0,0,'{}',NULL)"),{code:'42501'});await c.query('ROLLBACK');
   for(const metadata of [{secret:'forbidden'},{unit_id:'bad'}]){await c.query('BEGIN');await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','bulk_approve',true),set_config('app.request_id',$2,true)",[users.prp.id,randomUUID()]);await assert.rejects(c.query("SELECT record_bulk_verification_event('bulk_approve',1,1,0,0,$1,NULL)",[metadata]),{code:'22023'});await c.query('ROLLBACK');}
  }finally{await c.query('ROLLBACK');c.release();}
 });
 await t.test('Massal: tepat 100 diterima dan audit gagal tidak menyamarkan item commit',async()=>{
  const missing={confirmed:true,filter,items:Array.from({length:100},(_,n)=>({domain,id:String(9000000000000+n),row_version:1}))};
  const boundary=await prp.call('/verification/bulk-approve','POST',missing);assert.equal(boundary.status,200);assert.deepEqual(boundary.body.data.counts,{success:0,skipped:100,failed:0});assert.equal(boundary.body.data.audit_recorded,true);
  const row=await submitted(),req={user:{id:users.prp.id,role:'prp'},requestId:randomUUID()},injected={async connect(){const c=await pool.connect();return {release:()=>c.release(),query(sql,args){if(sql.includes('record_bulk_verification_event'))return Promise.reject(new Error('Injected audit failure'));return c.query(sql,args);}};}};
  const r=await bulkReview(injected,req,body([row]),true);assert.deepEqual(r.counts,{success:1,skipped:0,failed:0});assert.equal(r.audit_recorded,false);assert.equal(r.request_id,req.requestId);assert.equal((await owner.query('SELECT status FROM kpi_input WHERE id=$1',[row.id])).rows[0].status,'approved');assert.equal((await owner.query("SELECT count(*)::int AS n FROM audit_log WHERE request_id=$1 AND aksi='approve'",[req.requestId])).rows[0].n,1);
 });
 await t.test('Massal: rate limit tulis memberi 429 dengan pesan jelas',async()=>{
  let limited;for(let n=0;n<21;n++){limited=await admin.call('/verification/bulk-approve','POST',{});if(limited.status===429)break;}assert.equal(limited.status,429);assert.equal(limited.body.error.code,'VERIFICATION_RATE_LIMIT');assert.match(limited.body.error.message,/satu menit/);
 });
}
