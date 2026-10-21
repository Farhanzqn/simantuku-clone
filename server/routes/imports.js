import { Router } from 'express';
import { z } from 'zod';
import { parse as parseCSV } from 'csv-parse/sync';
import { requireLogin,roles,parse,validId,HttpError } from '../middleware/security.js';
import { getDomain,validate } from '../validators/domains.js';
import { authorizeDomain,withActor,createDraft,validateReferences } from '../services/data.js';
const csvCell=v=>{const s=String(v??'');return '"'+(/^[=+@\-]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';};
export function importRoutes(pool){const r=Router();r.use(requireLogin,roles('admin','prp'));
  r.get('/:domain/template',async(req,res)=>{const d=getDomain(req.params.domain);await authorizeDomain(pool,req.user,d,true);
    const fields=Object.keys(d.shape),prodi=fields.includes('prodi_id')?(await pool.query('SELECT id FROM prodi WHERE aktif ORDER BY urutan')).rows:[{}];
    res.type('text/csv').attachment(`${d.name}-template.csv`).send('\ufeff'+fields.join(',')+'\r\n'+prodi.map(p=>fields.map(k=>csvCell(k==='prodi_id'?p.id:'')).join(',')).join('\r\n'));});
  r.post('/:domain/preview',async(req,res)=>{const d=getDomain(req.params.domain),owner=await authorizeDomain(pool,req.user,d,true);
    const body=parse(z.object({csv:z.string().min(1).max(500000),periode_laporan_id:z.union([z.string(),z.number()]),periode_akademik_id:z.union([z.string(),z.number()]).nullable().optional()}).strict(),req.body);
    let lines;try{lines=parseCSV(body.csv,{columns:true,bom:true,skip_empty_lines:true,trim:true,max_record_size:50000});}catch{throw new HttpError(422,'CSV tidak dapat dibaca.');}
    if(!lines.length||lines.length>200)throw new HttpError(422,'CSV harus berisi 1–200 baris.');
    const errors=[],rows=[],keys=new Set();
    for(let i=0;i<lines.length;i++){try{
      const row={...lines[i]};for(const k of Object.keys(row)){
        if(row[k]===''||row[k]==='-')row[k]=null;
        else if(['data_sementara'].includes(k)){if(!['true','false'].includes(row[k]))throw new HttpError(422,'Boolean CSV harus true atau false.');row[k]=row[k]==='true';}
        else if(['total','perempuan','laki','s3','tenaga_pengajar','asisten_ahli','lektor','lektor_kepala','guru_besar','angkatan','masa_studi_rata','tahun_lulus','tahun_masuk','jumlah','responden','target','realisasi_daftar_ulang','nilai_numerik','ipk_rata'].includes(k)||k.startsWith('kerja_')||k.startsWith('sesuai_bidang')||k.startsWith('wirausaha')||k.startsWith('studi_lanjut'))row[k]=Number(row[k]);
        else if(k==='metrik_tambahan')row[k]=JSON.parse(row[k]);
      }
      row.periode_laporan_id=validId(body.periode_laporan_id);if(body.periode_akademik_id!==undefined)row.periode_akademik_id=body.periode_akademik_id===null?null:validId(body.periode_akademik_id);
      const checked=validate(d,row);await validateReferences(pool,d,checked);const key=JSON.stringify(d.keys.map(k=>checked[k]));if(keys.has(key))throw new HttpError(422,'Kunci periode/prodi duplikat dalam CSV.');keys.add(key);rows.push(checked);
    }catch(e){errors.push({row:i+2,message:e.status?e.message:'Nilai CSV tidak valid',fields:e.fields});}}
    const batch=await withActor(pool,req,'import_preview',async c=>{
      const id=(await c.query(`INSERT INTO import_batch(user_id,unit_id,domain,periode_laporan_id,periode_akademik_id,status,payload,hasil_preview,expires_at) VALUES($1,$2,$3,$4,$5,'preview',$6,$7,now()+interval '1 hour') RETURNING id`,[req.user.id,owner,d.name,validId(body.periode_laporan_id),body.periode_akademik_id??null,JSON.stringify(rows),JSON.stringify(errors)])).rows[0].id;
      await c.query("SELECT record_app_event('import_preview')");return id;
    });res.json({data:{batch_id:batch,rows,errors,can_commit:errors.length===0}});
  });
  r.get('/:batchId',async(req,res)=>{const b=(await pool.query('SELECT id,domain,status,hasil_preview,payload,expires_at FROM import_batch WHERE id=$1 AND (user_id=$2 OR $3::boolean)',[validId(req.params.batchId),req.user.id,req.user.role==='admin'])).rows[0];if(!b)throw new HttpError(404,'Batch tidak ditemukan.');res.json({data:b});});
  r.post('/:batchId/commit',async(req,res)=>{parse(z.object({}).strict(),req.body);const result=await withActor(pool,req,'import_commit',async c=>{
    const b=(await c.query('SELECT * FROM import_batch WHERE id=$1 AND (user_id=$2 OR $3::boolean) FOR UPDATE',[validId(req.params.batchId),req.user.id,req.user.role==='admin'])).rows[0];
    if(!b)throw new HttpError(404,'Batch tidak ditemukan.');const d=getDomain(b.domain);await authorizeDomain(c,req.user,d,true);
    if(b.status==='committed')return {batch_id:b.id,already_committed:true};
    if(new Date(b.expires_at)<=new Date()||b.hasil_preview.length)throw new HttpError(409,'Preview kadaluarsa atau mengandung error.');
    const rows=[];for(const row of b.payload)rows.push(await createDraft(c,d,req,row));
    await c.query("UPDATE import_batch SET status='committed' WHERE id=$1 AND (user_id=$2 OR $3::boolean)",[b.id,req.user.id,req.user.role==='admin']);await c.query("SELECT record_app_event('import_commit')");return {batch_id:b.id,rows};
  });res.json({data:result});});return r;
}
