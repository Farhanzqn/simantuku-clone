import { Router } from 'express';
import { z } from 'zod';
import { roles,parse,validId,HttpError,visibility,requireLogin } from '../middleware/security.js';
import { withActor } from '../services/data.js';
const id=z.union([z.string().regex(/^[1-9]\d*$/),z.number().int().positive()]);const text=z.string().trim().min(1).max(2000);
const configs={
  '/kpi/indikator':['kpi_indikator',z.object({kode:text,tahun:z.number().int().min(2000),perspektif:z.enum(['A','B','C','D']),nama:text,formula:text,bobot:z.number().finite(),
    target_nilai:z.number().nonnegative().nullable(),target_teks:text.nullable(),target_tanggal:z.iso.date().nullable(),satuan:text,jenis:z.enum(['angka','persen','tanggal','indeks']),
    arah:z.enum(['higher_is_better','lower_is_better']),arah_terkonfirmasi:z.boolean(),unit_pemilik_id:id,sumber_id:id}).strict()],
  '/rka-target':['rka_target',z.object({kode_item:text,item:text,angka:z.number().nonnegative(),satuan:text,tahun:z.number().int().min(2000),jenjang:z.enum(['D3','S1','S2','PROFESI']).nullable(),sumber_id:id}).strict()]};
export function kpiMasterRoutes(pool,globalPublic){const r=Router();
  for(const [path,[table,schema]] of Object.entries(configs)){
    r.get(path,requireLogin,visibility(pool,globalPublic,['kpi']),async(req,res)=>res.json({data:(await pool.query(table==='rka_target'?`SELECT m.*,CASE WHEN v.id IS NULL THEN m.angka ELSE v.angka END AS angka FROM rka_target m LEFT JOIN LATERAL (SELECT id,angka FROM rka_revisi WHERE rka_target_id=m.id AND status='approved' AND is_current_approved ORDER BY periode_laporan_id DESC LIMIT 1) v ON true ORDER BY m.id LIMIT 200`:`SELECT * FROM ${table} ORDER BY id LIMIT 200`)).rows}));
    for(const method of ['post','patch'])r[method](path+(method==='patch'?'/:id':''),roles('admin','prp'),async(req,res)=>{
      if(table==='rka_target')throw new HttpError(409,'Gunakan formulir Target RKA dan alur persetujuan.');
      const b=parse(method==='post'?schema:schema.partial(),req.body),keys=Object.keys(b);if(!keys.length)throw new HttpError(422,'Tidak ada perubahan.');
      const out=await withActor(pool,req,'kpi_master_'+method,async c=>{
        if(method==='patch'&&table==='kpi_indikator'){
          await c.query('SELECT id FROM kpi_indikator WHERE id=$1 FOR UPDATE',[validId(req.params.id)]);
          const used=(await c.query("SELECT id FROM kpi_capaian WHERE indikator_id=$1 AND status='approved' LIMIT 1",[req.params.id])).rows.length;
          if(used)throw new HttpError(409,'Indikator sudah dipublikasikan; buat master tahun baru, jangan ubah target historis.');
        }
        if(method==='post')return (await c.query(`INSERT INTO ${table}(${keys}) VALUES(${keys.map((_,i)=>`$${i+1}`)}) RETURNING *`,Object.values(b))).rows[0];
        return (await c.query(`UPDATE ${table} SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} WHERE id=$${keys.length+1} RETURNING *`,[...Object.values(b),validId(req.params.id)])).rows[0];});
      if(!out)throw new HttpError(404,'Master tidak ditemukan.');res.status(method==='post'?201:200).json({data:out});
    });
  }return r;
}
