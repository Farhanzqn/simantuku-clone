import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import bcrypt from 'bcrypt';
import express from 'express';
import {createApp} from '../app.js';
import {createPool,createAppPool,transaction} from '../services/db.js';
import {migrate} from '../../db/scripts/migrate.js';
import {seed} from '../../db/scripts/seed-pimpinan.js';
import {excelWorker,excelWorkerResult,excelGate,excelConfig} from '../services/excel-resources.js';
import {normalizedPagePath} from '../../static-web/assets/js/navigation.js';
import {posix} from 'node:path';
import {assertTemplateBytes,makeWorkbook} from '../services/form-xlsx.js';

test('Template output: kosong/tidak valid menjadi HTTP 503 eksplisit, bukan 200 kosong',async()=>{
 let bytes;const app=express();app.get('/template',(req,res)=>res.send(assertTemplateBytes(bytes)));app.use((e,req,res,next)=>res.status(e.status||500).json({error:{code:e.code,message:e.message}}));const {server,url}=await listen(app);
 try{for(const bad of [undefined,null,Buffer.alloc(0),Buffer.from('not XLSX'),Buffer.from('PK\x03\x04'+'x'.repeat(40))]){bytes=bad;const res=await fetch(url+'/template');assert.equal(res.status,503);assert.equal((await res.json()).error.code,'EXCEL_INVALID_OUTPUT');}bytes=makeWorkbook([{name:'Data',rows:[['valid']]}]);const res=await fetch(url+'/template');assert.equal(res.status,200);assert.deepEqual(Buffer.from(await res.arrayBuffer()),bytes);}finally{await close(server);}
});

test('Worker: pesan hasil wajib ada; Node watch dependency reports bukan hasil Excel',async()=>{
 for(const message of [undefined,null,{}, {type:'excel:result'}, {type:'excel:result',result:null}, {type:'excel:result',result:Buffer.alloc(0)}])assert.throws(()=>excelWorkerResult('generate',message),{status:503,code:'EXCEL_INVALID_OUTPUT'});
 for(const message of [{type:'excel:result'}, {type:'excel:result',result:null}])assert.throws(()=>excelWorkerResult('parse',message),{status:503,code:'EXCEL_INVALID_OUTPUT'});
 const previous=process.env.WATCH_REPORT_DEPENDENCIES;process.env.WATCH_REPORT_DEPENDENCIES='1';
 try{const bytes=await excelWorker('generate',[{name:'Data',rows:[['watch',0]]}]);assert.ok(bytes.length>0);assert.equal((await excelWorker('parse',bytes)).Data.rows[0][0].value,'watch');}
 finally{if(previous===undefined)delete process.env.WATCH_REPORT_DEPENDENCIES;else process.env.WATCH_REPORT_DEPENDENCIES=previous;}
});

const pause=ms=>new Promise(r=>setTimeout(r,ms));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const bounded=p=>Promise.race([p,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Test barrier timeout')),5000);timer.unref();})]);
async function listen(app){const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));return {server,url:`http://127.0.0.1:${server.address().port}`};}
async function close(server){server.closeAllConnections();await new Promise(r=>server.close(r));}

test('E1 B3: normalisasi browser/server sama untuk alias, dot segment dan encoding invalid',()=>{
  for(const path of ['/pegawai%2dformasi.html','/%69nput/baa.html','/input%2fbaa.html','/INPUT//./baa.html','/x/%2e%2e/admin/users.html','/input%5cbaa.html','/input/../keuangan.html','/input/','/']){
    assert.equal(normalizedPagePath(path),posix.normalize(decodeURIComponent(path).replaceAll('\\','/')).toLowerCase());
  }
  assert.equal(normalizedPagePath('/%zz'),'');
});

test('E1 B1/B5: worker deadline menghentikan pekerjaan; proses tetap responsif dan worker berikutnya pulih',async()=>{
  const start=Date.now();let tick=false;
  const result=excelWorker('generate',[{name:'Data',rows:Array.from({length:500},()=>Array(30).fill('x'.repeat(1000)))}],{deadline:1,heap:32});
  setImmediate(()=>{tick=true;});
  await assert.rejects(result,{status:503,code:'EXCEL_TIMEOUT'});
  assert.ok(tick);assert.ok(Date.now()-start<3000);
  const bytes=await excelWorker('generate',[{name:'Data',rows:[['aman',0]]}]);
  assert.equal((await excelWorker('parse',bytes)).Data.rows[0][1].value,0);
  const controller=new AbortController();
  const cancelled=excelWorker('generate',[{name:'Data',rows:[['cancel']]}],{signal:controller.signal});controller.abort();
  await assert.rejects(cancelled,{status:503});
});

test('E1 B1/B5: semaphore sebelum body, antrean terbatas/timeout, 429 global/user, 503 dan health responsif',async()=>{
  const app=express(),gate=excelGate({...excelConfig({}),active:1,queue:1,wait:250,upload:2,global:6});let bodies=0;
  app.get('/health',(req,res)=>res.json({ok:true}));
  app.post('/upload',(req,res,next)=>{req.user={id:req.get('x-user')};next();},gate('upload'),async(req,res,next)=>{try{bodies++;await new Promise((resolve,reject)=>express.raw({type:()=>true})(req,res,e=>e?reject(e):resolve()));res.send('ok');}catch(e){next(e);}finally{req.excelRelease();}});
  app.use((e,req,res,next)=>res.status(e.status||500).json({code:e.code}));
  const {server,url}=await listen(app),held=[];
  const slow=user=>{let resolve;const response=new Promise(r=>{resolve=r;});const req=httpRequest(url+'/upload',{method:'POST',headers:{'x-user':user,'content-type':'application/octet-stream','content-length':'10'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',()=>{});req.flushHeaders();held.push(req);return {req,response};};
  try{
    const first=slow('a');for(let n=0;n<100&&bodies!==1;n++)await pause(10);assert.equal(bodies,1);
    const second=slow('b');await pause(30);
    assert.equal(await slow('c').response,503,'queue full without sending body');assert.equal(bodies,1);
    assert.equal((await fetch(url+'/health',{signal:AbortSignal.timeout(1500)})).status,200);
    assert.equal(await second.response,503,'queue deadline without body parsing');assert.equal(bodies,1);
    // Second a consumes its remaining allowance while first a still occupies the slot.
    const otherA=slow('a');assert.equal(await slow('a').response,429,'per-user limit');assert.equal(await otherA.response,503);
    assert.equal(await slow('d').response,503);assert.equal(await slow('e').response,429,'global limit across users');
    assert.equal(bodies,1);first.req.end('0123456789');assert.equal(await first.response,200);
  }finally{for(const r of held)r.destroy();await close(server);}
});

test('E1 Bagian B: integrasi PostgreSQL _test, HTTP dan retensi preview',async t=>{
  const database=process.env.PGTEST_DATABASE;assert.ok(database?.endsWith('_test')&&database!==process.env.PGDATABASE);
  const owner=createPool(database);await migrate(owner);await seed(owner);const pool=createAppPool(database);
  const run=randomUUID(),password=randomBytes(18).toString('hex'),users=[];
  for(let i=0;i<2;i++)users.push((await owner.query("INSERT INTO users(nama,email,password_hash,role,unit_id,must_change_password) VALUES('E1 security',$1,$2,'baa',(SELECT id FROM unit WHERE kode='BAA'),false) RETURNING id,email",[`e1-b-${i}-${run}@test.invalid`,await bcrypt.hash(password,4)])).rows[0]);
  const report=(await owner.query("INSERT INTO periode_laporan(kode,tahun,semester,mulai,selesai,urutan) SELECT $1,2099,'S1','2099-01-01','2099-06-30',max(urutan)+1 FROM periode_laporan RETURNING id",['e1-b-'+run])).rows[0].id;
  const academic=(await owner.query("INSERT INTO periode_akademik(kode,tahun_ajaran,semester,urutan,aktif) SELECT $1,'2098/2099','Genap',max(urutan)+1,false FROM periode_akademik RETURNING id",['e1-b-'+run])).rows[0].id;
  // Fault injection is restricted to reference lookup, through the real HTTP error path.
  let fault=false;
  const routePool={query:(sql,args)=>fault&&sql.startsWith('SELECT id FROM periode_laporan WHERE')?Promise.reject(Object.assign(new Error('driver secret sentinel'),{code:'08006'})):pool.query(sql,args),connect:()=>pool.connect()};
  const app=createApp({pool:routePool,passwordEnv:{},secret:randomBytes(48).toString('hex'),excelEnv:{EXCEL_UPLOAD_PER_MINUTE:100,EXCEL_APPLY_PER_MINUTE:100}}),{server,url}=await listen(app);
  const q=new URLSearchParams({periode:report,periode_akademik_id:academic,status_mhs:'aktif'}),path='/api/forms/mahasiswa-aktif';
  async function login(user,base=url){let r=await fetch(base+'/api/auth/csrf'),cookie=r.headers.get('set-cookie').split(';')[0],csrf=(await r.json()).data.csrf;r=await fetch(base+'/api/auth/login',{method:'POST',headers:{cookie,'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({email:user.email,password})});assert.equal(r.status,200);return {cookie:r.headers.get('set-cookie').split(';')[0],csrf:(await r.json()).data.csrf};}
  async function post(c,suffix,body,base=url){const r=await fetch(base+path+suffix,{method:'POST',headers:{cookie:c.cookie,'x-csrf-token':c.csrf,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
  const clients=await Promise.all(users.map(u=>login(u)));let bytes;
  async function upload(c=clients[0]){const data=new FormData();data.append('file',new Blob([bytes]),'data.xlsx');const r=await fetch(url+path+'/upload?'+q,{method:'POST',headers:{cookie:c.cookie,'x-csrf-token':c.csrf},body:data});return {status:r.status,body:await r.json()};}
  async function preview(){const p=await upload();assert.equal(p.status,200,JSON.stringify(p.body));return p.body.data.id;}
  const row=async id=>(await owner.query('SELECT * FROM form_upload_preview WHERE id=$1',[id])).rows[0];
  const empty=p=>{assert.deepEqual(p.rows,[]);assert.deepEqual(p.issues,[]);assert.deepEqual(p.snapshot,{});};
  try{
    const r=await fetch(url+path+'/template?'+q,{headers:{cookie:clients[0].cookie}});assert.equal(r.status,200);bytes=Buffer.from(await r.arrayBuffer());
    await t.test('E1-02b: disconnect saat INSERT menahan slot sampai ROLLBACK selesai, tanpa draft parsial',async()=>{
      const id=await preview(),inserted=deferred(),continueQuery=deferred(),rollingBack=deferred(),continueRollback=deferred(),released=deferred();
      let held=false,commits=0,admitted=0,aborted;
      const controlled={query:(...args)=>pool.query(...args),connect:async()=>{
        const c=await pool.connect();let target=false;
        return {query:async(sql,args)=>{
          if(target&&sql==='ROLLBACK'){rollingBack.resolve();await continueRollback.promise;}
          if(target&&sql==='COMMIT')commits++;
          const result=await c.query(sql,args);
          if(!held&&sql.startsWith('INSERT INTO mahasiswa_aktif(')){held=true;target=true;inserted.resolve();await continueQuery.promise;}
          return result;
        },release:()=>{c.release();if(target)released.resolve();}};
      }};
      const isolated=createApp({pool:controlled,passwordEnv:{},secret:randomBytes(48).toString('hex'),excelEnv:{EXCEL_ACTIVE_JOBS:1}}),running=await listen(isolated);
      let pending;
      try{
        const c=await login(users[0],running.url);
        // Observe actual admission, after auth/authorization and before the first context query.
        const original=controlled.query;controlled.query=(sql,...args)=>{if(sql.startsWith('SELECT * FROM periode_laporan'))admitted++;return original(sql,...args);};
        const disconnected=deferred();running.server.on('request',(req,res)=>{if(req.url===path+'/apply')res.once('close',()=>disconnected.resolve());});
        const request=httpRequest(running.url+path+'/apply',{method:'POST',headers:{cookie:c.cookie,'x-csrf-token':c.csrf,'content-type':'application/json'}},res=>res.resume());
        aborted=request;request.on('error',()=>{});request.end(JSON.stringify({preview_id:id,confirm_overwrite:true}));
        await bounded(inserted.promise);
        request.destroy();await bounded(disconnected.promise);
        pending=fetch(running.url+path+'/template?'+q,{headers:{cookie:c.cookie},signal:AbortSignal.timeout(10000)});
        await pause(100);assert.equal(admitted,0,'disconnect must not admit a queued DB job');
        continueQuery.resolve();await bounded(rollingBack.promise);
        await pause(100);assert.equal(admitted,0,'rollback still owns the slot');assert.equal(commits,0);
        continueRollback.resolve();await bounded(released.promise);
        assert.equal((await pending).status,200);assert.equal(admitted,1,'slot recovered after rollback');
        assert.equal((await owner.query('SELECT count(*)::int n FROM mahasiswa_aktif WHERE periode_laporan_id=$1',[report])).rows[0].n,0);
        assert.equal((await row(id)).status,'preview');
        assert.equal((await owner.query("SELECT count(*)::int n FROM audit_log WHERE user_id=$1 AND aksi='template_apply'",[users[0].id])).rows[0].n,0);
        assert.equal((await post(c,'/apply',{preview_id:id},running.url)).status,200,'retry succeeds after aborted transaction');
        assert.equal((await post(c,'/apply',{preview_id:id},running.url)).status,409,'handler error also releases slot');
        assert.equal((await fetch(running.url+path+'/apply',{method:'POST',headers:{cookie:c.cookie,'x-csrf-token':c.csrf,'content-type':'application/json'},body:'{'})).status,400,'body parser error releases slot');
        const incomplete=httpRequest(running.url+path+'/apply',{method:'POST',headers:{cookie:c.cookie,'x-csrf-token':c.csrf,'content-type':'application/json','content-length':'100'}},res=>res.resume());incomplete.on('error',()=>{});incomplete.write('{');await pause(100);incomplete.destroy();
        assert.equal((await fetch(running.url+path+'/template?'+q,{headers:{cookie:c.cookie},signal:AbortSignal.timeout(5000)})).status,200,'body disconnect does not leak slot');
      }finally{aborted?.destroy();continueQuery.resolve();continueRollback.resolve();if(pending)await pending.catch(()=>{});isolated.locals.store.close();await close(running.server);}
    });
    await t.test('Dua apply paralel: tepat satu sukses, satu konflik, satu audit apply',async()=>{
      const id=await preview(),before=(await owner.query("SELECT count(*)::int n FROM audit_log WHERE user_id=$1 AND aksi='template_apply' AND tabel='form_excel'",[users[0].id])).rows[0].n;
      const out=await Promise.all([post(clients[0],'/apply',{preview_id:id,confirm_overwrite:true}),post(clients[0],'/apply',{preview_id:id,confirm_overwrite:true})]);
      assert.deepEqual(out.map(x=>x.status).sort(),[200,409]);empty(await row(id));assert.equal((await row(id)).status,'applied');
      assert.equal((await owner.query("SELECT count(*)::int n FROM audit_log WHERE user_id=$1 AND aksi='template_apply' AND tabel='form_excel'",[users[0].id])).rows[0].n,before+1);
      const saved=(await owner.query('SELECT status,is_current_approved FROM mahasiswa_aktif WHERE periode_laporan_id=$1',[report])).rows;assert.equal(saved.length,19);assert.ok(saved.every(x=>x.status==='draft'&&!x.is_current_approved));
    });
    await t.test('Preview akun lain dengan role/unit sama tidak dapat apply/cancel',async()=>{
      const id=await preview(),before=await row(id);
      assert.equal((await post(clients[1],'/apply',{preview_id:id,confirm_overwrite:true})).status,409);
      assert.equal((await post(clients[1],'/upload/cancel',{preview_id:id})).status,404);assert.deepEqual(await row(id),before);
    });
    await t.test('Cancel wajib CSRF, mengosongkan payload dan menolak apply berikutnya',async()=>{
      const id=await preview();assert.equal((await post({...clients[0],csrf:'wrong'},'/upload/cancel',{preview_id:id})).status,403);
      assert.equal((await post(clients[0],'/upload/cancel',{preview_id:id})).status,200);assert.equal((await row(id)).status,'cancelled');empty(await row(id));
      assert.equal((await post(clients[0],'/apply',{preview_id:id,confirm_overwrite:true})).status,409);
      assert.equal((await post(clients[0],'/upload/cancel',{preview_id:id})).status,409);
    });
    await t.test('Race cancel vs apply: satu pemenang, satu konflik, tanpa duplikasi draft',async()=>{
      for(const reverse of [false,true]){
        const id=await preview(),before=(await owner.query("SELECT count(*)::int n FROM audit_log WHERE user_id=$1 AND tabel='form_excel' AND aksi IN ('template_apply','template_cancel')",[users[0].id])).rows[0].n;
        const calls=[()=>post(clients[0],'/apply',{preview_id:id,confirm_overwrite:true}),()=>post(clients[0],'/upload/cancel',{preview_id:id})];if(reverse)calls.reverse();
        const out=await Promise.all(calls.map(f=>f()));assert.deepEqual(out.map(x=>x.status).sort(),[200,409]);
        const p=await row(id);assert.equal(p.status,out[reverse?1:0].status===200?'applied':'cancelled');empty(p);
        assert.equal((await owner.query("SELECT count(*)::int n FROM audit_log WHERE user_id=$1 AND tabel='form_excel' AND aksi IN ('template_apply','template_cancel')",[users[0].id])).rows[0].n,before+1);
        const drafts=(await owner.query('SELECT prodi_id,status FROM mahasiswa_aktif WHERE periode_laporan_id=$1',[report])).rows;assert.equal(drafts.length,19);assert.equal(new Set(drafts.map(x=>x.prodi_id)).size,19);assert.ok(drafts.every(x=>x.status==='draft'));
      }
    });
    await t.test('Prune >1.000 record: payload dan retensi berkurang per batch sampai habis, audit tetap',async()=>{
      const ids=Array.from({length:2105},()=>randomUUID()),before=(await owner.query('SELECT * FROM audit_log WHERE user_id=$1 ORDER BY id',[users[0].id])).rows;
      await owner.query("INSERT INTO form_upload_preview(id,user_id,domain,context,schema_hash,rows,issues,snapshot,expires_at) SELECT id,$2,'mahasiswa-aktif','{}','test','[{}]','[{}]','{\"test\":1}',now()-interval '1 day' FROM unnest($1::uuid[]) id",[ids,users[0].id]);
      const counts=async()=> (await owner.query("SELECT count(*)::int total,count(*) FILTER(WHERE rows<>'[]'::jsonb OR issues<>'[]'::jsonb OR snapshot<>'{}'::jsonb OR status='preview')::int dirty FROM form_upload_preview WHERE id=ANY($1::uuid[])",[ids])).rows[0];
      for(const expected of [1105,105,0]){await app.locals.store.maintenance();assert.deepEqual(await counts(),{total:2105,dirty:expected});}
      await owner.query("UPDATE form_upload_preview SET created_at=now()-interval '8 days' WHERE id=ANY($1::uuid[])",[ids]);
      for(const expected of [1105,105,0]){await app.locals.store.maintenance();assert.deepEqual(await counts(),{total:expected,dirty:0});}
      assert.deepEqual((await owner.query('SELECT * FROM audit_log WHERE user_id=$1 ORDER BY id',[users[0].id])).rows,before);
    });
    await t.test('Expired ditolak; maintenance runtime membersihkan payload/retensi tanpa menghapus audit',async()=>{
      const id=await preview();await owner.query("UPDATE form_upload_preview SET expires_at=now()-interval '1 minute' WHERE id=$1",[id]);
      assert.equal((await post(clients[0],'/apply',{preview_id:id,confirm_overwrite:true})).status,409);
      const before=(await owner.query('SELECT * FROM audit_log WHERE user_id=$1 ORDER BY id',[users[0].id])).rows;
      await app.locals.store.maintenance();assert.equal((await row(id)).status,'expired');empty(await row(id));
      await owner.query("UPDATE form_upload_preview SET created_at=now()-interval '8 days' WHERE id=$1",[id]);await app.locals.store.maintenance();assert.equal(await row(id),undefined);
      assert.deepEqual((await owner.query('SELECT * FROM audit_log WHERE user_id=$1 ORDER BY id',[users[0].id])).rows,before);
      await assert.rejects(pool.query('DELETE FROM form_upload_preview WHERE id=$1',[randomUUID()]),{code:'42501'});
    });
    await t.test('Kuota tiga preview tetap atomik pada unggahan paralel, preview tertua dibersihkan',async()=>{
      const old=await preview(),out=await Promise.all(Array.from({length:4},()=>upload()));assert.ok(out.every(x=>x.status===200),JSON.stringify(out));
      const active=(await owner.query("SELECT id FROM form_upload_preview WHERE user_id=$1 AND domain='mahasiswa-aktif' AND status='preview' AND expires_at>now()",[users[0].id])).rows;assert.equal(active.length,3);
      assert.equal((await row(old)).status,'expired');empty(await row(old));assert.equal((await post(clients[0],'/apply',{preview_id:old})).status,409);
    });
    await t.test('Kegagalan driver saat validasi menghasilkan 503 tanpa pesan driver atau preview baru',async()=>{
      const before=(await owner.query('SELECT count(*)::int n FROM form_upload_preview WHERE user_id=$1',[users[0].id])).rows[0].n;
      fault=true;let out;try{out=await upload();}finally{fault=false;}
      assert.equal(out.status,503);assert.equal(out.body.error.code,'EXCEL_VALIDATION_UNAVAILABLE');assert.ok(!JSON.stringify(out.body).includes('sentinel'));
      assert.equal((await owner.query('SELECT count(*)::int n FROM form_upload_preview WHERE user_id=$1',[users[0].id])).rows[0].n,before);
    });
    await t.test('Audit SQL menolak metadata nested/tipe/panjang/key/aktor/form salah; transaksi rollback',async()=>{
      const id=await preview(),p=await row(id),valid={form:p.domain,periode:p.context,version:1,schema_hash:p.schema_hash,result:'preview',rows:19};
      const bad=[null,[],{...valid,result:{value:'cell'}},{...valid,rows:'19'},{...valid,rows:-1},{...valid,periode:{periode_laporan_id:{cell:1}}},{...valid,periode:{periode_laporan_id:null}},{...valid,periode:{...p.context,extra:'cell'}},{...valid,schema_hash:'x'},{...valid,result:'generated'},{...valid,form:'dosen'},{...valid,file:'x'.repeat(2050)}];
      const write=(metadata,actor=users[0].id)=>transaction(pool,async c=>{await c.query("SELECT set_config('app.user_id',$1,true)",[String(actor)]);await c.query("SELECT record_form_excel_event('template_upload',$1)",[metadata]);});
      for(const metadata of bad)await assert.rejects(write(metadata),/Metadata audit template tidak valid/);
      await assert.rejects(write({...valid,form:'formasi'}),{code:'42501'});await assert.rejects(write(valid,0),{code:'42501'});
      await write(valid);
    });
    await t.test('Timeout DB tersedia di semua koneksi runtime; lock timeout membatalkan operasi',async()=>{
      const c=await pool.connect();try{assert.equal((await c.query('SHOW statement_timeout')).rows[0].statement_timeout,'10s');assert.equal((await c.query('SHOW lock_timeout')).rows[0].lock_timeout,'3s');assert.equal((await c.query('SHOW idle_in_transaction_session_timeout')).rows[0].idle_in_transaction_session_timeout,'15s');await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='50ms'");await assert.rejects(c.query('SELECT pg_sleep(1)'),{code:'57014'});await c.query('ROLLBACK');}finally{c.release();}
      const lock=await owner.connect();try{await lock.query('BEGIN');await lock.query('SELECT pg_advisory_xact_lock(987654321)');await assert.rejects(transaction(pool,async c=>{await c.query("SET LOCAL lock_timeout='50ms'");await c.query('SELECT pg_advisory_xact_lock(987654321)');}),{code:'55P03'});}finally{await lock.query('ROLLBACK');lock.release();}
    });
    await t.test('Limiter route nyata menolak sebelum membaca body JSON/upload yang belum dikirim',async()=>{
      const limited=createApp({pool,passwordEnv:{},secret:randomBytes(48).toString('hex'),excelEnv:{EXCEL_UPLOAD_PER_MINUTE:1,EXCEL_APPLY_PER_MINUTE:1}}),running=await listen(limited);const held=[];
      try{const c=await login(users[0],running.url);
        const send=(suffix,contentType)=>new Promise(resolve=>{const req=httpRequest(running.url+path+suffix,{method:'POST',headers:{cookie:c.cookie,'x-csrf-token':c.csrf,'content-type':contentType,'content-length':'10'}},res=>{res.resume();resolve(res.statusCode);});held.push(req);req.on('error',()=>{});req.flushHeaders();});
        const data=new FormData();data.append('file',new Blob([bytes]),'data.xlsx');assert.equal((await fetch(running.url+path+'/upload?'+q,{method:'POST',headers:{cookie:c.cookie,'x-csrf-token':c.csrf},body:data})).status,200);
        assert.equal(await send('/upload?'+q,'multipart/form-data; boundary=x'),429);
        assert.equal((await post(c,'/apply',{preview_id:randomUUID()},running.url)).status,409);assert.equal(await send('/apply','application/json'),429);
        assert.equal((await fetch(running.url+'/api/health',{signal:AbortSignal.timeout(1500)})).status,200);
      }finally{for(const req of held)req.destroy();limited.locals.store.close();await close(running.server);}
    });
  }finally{
    app.locals.store.close();await close(server);await pool.end();
    await owner.query('DELETE FROM form_upload_preview WHERE user_id=ANY($1::bigint[])',[users.map(u=>u.id)]);
    await owner.query('DELETE FROM mahasiswa_aktif WHERE periode_laporan_id=$1',[report]);await owner.query('DELETE FROM periode_laporan WHERE id=$1',[report]);await owner.query('DELETE FROM periode_akademik WHERE id=$1',[academic]);
    await owner.query('UPDATE users SET aktif=false,session_version=session_version+1 WHERE id=ANY($1::bigint[])',[users.map(u=>u.id)]);await owner.end();
  }
});
