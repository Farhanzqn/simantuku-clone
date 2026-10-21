import {randomUUID} from 'node:crypto';
// Fixed groups only: no raw path/query/body/cookie, account, SQL or exception text.
const group=path=>/^\/api\/forms\/[^/]+\/upload(?:\/cancel)?\/?$/i.test(path)?'excel_upload':/^\/api\/forms\/[^/]+\/template\/?$/i.test(path)?'excel_template':/^\/api\/forms\/[^/]+\/apply\/?$/i.test(path)?'excel_apply':/^\/api\/auth(?:\/|$)/i.test(path)?'auth':/^\/api\/verification(?:\/|$)/i.test(path)?'verification':/^\/api(?:\/|$)/i.test(path)?'api':'page';
export function requestLog(req,res,next){
 req.requestId=randomUUID();res.set('x-request-id',req.requestId);const start=performance.now(),category=group(req.path);let code,finished=false;
 const json=res.json;res.json=function(body){if(typeof body?.error?.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(body.error.code))code=body.error.code;return json.call(this,body);};
 const log=aborted=>{if(finished)return;finished=true;if(res.statusCode<400&&!aborted&&!['excel_upload','excel_template','excel_apply','auth'].includes(category))return;console.info(JSON.stringify({event:'http_result',request_id:req.requestId,method:['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(req.method)?req.method:'OTHER',group:category,status:res.statusCode,code:code??(res.statusCode>=400?'HTTP_'+res.statusCode:'OK'),duration_ms:Math.round(performance.now()-start),excel_admitted:!!req.excelAdmitted,aborted}));};
 res.once('finish',()=>log(false));res.once('close',()=>log(!res.writableFinished));next();
}
