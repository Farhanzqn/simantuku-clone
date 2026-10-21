import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
import {getDomain,validate} from '../../server/validators/domains.js';
import {publish,validateReferences} from '../../server/services/data.js';
import {warnings} from '../../static-web/assets/js/input-schema.js';
export async function seedAccreditation(pool){
 const text=await readFile(new URL('../seed/akreditasi-2026-s1.json',import.meta.url),'utf8'),data=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex');
 const base=JSON.parse(await readFile(new URL('../seed/laporan-2026-s1.json',import.meta.url),'utf8'));
 return transaction(pool,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(16020265)');
  const old=(await c.query("SELECT checksum FROM seed_runs WHERE kode='akreditasi-2026-s1-v1'")).rows[0];
  if(old){if(old.checksum!==checksum)throw Error('Seed akreditasi berubah; buat versi baru.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND NOT aktif AND nama='seed'")).rows[0].id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_approved',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  const report=(await c.query('SELECT id FROM periode_laporan WHERE kode=$1',[data.periode_laporan])).rows[0].id;
  const unit=(await c.query("SELECT unit_id FROM domain_unit WHERE domain='akreditasi'")).rows[0].unit_id,sources={};
  for(const page of [141,142])sources[page]=(await c.query("INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak) VALUES($1,$2,$3,'4.17',$4,$5) ON CONFLICT(kode) DO UPDATE SET kode=EXCLUDED.kode RETURNING id",['t4_17_'+page,data.dokumen,base.sha256,page,String(page-8)])).rows[0].id;
  const flag=async(kode,row,pesan,detail)=>c.query("INSERT INTO data_quality_flag(kode,tabel,row_id,unit_id,sumber_id,pesan,detail,severity,rule_code) VALUES($1,'akreditasi_revisi',$2,$3,$4,$5,$6,'warning','source_review')",[kode,row?.id??null,unit,row?.sumber_id??sources[141],pesan,detail]);
  const inserted=[];
  for(const source of data.rows){
   const prodi=source.prodi_kode?(await c.query('SELECT id FROM prodi WHERE kode=$1',[source.prodi_kode])).rows[0].id:null;
   const values=validate(getDomain('akreditasi'),{periode_laporan_id:report,periode_akademik_id:null,butir:source.butir,cakupan:'prodi',prodi_id:prodi,nama_sumber:source.nama_sumber,jenjang:source.jenjang,peringkat:source.peringkat,nomor_sk:source.nomor_sk,lembaga:source.lembaga,berlaku_mulai:source.berlaku_mulai,berlaku_sampai:source.berlaku_sampai,status_sumber:source.status_sumber});
   await validateReferences(c,getDomain('akreditasi'),values);
   const row={...values,unit_id:unit,created_by:actor,sumber_id:sources[source.halaman_pdf],sumber:data.dokumen};
   const keys=Object.keys(row),draft=(await c.query(`INSERT INTO akreditasi_revisi(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(row))).rows[0];
   const submitted=(await c.query("UPDATE akreditasi_revisi SET status='submitted',submitted_by=$2,submitted_at=now() WHERE id=$1 RETURNING *",[draft.id,actor])).rows[0];
   const approved=await publish(c,getDomain('akreditasi'),{user:{id:actor}},submitted,'Seed laporan v1');inserted.push(approved);
   const citation={tabel:'4.17',halaman_pdf:source.halaman_pdf,halaman_cetak:source.halaman_cetak,kutipan:source.nama_sumber+' | '+source.nomor_sk+' | '+source.berlaku_sampai+' | '+source.status_sumber};
   if(!prodi)await flag('akreditasi-belum-terpetakan-'+source.butir,approved,'Nama prodi laporan belum dipastikan pemetaannya ke master; perlu verifikasi PJM.',{sumber:[citation],nama_laporan:source.nama_sumber});
   const notices=warnings('akreditasi',values);if(notices.length)await flag('akreditasi-masa-berlaku-'+source.butir,approved,notices.join(' '),{sumber:[citation],khusus_internal:true});
   if(source.butir==='prodi-18')await flag('akreditasi-d3-mesin-tanggal',approved,'Tabel menulis D3 Mesin Aktif, tetapi masa berlaku 12-01-2026 mendahului snapshot Semester I 2026. Angka sumber dipertahankan.',{sumber:[citation,{tabel:'4.17',halaman_pdf:142,halaman_cetak:'134',kutipan:'seluruh program studi telah memiliki status akreditasi aktif'}]});
  }
  const duplicates=inserted.filter(x=>x.nomor_sk==='070/SK/LAMSAMA/Akred/S/V/2025');
  await flag('akreditasi-sk-duplikat',null,'S1 Geografi dan S1 Kewirausahaan memakai SK yang sama; perlu verifikasi PJM.',{sumber:duplicates.map(x=>({tabel:'4.17',halaman_pdf:141,halaman_cetak:'133',kutipan:x.nama_sumber+' | '+x.nomor_sk}))});
  const counts={};for(const r of inserted)counts[r.peringkat]=(counts[r.peringkat]??0)+1;
  if(inserted.length!==19||counts.Baik!==11||counts['Baik Sekali']!==6||counts.Unggul!==1||counts.Terakreditasi!==1)throw Error('Rekap akreditasi tidak sesuai narasi Tabel 4.17.');
  await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',['akreditasi-2026-s1-v1',checksum,actor]);
  console.log('Seed akreditasi: 19 butir v1 draft -> submitted -> approved; institusi/internasional tetap kosong.');
 });
}
