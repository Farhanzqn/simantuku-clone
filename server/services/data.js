import {warnings,formDefinitions} from '../../static-web/assets/js/input-schema.js';
import { transaction } from './db.js';
import { HttpError,parse } from '../middleware/security.js';
import { validate } from '../validators/domains.js';

export async function withActor(pool,req,action,work,override=false,reason='') {
  return transaction(pool,async c=>{
    await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action',$2,true),set_config('app.request_id',$3,true),set_config('app.is_override',$4,true),set_config('app.override_reason',$5,true)",
      [String(req.user.id),action,req.requestId,String(override),reason]);
    return work(c);
  });
}
export async function authorizeDomain(pool,user,d,write=false){
  if(write && !['admin',d.role].includes(user.role))throw new HttpError(403,'Role tidak boleh menulis domain ini.');
  const owner=(await pool.query('SELECT du.unit_id FROM domain_unit du JOIN unit u ON u.id=du.unit_id WHERE du.domain=$1 AND u.aktif',[d.name])).rows[0]?.unit_id;
  if(!owner|| (write&&user.role!=='admin'&&String(user.unit_id)!==String(owner)))throw new HttpError(403,'Unit tidak memiliki domain ini.');
  return owner;
}
export const scope=(user)=>[user.role==='admin'||user.role==='prp',user.unit_id??null];
export async function locked(c,d,id,user,write=false){
  const [all,unit]=write?[user.role==='admin',user.unit_id??null]:scope(user);
  const row=(await c.query(`SELECT * FROM ${d.table} WHERE id=$1 AND ($2::boolean OR unit_id=$3) FOR UPDATE`,[id,all,unit])).rows[0];
  if(!row)throw new HttpError(404,'Data tidak ditemukan dalam unit Anda.');return row;
}
function payload(d,row){return Object.fromEntries(Object.keys(d.shape).map(k=>{const col=formDefinitions[d.name]?.columns.find(c=>c.key===k);return [k,row[k] instanceof Date?row[k].toISOString().slice(0,10):typeof row[k]==='string' && (['nilai_numerik','ipk_rata','masa_studi_rata','angka'].includes(k)||col&&!col.text&&!col.date)?Number(row[k]):row[k]];}));}
export async function createDraft(c,d,req,raw,previous=null){
  const data=validate(d,raw); const owner=await authorizeDomain(c,req.user,d,true);
  await validateReferences(c,d,data);
  const src=(await c.query("SELECT id FROM sumber_data WHERE kode='input-unit'")).rows[0].id;
  const keyValues=d.keys.map(k=>data[k]);
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[d.name+JSON.stringify(keyValues)]);
  const where=d.keys.map((k,i)=>`${k} IS NOT DISTINCT FROM $${i+1}`).join(' AND ');
  const existing=(await c.query(`SELECT max(versi) AS versi,bool_or(is_current_approved) AS published FROM ${d.table} WHERE ${where}`,keyValues)).rows[0];
  if(existing.published&&!previous)throw new HttpError(409,'Data approved sudah ada; gunakan revision.');
  const row={...data,unit_id:owner,versi:Number(existing.versi||0)+1,created_by:req.user.id,previous_approved_id:previous,
    sumber_id:src,sumber:'Input unit Satu Data ITPLN'};
  const keys=Object.keys(row);
  const out=(await c.query(`INSERT INTO ${d.table}(${keys.join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,Object.values(row))).rows[0];
  await quality(c,d,out);return out;
}
export async function patchDraft(c,d,req,id,body){
  const row=await locked(c,d,id,req.user,true);
  if(!['draft','rejected'].includes(row.status))throw new HttpError(409,'Data terkunci; buat revision.');
  if(row.row_version!==body.row_version)throw new HttpError(409,'Versi berubah.');
  const updates={...body};delete updates.row_version;
  const full=validate(d,{...payload(d,row),...updates});
  await validateReferences(c,d,full);
  if(d.keys.some(k=>String(full[k])!==String(row[k])))throw new HttpError(422,'Kunci periode/prodi tidak dapat diubah; buat draft lain.');
  const keys=Object.keys(full);
  const out=(await c.query(`UPDATE ${d.table} SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')},status='draft',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL
    WHERE id=$${keys.length+1} AND ($${keys.length+2}::boolean OR unit_id=$${keys.length+3}) RETURNING *`,[...Object.values(full),id,req.user.role==='admin',req.user.unit_id??null])).rows[0];
  await quality(c,d,out);return out;
}
export async function revision(c,d,req,id,version){const row=await locked(c,d,id,req.user,true);if(row.row_version!==version||!row.is_current_approved)throw new HttpError(409,'Versi approved bukan versi terkini.');return createDraft(c,d,req,payload(d,row),row.id);}
export async function discardDrafts(c,d,req,rows){
  await authorizeDomain(c,req.user,d,true);
  if(new Set(rows.map(r=>String(r.id))).size!==rows.length)throw new HttpError(422,'Baris draft duplikat.');
  await c.query("SELECT set_config('app.discard_form',$1,true),set_config('app.discard_count',$2,true)",[d.name,String(rows.length)]);
  const result=[];for(const item of [...rows].sort((a,b)=>Number(a.id)-Number(b.id))){const row=await locked(c,d,item.id,req.user,true);
    if(row.status!=='draft'||row.row_version!==item.row_version)throw new HttpError(409,'Draft/status/versi berubah. Muat ulang sebelum membuang draft.');
    result.push((await c.query(`UPDATE ${d.table} SET status='discarded' WHERE id=$1 AND unit_id=$2 AND status='draft' AND row_version=$3 RETURNING id,status,row_version`,[row.id,row.unit_id,item.row_version])).rows[0]);
  }return result;
}
export async function submit(c,d,req,id,version){const row=await locked(c,d,id,req.user,true);
  if(row.row_version!==version||row.status!=='draft')throw new HttpError(409,'Draft/versi tidak sesuai.');
  await validateReferences(c,d,validate(d,payload(d,row)));
  const policy=(await c.query('SELECT perlu_verifikasi FROM definisi_formulir WHERE domain=$1 FOR SHARE',[d.name])).rows[0];
  const submitted=(await c.query(`UPDATE ${d.table} SET status='submitted',submitted_by=$2,submitted_at=now() WHERE id=$1 AND ($3::boolean OR unit_id=$4) RETURNING *`,[id,req.user.id,req.user.role==='admin',req.user.unit_id??null])).rows[0];
  if(policy?.perlu_verifikasi!==false)return submitted;
  const action=(await c.query("SELECT current_setting('app.action',true) AS action")).rows[0].action;
  await c.query("SELECT set_config('app.action','auto-approved',true)");
  const result=await publish(c,d,req,submitted,'auto-approved');
  await c.query("SELECT set_config('app.action',$1,true)",[action||'submit']);
  return result;}
export async function review(c,d,req,id,body,approve){
  const row=await locked(c,d,id,req.user);
  if(row.status!=='submitted'||row.row_version!==body.row_version)throw new HttpError(409,'Submission/versi berubah.');
  if(approve&&String(row.submitted_by)===String(req.user.id)&&!(req.user.role==='admin'&&body.override&&body.override_reason))throw new HttpError(403,'Pengaju tidak boleh approve sendiri.');
  if(body.override&& (req.user.role!=='admin'||!body.override_reason))throw new HttpError(403,'Override hanya admin dengan alasan wajib.');
  if(!approve&&!body.review_note)throw new HttpError(422,'Reject membutuhkan catatan.');
  if(approve){
    return publish(c,d,req,row,body.review_note);
  }
  return (await c.query(`UPDATE ${d.table} SET status='rejected',reviewed_by=$2,reviewed_at=now(),review_note=$3 WHERE id=$1 RETURNING *`,[id,req.user.id,body.review_note])).rows[0];
}
export async function publish(c,d,req,row,note){
    const args=d.keys.map(k=>row[k]);await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[d.name+JSON.stringify(args)]);
    const current=(await c.query(`SELECT id FROM ${d.table} WHERE ${d.keys.map((k,i)=>`${k} IS NOT DISTINCT FROM $${i+1}`).join(' AND ')} AND is_current_approved FOR UPDATE`,args)).rows[0];
    if(String(current?.id??'')!==String(row.previous_approved_id??''))throw new HttpError(409,'Published berubah; tinjau ulang revisi.');
    if(current)await c.query(`UPDATE ${d.table} SET is_current_approved=false WHERE id=$1`,[current.id]);
    const result=(await c.query(`UPDATE ${d.table} SET status='approved',is_current_approved=true,approved_by=$2,approved_at=now(),reviewed_by=$2,reviewed_at=now(),review_note=$3 WHERE id=$1 RETURNING *`,[row.id,req.user.id,note])).rows[0];
    if(d.name==='lulusan'&&note!=='auto-approved')await refreshTracer(c,req,row.id,row.previous_approved_id);
    return result;
}
async function refreshTracer(c,req,newId,oldId){
  // Ringkasan yang masih mereferensi denominasi lama diterbitkan sebagai versi baru, dalam transaksi approval.
  const rows=(await c.query('SELECT * FROM tracer_ringkasan WHERE lulusan_institusi_id=$1 AND is_current_approved FOR UPDATE',[oldId])).rows;
  for(const row of rows){
    await c.query('UPDATE tracer_ringkasan SET is_current_approved=false WHERE id=$1',[row.id]);
    const keys=['periode_laporan_id','unit_id','tahun_lulus','responden','kerja_kurang_3_bulan_sumber','kerja_lebih_3_bulan_sumber','sesuai_bidang_sumber','wirausaha_sumber','studi_lanjut_sumber','data_sementara','sumber_id','sumber'];
    const data=Object.fromEntries(keys.map(k=>[k,row[k]]));Object.assign(data,{lulusan_institusi_id:newId,previous_approved_id:row.id,versi:row.versi+1,created_by:req.user.id});
    const names=Object.keys(data);
    const id=(await c.query(`INSERT INTO tracer_ringkasan(${names.join(',')}) VALUES (${names.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id`,Object.values(data))).rows[0].id;
    // Metadata pengajuan sebelumnya dipertahankan sebagai basis persetujuan denominasi; reviewer tetap berbeda.
    const submitter=row.submitted_by||row.created_by;
    await c.query("UPDATE tracer_ringkasan SET status='submitted',submitted_by=$2,submitted_at=now() WHERE id=$1",[id,submitter]);
    await c.query("UPDATE tracer_ringkasan SET status='approved',is_current_approved=true,approved_by=$2,approved_at=now(),review_note='Referensi lulusan diperbarui atomik saat approval denominasi' WHERE id=$1",[id,req.user.id]);
  }
}
async function quality(c,d,row){
  const message=warnings(d.name,row).join(' ')||null;
  if(message)await c.query(`INSERT INTO data_quality_flag(kode,tabel,row_id,unit_id,sumber_id,pesan,severity,rule_code) VALUES($1,$2,$3,$4,$5,$6,'warning','input_warning')
    ON CONFLICT(kode) DO UPDATE SET pesan=EXCLUDED.pesan,resolved=false,resolved_by=NULL,resolved_at=NULL,resolution_note=NULL`,[`${d.name}-${row.id}-input`,d.table,row.id,row.unit_id,row.sumber_id,message]);
  else await c.query(`UPDATE data_quality_flag SET resolved=true,resolved_by=nullif(current_setting('app.user_id',true),'')::bigint,resolved_at=now(),resolution_note='Validasi ulang: data telah dikoreksi' WHERE kode=$1 AND NOT resolved`,[`${d.name}-${row.id}-input`]);
}

export async function validateReferences(c,d,data){
  if(d.name==='akreditasi'&&data.prodi_id!==null){const prodi=(await c.query('SELECT jenjang FROM prodi WHERE id=$1',[data.prodi_id])).rows[0];if(prodi&&prodi.jenjang!==data.jenjang)throw new HttpError(422,'Jenjang akreditasi tidak sesuai master prodi.');}
  for(const [field,table] of [['periode_laporan_id','periode_laporan'],['periode_akademik_id','periode_akademik'],['prodi_id','prodi']]){
    if(data[field]!=null){const found=(await c.query(`SELECT id FROM ${table} WHERE id=$1 ${table==='prodi'?'AND aktif':''}`,[data[field]])).rows.length;
      if(!found)throw new HttpError(422,`${field} tidak tersedia.`);}
  }
  if(d.name==='iku-capaian'&&!(await c.query('SELECT id FROM iku_indikator WHERE id=$1',[data.indikator_id])).rows.length)throw new HttpError(422,'Indikator IKU tidak tersedia.');
  if(d.name==='rka-target'&&!(await c.query('SELECT id FROM rka_target WHERE id=$1',[data.rka_target_id])).rows.length)throw new HttpError(422,'Target RKA tidak tersedia.');
  if(d.name.startsWith('kpi')){
    const i=(await c.query('SELECT jenis FROM kpi_indikator WHERE id=$1',[data.indikator_id])).rows[0];
    if(!i)throw new HttpError(422,'Indikator tidak tersedia.');
    if(d.name==='kpi-capaian'&&((i.jenis==='tanggal'&&data.nilai_numerik!==null)||(i.jenis!=='tanggal'&&data.nilai_tanggal!==null)))throw new HttpError(422,'Jenis nilai tidak sesuai indikator KPI.');
  }
  if(d.name==='tracer-ringkasan'&&!(await c.query(`SELECT id FROM lulusan WHERE id=$1 AND cakupan='institusi' AND status='approved' AND is_current_approved AND tahun_lulus=$2 AND periode_laporan_id=$3 AND jumlah>=$4`,[data.lulusan_institusi_id,data.tahun_lulus,data.periode_laporan_id,data.responden])).rows.length)throw new HttpError(422,'Denominator lulusan institusi approved tidak sesuai.');
}
