import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
import {getDomain,validate} from '../../server/validators/domains.js';
import {publish,validateReferences} from '../../server/services/data.js';
export async function seedFinance(pool){
 const text=await readFile(new URL('../seed/keuangan-2026-s1.json',import.meta.url),'utf8'),data=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex'),base=JSON.parse(await readFile(new URL('../seed/laporan-2026-s1.json',import.meta.url),'utf8'));
 return transaction(pool,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(16020272)');const old=(await c.query("SELECT checksum FROM seed_runs WHERE kode='finance-2026-s1-v1'")).rows[0];if(old){if(old.checksum!==checksum)throw Error('Seed keuangan berubah; buat versi baru.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND NOT aktif AND nama='seed'")).rows[0].id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_approved',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  const unit=(await c.query("SELECT unit_id FROM domain_unit WHERE domain='keuangan'")).rows[0].unit_id,report=(await c.query('SELECT id FROM periode_laporan WHERE kode=$1',[data.periode_laporan])).rows[0].id;
  async function source(tabel,pdf,cetak){return (await c.query('INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak,catatan) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(kode) DO UPDATE SET kode=EXCLUDED.kode RETURNING id',['finance-'+tabel+'-'+pdf,data.dokumen,base.sha256,tabel,pdf,cetak??String(pdf-8),'Satuan rasio per kategori; nominal Rp (narasi PDF 145/cetak 137). Cakupan tabel terpisah; kode periode sebelumnya tidak tersedia.'])).rows[0].id;}
  for(const raw of data.rows){const {tabel,pdf,...fields}=raw,d=getDomain('keuangan'),values=validate(d,{...fields,periode_laporan_id:report,tahun:data.tahun});await validateReferences(c,d,values);
   const row={...values,unit_id:unit,created_by:actor,sumber_id:await source(tabel,pdf),sumber:data.dokumen},keys=Object.keys(row);
   const draft=(await c.query(`INSERT INTO keuangan_revisi(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(row))).rows[0],submitted=(await c.query("UPDATE keuangan_revisi SET status='submitted',submitted_by=$2,submitted_at=now() WHERE id=$1 RETURNING *",[draft.id,actor])).rows[0];await publish(c,d,{user:{id:actor}},submitted,'Seed laporan v1');
  }
  for(const f of data.flags){const ids=[];for(const s of f.sources)ids.push(await source(s.tabel,s.pdf,s.cetak));const detail={sumber:f.sources.map(s=>({...s,halaman_pdf:s.pdf,halaman_cetak:s.cetak??String(s.pdf-8)}))};
   const flag=(await c.query("INSERT INTO data_quality_flag(kode,tabel,unit_id,sumber_id,pesan,detail,severity,rule_code) VALUES($1,'keuangan_revisi',$2,$3,$4,$5,'warning','source_finance_comparison') RETURNING id",[f.kode,unit,ids[0],f.pesan,detail])).rows[0].id;
   for(const [i,s]of f.sources.entries())await c.query('INSERT INTO data_quality_flag_sumber(flag_id,sumber_id,nilai_numerik,satuan) VALUES($1,$2,$3,$4)',[flag,ids[i],s.nilai??null,s.satuan??'keterangan']);
  }
  await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',['finance-2026-s1-v1',checksum,actor]);console.log('Seed keuangan: 17 butir v1 approved; empat flag pembanding bersumber, KPI tidak diubah.');
 });
}
