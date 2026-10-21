import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../server/services/db.js';
export async function seedDashboard(pool){
  const text=await readFile(new URL('../seed/dashboard-2026-s1.json',import.meta.url),'utf8'),data=JSON.parse(text),checksum=createHash('sha256').update(text).digest('hex');
  return transaction(pool,async c=>{
    await c.query('SELECT pg_advisory_xact_lock(16020263)');
    const old=(await c.query("SELECT checksum FROM seed_runs WHERE kode='dashboard-2026-s1-v1'")).rows[0];
    if(old){if(old.checksum!==checksum)throw new Error('Seed dashboard berubah: gunakan versi baru.');return;}
    const actor=(await c.query("SELECT id FROM users WHERE is_system AND nama='seed' AND NOT aktif")).rows[0].id;
    await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_approved',true),set_config('app.request_id',$2,true)",[String(actor),randomUUID()]);
    const academic=(await c.query('SELECT id FROM periode_akademik WHERE kode=$1',[data.periode_akademik])).rows[0].id,report=(await c.query('SELECT id FROM periode_laporan WHERE kode=$1',[data.periode_laporan])).rows[0].id;
    await c.query("INSERT INTO domain_unit(domain,unit_id) SELECT v.domain,u.id FROM (VALUES ('mahasiswa-angkatan','BAA'),('pegawai-ringkasan','BSDM')) v(domain,kode) JOIN unit u ON u.kode=v.kode ON CONFLICT(domain) DO NOTHING");
    const owners=new Map((await c.query('SELECT domain,unit_id FROM domain_unit')).rows.map(r=>[r.domain,r.unit_id]));
    const sources={};
    for(const [kode,tabel,page,cetak] of [['t2_5','2.5',39,'31–33'],['t2_7','2.7',43,'35']])sources[kode]=(await c.query('INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak,rentang_mulai,rentang_akhir) VALUES($1,$2,$3,$4,$5,$6,\'2026-01-01\',\'2026-06-30\') ON CONFLICT(kode) DO UPDATE SET kode=EXCLUDED.kode RETURNING id',[kode,data.dokumen,data.sha256,tabel,page,cetak])).rows[0].id;
    let total=0;
    for(const prodi of data.angkatan){
      const id=(await c.query('SELECT id FROM prodi WHERE kode=$1',[prodi.prodi_kode])).rows[0].id,sum=Object.values(prodi.rows).reduce((a,b)=>a+b,0);
      const official=Number((await c.query('SELECT sum(total) AS n FROM v_dashboard_mahasiswa WHERE prodi_id=$1 AND periode_akademik_id=$2 AND periode_laporan_id=$3',[id,academic,report])).rows[0].n);
      if(sum!==official)throw new Error('Jumlah angkatan tidak sama dengan mahasiswa approved per prodi.');total+=sum;
      for(const [angkatan,jumlah] of Object.entries(prodi.rows))await c.query(`INSERT INTO mahasiswa_angkatan(periode_laporan_id,periode_akademik_id,unit_id,prodi_id,angkatan,total,status,is_current_approved,created_by,approved_by,approved_at,sumber_id,sumber) VALUES($1,$2,$3,$4,$5,$6,'approved',true,$7,$7,now(),$8,$9)`,[report,academic,owners.get('mahasiswa-angkatan'),id,Number(angkatan),jumlah,actor,sources.t2_5,data.dokumen]);
    }
    for(const [kategori,jumlah] of Object.entries(data.pegawai))await c.query(`INSERT INTO pegawai_ringkasan(periode_laporan_id,periode_akademik_id,unit_id,kategori,jumlah,status,is_current_approved,created_by,approved_by,approved_at,sumber_id,sumber) VALUES($1,$2,$3,$4,$5,'approved',true,$6,$6,now(),$7,$8)`,[report,academic,owners.get('pegawai-ringkasan'),kategori,jumlah,actor,sources.t2_7,data.dokumen]);
    await c.query("UPDATE data_quality_flag SET catatan_publik=pesan WHERE kode='jafung-total-institut'");
    await c.query("UPDATE data_quality_flag SET catatan_publik='definisi berbeda dengan KPI PMB ('||replace(detail->>'persen_kpi','.',',')||'%)' WHERE kode='pmb-definisi-berbeda'");
    await c.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES($1,$2,$3)',['dashboard-2026-s1-v1',checksum,actor]);
    console.log(`Seed dashboard approved: ${total} mahasiswa dalam 78 baris angkatan; empat kategori pegawai Tabel 2.7.`);
  });
}
