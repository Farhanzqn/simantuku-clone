import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
import {getDomain,validate} from '../../server/validators/domains.js';
import {publish,validateReferences} from '../../server/services/data.js';
export async function seedEmployment(pool){
 const text=await readFile(new URL('../seed/pegawai-formasi-2026-s1.json',import.meta.url),'utf8'),data=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex'),base=JSON.parse(await readFile(new URL('../seed/laporan-2026-s1.json',import.meta.url),'utf8'));
 return transaction(pool,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(16020274)');const old=(await c.query("SELECT checksum FROM seed_runs WHERE kode='employment-2026-s1-v1'")).rows[0];if(old){if(old.checksum!==checksum)throw Error('Seed pegawai/formasi berubah; buat versi baru.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND NOT aktif AND nama='seed'")).rows[0].id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_approved',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  for(const domain of ['formasi','pegawai-pergerakan'])await c.query("INSERT INTO domain_unit(domain,unit_id) SELECT $1,id FROM unit WHERE kode='BSDM' ON CONFLICT(domain) DO NOTHING",[domain]);
  const unit=(await c.query("SELECT unit_id FROM domain_unit WHERE domain='formasi'")).rows[0].unit_id,report=(await c.query('SELECT id FROM periode_laporan WHERE kode=$1',[data.periode_laporan])).rows[0].id;
  async function source(tabel,pdf,cetak,part=''){return (await c.query('INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak,catatan) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(kode) DO UPDATE SET kode=EXCLUDED.kode RETURNING id',['employment-'+tabel+'-'+pdf+part,data.dokumen,base.sha256,tabel,pdf,cetak??String(pdf-8),'Agregat sumber SDM; nama unit sumber bukan kode master. Tanpa identitas, tidak menggabungkan kategori pegawai.'])).rows[0].id;}
  for(const [domain,rows] of [['formasi',data.formasi],['pegawai-pergerakan',data.pergerakan]])for(const raw of rows){const {nomor,nama_sumber,label,tabel,pdf,...fields}=raw,d=getDomain(domain),values=validate(d,{...fields,periode_laporan_id:report,tahun:data.tahun});await validateReferences(c,d,values);
   const row={...values,unit_id:unit,created_by:actor,sumber_id:await source(tabel,pdf),sumber:data.dokumen},keys=Object.keys(row);
   const draft=(await c.query(`INSERT INTO ${d.table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(row))).rows[0],submitted=(await c.query(`UPDATE ${d.table} SET status='submitted',submitted_by=$2,submitted_at=now() WHERE id=$1 RETURNING *`,[draft.id,actor])).rows[0];await publish(c,d,{user:{id:actor}},submitted,'Seed laporan v1');
  }
  // Heading 1.5 memakai "Pendidikan", tetapi kutipan narasi PDF 23 memakai "kependidikan".
  // Pertahankan checksum/angka JSON; kutipan narasi harus mengikuti teks aslinya.
  for(const f of data.flags){const ids=[];for(const [i,s] of f.sources.entries())ids.push(await source(s.tabel,s.pdf,s.cetak,'-'+f.kode+'-'+i));const detail={sumber:f.sources.map(s=>({...s,kutipan:f.kode==='pegawai-tendik-cakupan-berbeda'&&s.tabel==='1.5'?s.kutipan.replace('30 orang tenaga pendidikan','30 orang tenaga kependidikan'):s.kutipan,halaman_pdf:s.pdf,halaman_cetak:s.cetak??String(s.pdf-8)}))};
   const flag=(await c.query("INSERT INTO data_quality_flag(kode,tabel,unit_id,sumber_id,pesan,detail,severity,rule_code) VALUES($1,'formasi_revisi',$2,$3,$4,$5,'warning','source_employment_comparison') RETURNING id",[f.kode,unit,ids[0],f.pesan,detail])).rows[0].id;
   for(const [i,s]of f.sources.entries())await c.query('INSERT INTO data_quality_flag_sumber(flag_id,sumber_id,nilai_numerik,satuan) VALUES($1,$2,$3,$4)',[flag,ids[i],s.nilai??null,s.satuan??'keterangan']);
  }
  await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',['employment-2026-s1-v1',checksum,actor]);console.log('Seed pegawai/formasi: 50 formasi + 4 pergerakan v1 approved; empat flag bersumber.');
 });
}
