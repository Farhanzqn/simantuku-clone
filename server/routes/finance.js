import {Router} from 'express';
import {z} from 'zod';
import {parse,visibility,requireLogin} from '../middleware/security.js';
import {financeCategories} from '../../static-web/assets/js/finance-schema.js';
export function financeRoutes(pool,publicDashboard){const r=Router();
 r.get('/keuangan',requireLogin,visibility(pool,publicDashboard,['keuangan']),async(req,res)=>{
  const f=parse(z.object({periode_laporan_id:z.coerce.number().int().positive().optional(),tahun:z.coerce.number().int().min(2000).max(2200).optional()}).strict(),req.query);
  const report=f.periode_laporan_id??(await pool.query('SELECT id FROM periode_laporan WHERE aktif')).rows[0]?.id;
  const rows=(await pool.query('SELECT * FROM v_dashboard_keuangan WHERE periode_laporan_id=$1 AND ($2::integer IS NULL OR tahun=$2) ORDER BY tahun,kategori',[report??null,f.tahun??null])).rows;
  for(const row of rows){const [,label,group,unit]=financeCategories.find(c=>c[0]===row.kategori);Object.assign(row,{kategori_label:label,kelompok:group,satuan:unit});}
  const ids=[...new Set(rows.map(x=>x.sumber_id))],sumber=ids.length?(await pool.query('SELECT dokumen,nomor_tabel,halaman_pdf,halaman_cetak FROM sumber_data WHERE id=ANY($1::bigint[])',[ids])).rows:[];
  res.json({data:rows,meta:{sumber,empty:!rows.length,message:'Belum ada data. Menunggu input BKU.',periode_sebelumnya:'Kode periode sebelumnya tidak disebutkan pada laporan.'}});
 });return r;
}
