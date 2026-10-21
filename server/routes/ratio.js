import {Router} from 'express';
import {z} from 'zod';
import {parse,visibility} from '../middleware/security.js';
export function ratioRoutes(pool,publicDashboard){const r=Router();
 r.get('/rasio-dosen-mahasiswa',visibility(pool,publicDashboard,['rasio-dosen-mahasiswa','mahasiswa','dosen']),async(req,res)=>{
  const f=parse(z.object({periode_akademik_id:z.coerce.number().int().positive().optional(),periode_laporan_id:z.coerce.number().int().positive().optional(),prodi_id:z.coerce.number().int().positive().optional(),jenjang:z.enum(['D3','S1','S2','PROFESI']).optional()}).strict(),req.query);
  const academic=f.periode_akademik_id??(await pool.query('SELECT id FROM periode_akademik WHERE aktif')).rows[0]?.id,report=f.periode_laporan_id??(await pool.query('SELECT id FROM periode_laporan WHERE aktif')).rows[0]?.id;
  const rows=(await pool.query(`SELECT p.id AS prodi_id,p.kode AS prodi_kode,p.nama AS prodi_nama,p.jenjang,
   m.mahasiswa,d.dosen,CASE WHEN m.mahasiswa IS NOT NULL AND d.dosen>0 THEN round(m.mahasiswa/d.dosen,2) END AS mahasiswa_per_dosen,
   a.kode AS periode_akademik_kode,a.tahun_ajaran,a.semester AS semester_akademik,l.kode AS periode_laporan_kode,
   $1::bigint AS periode_akademik_id,$2::bigint AS periode_laporan_id,
   concat_ws('; ',m.sumber,d.sumber) AS sumber
   FROM prodi p JOIN periode_akademik a ON a.id=$1 JOIN periode_laporan l ON l.id=$2
   LEFT JOIN LATERAL(SELECT CASE WHEN count(total)=count(*) THEN sum(total)::numeric END AS mahasiswa,string_agg(DISTINCT sumber,'; ') AS sumber FROM v_dashboard_mahasiswa WHERE prodi_id=p.id AND periode_akademik_id=$1 AND periode_laporan_id=$2 AND status_mhs='aktif') m ON true
   LEFT JOIN LATERAL(SELECT CASE WHEN count(total)=count(*) THEN sum(total)::numeric END AS dosen,string_agg(DISTINCT sumber,'; ') AS sumber FROM v_dashboard_dosen WHERE prodi_id=p.id AND periode_akademik_id=$1 AND periode_laporan_id=$2) d ON true
   WHERE p.aktif AND ($3::bigint IS NULL OR p.id=$3) AND ($4::text IS NULL OR p.jenjang=$4) ORDER BY p.urutan`,[academic??null,report??null,f.prodi_id??null,f.jenjang??null])).rows;
  const filled=rows.filter(x=>x.mahasiswa!==null&&x.dosen!==null),complete=rows.length>0&&filled.length===rows.length;
  const mahasiswa=complete?filled.reduce((n,x)=>n+Number(x.mahasiswa),0):null,dosen=complete?filled.reduce((n,x)=>n+Number(x.dosen),0):null;
  const empty=!rows.some(x=>x.mahasiswa!==null||x.dosen!==null);
  res.json({data:empty?[]:rows,meta:{empty,message:'Belum ada data approved yang berpasangan. Menunggu input BAA/BSDM.',rumus:'Mahasiswa aktif approved / dosen tetap approved. Rasio 1 : X berarti X mahasiswa per satu dosen. Dosen tidak tetap tidak menjadi denominator.',institusi:{mahasiswa,dosen,mahasiswa_per_dosen:dosen>0?mahasiswa/dosen:null,lengkap:complete,cakupan:filled.length,total_prodi:rows.length},sumber:[{dokumen:'Mahasiswa aktif: Tabel 1.3 (halaman PDF 17 / cetak 9); dosen tetap per prodi: Tabel 1.4 (PDF 22 / cetak 14); konfirmasi institusi: Tabel 2.7 (PDF 43 / cetak 35). Laporan Manajemen Semester I 2026; revisi memakai sumber input unit approved.'}]}});
 });return r;
}
