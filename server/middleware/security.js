import { randomBytes, timingSafeEqual } from 'node:crypto';
export class HttpError extends Error {
  constructor(status,message,code='REQUEST_REJECTED',fields){super(message);this.status=status;this.code=code;this.fields=fields;}
}
export const requireLogin=(req,res,next)=>req.user?next():next(new HttpError(401,'Silakan masuk.','LOGIN_REQUIRED'));
export const roles=(...allowed)=>(req,res,next)=>{if(!req.user)return next(new HttpError(401,'Silakan masuk.','LOGIN_REQUIRED'));allowed.includes(req.user.role)?next():next(new HttpError(403,'Role tidak memiliki akses.','FORBIDDEN'));};
export const newToken=()=>randomBytes(32).toString('hex');
export function csrf(req,res,next){
  if(['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const value=req.get('x-csrf-token'); const expected=req.session?.csrf;
  if(typeof value!=='string'||!expected||Buffer.byteLength(value)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(value),Buffer.from(expected))) return next(new HttpError(403,'Token CSRF tidak valid.','CSRF_INVALID'));
  next();
}
export function visibility(pool,globalPublic,modules){return async(req,res,next)=>{
  const list=typeof modules==='function'?modules(req):modules;
  const result=await pool.query('SELECT kode_modul,akses,aktif FROM visibilitas_modul WHERE kode_modul=ANY($1::text[])',[list]);
  if(result.rows.length!==list.length||result.rows.some(r=>!r.aktif)) throw new HttpError(403,'Modul dinonaktifkan.');
  if(!req.user && (!globalPublic||result.rows.some(r=>r.akses!=='public'))) throw new HttpError(401,'Modul ini memerlukan login.','LOGIN_REQUIRED');
  next();
};}
export const validId=(value)=>{if(!/^\d+$/.test(String(value))||Number(value)<1||!Number.isSafeInteger(Number(value))) throw new HttpError(422,'ID tidak valid.');return String(value);};
export function parse(schema,value){const r=schema.safeParse(value);if(!r.success)throw new HttpError(422,'Input tidak valid.','VALIDATION_ERROR',r.error.issues.map(i=>({field:i.path.join('.'),message:i.message})));return r.data;}
