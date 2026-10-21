import {z} from 'zod';
import {HttpError,validId} from '../middleware/security.js';
import {domains,getDomain} from '../validators/domains.js';
import {locked,review,withActor} from './data.js';

const id=z.union([z.string(),z.number()]).transform(value=>String(Number(validId(value))));
export const verificationFilter=z.object({domain:z.enum(Object.keys(domains)).optional(),unit_id:id.optional(),periode_laporan_id:id.optional()}).strict();
export const bulkReviewSchema=z.object({
  confirmed:z.literal(true),filter:verificationFilter,
  items:z.array(z.object({domain:z.enum(Object.keys(domains)),id,row_version:z.number().int().positive().safe()}).strict()).min(1).max(100),
  review_note:z.string().trim().max(2000).optional()
}).strict().superRefine((body,ctx)=>{
  if(new Set(body.items.map(x=>x.domain+':'+x.id)).size!==body.items.length)ctx.addIssue({code:'custom',path:['items'],message:'Daftar item duplikat.'});
});

export async function bulkReview(pool,req,body,approve){
  const action=approve?'approve':'reject',results=[],deadline=Date.now()+30000;
  for(const item of body.items){
    // Bound the request even when several database locks time out. Already committed items remain reported.
    if(Date.now()>deadline){results.push({...item,outcome:'failed',code:'BATCH_DEADLINE',reason:'Batas waktu proses tercapai. Item ini belum diproses; muat ulang sebelum mencoba kembali.'});continue;}
    try{
      await withActor(pool,req,action,async c=>{
        const d=getDomain(item.domain),row=await locked(c,d,item.id,req.user);
        if(body.filter.domain&&body.filter.domain!==d.name||body.filter.unit_id&&String(row.unit_id)!==body.filter.unit_id||body.filter.periode_laporan_id&&String(row.periode_laporan_id)!==body.filter.periode_laporan_id)throw new HttpError(409,'Item di luar filter yang dikonfirmasi.','FILTER_CHANGED');
        if(row.status!=='submitted')throw new HttpError(409,'Status bukan lagi submitted.','STATUS_CHANGED');
        if(row.row_version!==item.row_version)throw new HttpError(409,'Versi berubah sejak ditampilkan.','VERSION_CHANGED');
        if(String(row.submitted_by)===String(req.user.id))throw new HttpError(403,'Pengajuan sendiri harus diverifikasi pengguna lain.','SELF_SUBMISSION');
        await review(c,d,req,item.id,{row_version:item.row_version,review_note:approve?'':body.review_note},approve);
      });
      results.push({...item,outcome:'success'});
    }catch(error){
      const skipped=error instanceof HttpError&&[403,404,409].includes(error.status);
      results.push({...item,outcome:skipped?'skipped':'failed',code:error instanceof HttpError?error.code:'ITEM_FAILED',reason:error instanceof HttpError?error.message:'Item gagal diproses. Muat ulang dan periksa sebelum mencoba kembali.'});
    }
  }
  const counts={success:results.filter(x=>x.outcome==='success').length,skipped:results.filter(x=>x.outcome==='skipped').length,failed:results.filter(x=>x.outcome==='failed').length};
  let auditId=null;
  try{auditId=await withActor(pool,req,'bulk_'+action,async c=>(await c.query('SELECT record_bulk_verification_event($1,$2,$3,$4,$5,$6,$7) AS id',['bulk_'+action,body.items.length,counts.success,counts.skipped,counts.failed,body.filter,approve?null:body.review_note])).rows[0].id);}
  catch{console.error(JSON.stringify({event:'bulk_verification_audit_failed',request_id:req.requestId}));}
  return {results,counts,audit_recorded:auditId!==null,audit_id:auditId,request_id:req.requestId};
}
