import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {seed as seedExisting} from './seed.js';
import {createPool,transaction,reportError} from '../../server/services/db.js';
import {getDomain,validate} from '../../server/validators/domains.js';
import {publish,validateReferences} from '../../server/services/data.js';

export async function seedIku(pool){
 const text=await readFile(new URL('../seed/iku-2026-t2.json',import.meta.url),'utf8'),data=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex');
 if(data.rows.length!==19)throw Error('Seed IKU harus berisi 19 indikator.');
 return transaction(pool,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(16020290)');
  const old=(await c.query("SELECT checksum FROM seed_runs WHERE kode='iku-2026-t2-v1'")).rows[0];
  if(old){if(old.checksum!==checksum)throw Error('Checksum seed IKU berubah; buat versi baru.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND NOT aktif AND nama='seed'")).rows[0].id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_approved',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  const unit=(await c.query("SELECT unit_id FROM domain_unit WHERE domain='iku-capaian'")).rows[0].unit_id;
  const report=(await c.query('SELECT id FROM periode_laporan WHERE kode=$1',[data.periode_laporan])).rows[0].id;
  await c.query("INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,catatan) VALUES('iku-2026-t2',$1,$2,'Indikator Wajib - 19 indikator',$3) ON CONFLICT DO NOTHING",[data.sumber,checksum,'Transkripsi pengguna; T2 2026, status sumber Sudah Diajukan. Tidak tersedia nomor halaman atau arti catatan kaki D3*/S2**.']);
  const source=(await c.query("SELECT id FROM sumber_data WHERE kode='iku-2026-t2'")).rows[0].id,ids=new Map(),d=getDomain('iku-capaian');
  for(const raw of data.rows){
   const indicator=(await c.query('INSERT INTO iku_indikator(kode,induk_id,uraian,satuan,arah,urutan,grup_iku) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(kode) DO NOTHING RETURNING id',[raw.kode,raw.induk?ids.get(raw.induk):null,raw.uraian,raw.satuan,raw.arah,raw.urutan,raw.grup_iku])).rows[0]??(await c.query('SELECT id FROM iku_indikator WHERE kode=$1',[raw.kode])).rows[0];
   ids.set(raw.kode,indicator.id);
   // Jangan membuat seed v1 di atas data manusia yang sudah ada.
   if((await c.query('SELECT 1 FROM iku_capaian WHERE indikator_id=$1 AND tahun=$2 AND periode=$3',[indicator.id,data.tahun,data.periode])).rows.length)continue;
   const values=validate(d,{periode_laporan_id:report,indikator_id:indicator.id,tahun:data.tahun,periode:data.periode,baseline:Number(raw.baseline),target:Number(raw.target),realisasi:Number(raw.realisasi),status_sumber:data.status_sumber,catatan_verifikasi:raw.catatan_verifikasi});
   await validateReferences(c,d,values);
   // Decimal strings bind directly to numeric: preserve source precision.
   const row={...values,baseline:raw.baseline,target:raw.target,realisasi:raw.realisasi,unit_id:unit,created_by:actor,sumber_id:source,sumber:data.sumber},keys=Object.keys(row);
   const draft=(await c.query(`INSERT INTO iku_capaian(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(row))).rows[0];
   const submitted=(await c.query("UPDATE iku_capaian SET status='submitted',submitted_by=$2,submitted_at=now() WHERE id=$1 RETURNING *",[draft.id,actor])).rows[0];
   await publish(c,d,{user:{id:actor}},submitted,'Seed laporan v1');
  }
  await c.query("INSERT INTO seed_runs(kode,checksum,user_id) VALUES('iku-2026-t2-v1',$1,$2)",[checksum,actor]);
  console.log('Seed IKU T2 2026 selesai; ledger insert-only, 19 definisi indikator.');
 });
}
export async function seed(pool){await seedExisting(pool);await seedIku(pool);}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const pool=createPool();try{await seed(pool);}catch(e){reportError(e);}finally{await pool.end();}
}
