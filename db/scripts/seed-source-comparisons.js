import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
export async function seedSourceComparisons(pool){
 const text=await readFile(new URL('../seed/lppm-perbandingan-sumber.json',import.meta.url),'utf8'),data=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex'),base=JSON.parse(await readFile(new URL('../seed/laporan-2026-s1.json',import.meta.url),'utf8'));
 return transaction(pool,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(16020268)');const old=(await c.query("SELECT checksum FROM seed_runs WHERE kode='lppm-source-comparisons-v1'")).rows[0];if(old){if(old.checksum!==checksum)throw Error('Perbandingan sumber berubah; buat versi baru.');return;}
  const actor=(await c.query("SELECT id FROM users WHERE is_system AND NOT aktif AND nama='seed'")).rows[0].id;
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_quality_flag',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
  for(const item of data.comparisons){
   const unit=(await c.query('SELECT unit_id FROM domain_unit WHERE domain=$1',[item.domain])).rows[0].unit_id,ids=[];
   for(const src of item.sources)ids.push((await c.query('INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(kode) DO UPDATE SET kode=EXCLUDED.kode RETURNING id',['lppm-compare-'+src.tabel+'-'+src.pdf,data.dokumen,base.sha256,src.tabel,src.pdf,src.cetak])).rows[0].id);
   const detail={field:item.field,nilai_resmi:item.sources[1].nilai,sumber:item.sources.map(x=>({tabel:x.tabel,halaman_pdf:x.pdf,halaman_cetak:x.cetak,nilai:x.nilai,kutipan:x.kutipan}))};
   const flag=(await c.query("INSERT INTO data_quality_flag(kode,tabel,unit_id,sumber_id,pesan,detail,severity,rule_code) VALUES($1,$2,$3,$4,$5,$6,'warning','source_total_conflict') RETURNING id",[item.kode,item.domain+'_revisi',unit,ids[1],'Nilai produktivitas Tabel 2.8 berbeda dari rincian LPPM. Dashboard mengikuti Tabel '+item.sources[1].tabel+'; perlu verifikasi cakupan/definisi LPPM.',detail])).rows[0].id;
   for(let i=0;i<ids.length;i++)await c.query("INSERT INTO data_quality_flag_sumber(flag_id,sumber_id,nilai_numerik,satuan) VALUES($1,$2,$3,'jumlah')",[flag,ids[i],item.sources[i].nilai]);
  }
  await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',['lppm-source-comparisons-v1',checksum,actor]);console.log('Tiga flag perbandingan Tabel 2.8 vs 4.7/4.9 ditambahkan; data approved tidak diubah.');
 });
}
