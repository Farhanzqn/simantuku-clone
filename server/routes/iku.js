import {Router} from 'express';
import {z} from 'zod';
import {requireLogin,visibility,parse} from '../middleware/security.js';
import {ikuThresholds} from '../../static-web/assets/js/iku-schema.js';
const filters=z.object({tahun:z.coerce.number().int().min(2000).max(2200).optional(),periode:z.enum(['T1','T2','T3','T4']).optional()}).strict();
export function ikuRoutes(pool,publicDashboard){
 const r=Router();
 r.get('/iku',requireLogin,visibility(pool,publicDashboard,['iku']),async(req,res)=>{
  const f=parse(filters,req.query);
  const available=(await pool.query('SELECT DISTINCT tahun,periode FROM v_dashboard_iku ORDER BY tahun DESC,periode DESC')).rows;
  const tahun=f.tahun??available[0]?.tahun??new Date().getUTCFullYear();
  const periode=f.periode??available.find(x=>x.tahun===tahun)?.periode??'T2';
  const rows=(await pool.query('SELECT * FROM v_dashboard_iku WHERE tahun=$1 AND periode=$2 ORDER BY urutan',[tahun,periode])).rows;
  const measured=rows.filter(x=>x.persen_capaian!==null),achieved=measured.filter(x=>Number(x.persen_capaian)>=ikuThresholds.tercapai).length;
  res.json({data:rows,meta:{tahun,periode,tersedia:available,ambang:ikuThresholds,empty:!rows.length,message:rows.length?null:'Belum ada data approved. Menunggu input dan verifikasi PRP.',ringkasan:{jumlah:rows.length,rata_rata:measured.length?measured.reduce((s,x)=>s+Number(x.persen_capaian),0)/measured.length:null,mencapai:achieved,di_bawah:measured.length-achieved,tanpa_rasio:rows.length-measured.length},diperbarui_pada:rows.reduce((last,x)=>!last||x.diperbarui_pada>last?x.diperbarui_pada:last,null)}});
 });
 return r;
}
