import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
const privateModules=['keuangan','kpi','iku','ami','pegawai-internal','pegawai','formasi','data_quality_flag'];
export async function seedForms(pool){return transaction(pool,async c=>{
 const key='phase4-visibility-v1',checksum=createHash('sha256').update(JSON.stringify(privateModules)).digest('hex');
 await c.query('SELECT pg_advisory_xact_lock(16020264)');
 const old=(await c.query('SELECT checksum FROM seed_runs WHERE kode=$1',[key])).rows[0];if(old){if(old.checksum!==checksum)throw Error('Checksum seed visibilitas berubah.');return;}
 const actor=(await c.query("SELECT id FROM users WHERE is_system AND nama='seed' AND NOT aktif")).rows[0].id;
 await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','phase4_visibility',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
 await c.query("UPDATE visibilitas_modul SET akses=CASE WHEN kode_modul=ANY($1::text[]) THEN 'authenticated' ELSE 'public' END WHERE akses IS DISTINCT FROM CASE WHEN kode_modul=ANY($1::text[]) THEN 'authenticated' ELSE 'public' END",[privateModules]);
 for(const module of privateModules)await c.query("INSERT INTO visibilitas_modul(kode_modul,akses) VALUES($1,'authenticated') ON CONFLICT(kode_modul) DO NOTHING",[module]);
 await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',[key,checksum,actor]);
});}
