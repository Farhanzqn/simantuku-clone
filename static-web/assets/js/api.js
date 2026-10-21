import {safeNext,normalizedPagePath} from './navigation.js';
import {ApiError,apiError,isCsrfRejection,retryAfter} from './error-policy.js';
import './error-ui.js';
import {serverFieldMessage} from './validation-message.js';
export {safeNext} from './navigation.js';
export {ApiError} from './error-policy.js';
export const apiSource=Symbol.for('itpln.api-source');
let csrfToken,userPromise,csrfPromise,requestSequence=0;
const emit=(name,detail)=>{if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(name,{detail}));};
export function clearClientState(){csrfToken=undefined;userPromise=undefined;csrfPromise=undefined;}
async function freshCsrf(){
 if(csrfToken)return csrfToken;
 return csrfPromise??=request('/auth/csrf').then(r=>{if(typeof r.data?.csrf!=='string'||!/^[a-f0-9]{64}$/.test(r.data.csrf))throw apiError({kind:'response'});return csrfToken=r.data.csrf;}).finally(()=>{csrfPromise=undefined;});
}
function delay(ms,signal){return new Promise((resolve,reject)=>{if(signal?.aborted)return reject(signal.reason);let timer;const abort=()=>{clearTimeout(timer);reject(signal.reason);};timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);signal?.addEventListener('abort',abort,{once:true});});}
async function jsonPayload(response,method){
 let payload;try{if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??''))throw Error();payload=await response.json();if(!payload||typeof payload!=='object'||Array.isArray(payload)||!Object.hasOwn(payload,response.ok?'data':'error')||response.ok&&(payload.data==null||Object.hasOwn(payload,'error')))throw Error();}catch(e){
  if(['AbortError','TimeoutError'].includes(e.name))throw e;
  if(!response.ok)return {};
  throw apiError({status:response.status,method,kind:'response',requestId:response.headers.get('x-request-id')});
 }return payload;
}
async function transport(path,{method='GET',body,signal,timeout=15000,binary=false,expectedStatus}={}){
 method=method.toUpperCase();const write=!['GET','HEAD'].includes(method),id=++requestSequence;
 const multipart=body instanceof FormData,endpoint=path.split('?')[0].replace(/\/+$/,'').toLowerCase();
 // Capture once: caller edits during token/session refresh must not change a replay.
 const requestBody=multipart?new FormData():body===undefined?undefined:JSON.stringify(body);
 if(multipart)for(const [key,value]of body)requestBody.append(key,value);
 let csrfRetried=false;
 try{
  if(write)await freshCsrf();
  for(let attempt=0;;attempt++){
   let response,payload,deadline;
   try{
    deadline=AbortSignal.timeout(timeout);const combined=signal?AbortSignal.any([signal,deadline]):deadline;
    response=await fetch('/api'+path,{method,credentials:'same-origin',cache:'no-store',signal:combined,headers:{...(body!==undefined&&!multipart?{'Content-Type':'application/json'}:{}),...(write?{'X-CSRF-Token':csrfToken}:{})},...(requestBody!==undefined?{body:requestBody}:{})});
    payload=method==='HEAD'&&response.ok?{data:null}:binary&&response.ok?null:await jsonPayload(response,method);
    if(!response.ok){
     const code=payload?.error?.code,requestId=response.headers.get('x-request-id')??payload?.error?.request_id;
     const error=apiError({status:response.status,code,method,requestId,waitMs:retryAfter(response.headers.get('retry-after'))});
     // Keep field paths, never expose raw validator/driver messages in the UI.
     if(response.status===422&&Array.isArray(payload?.error?.fields))error.fields=payload.error.fields.slice(0,500).filter(f=>typeof f?.field==='string'&&/^[a-zA-Z0-9_.-]{1,160}$/.test(f.field)).map(f=>({field:f.field,message:serverFieldMessage(f.message)}));
     throw error;
    }
    if(expectedStatus!==undefined&&response.status!==expectedStatus)throw apiError({status:response.status,method,kind:'response',requestId:response.headers.get('x-request-id')});
    // Binary validation/body read runs inside the same deadline and error boundary.
    if(binary)return await templateBlob(response);
    if(path==='/auth/logout')clearClientState();
    if(payload.data?.csrf)csrfToken=payload.data.csrf;
    if(['/auth/login','/auth/logout','/auth/change-password'].includes(path))userPromise=undefined;
    payload[apiSource]=path;payload[Symbol.for('itpln.request-id')]=response.headers.get('x-request-id');emit('api-recovered',{path});return payload;
   }catch(original){
    let error=original instanceof ApiError?original:apiError({method,kind:signal?.aborted?(signal.reason?.name==='TimeoutError'?'timeout':'cancelled'):deadline?.aborted||original?.name==='TimeoutError'?'timeout':'network',requestId:response?.headers.get('x-request-id')});
    if(isCsrfRejection(error)){
     csrfToken=undefined;
     // Only this middleware rejection proves the route has not executed.
     // The recovery endpoints cannot start recovery themselves; each call gets one replay.
     if(!csrfRetried&&(write||attempt===0)&&!['/auth/csrf','/auth/me'].includes(endpoint)&&!signal?.aborted){
      csrfRetried=true;
      try{
       await freshCsrf();
       if(write)await request('/auth/me',{expectedStatus:200,signal});
       if(!signal?.aborted)continue;
      }catch(check){if(check.status===401)error=apiError({status:401,code:'LOGIN_REQUIRED',method,requestId:error.requestId});}
     }
    }
    if(error.status===401&&error.code!=='LOGIN_FAILED'){
     clearClientState();if(path!=='/auth/me')emit('session-expired',error);
    }
    if(error.retryable&&attempt<2&&!signal?.aborted){
     const waitMs=Math.max(400*2**attempt,error.waitMs||0);
     // A long Retry-After is displayed for manual retry; do not hold a spinner for minutes.
     if(waitMs<=10000){emit('api-retry',{id,attempt:attempt+1,waitMs});await delay(waitMs,signal);continue;}
    }
    throw error;
   }
  }
 }catch(original){const error=original instanceof ApiError?original:apiError({method,kind:signal?.aborted?'cancelled':'network'});error.path=path;if(!(path==='/auth/me'&&error.status===401))emit('api-failure',error);throw error;
 }finally{emit('api-retry',{id,done:true});}
}
export async function formTransfer(path,{file,signal}={}){
 const body=file?new FormData():undefined;if(file)body.append('file',file);
 return transport(path,{method:file?'POST':'GET',body,signal,timeout:30000,binary:!file});
}
async function templateBlob(response){
 const invalid=()=>apiError({status:502,code:'INVALID_TEMPLATE',requestId:response.headers.get('x-request-id')});
 const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 if(response.status!==200||response.redirected||response.headers.get('content-type')?.split(';')[0].trim()!==mime)throw invalid();
 // Consume the HTTP body exactly once. Validate before creating any download URL.
 let bytes;try{bytes=new Uint8Array(await response.arrayBuffer());}catch{throw invalid();}
 const length=response.headers.get('content-length'),hash=response.headers.get('x-template-sha256');
 if(bytes.length<22||bytes.length>5*1024*1024||length===null||!/^\d+$/.test(length)||Number(length)!==bytes.length||!hash||!/^[a-f0-9]{64}$/.test(hash))throw invalid();
 const view=new DataView(bytes.buffer),end=bytes.length-22;
 if(view.getUint32(0,true)!==0x04034b50||view.getUint32(end,true)!==0x06054b50||view.getUint16(end+20,true)!==0||view.getUint32(end+12,true)+view.getUint32(end+16,true)!==end)throw invalid();
 const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(actual!==hash)throw invalid();
 return new Blob([bytes],{type:mime});
}
if(typeof window!=='undefined'){
 // BFCache dapat menyimpan DOM walaupun HTTP no-store. Salinan halaman
 // privat disembunyikan sebelum ditinggalkan, lalu meminta HTML baru.
 const privatePage=/^\/(?:input\/|admin\/|(?:pegawai-formasi|keuangan|ami|statistik-tendik|monitoring-kpi|monitoring-iku|capaian-iku-universitas|kualitas-data|ruang-unit|verifikasi|ganti-password)\.html$)/i.test(normalizedPagePath(location.pathname));
 window.addEventListener('pagehide',()=>{if(privatePage)document.documentElement.style.visibility='hidden';});
 window.addEventListener('pageshow',event=>{if(event.persisted){clearClientState();location.reload();}});
 window.addEventListener('focus',clearClientState);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')clearClientState();});
}
export const request=(path,options={})=>transport(path,options);
export function getUser(){return userPromise??=request('/auth/me').then(r=>r.data).catch(e=>{userPromise=undefined;if(e.status===401)return null;throw e;});}
export function loginUrl(next=location.pathname+location.search+location.hash){return '/login.html?next='+encodeURIComponent(safeNext(next));}
export async function requireUser(){const user=await getUser();if(!user){location.replace(loginUrl());return null;}if(user.must_change_password){location.replace('/ganti-password.html?next='+encodeURIComponent(safeNext(location.pathname+location.search)));return null;}return user;}
export function query(values={}){const p=new URLSearchParams();for(const [k,v] of Object.entries(values))if(v!==''&&v!==null&&v!==undefined)p.set(k,v);return p.size?'?'+p:'';}
export const numbers=new Intl.NumberFormat('id-ID',{maximumFractionDigits:2});
export const numeric=value=>value===null||value===undefined||value===''?null:Number.isFinite(Number(value))?Number(value):null;
export const format=value=>numeric(value)===null?'belum ada data':numbers.format(Number(value));
export function sum(rows,key){const values=rows.map(r=>numeric(r[key])).filter(v=>v!==null);return values.length?values.reduce((a,b)=>a+b,0):null;}
export function period(row={}){
  const parts=[];
  if(row.tahun_ajaran&&row.semester_akademik)parts.push(`${row.semester_akademik} ${row.tahun_ajaran}`);
  else if(row.periode_akademik_kode)parts.push('Akademik '+row.periode_akademik_kode);
  const match=/^(\d{4})-S([12])$/.exec(row.periode_laporan_kode??row.kode??'');
  if(match)parts.push(`Laporan Semester ${match[2]==='1'?'I':'II'} ${match[1]}`);
  if(row.tanggal_snapshot){const date=new Date(row.tanggal_snapshot+'T00:00:00+07:00');if(!Number.isNaN(date.getTime()))parts.push('per '+new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(date));}
  return parts.join(' · ');
}
export function date(value){if(!value)return 'belum ada data';const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T00:00:00+07:00':value);return Number.isNaN(d.getTime())?'belum ada data':new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(d);}

export function difference(rows,total,part){if(!rows.length||rows.some(r=>numeric(r[total])===null||numeric(r[part])===null||Number(r[part])>Number(r[total])))return null;return sum(rows,total)-sum(rows,part);}
