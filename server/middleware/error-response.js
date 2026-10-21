import {readFileSync} from 'node:fs';
import {HttpError} from './security.js';
import {safeNext} from '../../static-web/assets/js/navigation.js';
const codes=[400,401,403,404,413,429,500,503];
const pages=new Map(codes.map(code=>[code,readFileSync(new URL(`../../static-web/errors/${code}.html`,import.meta.url),'utf8')]));
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function sendErrorPage(req,res,status){
 const code=pages.has(status)?status:500;
 const html=pages.get(code).replace('data-request-id=""','data-request-id="'+escape(req.requestId)+'"').replace('data-retry-after=""','data-retry-after="'+escape(/^\d{1,6}$/.test(res.getHeader('retry-after')??'')?res.getHeader('retry-after'):'')+'"');
 res.status(status).set('Cache-Control','no-store').type('html').send(html);
}
export function errorResponse(err,req,res,next){
 // A partial response cannot become an error page/JSON envelope. Close it
 // without passing raw exceptions to Express' development stack reporter.
 if(res.headersSent){res.destroy();return;}
 const candidate=err.status||({'23505':409,'23503':422,'23514':422,'42501':403,'22007':422}[err.code])||500;
 const status=Number.isInteger(candidate)&&candidate>=400&&candidate<=599?candidate:500,known=err instanceof HttpError;
 const api=/^\/api(?:\/|$)/i.test(req.path),html=!api&&['GET','HEAD'].includes(req.method)&&req.get('accept')?.toLowerCase().includes('text/html');
 res.set('Cache-Control','no-store');
 if(status===401&&html)return res.redirect(302,'/login.html?next='+encodeURIComponent(safeNext(req.originalUrl)));
 if(html)return sendErrorPage(req,res,['ECONNREFUSED','ECONNRESET','08006','08001','57P01','57P03'].includes(err.code)?503:status);
 // Preserve the established API envelope, codes, fields and messages.
 res.status(status).json({error:{code:known?err.code:status===500?'INTERNAL_ERROR':status===400||status===413?'INVALID_REQUEST':'DATABASE_CONSTRAINT',message:known?err.message:status===500?'Terjadi kesalahan internal.':status===400||status===413?'Request tidak valid atau terlalu besar.':'Data melanggar aturan database.',...(known&&err.fields?{fields:err.fields}:{}),request_id:req.requestId}});
}
