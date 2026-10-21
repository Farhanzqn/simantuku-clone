import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import bcrypt from 'bcrypt';
import {createPool} from '../services/db.js';
import {excelBrowsers,excelBrowserSmoke} from './excel-runtime-smoke.js';
import {externalFixture} from './xlsx-compatibility-cases.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function excelEntryCases(t){
 const database=process.env.PGTEST_DATABASE;assert.ok(database?.endsWith('_test')&&database!==process.env.PGDATABASE);
 const owner=createPool(database),id=randomUUID(),password=randomBytes(18).toString('hex'),email=`excel-entry-${id}@test.invalid`,root='.runtime/xlsx-diag/entry-'+id;await mkdir(root,{recursive:true});
 let user,report;
 try{
  user=(await owner.query("INSERT INTO users(nama,email,password_hash,role,must_change_password) VALUES('Excel runtime test',$1,$2,'admin',false) RETURNING id",[email,await bcrypt.hash(password,4)])).rows[0].id;
  report=(await owner.query("INSERT INTO periode_laporan(kode,tahun,semester,mulai,selesai,urutan) SELECT $1,coalesce(max(tahun) FILTER(WHERE tahun>=2099),2098)+1,'S1','2099-01-01','2099-06-30',max(urutan)+1 FROM periode_laporan RETURNING id",['excel-entry-'+id])).rows[0].id;
  const academic=(await owner.query("SELECT id FROM periode_akademik WHERE kode='20252'")).rows[0].id;
  const browsers=await excelBrowsers(),manifest=JSON.parse(await readFile('package.json','utf8'));
  assert.equal(manifest.scripts.start,'node server/app.js');assert.equal(manifest.scripts.dev,'node --watch server/app.js');
  for(const mode of ['start','dev'])await t.test(mode+': entry aplikasi asli, limiter default, Edge/Brave + upload eksternal DRAFT',async t=>{
   const api=spawn(process.execPath,[...(mode==='dev'?['--watch']:[]),'server/app.js'],{windowsHide:true,env:{...process.env,PGDATABASE:database,PORT:'31952',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});let log='';api.stdout.on('data',b=>log+=b);api.stderr.on('data',b=>log+=b);
   try{
    for(let i=0;i<150&&!log.includes('API Satu Data ITPLN:');i++){assert.equal(api.exitCode,null,'Server berhenti sebelum ready');await pause(100);}assert.ok(log.includes('API Satu Data ITPLN:'),'Entry startup harus lolos pemeriksaan app_user');
    const base='http://127.0.0.1:31952';for(const browser of browsers){const result=await excelBrowserSmoke({base,email,password,browser,root:root+'/'+mode,report:1,academic});assert.equal(result.results.length,11);await writeFile(root+'/'+mode+'-'+browser.name+'.json',JSON.stringify(result,null,2));t.diagnostic(browser.name+': 11 unduhan nyata >0, PK, ExcelJS; semua GET data/template 200');}
    let cookie='',csrf;const request=async(path,body)=>{const res=await fetch(base+'/api'+path,{headers:{cookie,...(body instanceof FormData?{'x-csrf-token':csrf}:body?{'content-type':'application/json','x-csrf-token':csrf}:{})},...(body?{method:'POST',body:body instanceof FormData?body:JSON.stringify(body)}:{})});cookie=res.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')||cookie;const json=await res.json();assert.equal(res.status,200,JSON.stringify(json));return json.data;};
    csrf=(await request('/auth/csrf')).csrf;csrf=(await request('/auth/login',{email,password})).csrf;
    const context={periode_laporan_id:Number(report),periode_akademik_id:Number(academic),status_mhs:'cuti'},query=new URLSearchParams(context);
    for(const file of ['exceljs-shared-relative.xlsx','exceljs-inline-absolute.xlsx','excel16-resaved.xlsx']){
     const bytes=await externalFixture(file,context),form=new FormData();form.append('file',new Blob([bytes]),file);const preview=await request('/forms/mahasiswa-aktif/upload?'+query,form);assert.deepEqual(preview.issues,[]);
     const draft=await request('/forms/mahasiswa-aktif/apply',{preview_id:preview.id,confirm_overwrite:true});assert.ok(draft.length>0&&draft.every(r=>r.status==='draft'&&!r.is_current_approved));
    }
    const rows=(await owner.query('SELECT status,is_current_approved FROM mahasiswa_aktif WHERE periode_laporan_id=$1',[report])).rows;assert.ok(rows.length>0&&rows.every(r=>r.status==='draft'&&!r.is_current_approved));
    t.diagnostic('3 fixture ExcelJS/Excel 16 diterima dan diterapkan hanya DRAFT');
   }finally{api.kill('SIGINT');await new Promise(r=>api.exitCode!==null?r():(api.once('exit',r),setTimeout(r,3000)));await writeFile(root+'/'+mode+'-server.log',log);}
  });
 }finally{
  if(report){await owner.query('DELETE FROM mahasiswa_aktif WHERE periode_laporan_id=$1',[report]);await owner.query('DELETE FROM periode_laporan WHERE id=$1',[report]);}
  if(user)await owner.query('UPDATE users SET aktif=false,session_version=session_version+1 WHERE id=$1',[user]);await owner.end();
 }
}
