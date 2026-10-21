import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
import {getDomain,validate} from '../../server/validators/domains.js';
import {publish,validateReferences} from '../../server/services/data.js';
export async function seedAchievements(pool){
 const text=await readFile(new URL('../seed/prestasi-2026-s1.json',import.meta.url),'utf8'),data=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex');
 const base=JSON.parse(await readFile(new URL('../seed/laporan-2026-s1.json',import.meta.url),'utf8'));
 return transaction(pool,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(16020267)');const old=(await c.query("SELECT checksum FROM seed_runs WHERE kode='prestasi-2026-s1-v1'")).rows[0];
  if(old){if(old.checksum!==checksum)throw Error('Seed prestasi berubah; gunakan versi baru.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND NOT aktif AND nama='seed'")).rows[0].id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_approved',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  const report=(await c.query('SELECT id FROM periode_laporan WHERE kode=$1',[data.periode_laporan])).rows[0].id,unit=(await c.query("SELECT unit_id FROM domain_unit WHERE domain='prestasi'")).rows[0].unit_id;
  const source=(await c.query("INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak) VALUES('t1_8', $1,$2,'1.8',27,'19') ON CONFLICT(kode) DO UPDATE SET kode=EXCLUDED.kode RETURNING id",[data.dokumen,base.sha256])).rows[0].id;
  const d=getDomain('prestasi');
  for(const src of data.rows){const {prodi_kode,...counts}=src,prodi=(await c.query('SELECT id FROM prodi WHERE kode=$1',[prodi_kode])).rows[0].id;
   const values=validate(d,{...counts,periode_laporan_id:report,tahun:data.tahun,prodi_id:prodi});await validateReferences(c,d,values);
   const row={...values,unit_id:unit,created_by:actor,sumber_id:source,sumber:data.dokumen},keys=Object.keys(row);
   const draft=(await c.query(`INSERT INTO prestasi_revisi(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(row))).rows[0];
   const submitted=(await c.query("UPDATE prestasi_revisi SET status='submitted',submitted_by=$2,submitted_at=now() WHERE id=$1 RETURNING *",[draft.id,actor])).rows[0];await publish(c,d,{user:{id:actor}},submitted,'Seed laporan v1');
  }
  for(const [field,narrative] of Object.entries(data.narasi)){
   const filled=data.rows.map(x=>x[field]).filter(x=>x!==null),total=filled.length?filled.reduce((n,x)=>n+x,0):null;
   if(total!==narrative)await c.query("INSERT INTO data_quality_flag(kode,tabel,unit_id,sumber_id,pesan,detail,severity,rule_code) VALUES($1,'prestasi_revisi',$2,$3,$4,$5,'warning','source_total_conflict')",['prestasi-total-'+field,unit,source,'Jumlah rincian berbeda dari narasi; perlu verifikasi BKM.',{sumber:[{tabel:'1.8',halaman_pdf:27,halaman_cetak:'19',kutipan:'Jumlah rincian '+field,nilai:total},{tabel:'1.8',halaman_pdf:27,halaman_cetak:'19',kutipan:'122 mahasiswa berprestasi; 105 nasional; 8 provinsi/wilayah; 9 internasional',nilai:narrative}]}]);
  }
  await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',['prestasi-2026-s1-v1',checksum,actor]);console.log('Seed prestasi: 14 prodi v1 approved; tanda minus NULL, lima prodi tanpa rincian tidak diisi.');
 });
}
