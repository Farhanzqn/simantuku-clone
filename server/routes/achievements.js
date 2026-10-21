import {Router} from 'express';
import {z} from 'zod';
import {parse,visibility} from '../middleware/security.js';
export function achievementRoutes(pool,publicDashboard){const r=Router();
 r.get('/prestasi',visibility(pool,publicDashboard,['prestasi']),async(req,res)=>{
  const f=parse(z.object({periode_laporan_id:z.coerce.number().int().positive().optional(),tahun:z.coerce.number().int().min(2000).max(2200).optional(),prodi_id:z.coerce.number().int().positive().optional(),jenjang:z.enum(['D3','S1','S2','PROFESI']).optional()}).strict(),req.query);
  const report=(await pool.query('SELECT id,tahun FROM periode_laporan WHERE '+(f.periode_laporan_id?'id=$1':'aktif'),f.periode_laporan_id?[f.periode_laporan_id]:[])).rows[0];
  let rows=(await pool.query(`SELECT p.id AS prodi_id,p.kode AS prodi_kode,p.nama AS prodi_nama,p.jenjang,$2::integer AS tahun,v.jumlah_mahasiswa,v.nasional,v.regional,v.internasional,v.pkm_dikti,v.sumber_id,v.sumber,v.periode_laporan_kode,v.id IS NOT NULL AS has_data FROM prodi p LEFT JOIN v_dashboard_prestasi v ON v.prodi_id=p.id AND v.periode_laporan_id=$1 AND v.tahun=$2 WHERE ($3::bigint IS NULL OR p.id=$3) AND ($4::text IS NULL OR p.jenjang=$4) ORDER BY p.kode`,[report?.id??null,f.tahun??report?.tahun??null,f.prodi_id??null,f.jenjang??null])).rows;
  if(!rows.some(x=>x.has_data))rows=[];
  const ids=[...new Set(rows.map(x=>x.sumber_id).filter(Boolean))],sumber=ids.length?(await pool.query('SELECT dokumen,nomor_tabel,halaman_pdf,halaman_cetak FROM sumber_data WHERE id=ANY($1::bigint[])',[ids])).rows:[];
  const totals={};for(const field of ['jumlah_mahasiswa','nasional','regional','internasional','pkm_dikti']){const filled=rows.map(x=>x[field]).filter(x=>x!==null);totals[field]=filled.length?filled.reduce((n,x)=>n+x,0):null;}
  res.json({data:rows,meta:{sumber,totals,empty:!rows.length,message:'Belum ada data. Menunggu input BKM.',tanpa_rincian:rows.filter(x=>!x.has_data).length}});
 });return r;
}
