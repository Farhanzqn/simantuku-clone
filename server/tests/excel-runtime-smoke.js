// Browser smoke against the unmodified application entry point (start AND dev).
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {excelForms} from '../../static-web/assets/js/excel-schema.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const units={'mahasiswa-aktif':'baa',lulusan:'baa','mahasiswa-baru':'ppa',prestasi:'bkm',kerjasama:'kerjasama'};
export async function excelBrowsers(){
 const paths={Edge:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'],Brave:['C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe']};const found=[];
 for(const [name,candidates]of Object.entries(paths)){let executable;for(const path of candidates)try{await access(path);executable=path;break;}catch{}assert.ok(executable,name+' harus tersedia untuk smoke Excel');found.push({name,executable});}return found;
}
export async function excelBrowserSmoke({base,email,password,browser,root,domains=Object.keys(excelForms),report,academic,pmbAcademic}){
 const ExcelJS=(await import('../../.runtime/xlsx-diag/scratch/node_modules/exceljs/excel.js')).default;
 const directory=resolve(root,browser.name+'-'+randomUUID());await mkdir(directory,{recursive:true});
 const child=spawn(browser.executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+directory,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let socket;const results=[],responses=[];
 try{
  let debug;for(let i=0;i<100;i++){try{debug=(await readFile(resolve(directory,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{}await pause(100);}assert.ok(debug,browser.name+' DevTools tersedia');
  const pages=await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json();socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((ok,fail)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map(),downloads=new Map();
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}}
   if(m.method==='Browser.downloadWillBegin')downloads.set(m.params.guid,{...m.params});
   if(m.method==='Browser.downloadProgress')Object.assign(downloads.get(m.params.guid)??{},m.params);
   if(m.method==='Network.responseReceived'&&/\/api\/forms\//.test(m.params.response.url)){const r=m.params.response;responses.push({url:r.url,status:r.status,request_id:r.headers['x-request-id']??r.headers['X-Request-Id']});}
  });
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},10000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error('Browser evaluation failed');return r.result.value;};
  const wait=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await pause(100);}throw new Error('UI timeout: '+expression);};
  const goto=async path=>{const marker=randomUUID();await evaluate(`document.documentElement.dataset.smoke=${JSON.stringify(marker)}`);await call('Page.navigate',{url:base+path});await wait(`document.documentElement?.dataset.smoke!==${JSON.stringify(marker)}&&document.readyState==='complete'`);};
  const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getClientRects()[0];return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...point});};
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await call('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:directory,eventsEnabled:true});
  await goto('/login.html');await wait("!!document.querySelector('#auth-form [name=email]')");
  // Password stays in memory; never serialize CDP commands or cookies to artifacts.
  await evaluate(`document.querySelector('[name=email]').value=${JSON.stringify(email)};document.querySelector('[name=password]').value=${JSON.stringify(password)}`);await click('#auth-form button[type=submit]');await wait("location.pathname==='/index.html'");
  for(const domain of domains)for(const scope of domain==='lulusan'?['prodi','institusi']:[null]){
   await goto('/input/'+(units[domain]||'bsdm')+'.html');await wait(`!!document.querySelector('[data-domain="${domain}"]')`);await click(`[data-domain="${domain}"]`);await wait(`!!document.querySelector('[data-domain="${domain}"][aria-selected="true"]')&&!!document.querySelector('#entry-table tbody tr')&&!!document.querySelector('#template-upload button')`);
   const values={...(report?{report:String(report)}:{}),...(academic?{academic:String(domain==='mahasiswa-baru'?(pmbAcademic??academic):academic)}:{}),...(scope?{scope,...(scope==='prodi'?{wisuda:'Smoke Excel'}:{wisuda:''})}:{})};
   // Only clean context controls change; no input cells, save/apply or domain writes.
   if(Object.keys(values).length){await evaluate(`(()=>{const values=${JSON.stringify(values)};for(const [name,value]of Object.entries(values)){const e=document.querySelector('[name='+name+']');e.value=value;}document.querySelector('[name=report]').dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait("!!document.querySelector('#entry-table tbody tr')");}
   if(scope)await wait("document.querySelectorAll('#entry-table tbody tr').length==="+(scope==='institusi'?1:19));
   const previous=new Set(downloads.keys());await click('#template-upload button');let saved;
   for(let i=0;i<150;i++){saved=[...downloads.values()].find(d=>!previous.has(d.guid));if(['completed','canceled'].includes(saved?.state))break;await pause(100);}
   assert.equal(saved?.state,'completed',domain+' '+(scope??'')+': '+await evaluate("document.querySelector('#template-upload .save-status')?.textContent"));assert.ok(saved.receivedBytes>0);assert.equal(saved.suggestedFilename,domain+'-template.xlsx');
   const bytes=await readFile(resolve(directory,saved.guid));assert.equal(bytes.length,saved.receivedBytes);assert.equal(bytes.subarray(0,4).toString('hex'),'504b0304');const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);assert.deepEqual(book.worksheets.map(s=>s.name),['Petunjuk','Data','_meta']);const meta=book.getWorksheet('_meta');assert.equal(meta.state,'hidden');assert.equal(meta.getCell('B1').value,domain);const context=JSON.parse(meta.getCell('B4').value);if(report)assert.equal(String(context.periode_laporan_id),String(report));if(scope)assert.equal(context.cakupan,scope);
   const file=resolve(directory,domain+(scope?'-'+scope:'')+'-template.xlsx');await writeFile(file,bytes);results.push({domain,scope,size:bytes.length,file,exceljs:true});
  }
  assert.ok(responses.every(r=>r.status===200),'Semua GET data/template nyata wajib 200: '+JSON.stringify(responses.filter(r=>r.status!==200)));
  await call('Browser.close');return {browser:browser.name,results,responses};
 }finally{socket?.close();child.kill();await writeFile(resolve(directory,'results.json'),JSON.stringify({browser:browser.name,results,responses},null,2));}
}
