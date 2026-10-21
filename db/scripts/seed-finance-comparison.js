import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
export async function seedFinanceComparison(pool){
 const text=await readFile(new URL('../seed/keuangan-pembanding-a2.json',import.meta.url),'utf8'),data=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex');
 return transaction(pool,async c=>{
  const key='finance-a2-comparison-v1';await c.query('SELECT pg_advisory_xact_lock(16020273)');const old=(await c.query('SELECT checksum FROM seed_runs WHERE kode=$1',[key])).rows[0];
  if(old){if(old.checksum!==checksum)throw Error('Checksum pembanding keuangan berubah.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND NOT aktif AND nama='seed'")).rows[0].id,unit=(await c.query("SELECT unit_id FROM domain_unit WHERE domain='keuangan'")).rows[0].unit_id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_source_comparison',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  const ids=[];for(const source of data.sources){const row=(await c.query('SELECT id FROM sumber_data WHERE kode=$1',[source.kode])).rows[0];if(!row)throw Error('Provenance keuangan belum terpasang.');ids.push(row.id);}
  const flag=(await c.query("INSERT INTO data_quality_flag(kode,tabel,unit_id,sumber_id,pesan,detail,severity,rule_code) VALUES($1,'keuangan_revisi',$2,$3,$4,$5,'warning','source_finance_comparison') RETURNING id",[data.kode,unit,ids[0],data.pesan,{sumber:data.sources}])).rows[0].id;
  for(const [i,source]of data.sources.entries())await c.query('INSERT INTO data_quality_flag_sumber(flag_id,sumber_id,nilai_numerik,satuan) VALUES($1,$2,$3,$4)',[flag,ids[i],source.nilai,source.satuan]);
  await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',[key,checksum,actor]);
 });
}
