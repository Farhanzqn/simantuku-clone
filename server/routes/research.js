import {Router} from 'express';
import {z} from 'zod';
import {parse,visibility} from '../middleware/security.js';
import {formDefinitions} from '../../static-web/assets/js/input-schema.js';
export function researchRoutes(pool,publicDashboard){const r=Router();
 for(const name of ['penelitian','hki','pkm'])r.get('/'+name,visibility(pool,publicDashboard,[name]),async(req,res)=>{
  const f=parse(z.object({periode_laporan_id:z.coerce.number().int().positive().optional(),tahun:z.coerce.number().int().min(2000).max(2200).optional()}).strict(),req.query);
  const report=f.periode_laporan_id??(await pool.query('SELECT id FROM periode_laporan WHERE aktif')).rows[0]?.id;
  const rows=(await pool.query(`SELECT * FROM v_dashboard_${name} WHERE periode_laporan_id=$1 AND ($2::integer IS NULL OR tahun=$2) ORDER BY tahun,kategori`,[report??null,f.tahun??null])).rows;
  const labels=new Map(formDefinitions[name].categories);for(const row of rows)row.kategori_label=labels.get(row.kategori);
  const ids=[...new Set(rows.map(x=>x.sumber_id))],sumber=ids.length?(await pool.query('SELECT dokumen,nomor_tabel,halaman_pdf,halaman_cetak FROM sumber_data WHERE id=ANY($1::bigint[])',[ids])).rows:[];
  res.json({data:rows,meta:{sumber,empty:!rows.length,message:'Belum ada data. Menunggu input LPPM.',catatan:name==='penelitian'&&rows.some(x=>x.periode_laporan_kode==='2026-S1')?'Tahun 2026 mengikuti judul Tabel 4.7. Narasi menyebut 2025; menunggu verifikasi LPPM.':null}});
 });return r;
}
