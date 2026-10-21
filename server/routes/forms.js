import {Router} from 'express';
import {z} from 'zod';
import {requireLogin,parse,HttpError,validId} from '../middleware/security.js';
import {getDomain} from '../validators/domains.js';
import {authorizeDomain,withActor,createDraft,patchDraft,revision} from '../services/data.js';
import {formDefinitions} from '../../static-web/assets/js/input-schema.js';
export function formRoutes(pool){const r=Router();r.use(requireLogin);
 r.get('/meta',async(req,res)=>{
  const policies=new Map((await pool.query('SELECT domain,perlu_verifikasi FROM definisi_formulir')).rows.map(p=>[p.domain,p.perlu_verifikasi]));
  const allowed=[];for(const [name,def]of Object.entries(formDefinitions)){try{await authorizeDomain(pool,req.user,getDomain(name),true);allowed.push({name,...def,perlu_verifikasi:policies.get(name)??true});}catch(e){if(e.status!==403)throw e;}}
  if(!allowed.length)throw new HttpError(403,'Tidak ada formulir untuk role Anda.');
  const [prodi,academic,report,kpi,rka]=await Promise.all(['SELECT id,kode,nama,jenjang FROM prodi WHERE aktif ORDER BY urutan','SELECT * FROM periode_akademik ORDER BY urutan','SELECT * FROM periode_laporan ORDER BY urutan','SELECT id,kode,nama,jenis,satuan,tahun,target_nilai FROM kpi_indikator ORDER BY id','SELECT id,kode_item,item,angka,satuan,tahun FROM rka_target ORDER BY id'].map(sql=>pool.query(sql)));
  const lulusan=allowed.some(d=>d.name==='tracer-ringkasan')?(await pool.query("SELECT id,periode_laporan_id,tahun_lulus,jumlah FROM lulusan WHERE cakupan='institusi' AND status='approved' AND is_current_approved ORDER BY tahun_lulus DESC")).rows:[];
  const kpiInputs=allowed.some(d=>d.name==='kpi-input')?(await pool.query("SELECT DISTINCT v.indikator_id,v.kode_input,v.satuan,i.kode,i.nama,i.tahun FROM v_kpi_input v JOIN kpi_indikator i ON i.id=v.indikator_id ORDER BY v.indikator_id,v.kode_input")).rows:[];
  const iku=allowed.some(d=>d.name==='iku-capaian')?(await pool.query('SELECT * FROM iku_indikator ORDER BY urutan')).rows:[];
  res.json({data:{iku,domains:allowed,prodi:prodi.rows,academic:academic.rows,report:report.rows,lulusan_institusi:lulusan,kpi_inputs:kpiInputs,tracer_year:(await pool.query('SELECT max(tahun_lulus) AS tahun FROM v_dashboard_tracer')).rows[0].tahun,kpi:req.user.role==='admin'||req.user.role==='prp'?kpi.rows:[],rka:req.user.role==='admin'||req.user.role==='prp'?rka.rows:[]}});
 });
 r.param('domain',async(req,res,next,name)=>{if(!formDefinitions[name])throw new HttpError(404,'Formulir belum tersedia.');req.domain=getDomain(name);req.owner=await authorizeDomain(pool,req.user,req.domain,true);next();});
 r.get('/:domain',async(req,res)=>{
  const f=parse(z.object({periode_laporan_id:z.coerce.number().int().positive(),periode_akademik_id:z.coerce.number().int().positive().optional()}).strict(),req.query),d=req.domain;
  const args=[req.owner,f.periode_laporan_id,f.periode_akademik_id??null];
  const base=`SELECT d.*,u.nama AS pengaju,v.nama AS reviewer,c.nama AS pembuat FROM ${d.table} d LEFT JOIN users u ON u.id=d.submitted_by LEFT JOIN users v ON v.id=d.reviewed_by LEFT JOIN users c ON c.id=d.created_by`;
  const rows=(await pool.query(`${base} WHERE d.unit_id=$1 AND d.periode_laporan_id=$2 AND ($3::bigint IS NULL OR d.periode_akademik_id=$3) AND (d.is_current_approved OR d.status IN ('draft','submitted','rejected')) ORDER BY d.versi DESC,d.id DESC`,args)).rows;
  const previous=(await pool.query(`${base} JOIN periode_laporan l ON l.id=d.periode_laporan_id LEFT JOIN periode_akademik a ON a.id=d.periode_akademik_id WHERE d.unit_id=$1 AND d.is_current_approved AND l.urutan<=(SELECT urutan FROM periode_laporan WHERE id=$2) AND ($3::bigint IS NULL OR a.urutan<=(SELECT urutan FROM periode_akademik WHERE id=$3)) AND (d.periode_laporan_id<>$2 OR ($3::bigint IS NOT NULL AND d.periode_akademik_id<>$3)) ORDER BY l.urutan DESC,a.urutan DESC,d.versi DESC LIMIT 2000`,args)).rows;
  const discarded=(await pool.query(`SELECT d.* FROM ${d.table} d WHERE d.unit_id=$1 AND d.periode_laporan_id=$2 AND ($3::bigint IS NULL OR d.periode_akademik_id=$3) AND d.status='discarded' ORDER BY d.versi DESC,d.id DESC`,args)).rows;
  res.json({data:rows,meta:{previous,discarded}});
 });
 r.post('/:domain/draft',async(req,res)=>{
  const body=parse(z.object({rows:z.array(z.object({id:z.union([z.string(),z.number()]).optional(),row_version:z.number().int().positive().optional(),values:z.record(z.string(),z.unknown())}).strict()).min(1).max(500)}).strict(),req.body),d=req.domain;
  const rows=await withActor(pool,req,'form_draft',async c=>{const out=[];for(const b of body.rows){
   if(!b.id){out.push(await createDraft(c,d,req,b.values));continue;}
   const old=(await c.query(`SELECT * FROM ${d.table} WHERE id=$1 AND unit_id=$2 FOR UPDATE`,[validId(b.id),req.owner])).rows[0];
   if(!old)throw new HttpError(404,'Data tidak tersedia di unit ini.');
   if(old.row_version!==b.row_version)throw new HttpError(409,'Data berubah. Muat ulang sebelum melanjutkan.');
   const working=old.status==='approved'?await revision(c,d,req,old.id,old.row_version):old;
   out.push(await patchDraft(c,d,req,working.id,{...b.values,row_version:working.row_version}));
  }return out;});res.json({data:rows});
 });return r;
}
