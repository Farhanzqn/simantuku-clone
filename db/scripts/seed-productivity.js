import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
import {getDomain,validate} from '../../server/validators/domains.js';
import {publish,validateReferences} from '../../server/services/data.js';
export async function seedProductivity(pool){
 const text=await readFile(new URL('../seed/produktivitas-dosen-2026-s1.json',import.meta.url),'utf8'),data=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex'),base=JSON.parse(await readFile(new URL('../seed/laporan-2026-s1.json',import.meta.url),'utf8'));
 return transaction(pool,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(16020270)');const old=(await c.query("SELECT checksum FROM seed_runs WHERE kode='productivity-2026-s1-v1'")).rows[0];if(old){if(old.checksum!==checksum)throw Error('Seed produktivitas berubah; buat versi baru.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND NOT aktif AND nama='seed'")).rows[0].id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_approved',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  await c.query("INSERT INTO domain_unit(domain,unit_id) SELECT 'produktivitas-dosen',id FROM unit WHERE kode='BSDM' ON CONFLICT(domain) DO NOTHING");
  const unit=(await c.query("SELECT unit_id FROM domain_unit WHERE domain='produktivitas-dosen'")).rows[0].unit_id,report=(await c.query('SELECT id FROM periode_laporan WHERE kode=$1',[data.periode_laporan])).rows[0].id;
  const source=(await c.query("INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak,catatan) VALUES('productivity-t2_8',$1,$2,'2.8',43,'35','Hanya publikasi, beban mengajar rata-rata dan pelatihan. Penelitian/PkM mengikuti 4.7/4.9.') ON CONFLICT(kode) DO UPDATE SET kode=EXCLUDED.kode RETURNING id",[data.dokumen,base.sha256])).rows[0].id;
  for(const raw of data.rows){const d=getDomain('produktivitas-dosen'),values=validate(d,{...raw,periode_laporan_id:report,tahun:data.tahun});await validateReferences(c,d,values);const row={...values,unit_id:unit,created_by:actor,sumber_id:source,sumber:data.dokumen},keys=Object.keys(row);
   const draft=(await c.query(`INSERT INTO produktivitas_dosen_revisi(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(row))).rows[0],submitted=(await c.query("UPDATE produktivitas_dosen_revisi SET status='submitted',submitted_by=$2,submitted_at=now() WHERE id=$1 RETURNING *",[draft.id,actor])).rows[0];await publish(c,d,{user:{id:actor}},submitted,'Seed laporan v1');
  }
  await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',['productivity-2026-s1-v1',checksum,actor]);console.log('Seed produktivitas: tiga ukuran unik Tabel 2.8 v1 approved; penelitian/PkM tidak disalin.');
 });
}
