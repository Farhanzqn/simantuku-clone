import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
import {getDomain,validate} from '../../server/validators/domains.js';
import {publish,validateReferences} from '../../server/services/data.js';
export async function seedAMI(pool){
 const text=await readFile(new URL('../seed/ami-2026-s1.json',import.meta.url),'utf8'),data=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex'),base=JSON.parse(await readFile(new URL('../seed/laporan-2026-s1.json',import.meta.url),'utf8'));
 return transaction(pool,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(16020271)');const old=(await c.query("SELECT checksum FROM seed_runs WHERE kode='ami-2026-s1-v1'")).rows[0];if(old){if(old.checksum!==checksum)throw Error('Seed AMI berubah; buat versi baru.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND NOT aktif AND nama='seed'")).rows[0].id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_approved',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  const unit=(await c.query("SELECT unit_id FROM domain_unit WHERE domain='ami'")).rows[0].unit_id,report=(await c.query('SELECT id FROM periode_laporan WHERE kode=$1',[data.periode_laporan])).rows[0].id;
  async function source(tabel,pdf){return (await c.query('INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak,catatan) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(kode) DO UPDATE SET kode=EXCLUDED.kode RETURNING id',['ami-'+tabel+'-'+pdf,data.dokumen,base.sha256,tabel,pdf,String(pdf-8),'Semester I: evaluasi diri/kesiapan/kesenjangan awal, bukan audit formal.'])).rows[0].id;}
  for(const [i,raw] of data.rows.entries()){
   const {tabel,pdf,pembanding_pdf,evaluasi_pdf,...fields}=raw;
   if(i<28&&JSON.stringify([fields.skor_standar,fields.realisasi,fields.capaian_laporan])!==JSON.stringify(data.comparison[i].nums))throw Error('Perbandingan rincian AMI tidak cocok.');
   const d=getDomain('ami'),values=validate(d,{...fields,periode_laporan_id:report,tahun:data.tahun});await validateReferences(c,d,values);
   const row={...values,unit_id:unit,created_by:actor,sumber_id:await source(tabel,pdf),sumber_evaluasi_id:evaluasi_pdf?await source('4.15',evaluasi_pdf):null,sumber_pembanding_id:pembanding_pdf?await source('4.14',pembanding_pdf):null,sumber:data.dokumen},keys=Object.keys(row);
   const draft=(await c.query(`INSERT INTO ami_revisi(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(row))).rows[0],submitted=(await c.query("UPDATE ami_revisi SET status='submitted',submitted_by=$2,submitted_at=now() WHERE id=$1 RETURNING *",[draft.id,actor])).rows[0];await publish(c,d,{user:{id:actor}},submitted,'Seed laporan v1');
  }
  const flags=[{kode:'ami-istilah-kesenjangan-awal',pesan:'Judul tabel memakai Hasil AMI, tetapi semester I adalah evaluasi diri/kesenjangan awal, bukan temuan audit formal.',sources:[{tabel:'4.15',pdf:134,kutipan:'Tabel 4.15 Evaluasi Hasil AMI Tahun 2026 Semester I'},{tabel:'4.3 (narasi)',pdf:128,kutipan:'Audit Mutu Internal sebagai bentuk evaluasi formal terhadap kesesuaian pelaksanaan standar baru dilaksanakan pada semester II.'}]},{kode:'ami-rujukan-narasi-berbeda',pesan:'Narasi merujuk 4.14 untuk kesenjangan; rincian standar/kesenjangan berada di 4.15. Angka tidak diubah.',sources:[{tabel:'4.14 (narasi)',pdf:135,kutipan:'Berdasarkan pemetaan awal pada Tabel 4.14, terdapat 1.068 kesenjangan dari 1.473 standar atau indikator yang diperiksa, setara dengan 72,5%.'},{tabel:'4.15',pdf:134,kutipan:'Tabel 4.15 Evaluasi Hasil AMI Tahun 2026 Semester I'}]}];
  for(const f of flags){const ids=[];for(const src of f.sources)ids.push(await source(src.tabel,src.pdf));const detail={sumber:f.sources.map(s=>({...s,halaman_pdf:s.pdf,halaman_cetak:s.pdf-8}))};const flag=(await c.query("INSERT INTO data_quality_flag(kode,tabel,unit_id,sumber_id,pesan,detail,severity,rule_code) VALUES($1,'ami_revisi',$2,$3,$4,$5,'warning','source_semantic_conflict') RETURNING id",[f.kode,unit,ids[0],f.pesan,detail])).rows[0].id;for(const id of ids)await c.query("INSERT INTO data_quality_flag_sumber(flag_id,sumber_id,nilai_numerik,satuan) VALUES($1,$2,NULL,'keterangan')",[flag,id]);}
  await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',['ami-2026-s1-v1',checksum,actor]);console.log('Seed AMI: 28 entitas dan empat rekap v1 approved; bukan audit formal.');
 });
}
