import {Router} from 'express';
import {z} from 'zod';
import {parse,visibility,requireLogin} from '../middleware/security.js';
import {amiEntities,amiBands} from '../../static-web/assets/js/ami-schema.js';
export function amiRoutes(pool,publicDashboard){const r=Router();
 r.get('/ami',requireLogin,visibility(pool,publicDashboard,['ami']),async(req,res)=>{
  const f=parse(z.object({periode_laporan_id:z.coerce.number().int().positive().optional(),tahun:z.coerce.number().int().min(2000).max(2200).optional()}).strict(),req.query),report=f.periode_laporan_id??(await pool.query('SELECT id FROM periode_laporan WHERE aktif')).rows[0]?.id;
  const rows=(await pool.query('SELECT * FROM v_dashboard_ami WHERE periode_laporan_id=$1 AND ($2::integer IS NULL OR tahun=$2) ORDER BY tahun,kategori',[report??null,f.tahun??null])).rows;
  const entities=new Map(amiEntities.map(x=>[x.key,x])),bands=new Map(amiBands);for(const row of rows){const e=entities.get(row.kategori);row.kategori_label=e?.label??bands.get(row.kategori);row.kelompok=e?.group??'rekap';}
  const ids=[...new Set(rows.flatMap(x=>[x.sumber_id,x.sumber_evaluasi_id,x.sumber_pembanding_id]).filter(Boolean))],sumber=ids.length?(await pool.query('SELECT dokumen,nomor_tabel,halaman_pdf,halaman_cetak FROM sumber_data WHERE id=ANY($1::bigint[]) ORDER BY halaman_pdf',[ids])).rows:[];
  const mean=items=>{const v=items.filter(x=>x.capaian_laporan!==null);return v.length?v.reduce((a,x)=>a+Number(x.capaian_laporan),0)/v.length:null;};
  const summaries=['prodi','unit'].map(k=>{const part=rows.filter(x=>x.kelompok===k),sum=field=>{const v=part.filter(x=>x[field]!==null);return v.length?v.reduce((a,x)=>a+Number(x[field]),0):null;};return {kelompok:k,entitas:part.length,kesiapan:mean(part),jumlah_standar:sum('jumlah_standar'),kesenjangan:sum('kesenjangan')};});
  const prodi=rows.filter(x=>x.kelompok==='prodi'&&x.capaian_laporan!==null),rekap=amiBands.map(([key,label],i)=>({kategori:key,kategori_label:label,jumlah_prodi:rows.find(x=>x.kategori===key)?.jumlah_prodi??null,jumlah_hitung:prodi.length?prodi.filter(x=>{const v=Number(x.capaian_laporan);return i===0?v>=80:i===1?v>=60&&v<80:i===2?v>=40&&v<60:v<40;}).length:null}));
  res.json({data:rows,meta:{sumber,ringkasan:summaries,rekap,empty:!rows.length,message:'Belum ada data. Menunggu input PJM.',catatan:'Semester I: evaluasi diri dan potensi ketidaksesuaian/kesenjangan awal, bukan audit formal. AMI formal dijadwalkan semester II. Kesiapan dan kesenjangan memakai instrumen berbeda. Rekap laporan dan hitungan revisi ditampilkan terpisah.'}});
 });return r;
}
