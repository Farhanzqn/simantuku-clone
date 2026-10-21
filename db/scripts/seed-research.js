import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
import {getDomain,validate} from '../../server/validators/domains.js';
import {publish,validateReferences} from '../../server/services/data.js';
export async function seedResearch(pool){
 const text=await readFile(new URL('../seed/penelitian-hki-pkm-2026-s1.json',import.meta.url),'utf8'),data=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex');
 const reportSource=JSON.parse(await readFile(new URL('../seed/laporan-2026-s1.json',import.meta.url),'utf8'));
 return transaction(pool,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(16020266)');
  const old=(await c.query("SELECT checksum FROM seed_runs WHERE kode='research-2026-s1-v1'")).rows[0];
  if(old){if(old.checksum!==checksum)throw Error('Seed LPPM berubah; gunakan versi baru.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND NOT aktif AND nama='seed'")).rows[0].id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_approved',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  const report=(await c.query('SELECT id FROM periode_laporan WHERE kode=$1',[data.periode_laporan])).rows[0].id;
  const owner=(await c.query("SELECT unit_id FROM domain_unit WHERE domain='penelitian'")).rows[0].unit_id;
  for(const [name,config] of Object.entries(data.domains)){
   const d=getDomain(name),sources={};
   for(const page of [...new Set(config.rows.map(x=>x.page))])sources[page]=(await c.query('INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(kode) DO UPDATE SET kode=EXCLUDED.kode RETURNING id',['t'+config.tabel.replace('.','_')+'_'+page,data.dokumen,reportSource.sha256,config.tabel,page,String(page-8)])).rows[0].id;
   for(const source of config.rows){
    const raw={...source};delete raw.page;
    const values=validate(d,{...raw,periode_laporan_id:report,periode_akademik_id:null,tahun:data.tahun});await validateReferences(c,d,values);
    const row={...values,unit_id:owner,created_by:actor,sumber_id:sources[source.page],sumber:data.dokumen},keys=Object.keys(row);
    const draft=(await c.query(`INSERT INTO ${d.table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(row))).rows[0];
    const submitted=(await c.query(`UPDATE ${d.table} SET status='submitted',submitted_by=$2,submitted_at=now() WHERE id=$1 RETURNING *`,[draft.id,actor])).rows[0];
    await publish(c,d,{user:{id:actor}},submitted,'Seed laporan v1');
   }
  }
  const sources=[];for(const [kode,year] of [['penelitian-narasi-2025',2025],['penelitian-judul-2026',2026]]){
   const id=(await c.query("INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak) VALUES($1,$2,$3,'4.7',116,'108') ON CONFLICT(kode) DO UPDATE SET kode=EXCLUDED.kode RETURNING id",[kode,data.dokumen,reportSource.sha256])).rows[0].id;sources.push([id,year]);
  }
  const detail={tahun_resmi:2026,sumber:[{tabel:'4.7',halaman_pdf:116,halaman_cetak:'108',nilai:2025,kutipan:'Rincian target, realisasi, serta capaian pelaksanaan penelitian pada tahun 2025 disajikan pada tabel 4.7.'},{tabel:'4.7',halaman_pdf:116,halaman_cetak:'108',nilai:2026,kutipan:'Tabel 4. 7 Realisasi Penelitian Tahun 2026 Semester I'}]};
  const flag=(await c.query("INSERT INTO data_quality_flag(kode,tabel,unit_id,sumber_id,pesan,detail,severity,rule_code) VALUES('penelitian-tahun-narasi-berbeda','penelitian_revisi',$1,$2,'Narasi penelitian menulis 2025; judul Tabel 4.7 menulis 2026. Tahun resmi mengikuti judul tabel; perlu verifikasi LPPM.',$3,'warning','source_year_conflict') RETURNING id",[owner,sources[1][0],detail])).rows[0].id;
  for(const [id,year] of sources)await c.query("INSERT INTO data_quality_flag_sumber(flag_id,sumber_id,nilai_numerik,satuan) VALUES($1,$2,$3,'tahun')",[flag,id,year]);
  await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',['research-2026-s1-v1',checksum,actor]);
  console.log('Seed LPPM: 5 penelitian, 4 HKI, 2 PkM v1 melalui draft/submitted/approved; dana NULL.');
 });
}
