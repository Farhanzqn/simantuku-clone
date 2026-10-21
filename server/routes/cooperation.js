import {Router} from 'express';
import {z} from 'zod';
import {parse,visibility} from '../middleware/security.js';
import {formDefinitions} from '../../static-web/assets/js/input-schema.js';
export function cooperationRoutes(pool,publicDashboard){const r=Router();
 r.get('/kerjasama',visibility(pool,publicDashboard,['kerjasama']),async(req,res)=>{
  const f=parse(z.object({periode_laporan_id:z.coerce.number().int().positive().optional(),tahun:z.coerce.number().int().min(2000).max(2200).optional()}).strict(),req.query),report=f.periode_laporan_id??(await pool.query('SELECT id FROM periode_laporan WHERE aktif')).rows[0]?.id;
  const rows=(await pool.query('SELECT * FROM v_dashboard_kerjasama WHERE periode_laporan_id=$1 AND ($2::integer IS NULL OR tahun=$2) ORDER BY tahun,kategori',[report??null,f.tahun??null])).rows;
  const labels=new Map(formDefinitions.kerjasama.categories);for(const row of rows)row.kategori_label=labels.get(row.kategori);
  const ids=[...new Set(rows.map(x=>x.sumber_id))],sumber=ids.length?(await pool.query('SELECT id,dokumen,nomor_tabel,halaman_pdf,halaman_cetak FROM sumber_data WHERE id=ANY($1::bigint[])',[ids])).rows:[];
  res.json({data:rows,meta:{sumber,message:'Belum ada data. Menunggu input Bagian Pengembangan Kemitraan.'}});
 });return r;
}
