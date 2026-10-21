import {domains} from '../validators/domains.js';
import { Router } from 'express';
import { z } from 'zod';
import { visibility,parse,requireLogin } from '../middleware/security.js';
const filterSchema=z.object({periode_akademik_id:z.coerce.number().int().positive().optional(),periode_laporan_id:z.coerce.number().int().positive().optional(),prodi_id:z.coerce.number().int().positive().optional(),
  tahun:z.coerce.number().int().min(2000).max(2200).optional(),jenjang:z.enum(['D3','S1','S2','PROFESI']).optional(),status:z.enum(['aktif','cuti','nonaktif']).optional(),
  tanggal_snapshot:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict();
const configs={
  mahasiswa:['mahasiswa','v_dashboard_mahasiswa','total,perempuan,status_mhs'],
  'mahasiswa-baru':['mahasiswa-baru','v_dashboard_mahasiswa_baru','tahun_masuk,tanggal_snapshot,target,realisasi_daftar_ulang'],
  dosen:['dosen','v_dashboard_dosen','total,perempuan,s3,tenaga_pengajar,asisten_ahli,lektor,lektor_kepala,guru_besar'],
  tendik:['tendik','v_dashboard_tendik','laki,perempuan'],lulusan:['lulusan','v_dashboard_lulusan','cakupan,tahun_lulus,periode_wisuda,jumlah,ipk_rata'],
  tracer:['tracer','v_dashboard_tracer','tahun_lulus,jumlah_lulusan,responden,kerja_kurang_3_bulan,kerja_lebih_3_bulan,sesuai_bidang,wirausaha,studi_lanjut'],
  'mahasiswa-angkatan':['mahasiswa','v_dashboard_mahasiswa_angkatan','angkatan,total']};
async function dashboardMeta(pool,rows,table){
  const ids=[...new Set(rows.map(r=>r.sumber_id).filter(Boolean))];
  const sumber=ids.length?(await pool.query('SELECT dokumen,nomor_tabel,halaman_pdf,halaman_cetak FROM sumber_data WHERE id=ANY($1::bigint[])',[ids])).rows:[];
  const notices=ids.length?(await pool.query('SELECT kode,catatan_publik AS pesan FROM data_quality_flag WHERE tabel=$1 AND sumber_id=ANY($2::bigint[]) AND catatan_publik IS NOT NULL AND NOT resolved',[table,ids])).rows:[];
  return {sumber,catatan_kualitas:notices};
}
export function dashboardRoutes(pool,publicDashboard){const r=Router();
  for(const [name,[module,view,fields]] of Object.entries(configs))r.get('/'+name,...(name==='tendik'?[requireLogin]:[]),visibility(pool,publicDashboard,[module]),async(req,res)=>{
    const f=parse(filterSchema,req.query),args=[],where=[];
    for(const k of ['periode_akademik_id','periode_laporan_id','prodi_id','jenjang'])if(f[k]!==undefined){args.push(f[k]);where.push(`${k}=$${args.length}`);}
    if(f.tahun){args.push(f.tahun);where.push(`${name==='mahasiswa-baru'?'tahun_masuk':['tracer','lulusan'].includes(name)?'tahun_lulus':"substring(tahun_ajaran,1,4)::integer"}=$${args.length}`);}
    if(f.status&&name==='mahasiswa'){args.push(f.status);where.push(`status_mhs=$${args.length}`);}
    if(f.tanggal_snapshot&&name==='mahasiswa-baru'){args.push(f.tanggal_snapshot);where.push(`tanggal_snapshot=$${args.length}`);}
    const rows=(await pool.query(`SELECT prodi_id,prodi_kode,prodi_nama,jenjang,periode_akademik_id,periode_akademik_kode,tahun_ajaran,semester_akademik,periode_laporan_id,periode_laporan_kode,sumber_id,sumber,${fields} FROM ${view} ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY periode_laporan_id,prodi_kode LIMIT 2000`,args)).rows;
    const ringkasan=name==='tracer'?(await pool.query(`SELECT periode_laporan_id,periode_laporan_kode,tahun_lulus,responden,jumlah_lulusan,cakupan_persen,data_sementara FROM v_dashboard_tracer_ringkasan WHERE ($1::bigint IS NULL OR periode_laporan_id=$1) AND ($2::integer IS NULL OR tahun_lulus=$2) ORDER BY periode_laporan_id`,[f.periode_laporan_id??null,f.tahun??null])).rows:undefined;
    const domain=domains[name==='mahasiswa'?'mahasiswa-aktif':name];
    let rekonsiliasi;
    if(name==='mahasiswa-angkatan'){
      const current=(await pool.query(`SELECT sum(total)::bigint AS total FROM v_dashboard_mahasiswa WHERE status_mhs='aktif'
        AND ($1::bigint IS NULL OR periode_akademik_id=$1) AND ($2::bigint IS NULL OR periode_laporan_id=$2)
        AND ($3::bigint IS NULL OR prodi_id=$3) AND ($4::text IS NULL OR jenjang=$4)`,[f.periode_akademik_id??null,f.periode_laporan_id??null,f.prodi_id??null,f.jenjang??null])).rows[0];
      const filled=rows.filter(x=>x.total!==null),total=filled.length?filled.reduce((n,x)=>n+Number(x.total),0):null;
      const mahasiswa=current.total===null?null:Number(current.total);
      rekonsiliasi={mahasiswa_aktif:mahasiswa,total_angkatan:total,selisih:mahasiswa!==null&&total!==null?mahasiswa-total:null,
        catatan:'Rincian angkatan mengikuti formulir angkatan approved; selisih terhadap mahasiswa aktif perlu dikoreksi BAA, tanpa alokasi otomatis.'};
    }
    res.json({data:rows,meta:{...await dashboardMeta(pool,rows,domain.table),...(rekonsiliasi?{rekonsiliasi}:{}),empty:!rows.length,message:rows.length?null:`Belum ada data. Menunggu input ${['dosen','tendik'].includes(name)?'BSDM':name==='tracer'?'BPKA':name==='mahasiswa-baru'?'PPA':'BAA'}`,data_sementara:ringkasan?.some(r=>r.data_sementara)??false,catatan:name==='tracer'&&rows.some(r=>r.periode_laporan_kode==='2026-S1')?'laporan menulis total 8, rincian per prodi belum tersedia':null,...(ringkasan?{ringkasan,total_wirausaha:rows.some(row=>row.wirausaha!==null)?rows.reduce((sum,row)=>sum+(row.wirausaha??0),0):null}:{})}});
  });
  for(const internal of [false,true])r.get(internal?'/pegawai-internal':'/pegawai',...(internal?[requireLogin]:[]),visibility(pool,publicDashboard,[internal?'pegawai-internal':'pegawai-publik']),async(req,res)=>{
    const f=parse(filterSchema,req.query),kategori=internal?['tendik','pkwt']:['dosen_tetap','dosen_tidak_tetap'];
    const rows=(await pool.query(`SELECT kategori,jumlah,periode_akademik_id,periode_akademik_kode,tahun_ajaran,semester_akademik,periode_laporan_id,periode_laporan_kode,sumber_id,sumber FROM v_dashboard_pegawai_ringkasan WHERE kategori=ANY($1::text[]) AND ($2::bigint IS NULL OR periode_laporan_id=$2) AND ($3::bigint IS NULL OR periode_akademik_id=$3) ORDER BY kategori`,[kategori,f.periode_laporan_id??null,f.periode_akademik_id??null])).rows;
    res.json({data:rows,meta:{...await dashboardMeta(pool,rows,'pegawai_ringkasan'),empty:!rows.length,message:rows.length?null:'Belum ada data. Menunggu input BSDM'}});
  });
  // Explicit public exception: one institutional total only. Detail routes stay login-only.
  r.get('/tendik-total',visibility(pool,publicDashboard,['pegawai-publik']),async(req,res)=>{
    const f=parse(z.object({periode_akademik_id:z.coerce.number().int().positive().optional(),periode_laporan_id:z.coerce.number().int().positive().optional()}).strict(),req.query);
    const row=(await pool.query(`SELECT d.jumlah FROM v_dashboard_pegawai_ringkasan d
      JOIN periode_laporan l ON l.id=d.periode_laporan_id JOIN periode_akademik a ON a.id=d.periode_akademik_id
      WHERE d.kategori='tendik' AND ($1::bigint IS NULL OR d.periode_laporan_id=$1) AND ($2::bigint IS NULL OR d.periode_akademik_id=$2)
      ORDER BY l.urutan DESC,a.urutan DESC LIMIT 1`,[f.periode_laporan_id??null,f.periode_akademik_id??null])).rows[0];
    res.json({data:{total:row?.jumlah??null}});
  });
  r.get('/pmb-peminat',visibility(pool,publicDashboard,['pmb-peminat']),async(req,res)=>{
    const f=parse(z.object({periode_laporan_id:z.coerce.number().int().positive().optional(),periode_akademik_id:z.coerce.number().int().positive().optional(),tahun:z.coerce.number().int().min(2000).max(2200).optional()}).strict(),req.query);
    const row=(await pool.query(`SELECT d.*,s.nomor_tabel,s.halaman_pdf,s.halaman_cetak
      FROM v_dashboard_pmb_peminat d JOIN periode_laporan l ON l.id=d.periode_laporan_id JOIN sumber_data s ON s.id=d.sumber_id
      WHERE ($1::bigint IS NULL OR d.periode_laporan_id=$1) AND ($2::bigint IS NULL OR d.periode_akademik_id=$2) AND ($3::int IS NULL OR d.tahun_masuk=$3)
      ORDER BY l.urutan DESC,d.tanggal_snapshot DESC LIMIT 1`,[f.periode_laporan_id??null,f.periode_akademik_id??null,f.tahun??null])).rows[0];
    res.json({data:row?{...row,total:row.jumlah_peminat}:{total:null}});
  });
  r.get('/kpi',requireLogin,visibility(pool,publicDashboard,['kpi']),async(req,res)=>{
    const f=parse(filterSchema,req.query);const rows=(await pool.query(`SELECT id,indikator_id,indikator_kode,indikator_nama,perspektif,target_nilai,target_teks,target_tanggal,satuan,jenis,arah,arah_terkonfirmasi,
      nilai_numerik,nilai_teks,nilai_tanggal,basis_nilai,tanggal_snapshot,periode_laporan_id,periode_laporan_kode,persen_capaian,catatan,sumber_id,sumber FROM v_kpi_capaian WHERE ($1::bigint IS NULL OR periode_laporan_id=$1) ORDER BY indikator_id`,[f.periode_laporan_id??null])).rows;
    res.json({data:rows,meta:{...await dashboardMeta(pool,rows,'kpi_capaian'),empty:!rows.length,message:rows.length?null:'Belum ada data. Menunggu input PRP'}});});
  r.get('/summary',visibility(pool,publicDashboard,['mahasiswa','mahasiswa-baru','dosen','lulusan']),async(req,res)=>{
    const f=parse(filterSchema,req.query),cards={};
    for(const [key,view,value,condition] of [['mahasiswa','v_dashboard_mahasiswa','total',"status_mhs='aktif'"],['dosen','v_dashboard_dosen','total','true'],['mahasiswa_baru','v_dashboard_mahasiswa_baru','realisasi_daftar_ulang','true'],['lulusan','v_dashboard_lulusan','jumlah',"cakupan='institusi'"]]){
      const rows=(await pool.query(`SELECT periode_akademik_id,periode_akademik_kode,periode_laporan_id,periode_laporan_kode,${key==='mahasiswa_baru'?'tahun_masuk,tanggal_snapshot,':key==='lulusan'?'tahun_lulus,':''}sum(${value})::bigint AS total,${key==='mahasiswa'?"sum(perempuan)::bigint AS perempuan,CASE WHEN count(perempuan)=count(*) AND count(total)=count(*) AND sum(total)>0 THEN round(100.0*sum(perempuan)/sum(total),2) END AS persen_perempuan,":''}count(*) AS coverage,max(tahun_ajaran) AS tahun_ajaran,max(semester_akademik) AS semester_akademik,string_agg(DISTINCT sumber,'; ') AS sumber
        FROM ${view} WHERE ${condition} AND ($1::bigint IS NULL OR periode_akademik_id=$1) AND ($2::bigint IS NULL OR periode_laporan_id=$2)
        GROUP BY 1,2,3,4${key==='mahasiswa_baru'?',5,6':key==='lulusan'?',5':''} ORDER BY periode_laporan_id DESC,periode_akademik_id DESC NULLS LAST LIMIT 1`,[f.periode_akademik_id??null,f.periode_laporan_id??null])).rows;
      const current=rows[0];let delta=null;
      if(current&&['mahasiswa','dosen'].includes(key)){
        const prev=(await pool.query(`SELECT sum(total) AS total,count(*) AS coverage FROM ${view} WHERE ${condition} AND periode_akademik_id=(SELECT id FROM periode_akademik WHERE urutan<(SELECT urutan FROM periode_akademik WHERE id=$1) ORDER BY urutan DESC LIMIT 1)`,[current.periode_akademik_id])).rows[0];
        if(current.total!==null&&prev.total!==null&&prev.coverage===current.coverage)delta=Number(current.total)-Number(prev.total);
      }
      cards[key]=current?{...current,total:current.total===null?null:Number(current.total),delta}:{total:null,delta:null};
    }res.json({data:cards});
  });
  r.get('/prodi',visibility(pool,publicDashboard,['prodi','mahasiswa','dosen']),async(req,res)=>{
    const f=parse(filterSchema,req.query);const academic=f.periode_akademik_id??(await pool.query('SELECT id FROM periode_akademik WHERE aktif')).rows[0]?.id;
    const rows=(await pool.query(`SELECT p.id,p.kode,p.nama,p.jenjang,
      (SELECT sum(total) FROM v_dashboard_mahasiswa m WHERE m.prodi_id=p.id AND m.periode_akademik_id=$1 AND status_mhs='aktif' AND ($2::bigint IS NULL OR m.periode_laporan_id=$2)) AS mahasiswa,
      (SELECT sum(total) FROM v_dashboard_dosen d WHERE d.prodi_id=p.id AND d.periode_akademik_id=$1 AND ($2::bigint IS NULL OR d.periode_laporan_id=$2)) AS dosen,NULL::text AS akreditasi
      FROM prodi p WHERE p.aktif ORDER BY urutan`,[academic??null,f.periode_laporan_id??null])).rows;
    const sources=(await pool.query(`SELECT DISTINCT sumber_id FROM v_dashboard_mahasiswa WHERE periode_akademik_id=$1 AND ($2::bigint IS NULL OR periode_laporan_id=$2) UNION SELECT DISTINCT sumber_id FROM v_dashboard_dosen WHERE periode_akademik_id=$1 AND ($2::bigint IS NULL OR periode_laporan_id=$2)`,[academic??null,f.periode_laporan_id??null])).rows;
    res.json({data:rows,meta:{...await dashboardMeta(pool,sources,'prodi'),empty:!rows.length}});});
  for(const name of ['beban-mengajar','rekognisi-dosen'])r.get('/'+name,visibility(pool,publicDashboard,['dosen']),(req,res)=>res.json({data:[],meta:{empty:true,message:'Belum ada data. Menunggu input BSDM'}}));
  r.get('/kinerja-pt',visibility(pool,publicDashboard,['prodi']),(req,res)=>res.json({data:{akreditasi:null},meta:{message:'Belum ada data. Menunggu input PJM'}}));return r;
}
