import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
import {getDomain,validate} from '../../server/validators/domains.js';
import {publish,validateReferences} from '../../server/services/data.js';
export async function seedCooperation(pool){
 const text=await readFile(new URL('../seed/kerjasama-2026-s1.json',import.meta.url),'utf8'),data=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex'),base=JSON.parse(await readFile(new URL('../seed/laporan-2026-s1.json',import.meta.url),'utf8'));
 const proof=data.evidence;if(proof.length!==170||proof.some((x,i)=>x.baris!==i+1)||proof.filter(x=>x.nilai===null).length!==1||proof.reduce((n,x)=>n+(x.nilai??0),0)!==235)throw Error('Bukti penjumlahan Tabel 2.3 tidak cocok.');
 return transaction(pool,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(16020269)');const old=(await c.query("SELECT checksum FROM seed_runs WHERE kode='cooperation-2026-s1-v1'")).rows[0];if(old){if(old.checksum!==checksum)throw Error('Seed kerja sama berubah; buat versi baru.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND NOT aktif AND nama='seed'")).rows[0].id,unit=(await c.query("SELECT unit_id FROM domain_unit WHERE domain='kerjasama'")).rows[0].unit_id,report=(await c.query('SELECT id FROM periode_laporan WHERE kode=$1',[data.periode_laporan])).rows[0].id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_approved',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  let nationalSource;
  for(const input of data.rows){const {tabel,pdf,cetak,...raw}=input;
   const source=(await c.query('INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak,catatan) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(kode) DO UPDATE SET kode=EXCLUDED.kode RETURNING id',['cooperation-'+tabel,data.dokumen,base.sha256,tabel,pdf,cetak,'Agregat cakupan terpisah. Tabel 2.3 PDF 33–38; 2.24 PDF 84–87; 2.25 PDF 87–89. Tidak menjumlah cakupan atau nilai kontrak.'])).rows[0].id;
   if(tabel==='2.3')nationalSource=source;
   const d=getDomain('kerjasama'),values=validate(d,{...raw,periode_laporan_id:report,tahun:data.tahun});await validateReferences(c,d,values);
   const row={...values,unit_id:unit,created_by:actor,sumber_id:source,sumber:data.dokumen},keys=Object.keys(row);
   const draft=(await c.query(`INSERT INTO kerjasama_revisi(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(row))).rows[0];
   const submitted=(await c.query("UPDATE kerjasama_revisi SET status='submitted',submitted_by=$2,submitted_at=now() WHERE id=$1 RETURNING *",[draft.id,actor])).rows[0];await publish(c,d,{user:{id:actor}},submitted,'Seed laporan v1');
  }
  await c.query("INSERT INTO data_quality_flag(kode,tabel,unit_id,sumber_id,pesan,detail,severity,rule_code) VALUES('kerjasama-akademik-total-kosong','kerjasama_revisi',$1,$2,'Tabel 2.3 baris 80 tidak mempunyai nilai Total. Jumlah 235 hanya menjumlah sel tersedia; perlu verifikasi Bagian Pengembangan Kemitraan.',$3,'warning','source_incomplete')",[unit,nationalSource,{sumber:[{tabel:'2.3',halaman_pdf:35,halaman_cetak:'27',kutipan:'80 PT. PLN (PERSERO) UP3 BIMA; kolom Total kosong',nilai:null}],jumlah_sel_tersedia:235,baris_sumber:170,bukti:proof}]);
  await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',['cooperation-2026-s1-v1',checksum,actor]);console.log('Seed kerja sama: empat cakupan v1 approved, tanpa nominal kontrak atau individu.');
 });
}
