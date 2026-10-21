import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {seed as seedExisting} from './seed-pimpinan.js';
import {createPool,transaction,reportError} from '../../server/services/db.js';
import {getDomain,validate} from '../../server/validators/domains.js';
import {publish,validateReferences} from '../../server/services/data.js';

export async function seedPeminat(pool){
 const text=await readFile(new URL('../seed/pmb-peminat-2026-s1.json',import.meta.url),'utf8'),source=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex');
 return transaction(pool,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(16020320)');
  const old=(await c.query("SELECT checksum FROM seed_runs WHERE kode='pmb-peminat-2026-s1-v1'")).rows[0];
  if(old){if(old.checksum!==checksum)throw Error('Seed Peminat berubah; buat versi baru.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND NOT aktif AND nama='seed'")).rows[0].id;
  const report=(await c.query('SELECT id FROM periode_laporan WHERE kode=$1',[source.periode_laporan])).rows[0].id;
  const academic=(await c.query('SELECT id FROM periode_akademik WHERE kode=$1',[source.periode_akademik])).rows[0].id;
  const unit=(await c.query("SELECT unit_id FROM domain_unit WHERE domain='pmb-peminat'")).rows[0].unit_id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_approved',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  await c.query("INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak,catatan) VALUES('pmb-peminat-t4-1-2026-s1',$1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",[source.dokumen,source.sha256,source.tabel,source.halaman_pdf,source.halaman_cetak,source.kutipan+'; '+source.catatan]);
  const src=(await c.query("SELECT id FROM sumber_data WHERE kode='pmb-peminat-t4-1-2026-s1'")).rows[0].id,d=getDomain('pmb-peminat');
  // Insert-only initial source: a human row, if present, takes precedence.
  const existing=(await c.query('SELECT 1 FROM pmb_peminat WHERE periode_laporan_id=$1 AND periode_akademik_id=$2 AND tahun_masuk=$3 AND tanggal_snapshot=$4',[report,academic,source.tahun_masuk,source.tanggal_snapshot])).rows.length;
  if(!existing){
   const values=validate(d,{periode_laporan_id:report,periode_akademik_id:academic,tahun_masuk:source.tahun_masuk,tanggal_snapshot:source.tanggal_snapshot,jumlah_peminat:source.jumlah_peminat});await validateReferences(c,d,values);
   const row={...values,unit_id:unit,created_by:actor,sumber_id:src,sumber:source.dokumen},keys=Object.keys(row);
   const draft=(await c.query(`INSERT INTO pmb_peminat(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(row))).rows[0];
   const submitted=(await c.query("UPDATE pmb_peminat SET status='submitted',submitted_by=$2,submitted_at=now() WHERE id=$1 RETURNING *",[draft.id,actor])).rows[0];
   await publish(c,d,{user:{id:actor}},submitted,'Seed laporan v1');
  }
  await c.query("INSERT INTO seed_runs(kode,checksum,user_id) VALUES('pmb-peminat-2026-s1-v1',$1,$2)",[checksum,actor]);
 });
}
export async function seed(pool){await seedExisting(pool);await seedPeminat(pool);}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const pool=createPool();try{await seed(pool);console.log('Sumber Peminat PMB selesai; insert-only, ledger dan audit workflow v1.');}catch(e){reportError(e);}finally{await pool.end();}
}
