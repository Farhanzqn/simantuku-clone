import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {readFile} from 'node:fs/promises';
import {request,getUser,clearClientState,formTransfer} from '../../static-web/assets/js/api.js';
import {apiError,retryAfter} from '../../static-web/assets/js/error-policy.js';
import {safeNext} from '../../static-web/assets/js/navigation.js';
import {createApp} from '../app.js';
import {requestLog} from '../middleware/request-log.js';
import {errorResponse} from '../middleware/error-response.js';
import {HttpError} from '../middleware/security.js';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...headers}});
const csrf='a'.repeat(64);
async function mock(work,run){const original=globalThis.fetch;clearClientState();globalThis.fetch=work;try{await run();}finally{globalThis.fetch=original;clearClientState();}}

test('Error: semua kelas memakai pesan/tindakan Indonesia dan request_id aman',()=>{
 const classes=[[0,'network','Coba lagi'],[401,'session','Masuk ulang'],[403,'forbidden','Hubungi PRP'],[404,'missing','Kembali ke Beranda'],[409,'conflict','Muat ulang halaman'],[422,'validation','Coba lagi'],[429,'rate-limit','Coba lagi'],[500,'server','Coba lagi'],[502,'server','Coba lagi'],[503,'unavailable','Coba lagi'],[400,'bad-request','Coba lagi'],[413,'too-large','Coba lagi']];
 for(const [status,type,action]of classes){const e=apiError({status,requestId:'audit-safe-123'});assert.equal(e.type,type);assert.equal(e.action,action);assert.ok(e.message.includes('audit-safe-123'));assert.ok(!e.message.includes('undefined'));}
 assert.equal(apiError({status:403,code:'CSRF_INVALID'}).type,'csrf');assert.equal(apiError({status:401,code:'LOGIN_FAILED'}).type,'login');
 assert.match(apiError({kind:'timeout',method:'POST'}).message,/Hasil belum dapat dipastikan.*riwayat/);
 assert.equal(apiError({status:500,requestId:'<script>/private/SQL'}).requestId,'');
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');try{Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});assert.match(apiError({}).message,/Koneksi internet terputus/);}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('Error: GET/HEAD retry maksimal dua kali, status permanen dan timeout tidak retry',async()=>{
 for(const method of ['GET','HEAD']){let count=0;await mock(async()=>{count++;return count<3?json({error:{code:'EXCEL_BUSY'}},503):method==='HEAD'?new Response(null):json({data:[1]});},async()=>{await request('/test',{method});assert.equal(count,3);});}
 for(const status of [400,401,403,404,409,413,422,500]){let count=0;await mock(async()=>{count++;return json({error:{code:status===401?'LOGIN_REQUIRED':'TEST',message:'SQL password /private driver sentinel'}},status,{'x-request-id':'safe-id'});},async()=>{await assert.rejects(request('/test'),e=>e.status===status&&!e.message.includes('sentinel')&&e.requestId==='safe-id');assert.equal(count,1);});}
 let count=0;await mock(async()=>{count++;throw new TypeError('private driver sentinel');},async()=>{await assert.rejects(request('/test'),{type:'network'});assert.equal(count,3);});
});
test('Error: POST/PUT/PATCH/DELETE, login/upload/apply/submit tidak retry pada jaringan/429/5xx',async()=>{
 for(const method of ['POST','PUT','PATCH','DELETE'])for(const status of [429,502,503,504,0]){let writes=0;await mock(async(path)=>{if(path==='/api/auth/csrf')return json({data:{csrf}});writes++;if(!status)throw new TypeError('network');return json({error:{code:'TEST'}},status);},async()=>{await assert.rejects(request('/forms/test/apply',{method,body:{rows:[]}}));assert.equal(writes,1,method+' '+status);});}
 for(const path of ['/auth/login','/forms/test/apply','/data/test/bulk-submit','/verification/bulk-approve']){let count=0;await mock(async p=>{if(p==='/api/auth/csrf')return json({data:{csrf}});count++;throw new TypeError('lost result');},async()=>{await assert.rejects(request(path,{method:'POST',body:{}}),{uncertain:true});assert.equal(count,1);});}
 let count=0;await mock(async p=>{if(p==='/api/auth/csrf')return json({data:{csrf}});count++;return json({error:{code:'EXCEL_BUSY'}},503);},async()=>{await assert.rejects(formTransfer('/forms/test/upload',{file:new Blob(['fixture'])}),{uncertain:true});assert.equal(count,1);});
});
test('Error: Retry-After detik/tanggal dihormati, backoff terlihat, tunggu panjang menjadi manual',async()=>{
 const now=Date.now();assert.equal(retryAfter('2',now),2000);assert.equal(retryAfter(new Date(now+5000).toUTCString(),now)>=4000,true);assert.equal(retryAfter('not-a-date'),0);
 let count=0;const start=Date.now(),events=[],originalWindow=globalThis.window;
 globalThis.window={dispatchEvent:event=>events.push({type:event.type,detail:event.detail})};
 try{await mock(async()=>++count===1?json({error:{}},429,{'retry-after':'0.5'}):json({data:[]}),async()=>{await request('/test');assert.equal(count,2);assert.ok(Date.now()-start>=490);assert.ok(events.some(e=>e.type==='api-retry'&&e.detail.attempt===1&&e.detail.waitMs===500));assert.ok(events.some(e=>e.type==='api-retry'&&e.detail.done));});}finally{if(originalWindow)globalThis.window=originalWindow;else delete globalThis.window;}
 count=0;await mock(async()=>{count++;return json({error:{}},429,{'retry-after':'120'});},async()=>{await assert.rejects(request('/test'),{status:429,waitMs:120000});assert.equal(count,1);});
});
test('Error: CSRF basi otomatis 1 ditolak + 1 sukses, body tetap; token awal dideduplikasi',async()=>{
 let tokens=0,writes=0,executed=0,checks=0;const body={rows:[{id:1,row_version:3}]},sent=[];await mock(async(path,options)=>{
  if(path==='/api/auth/csrf'){tokens++;return json({data:{csrf:tokens===1?csrf:'b'.repeat(64)}});}
  if(path==='/api/auth/me'){checks++;body.rows[0].row_version=99;return json({data:{id:1}});}
  sent.push(options.body);
  writes++;if(options.headers['X-CSRF-Token']===csrf)return json({error:{code:'CSRF_INVALID'}},403);executed++;return json({data:{id:'preview'}});
 },async()=>{assert.equal((await request('/forms/test/apply',{method:'POST',body})).data.id,'preview');assert.equal(tokens,2);assert.equal(checks,1);assert.equal(writes,2);assert.equal(executed,1);assert.deepEqual(sent,[JSON.stringify({rows:[{id:1,row_version:3}]}),JSON.stringify({rows:[{id:1,row_version:3}]})]);});
 tokens=0;writes=0;await mock(async(path)=>{if(path==='/api/auth/csrf'){tokens++;await new Promise(r=>setTimeout(r,10));return json({data:{csrf}});}writes++;return json({data:[]});},async()=>{await Promise.all([request('/one',{method:'POST'}),request('/two',{method:'POST'})]);assert.equal(tokens,1);assert.equal(writes,2);});
});
test('Error: multipart CSRF memakai File yang sama, hanya satu eksekusi/kuota preview',async()=>{
 const file=new File(['same workbook bytes'],'csrf-fixture.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',lastModified:12345}),bodies=[],order=[];let tokens=0,executed=0;
 await mock(async(path,options)=>{if(path==='/api/auth/csrf'){order.push('token');return json({data:{csrf:++tokens===1?csrf:'b'.repeat(64)}});}if(path==='/api/auth/me'){order.push('me');return json({data:{id:1}});}bodies.push(options.body);order.push('upload');if(bodies.length===1)return json({error:{code:'CSRF_INVALID'}},403);executed++;return json({data:{id:'one-preview'}});},async()=>{
  assert.equal((await formTransfer('/forms/test/upload',{file})).data.id,'one-preview');assert.equal(bodies.length,2);assert.equal(executed,1);assert.equal(bodies[0],bodies[1]);for(const body of bodies){assert.equal(body.get('file'),file);assert.equal(await body.get('file').text(),'same workbook bytes');assert.equal(body.get('file').lastModified,12345);}assert.deepEqual(order,['token','upload','token','me','upload']);
 });
});
test('Error: hanya HTTP 403 + kode tepat CSRF_INVALID boleh memulihkan write',async()=>{
 for(const [status,code]of [[403,'FORBIDDEN'],[403,'csrf_invalid'],[403,'CSRF_INVALID '],[403,undefined],...[401,422,429,500,502,503,504].map(status=>[status,'CSRF_INVALID'])]){let tokens=0,writes=0,checks=0;await mock(async path=>{if(path==='/api/auth/csrf'){tokens++;return json({data:{csrf}});}if(path==='/api/auth/me'){checks++;return json({data:{id:1}});}writes++;return json({error:{code}},status);},async()=>{await assert.rejects(request('/write',{method:'POST'}),{status});assert.equal(writes,1,status+' '+code);assert.equal(tokens,1);assert.equal(checks,0);});}
});
test('Error: setiap metode/apply/submit mendapat satu pemulihan; CSRF kedua berhenti dengan pesan',async()=>{
 for(const [method,path]of [['POST','/forms/test/apply'],['POST','/data/test/bulk-submit'],['POST','/verification/bulk-approve'],['PUT','/write'],['PATCH','/write'],['DELETE','/write']]){let writes=0,tokens=0,checks=0,executed=0;await mock(async p=>{if(p==='/api/auth/csrf')return json({data:{csrf:++tokens===1?csrf:'b'.repeat(64)}});if(p==='/api/auth/me'){checks++;return json({data:{id:1}});}writes++;if(writes===1)return json({error:{code:'CSRF_INVALID'}},403);executed++;return json({data:[]});},async()=>{await request(path,{method,body:{id:1}});assert.equal(writes,2);assert.equal(tokens,2);assert.equal(checks,1);assert.equal(executed,1);});}
 let writes=0,tokens=0,checks=0;await mock(async p=>{if(p==='/api/auth/csrf')return json({data:{csrf:++tokens===1?csrf:'b'.repeat(64)}});if(p==='/api/auth/me'){checks++;return json({data:{id:1}});}writes++;return json({error:{code:'CSRF_INVALID'}},403,{'x-request-id':'second-rejection'});},async()=>{await assert.rejects(request('/write',{method:'POST'}),e=>e.status===403&&e.code==='CSRF_INVALID'&&/Pemulihan otomatis berhenti/.test(e.message)&&e.requestId==='second-rejection');assert.equal(writes,2);assert.equal(tokens,2);assert.equal(checks,1);});
});
test('Error: sesi harus HTTP 200; kegagalan token/me tidak rekursif dan tidak replay write',async()=>{
 for(const fault of ['token-csrf','me-csrf','me-201','me-empty','me-503','me-network','me-timeout']){let writes=0,tokens=0,checks=0;await mock(async p=>{if(p==='/api/auth/csrf'){tokens++;return fault==='token-csrf'&&tokens>1?json({error:{code:'CSRF_INVALID'}},403):json({data:{csrf}});}if(p==='/api/auth/me'){checks++;if(fault==='me-csrf')return json({error:{code:'CSRF_INVALID'}},403);if(fault==='me-201')return json({data:{id:1}},201);if(fault==='me-empty')return new Response(null);if(fault==='me-503')return json({error:{}},503);if(fault==='me-timeout')throw new DOMException('timeout','TimeoutError');throw new TypeError('network');}writes++;return json({error:{code:'CSRF_INVALID'}},403);},async()=>{await assert.rejects(request('/write',{method:'POST'}),{status:403,code:'CSRF_INVALID'});assert.equal(writes,1,fault);assert.equal(tokens,2);assert.ok(checks<=3);});}
 for(const path of ['/auth/csrf','/AUTH/CSRF/?x=1']){let writes=0,tokens=0;await mock(async(p,options)=>{if(p==='/api/auth/csrf'&&options.method==='GET'){tokens++;return json({data:{csrf}});}writes++;return json({error:{code:'CSRF_INVALID'}},403);},async()=>{await assert.rejects(request(path,{method:'POST'}),{status:403});assert.equal(tokens,1);assert.equal(writes,1);});}
});
test('Error: sesudah satu pemulihan CSRF, timeout/network/5xx tidak memicu request tulis ketiga',async()=>{
 for(const fault of ['timeout','network',500,502,503,504]){let writes=0;await mock(async p=>{if(p==='/api/auth/csrf')return json({data:{csrf}});if(p==='/api/auth/me')return json({data:{id:1}});if(++writes===1)return json({error:{code:'CSRF_INVALID'}},403);if(fault==='timeout')throw new DOMException('timeout','TimeoutError');if(fault==='network')throw new TypeError('network');return json({error:{}},fault);},async()=>{await assert.rejects(request('/write',{method:'POST'}),{uncertain:true});assert.equal(writes,2);});}
});
test('Error: CSRF pada sesi habis menjadi LOGIN_REQUIRED; safeNext menolak redirect eksternal',async()=>{
 let count=0;await mock(async path=>{if(path==='/api/auth/csrf')return json({data:{csrf}});if(path==='/api/auth/me')return json({error:{code:'LOGIN_REQUIRED'}},401);count++;return json({error:{code:'CSRF_INVALID'}},403);},async()=>{await assert.rejects(request('/forms/test/apply',{method:'POST'}),{status:401,type:'session'});assert.equal(count,1);});
 for(const next of ['https://evil.invalid','//evil.invalid','/%2f%2fevil.invalid','/input/baa.html%0a','javascript:alert(1)'])assert.equal(safeNext(next),'/index.html');assert.equal(safeNext('/input/baa.html?x=1'),'/input/baa.html?x=1');
});
test('Error: CSRF pada GET pulih sekali; penolakan endpoint token tidak berulang/deadlock',async()=>{
 let reads=0,tokens=0;await mock(async path=>{if(path==='/api/auth/csrf'){tokens++;return json({data:{csrf}});}return ++reads===1?json({error:{code:'CSRF_INVALID'}},403):json({data:[]});},async()=>{await request('/safe');assert.equal(reads,2);assert.equal(tokens,1);});
 tokens=0;await mock(async()=>{tokens++;return json({error:{code:'CSRF_INVALID'}},403);},async()=>{await assert.rejects(request('/auth/csrf'),{type:'csrf'});assert.equal(tokens,1);});
 reads=0;tokens=0;await mock(async path=>{if(path==='/api/auth/csrf'){tokens++;return json({data:{csrf}});}return ++reads<3?json({error:{}},503):json({error:{code:'CSRF_INVALID'}},403);},async()=>{await assert.rejects(request('/safe'),{type:'csrf'});assert.equal(reads,3,'GET stays within its existing total of three attempts');assert.equal(tokens,0);});
});
test('Error: respons 200 kosong/HTML/JSON salah/204 ditolak, status non-JSON dipertahankan',async()=>{
 for(const response of [()=>new Response(null),()=>new Response('<html>private</html>',{headers:{'content-type':'text/html'}}),()=>json({}),()=>json({data:null}),()=>json({error:{message:'sentinel'}}),()=>new Response(null,{status:204}),()=>new Response('{',{headers:{'content-type':'application/json'}})]){let count=0;await mock(async()=>{count++;return response();},async()=>{await assert.rejects(request('/test'),{type:'response'});assert.equal(count,1);});}
 await mock(async()=>new Response('<html>driver sentinel</html>',{status:403}),async()=>{await assert.rejects(request('/test'),e=>e.status===403&&!e.message.includes('sentinel'));});
});
test('Error: timeout mengakhiri request, kegagalan getUser tidak meracuni percobaan berikutnya',async()=>{
 let count=0;await mock(async(path,options)=>{if(path==='/api/auth/csrf')return json({data:{csrf}});count++;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));},async()=>{const keepAlive=setInterval(()=>{},1000);try{await assert.rejects(request('/write',{method:'POST',timeout:20}),{type:'timeout',uncertain:true});assert.equal(count,1);}finally{clearInterval(keepAlive);}});
 count=0;await mock(async()=>++count<=3?json({error:{}},503):json({data:{id:123}}),async()=>{await assert.rejects(getUser());assert.equal((await getUser()).id,123);assert.equal(count,4);});
});
test('Error: HTML khusus/no-store, API JSON existing, request_id sama dengan log tanpa detail',async()=>{
 const logs=[],info=console.info;console.info=line=>logs.push(JSON.parse(line));
 const app=express();app.use(requestLog);app.get(['/fault/:status','/api/fault/:status'],(req,res,next)=>next(Object.assign(new Error('SQL driver /private password sentinel'),{status:Number(req.params.status)})));app.get('/known',(req,res,next)=>next(new HttpError(422,'Input tidak valid.','VALIDATION_ERROR',[{field:'nama',message:'Wajib diisi'}])));app.use(errorResponse);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{for(const status of [400,403,404,413,429,500,503]){
  const r=await fetch(base+'/fault/'+status,{headers:{accept:'text/html'}}),text=await r.text();assert.equal(r.status,status);assert.match(r.headers.get('content-type'),/text\/html/);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(text.includes(r.headers.get('x-request-id')));assert.ok(!/sentinel|SQL driver|\/private/.test(text));assert.ok(!/<script(?![^>]*src=)/i.test(text));
  const api=await fetch(base+'/api/fault/'+status,{headers:{accept:'text/html'}});assert.match(api.headers.get('content-type'),/application\/json/);assert.equal(api.status,status);const data=await api.json();assert.equal(data.error.request_id,api.headers.get('x-request-id'));assert.ok(logs.some(l=>l.request_id===data.error.request_id&&l.status===status));assert.ok(!JSON.stringify(data).includes('sentinel'));
 }
 const known=await (await fetch(base+'/known')).json();assert.deepEqual(known.error.fields,[{field:'nama',message:'Wajib diisi'}]);assert.equal(known.error.code,'VALIDATION_ERROR');assert.equal(known.error.message,'Input tidak valid.');assert.ok(!JSON.stringify(logs).includes('password'));
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));console.info=info;}
});
test('Error: aplikasi asli 404, privat anonim redirect sama, API unknown tetap JSON; maintenance mandiri',async()=>{
 const app=createApp({pool:{query:async()=>({rows:[]})},secret:'test-error-secret-'.repeat(4),passwordEnv:{}}),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{const missing=await fetch(base+'/not-found.html',{headers:{accept:'text/html'}});assert.equal(missing.status,404);assert.match(await missing.text(),/Halaman tidak ditemukan/);
 for(const path of ['/input/baa.html','/input/missing.html','/admin/users.html','/admin/missing.html']){const r=await fetch(base+path,{headers:{accept:'text/html'},redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/login.html?next='+encodeURIComponent(safeNext(path)));}
 const api=await fetch(base+'/api/missing',{headers:{accept:'text/html'}});assert.equal(api.status,404);assert.equal((await api.json()).error.code,'NOT_FOUND');
 const maintenance=await readFile('static-web/maintenance.html','utf8');assert.ok(!/<script|<link|src="\//.test(maintenance));assert.match(maintenance,/data:image\/png;base64,/);
 }finally{app.locals.store.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('Error: DB session tidak terjangkau -> HTML 503, API existing JSON 500, aset error tetap 200',async()=>{
 let fault=false;const pool={query:async()=>{if(fault)throw Object.assign(new Error('driver SQL /private password sentinel'),{code:'ECONNREFUSED'});return {rows:[]};}};
 const app=createApp({pool,secret:'error-db-fault-secret-'.repeat(3),passwordEnv:{}}),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{const initial=await fetch(base+'/api/auth/csrf'),cookie=initial.headers.get('set-cookie').split(';')[0];await initial.text();fault=true;
  const html=await fetch(base+'/input/baa.html',{headers:{cookie,accept:'text/html'}});assert.equal(html.status,503);assert.match(await html.text(),/Maaf, layanan sedang tidak tersedia/);
  const api=await fetch(base+'/api/auth/me',{headers:{cookie,accept:'text/html'}});assert.equal(api.status,500);const json=await api.json();assert.equal(json.error.code,'INTERNAL_ERROR');assert.ok(!JSON.stringify(json).includes('sentinel'));
  for(const path of ['/assets/css/errors.css','/assets/js/error-page.js','/assets/images/logo-itpln-lambang.png']){const r=await fetch(base+path,{headers:{cookie}});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');await r.arrayBuffer();}
  assert.equal((await fetch(base+'/errors/503.html',{headers:{cookie}})).status,503);assert.equal((await fetch(base+'/maintenance.html',{headers:{cookie}})).status,200);
 }finally{app.locals.store.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('Error: kegagalan sesudah header menutup body parsial tanpa stack/detail',async()=>{
 const app=express();app.use(requestLog);app.get('/api/partial',(req,res,next)=>{res.type('json').write('{"data":');next(new Error('SQL /private password sentinel'));});app.use(errorResponse);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{await assert.rejects(fetch('http://127.0.0.1:'+server.address().port+'/api/partial').then(r=>r.text()),TypeError);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
