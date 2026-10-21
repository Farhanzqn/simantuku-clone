import {Router} from 'express';
import {z} from 'zod';
import {parse,visibility} from '../middleware/security.js';
import {accreditationSummary} from '../services/accreditation.js';
export function accreditationRoutes(pool,publicDashboard){const r=Router();
 r.get('/akreditasi',visibility(pool,publicDashboard,['akreditasi']),async(req,res)=>{
  const f=parse(z.object({tahun:z.coerce.number().int().min(2000).max(2200).optional(),periode_laporan_id:z.coerce.number().int().positive().optional(),prodi_id:z.coerce.number().int().positive().optional(),jenjang:z.enum(['D3','S1','S2','PROFESI']).optional()}).strict(),req.query);
  // Tahun memilih snapshot laporan terbaru yang memiliki data approved; tidak menjumlah semester.
  const report=f.periode_laporan_id??(f.tahun?(await pool.query('SELECT l.id FROM periode_laporan l WHERE l.tahun=$1 AND EXISTS(SELECT 1 FROM v_dashboard_akreditasi a WHERE a.periode_laporan_id=l.id) ORDER BY l.urutan DESC LIMIT 1',[f.tahun])).rows[0]?.id:(await pool.query('SELECT id FROM periode_laporan WHERE aktif')).rows[0]?.id);
  const all=(await pool.query('SELECT * FROM v_dashboard_akreditasi WHERE periode_laporan_id=$1 ORDER BY cakupan,prodi_kode NULLS LAST,butir',[report??null])).rows;
  const rows=all.filter(x=>x.cakupan!=='prodi'||(!f.prodi_id||String(x.prodi_id)===String(f.prodi_id))&&(!f.jenjang||x.jenjang===f.jenjang));
  const sources=[...new Set(rows.map(x=>x.sumber_id))],sumber=sources.length?(await pool.query('SELECT dokumen,nomor_tabel,halaman_pdf,halaman_cetak FROM sumber_data WHERE id=ANY($1::bigint[])',[sources])).rows:[];
  const detail=rows.filter(x=>x.cakupan==='prodi'),groups=new Map();
  for(const row of detail){const key=JSON.stringify([row.jenjang,row.peringkat]);groups.set(key,{jenjang:row.jenjang,peringkat:row.peringkat,jumlah:(groups.get(key)?.jumlah??0)+1});}
  const rekap=[...groups.values()].map(x=>({...x,persentase:detail.length?100*x.jumlah/detail.length:null}));
  const master=(await pool.query('SELECT id,nama,jenjang FROM prodi WHERE aktif AND ($1::bigint IS NULL OR id=$1) AND ($2::text IS NULL OR jenjang=$2) ORDER BY urutan',[f.prodi_id??null,f.jenjang??null])).rows;
  const summary=accreditationSummary(master,rows);
  // Tidak mengirim flag internal/expiry alert atau metadata aktor ke dashboard publik.
  res.json({data:rows,meta:{...summary,periode_laporan_id:report??null,sumber,empty:!rows.length,message:'Belum ada data. Menunggu input PJM.',rekap,total:detail.length,belum_terpetakan:detail.filter(x=>x.prodi_id===null).length,institusi:rows.filter(x=>x.cakupan==='institusi'),internasional:rows.filter(x=>x.cakupan==='internasional')}});
 });return r;
}
