import {Worker} from 'node:worker_threads';
import {HttpError} from '../middleware/security.js';
import {assertTemplateBytes} from './form-xlsx.js';
const integer=(v,fallback,min,max)=>Number.isInteger(Number(v))&&Number(v)>=min&&Number(v)<=max?Number(v):fallback;
export function excelConfig(env=process.env){return {
 upload:integer(env.EXCEL_UPLOAD_PER_MINUTE,6,1,1000),template:integer(env.EXCEL_DOWNLOAD_PER_MINUTE,30,1,1000),apply:integer(env.EXCEL_APPLY_PER_MINUTE,12,1,1000),cancel:integer(env.EXCEL_CANCEL_PER_MINUTE,12,1,1000),
 global:integer(env.EXCEL_GLOBAL_PER_MINUTE,120,1,10000),active:integer(env.EXCEL_ACTIVE_JOBS,2,1,8),queue:integer(env.EXCEL_QUEUED_JOBS,5,0,20),
 deadline:integer(env.EXCEL_WORKER_TIMEOUT_MS,5000,50,15000),heap:integer(env.EXCEL_WORKER_HEAP_MB,64,32,128),wait:integer(env.EXCEL_QUEUE_TIMEOUT_MS,10000,100,30000),
 statement:integer(env.EXCEL_STATEMENT_TIMEOUT_MS,10000,100,30000),lock:integer(env.EXCEL_LOCK_TIMEOUT_MS,3000,50,10000)
};}
export function excelWorkerResult(task,message){
 if(message?.type!=='excel:result'||!Object.hasOwn(message,'result')||message.result==null)throw new HttpError(503,'Template gagal dibuat atau tidak lengkap. Silakan coba lagi.','EXCEL_INVALID_OUTPUT');
 return task==='generate'?assertTemplateBytes(message.result instanceof Uint8Array?Buffer.from(message.result):null):message.result;
}
export function excelWorker(task,input,{deadline=5000,heap=64,signal,requestId}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(new HttpError(503,'Permintaan Excel dibatalkan.'));
  const worker=new Worker(new URL('./excel-worker.js',import.meta.url),{workerData:{task,input},resourceLimits:{maxOldGenerationSizeMb:heap,maxYoungGenerationSizeMb:8,stackSizeMb:4},execArgv:[]});let settled=false,messageShape=null,resultBytes=null;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error)console.error(JSON.stringify({event:'excel_worker_failure',request_id:requestId??null,task,code:error.code,status:error.status,result_bytes:resultBytes,deadline_ms:deadline,heap_mb:heap}));worker.terminate().finally(()=>error?reject(error):resolve(value));};
  const abort=()=>finish(new HttpError(503,'Permintaan Excel dibatalkan.'));
  const timer=setTimeout(()=>finish(new HttpError(503,'Pemrosesan Excel melewati batas waktu. Gunakan berkas lebih sederhana.','EXCEL_TIMEOUT')),deadline);
  signal?.addEventListener('abort',abort,{once:true});
  worker.on('message',m=>{
   if(settled)return;
   // Node --watch reports worker imports on this same port before our result.
   // Keep listening; the deadline still bounds a worker that never returns data.
   if(m?.type!=='excel:result'&&(Array.isArray(m?.['watch:import'])||Array.isArray(m?.['watch:require'])))return;
   messageShape={type:typeof m,keys:m&&typeof m==='object'?Object.keys(m).filter(k=>['type','result','error','watch:import','watch:require'].includes(k)):[],result_type:typeof m?.result,result_uint8:m?.result instanceof Uint8Array,has_error:!!m?.error,key_count:m&&typeof m==='object'?Object.keys(m).length:0};resultBytes=m?.result instanceof Uint8Array?m.result.byteLength:null;
   if(m?.type==='excel:result'&&m.error){messageShape.worker_status=m.error.status;messageShape.worker_message=m.error.message.slice(0,240);return finish(task==='generate'?new HttpError(503,'Template gagal dibuat atau tidak lengkap. Silakan coba lagi.','EXCEL_INVALID_OUTPUT'):new HttpError(m.error.status,m.error.message));}
   try{finish(null,excelWorkerResult(task,m));}catch(e){finish(e);}
  });
  worker.once('error',e=>{messageShape={...messageShape,worker_code:e.code??e.name,worker_message:e.message.slice(0,240)};finish(new HttpError(503,'Pemrosesan Excel melampaui sumber daya yang tersedia.','EXCEL_RESOURCE_LIMIT'));});
  worker.once('exit',code=>{if(!settled){messageShape={...messageShape,worker_exit_code:code};finish(new HttpError(503,'Pemrosesan Excel terhenti. Silakan coba lagi.','EXCEL_RESOURCE_LIMIT'));}});
 });
}
// Request slots precede body parsers: queued requests never accumulate multipart buffers.
export function excelGate(config){let active=0;const queue=[],buckets=new Map();
 const drain=()=>{while(active<config.active&&queue.length){const job=queue.shift();if(!job.done)job.enter();}};
 const use=(key,limit,now)=>{let item=buckets.get(key);if(!item||item.until<=now){item={until:now+60000,count:0};buckets.set(key,item);}return ++item.count<=limit;};
 return action=>(req,res,next)=>{
  if(req.aborted||res.destroyed)return next(new HttpError(503,'Permintaan Excel dibatalkan.','EXCEL_ABORTED'));
  const now=Date.now();for(const [key,b]of buckets)if(b.until<=now)buckets.delete(key);
  const deny=(status,message)=>{res.set('Retry-After','60');next(new HttpError(status,message,'EXCEL_BUSY'));};
  if(buckets.size>10000||!use('global',config.global,now)||!use(req.user.id+':'+action,config[action],now))return deny(429,'Batas permintaan Excel tercapai. Coba lagi sebentar.');
  const max=action==='upload'?5*1024*1024+16384:600*1024;
  if(req.headers['content-length']!==undefined&&(!/^\d+$/.test(req.headers['content-length'])||Number(req.headers['content-length'])>max))return next(new HttpError(413,'Berkas atau permintaan terlalu besar.'));
  const controller=new AbortController();req.excelSignal=controller.signal;let timer,entered=false;
  const job={done:false,enter(){if(job.done)return;clearTimeout(timer);entered=true;active++;req.excelAdmitted=true;next();}};
  const release=()=>{if(job.done)return;job.done=true;clearTimeout(timer);req.removeListener('aborted',abort);res.removeListener('close',abort);if(entered)active--;else{const i=queue.indexOf(job);if(i>=0)queue.splice(i,1);}drain();};
  // Disconnect cancels work, but the handler owns its slot until DB cleanup ends.
  const abort=()=>{controller.abort();if(!entered)release();};
  req.excelRelease=release;
  req.once('aborted',abort);res.once('close',abort);
  if(active<config.active)return job.enter();
  if(queue.length>=config.queue){release();return deny(503,'Antrean Excel penuh. Coba lagi sebentar.');}
  queue.push(job);timer=setTimeout(()=>{release();deny(503,'Antrean Excel melewati batas waktu. Coba lagi.');},config.wait);
 };
}
