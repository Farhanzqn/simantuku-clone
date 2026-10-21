import {Router} from 'express';
import {z} from 'zod';
import {parse,visibility,requireLogin} from '../middleware/security.js';
import {formationDefinition,movementDefinition} from '../../static-web/assets/js/employment-schema.js';
export function employmentRoutes(pool,publicDashboard){const r=Router();
 for(const [path,view,module,definition] of [['formasi','v_dashboard_formasi','formasi',formationDefinition],['pegawai-pergerakan','v_dashboard_pergerakan_pegawai','pegawai-internal',movementDefinition]])r.get('/'+path,requireLogin,visibility(pool,publicDashboard,[module]),async(req,res)=>{
  const f=parse(z.object({periode_laporan_id:z.coerce.number().int().positive().optional(),tahun:z.coerce.number().int().min(2000).max(2200).optional()}).strict(),req.query);
  const report=f.periode_laporan_id??(await pool.query('SELECT id FROM periode_laporan WHERE aktif')).rows[0]?.id;
  const rows=(await pool.query(`SELECT * FROM ${view} WHERE periode_laporan_id=$1 AND ($2::integer IS NULL OR tahun=$2) ORDER BY tahun,id`,[report??null,f.tahun??null])).rows;
  for(const row of rows)row.kategori_label=definition.categories.find(x=>x[0]===row.kategori)?.[1]??row.kategori;
  const ids=[...new Set(rows.map(x=>x.sumber_id))],sumber=ids.length?(await pool.query('SELECT dokumen,nomor_tabel,halaman_pdf,halaman_cetak FROM sumber_data WHERE id=ANY($1::bigint[])',[ids])).rows:[];
  const flags=path==='formasi'&&rows.some(x=>x.periode_laporan_kode==='2026-S1')?(await pool.query("SELECT kode,pesan FROM data_quality_flag WHERE kode=ANY($1::text[]) AND NOT resolved",[['pegawai-tendik-cakupan-berbeda','formasi-spi-persentase','formasi-bpas-persentase','formasi-nomor-44-tidak-tercantum']])).rows:[];
  res.json({data:rows,meta:{sumber,catatan_kualitas:flags,empty:!rows.length,message:'Belum ada data. Menunggu input BSDM.'}});
 });
 r.get('/pegawai-formasi',requireLogin,visibility(pool,publicDashboard,['pegawai-internal','pegawai-publik']),async(req,res)=>{
  const f=parse(z.object({periode_laporan_id:z.coerce.number().int().positive().optional(),tahun:z.coerce.number().int().min(2000).max(2200).optional()}).strict(),req.query);
  const report=f.periode_laporan_id??(await pool.query('SELECT id FROM periode_laporan WHERE aktif')).rows[0]?.id;
  const rows=(await pool.query("SELECT d.kategori,d.jumlah,d.periode_akademik_kode,d.periode_laporan_id,d.periode_laporan_kode,d.sumber_id,d.sumber,s.nomor_tabel,s.halaman_pdf,s.halaman_cetak FROM v_dashboard_pegawai_ringkasan d JOIN periode_laporan l ON l.id=d.periode_laporan_id JOIN sumber_data s ON s.id=d.sumber_id WHERE d.kategori=ANY($1::text[]) AND d.periode_laporan_id=$2 AND ($3::integer IS NULL OR l.tahun=$3) ORDER BY d.kategori",[['dosen_tetap','dosen_tidak_tetap','tendik','pkwt'],report??null,f.tahun??null])).rows;
  const ids=[...new Set(rows.map(x=>x.sumber_id))],sumber=ids.length?(await pool.query('SELECT dokumen,nomor_tabel,halaman_pdf,halaman_cetak FROM sumber_data WHERE id=ANY($1::bigint[])',[ids])).rows:[];
  res.json({data:rows,meta:{sumber,empty:!rows.length,message:'Belum ada data. Menunggu input BSDM.'}});
 });return r;
}
