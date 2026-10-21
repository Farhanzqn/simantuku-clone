import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
// Dijalankan setelah seed visibilitas Fase 4; checksum seed lama tidak berubah.
const privateModules=['tendik','keuangan','kpi','iku','ami','pegawai-internal','pegawai','formasi','data_quality_flag'];
export async function seedInternalVisibility(pool){return transaction(pool,async c=>{
  const key='phase5d-internal-visibility-v1',checksum=createHash('sha256').update(JSON.stringify(privateModules)).digest('hex');
  await c.query('SELECT pg_advisory_xact_lock(16020269)');
  const old=(await c.query('SELECT checksum FROM seed_runs WHERE kode=$1',[key])).rows[0];
  if(old){if(old.checksum!==checksum)throw Error('Checksum seed visibilitas internal berubah.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND nama='seed' AND NOT aktif")).rows[0].id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','phase5d_internal_visibility',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  await c.query("INSERT INTO visibilitas_modul(kode_modul,akses) SELECT unnest($1::text[]),'authenticated' ON CONFLICT(kode_modul) DO UPDATE SET akses='authenticated' WHERE visibilitas_modul.akses IS DISTINCT FROM 'authenticated'",[privateModules]);
  await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',[key,checksum,actor]);
});}
