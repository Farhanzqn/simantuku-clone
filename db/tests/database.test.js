import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPool } from '../../server/services/db.js';
import { migrate } from '../scripts/migrate.js';
import { seed } from '../scripts/seed-home-public.js';
import { check } from '../scripts/check.js';
import {seedInternalVisibility} from '../scripts/seed-internal-visibility.js';

test('Fase 1: migrasi/seed dan integritas PostgreSQL pada database terpisah',async t=>{
  const name=process.env.PGTEST_DATABASE;
  assert.ok(name?.endsWith('_test') && name!==process.env.PGDATABASE,'PGTEST_DATABASE harus terpisah dan berakhiran _test');
  const pool=createPool(name);
  try {
    // Tidak menghapus schema atau data existing: test DB harus kosong atau hasil fixture ini.
    await migrate(pool); await seed(pool);
    await t.test('Peminat PMB institusi: sumber 21.172, provenance, review default dan ledger',async()=>{
      const rows=(await pool.query("SELECT d.jumlah_peminat,d.tahun_masuk,d.tanggal_snapshot,d.periode_akademik_kode,d.versi,d.row_version,s.nomor_tabel,s.halaman_pdf FROM (SELECT v.*,p.versi,p.row_version FROM v_dashboard_pmb_peminat v JOIN pmb_peminat p USING(periode_laporan_id,periode_akademik_id,tahun_masuk,tanggal_snapshot) WHERE p.is_current_approved) d JOIN sumber_data s ON s.id=d.sumber_id WHERE d.periode_laporan_kode='2026-S1'")).rows;
      assert.equal(rows.length,1);assert.equal(rows[0].jumlah_peminat,21172);assert.equal(rows[0].periode_akademik_kode,'20261');assert.equal(rows[0].nomor_tabel,'4.1');assert.equal(rows[0].halaman_pdf,107);assert.equal(rows[0].row_version,3);
      assert.equal((await pool.query("SELECT perlu_verifikasi FROM definisi_formulir WHERE domain='pmb-peminat'")).rows[0].perlu_verifikasi,true);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM seed_runs WHERE kode='pmb-peminat-2026-s1-v1'")).rows[0].n,1);
    });
    await t.test('IKU 19 indikator approved dan empat catatan sumber',async()=>{
      const r=(await pool.query("SELECT count(*)::int AS n,count(*) FILTER(WHERE perlu_verifikasi)::int AS flagged FROM v_dashboard_iku WHERE tahun=2026 AND periode='T2'")).rows[0];assert.equal(r.n,19);assert.equal(r.flagged,4);
      const value=(await pool.query("SELECT round(persen_capaian,1) AS p FROM v_dashboard_iku WHERE kode='IKU 1' AND tahun=2026 AND periode='T2'")).rows[0];assert.equal(value.p,'94.1');
    });
    await t.test('Query kontrol, semua NULL tracer, dua sumber KPI',async()=>{await check(pool);});
    await t.test('D1 langkah 0: kebijakan tendik/internal tetap privat setelah seed dan idempotent',async()=>{
      const modules=['tendik','keuangan','kpi','iku','ami','pegawai-internal','pegawai','formasi','data_quality_flag'];
      const policies=(await pool.query('SELECT kode_modul,akses FROM visibilitas_modul WHERE kode_modul=ANY($1::text[])',[modules])).rows;
      assert.equal(policies.length,modules.length);assert.ok(policies.every(p=>p.akses==='authenticated'));
      assert.equal((await pool.query("SELECT akses FROM visibilitas_modul WHERE kode_modul='pegawai-publik'")).rows[0].akses,'public');
      const count=Number((await pool.query('SELECT count(*) AS n FROM audit_log')).rows[0].n);await seedInternalVisibility(pool);
      assert.equal(Number((await pool.query('SELECT count(*) AS n FROM audit_log')).rows[0].n),count);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM seed_runs WHERE kode='phase5d-internal-visibility-v1'")).rows[0].n,1);
    });
    await t.test('D1: angka bersumber, satuan, NULL, penurunan dan audit seed keuangan',async()=>{
      const rows=(await pool.query("SELECT k.*,r.versi,r.row_version FROM v_dashboard_keuangan k JOIN keuangan_revisi r ON r.id=k.id WHERE periode_laporan_kode='2026-S1'")).rows;
      assert.equal(rows.length,17);const by=key=>rows.find(x=>x.kategori===key);assert.equal(Number(by('pendapatan-mahasiswa').realisasi),59395010115);assert.equal(Number(by('likuiditas').realisasi),15.59);assert.equal(by('likuiditas').satuan,'kali');assert.equal(by('cost-student').satuan,'Rp/mahasiswa');assert.equal(by('efisiensi').satuan,'%');
      assert.equal(Number(by('laba-rugi').perubahan),-5310639000);assert.equal(Number(by('arus-kas').perubahan),-45994239000);
      for(const row of rows){assert.equal(row.versi,1);assert.equal(row.row_version,3);assert.ok(['2.12','2.13','2.14','4.19'].includes(row.nomor_tabel));assert.ok([58,60,61,144].includes(row.halaman_pdf));assert.equal(Number(row.halaman_cetak),row.halaman_pdf-8);
        assert.deepEqual((await pool.query("SELECT nilai_baru->>'status' AS status FROM audit_log WHERE tabel='keuangan_revisi' AND row_id=$1 AND aksi='seed_approved' ORDER BY id",[row.id])).rows.map(x=>x.status),['draft','submitted','approved']);
        if(row.nomor_tabel==='4.19'){assert.equal(row.target,null);assert.equal(row.capaian_laporan,null);assert.equal(Number(row.perubahan),Number(row.realisasi)-Number(row.periode_sebelumnya));}else assert.equal(row.perubahan,null);
      }
      const flags=(await pool.query("SELECT f.kode,f.detail,count(fs.sumber_id)::int AS n FROM data_quality_flag f JOIN data_quality_flag_sumber fs ON fs.flag_id=f.id WHERE f.kode LIKE 'keuangan-%' GROUP BY f.id")).rows;
      assert.equal(flags.length,5);assert.ok(flags.every(f=>f.n>=2&&f.detail.sumber.every(s=>s.kutipan&&s.halaman_pdf&&s.halaman_cetak)));
      assert.deepEqual(flags.find(f=>f.kode==='keuangan-kpi-pendapatan-berbeda').detail.sumber.map(x=>x.nilai),[417000000,417000000,59395010115]);
      assert.equal(Number((await pool.query("SELECT metrik_tambahan->>'pendapatan_miliar_rp' AS nilai FROM kpi_capaian c JOIN kpi_indikator i ON i.id=c.indikator_id WHERE i.kode='A1' AND c.is_current_approved")).rows[0].nilai),0.417);
      assert.deepEqual(flags.find(f=>f.kode==='keuangan-kpi-non-mahasiswa-berbeda').detail.sumber.map(x=>x.nilai),[25000000,2112640000]);
      assert.equal(Number((await pool.query("SELECT c.nilai_numerik AS nilai FROM kpi_capaian c JOIN kpi_indikator i ON i.id=c.indikator_id WHERE i.kode='A2' AND c.is_current_approved")).rows[0].nilai),0.025);
    });
    await t.test('D3: formasi/pergerakan bersumber, guard seed, flags dan ringkasan lama tetap',async()=>{
      const rows=(await pool.query("SELECT * FROM v_dashboard_formasi WHERE periode_laporan_kode='2026-S1' ORDER BY id")).rows;assert.equal(rows.length,50);
      assert.deepEqual(rows.map(x=>Number(x.kategori.split('-')[1])),[...Array.from({length:43},(_,i)=>i+1),...Array.from({length:7},(_,i)=>i+45)]);
      assert.equal(rows.reduce((n,x)=>n+x.jumlah,0),341);assert.equal(rows.reduce((n,x)=>n+x.target,0),403);assert.ok(rows.every(x=>x.nomor_tabel==='2.9'&&[44,45,46].includes(x.halaman_pdf)));
      assert.equal(Number(rows.find(x=>x.kategori==='laporan-9').capaian_laporan),1100);assert.equal(Number(rows.find(x=>x.kategori==='laporan-9').capaian_hitung),100);assert.equal(Number(rows.find(x=>x.kategori==='laporan-34').capaian_hitung),112.5);
      const movements=(await pool.query("SELECT * FROM v_dashboard_pergerakan_pegawai WHERE periode_laporan_kode='2026-S1' ORDER BY id")).rows;assert.deepEqual(movements.map(x=>x.jumlah),[5,4,2,5]);assert.ok(movements.every(x=>x.nomor_tabel==='2.11'&&[57,58].includes(x.halaman_pdf)));
      for(const [table,items]of [['formasi_revisi',rows],['pergerakan_pegawai_revisi',movements]])for(const row of items){const version=(await pool.query(`SELECT versi,row_version FROM ${table} WHERE id=$1`,[row.id])).rows[0];assert.deepEqual(version,{versi:1,row_version:3});assert.deepEqual((await pool.query("SELECT nilai_baru->>'status' AS status FROM audit_log WHERE tabel=$1 AND row_id=$2 AND aksi='seed_approved' ORDER BY id",[table,row.id])).rows.map(x=>x.status),['draft','submitted','approved']);}
      const flags=(await pool.query("SELECT f.kode,f.detail,count(s.sumber_id)::int AS n FROM data_quality_flag f JOIN data_quality_flag_sumber s ON s.flag_id=f.id WHERE f.rule_code='source_employment_comparison' GROUP BY f.id")).rows;assert.equal(flags.length,4);assert.ok(flags.every(x=>x.n===2&&x.detail.sumber.every(s=>s.kutipan&&s.halaman_pdf&&s.halaman_cetak)));
      assert.ok(flags.find(x=>x.kode==='pegawai-tendik-cakupan-berbeda').detail.sumber[0].kutipan.includes('30 orang tenaga kependidikan'));
      assert.equal((await pool.query("SELECT akses FROM visibilitas_modul WHERE kode_modul='formasi'")).rows[0].akses,'authenticated');assert.ok((await pool.query("SELECT perlu_verifikasi FROM definisi_formulir WHERE domain IN ('formasi','pegawai-pergerakan')")).rows.every(x=>x.perlu_verifikasi));
      const before=JSON.stringify(rows);await seed(pool);assert.equal(JSON.stringify((await pool.query("SELECT * FROM v_dashboard_formasi WHERE periode_laporan_kode='2026-S1' ORDER BY id")).rows),before);
      assert.deepEqual((await pool.query("SELECT kategori,jumlah FROM v_dashboard_pegawai_ringkasan ORDER BY kategori")).rows.map(x=>[x.kategori,x.jumlah]),[['dosen_tetap',222],['dosen_tidak_tetap',55],['pkwt',68],['tendik',109]]);
    });
    await t.test('C3: AMI cocok dengan narasi, provenance, NULL dan seed workflow',async()=>{
      const rows=(await pool.query("SELECT a.*,s.nomor_tabel,s.halaman_pdf FROM ami_revisi a JOIN periode_laporan l ON l.id=a.periode_laporan_id JOIN sumber_data s ON s.id=a.sumber_id WHERE l.kode='2026-S1' AND a.is_current_approved ORDER BY kategori")).rows;
      assert.equal(rows.length,32);const e=rows.filter(x=>x.kategori.startsWith('entitas-')),p=e.slice(0,19),u=e.slice(19);assert.equal(e.length,28);assert.ok(u.every(x=>x.status_sumber===null));assert.ok(p.every(x=>x.status_sumber!==null));
      const sum=(items,key)=>items.reduce((a,x)=>a+Number(x[key]),0);assert.equal(sum(p,'jumlah_standar'),1357);assert.equal(sum(p,'kesenjangan'),1050);assert.equal(sum(u,'jumlah_standar'),116);assert.equal(sum(u,'kesenjangan'),18);assert.equal(sum(e,'jumlah_standar'),1473);assert.equal(sum(e,'kesenjangan'),1068);assert.equal((sum(p,'capaian_laporan')/19).toFixed(2),'52.13');assert.equal((sum(u,'capaian_laporan')/9).toFixed(2),'72.23');
      assert.deepEqual(rows.filter(x=>x.kategori.startsWith('rekap-')).map(x=>x.jumlah_prodi),[5,7,1,6]);assert.equal(e.find(x=>x.kategori==='entitas-25').kesenjangan,0);
      for(const row of rows){assert.equal(row.versi,1);assert.equal(row.row_version,3);assert.equal(row.status,'approved');assert.ok([128,129,130,131].includes(row.halaman_pdf));assert.deepEqual((await pool.query("SELECT nilai_baru->>'status' AS status FROM audit_log WHERE tabel='ami_revisi' AND row_id=$1 AND aksi='seed_approved' ORDER BY id",[row.id])).rows.map(x=>x.status),['draft','submitted','approved']);if(row.kategori.startsWith('entitas-')){const src=(await pool.query('SELECT nomor_tabel,halaman_pdf FROM sumber_data WHERE id=ANY($1::bigint[]) ORDER BY nomor_tabel',[[row.sumber_evaluasi_id,row.sumber_pembanding_id]])).rows;assert.deepEqual(src.map(x=>x.nomor_tabel),['4.14','4.15']);assert.ok([132,133].includes(src[0].halaman_pdf));assert.ok([134,135].includes(src[1].halaman_pdf));}}
      const flags=(await pool.query("SELECT f.kode,f.detail,count(fs.sumber_id)::int AS n FROM data_quality_flag f JOIN data_quality_flag_sumber fs ON fs.flag_id=f.id WHERE f.kode IN ('ami-istilah-kesenjangan-awal','ami-rujukan-narasi-berbeda') GROUP BY f.id")).rows;assert.equal(flags.length,2);assert.ok(flags.every(f=>f.n===2&&f.detail.sumber.every(s=>s.kutipan&&s.halaman_pdf&&s.halaman_cetak)));
      assert.equal((await pool.query("SELECT akses FROM visibilitas_modul WHERE kode_modul='ami'")).rows[0].akses,'authenticated');assert.equal((await pool.query("SELECT perlu_verifikasi FROM definisi_formulir WHERE domain='ami'")).rows[0].perlu_verifikasi,true);
    });
    await t.test('B3: realisasi 4.17, dua nama belum terpetakan, flags bersumber dan institusi kosong',async()=>{
      const rows=(await pool.query("SELECT a.*,s.nomor_tabel,s.halaman_pdf FROM v_dashboard_akreditasi a JOIN sumber_data s ON s.id=a.sumber_id WHERE periode_laporan_kode='2026-S1'")).rows;
      assert.equal(rows.length,19);assert.equal(rows.filter(x=>x.prodi_id===null).length,2);assert.equal(rows.filter(x=>x.cakupan!=='prodi').length,0);
      const counts={};for(const row of rows){assert.equal(row.nomor_tabel,'4.17');assert.ok([141,142].includes(row.halaman_pdf));assert.equal(row.berlaku_mulai,null);counts[row.peringkat]=(counts[row.peringkat]??0)+1;}
      assert.deepEqual(counts,{Terakreditasi:1,Baik:11,'Baik Sekali':6,Unggul:1});
      const flags=(await pool.query("SELECT kode,detail FROM data_quality_flag WHERE kode IN ('akreditasi-sk-duplikat','akreditasi-d3-mesin-tanggal')")).rows;assert.equal(flags.length,2);
      for(const flag of flags){assert.equal(flag.detail.sumber.length,2);assert.ok(flag.detail.sumber.every(s=>s.kutipan&&s.tabel==='4.17'&&s.halaman_pdf));}
      assert.equal((await pool.query("SELECT perlu_verifikasi FROM definisi_formulir WHERE domain='akreditasi'")).rows[0].perlu_verifikasi,true);
    });
    await t.test('B4: kontrol sumber, dana NULL, dua tahun bersumber, seed v1 diaudit',async()=>{
      for(const [name,count,target,actual] of [['penelitian',5,130,7],['hki',4,160,87],['pkm',2,29,2]]){
        const rows=(await pool.query(`SELECT d.*,s.nomor_tabel,s.halaman_pdf FROM ${name}_revisi d JOIN periode_laporan l ON l.id=d.periode_laporan_id JOIN sumber_data s ON s.id=d.sumber_id WHERE l.kode='2026-S1' AND is_current_approved`)).rows;
        assert.equal(rows.length,count);assert.equal(rows.reduce((n,x)=>n+x.target,0),target);assert.equal(rows.reduce((n,x)=>n+x[name==='hki'?'disetujui':'realisasi'],0),actual);
        for(const row of rows){assert.equal(row.versi,1);assert.equal(row.row_version,3);assert.equal(row.tahun,2026);if(name!=='hki')assert.equal(row.dana,null);assert.ok([116,117,118,119].includes(row.halaman_pdf));assert.deepEqual((await pool.query("SELECT nilai_baru->>'status' AS status FROM audit_log WHERE tabel=$1 AND row_id=$2 AND aksi='seed_approved' ORDER BY id",[name+'_revisi',row.id])).rows.map(x=>x.status),['draft','submitted','approved']);}
      }
      const values=(await pool.query("SELECT s.halaman_pdf,fs.nilai_numerik FROM data_quality_flag f JOIN data_quality_flag_sumber fs ON fs.flag_id=f.id JOIN sumber_data s ON s.id=fs.sumber_id WHERE f.kode='penelitian-tahun-narasi-berbeda' ORDER BY fs.nilai_numerik")).rows;assert.deepEqual(values.map(x=>Number(x.nilai_numerik)),[2025,2026]);assert.ok(values.every(x=>x.halaman_pdf===116));
      for(const [kode,numbers,pages] of [['penelitian-target-produktivitas-berbeda',[105,130],[43,117]],['penelitian-realisasi-produktivitas-berbeda',[3,7],[43,117]],['pkm-target-produktivitas-berbeda',[25,29],[43,119]]]){
        const refs=(await pool.query('SELECT s.halaman_pdf,fs.nilai_numerik FROM data_quality_flag f JOIN data_quality_flag_sumber fs ON fs.flag_id=f.id JOIN sumber_data s ON s.id=fs.sumber_id WHERE f.kode=$1 ORDER BY s.halaman_pdf',[kode])).rows;assert.deepEqual(refs.map(x=>Number(x.nilai_numerik)),numbers);assert.deepEqual(refs.map(x=>x.halaman_pdf),pages);
      }
    });
    await t.test('B5: hanya Tabel 1.8, 14 prodi, total narasi cocok, minus NULL dan audit tiga status',async()=>{
      const rows=(await pool.query('SELECT p.*,s.nomor_tabel,s.halaman_pdf FROM prestasi_revisi p JOIN sumber_data s ON s.id=p.sumber_id ORDER BY prodi_id')).rows;assert.equal(rows.length,14);
      for(const [key,total] of Object.entries({jumlah_mahasiswa:122,nasional:105,regional:8,internasional:9}))assert.equal(rows.reduce((n,x)=>n+(x[key]??0),0),total);
      assert.ok(rows.every(x=>x.pkm_dikti===null&&x.nomor_tabel==='1.8'&&x.halaman_pdf===27&&x.versi===1));assert.equal(rows.filter(x=>x.jumlah_mahasiswa===null).length,1);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM prodi p WHERE NOT EXISTS(SELECT 1 FROM prestasi_revisi r WHERE r.prodi_id=p.id)')).rows[0].n,5);
      for(const row of rows)assert.deepEqual((await pool.query("SELECT nilai_baru->>'status' AS status FROM audit_log WHERE tabel='prestasi_revisi' AND row_id=$1 AND aksi='seed_approved' ORDER BY id",[row.id])).rows.map(x=>x.status),['draft','submitted','approved']);
    });
    await t.test('C1: empat cakupan, bukti 235/NULL, status dan sumber, master tidak dikarang',async()=>{
      const rows=(await pool.query('SELECT r.*,s.nomor_tabel,s.halaman_pdf FROM kerjasama_revisi r JOIN sumber_data s ON s.id=r.sumber_id ORDER BY kategori')).rows;assert.equal(rows.length,4);assert.deepEqual(rows.map(x=>x.jumlah),[235,3,12,29]);
      const national=rows[0];assert.equal(national.total_kosong,1);assert.equal(national.selesai,null);assert.equal(national.baris_sumber,170);
      assert.equal(rows[1].mitra_institusi,'AseanSpace; ICBC; HR&CDI');assert.equal(rows[2].selesai,4);assert.equal(rows[2].berjalan,7);assert.equal(rows[3].selesai,6);assert.equal(rows[3].tahap_penjajakan,5);
      const flag=(await pool.query("SELECT detail FROM data_quality_flag WHERE kode='kerjasama-akademik-total-kosong'")).rows[0].detail;assert.equal(flag.bukti.length,170);assert.equal(flag.bukti[79].nilai,null);assert.equal(flag.bukti[79].halaman_pdf,35);
      assert.equal((await pool.query("SELECT u.kode FROM domain_unit d JOIN unit u ON u.id=d.unit_id WHERE d.domain='kerjasama'")).rows[0].kode,null);
      for(const row of rows){assert.equal(row.versi,1);assert.equal(row.row_version,3);assert.deepEqual((await pool.query("SELECT nilai_baru->>'status' AS status FROM audit_log WHERE tabel='kerjasama_revisi' AND row_id=$1 AND aksi='seed_approved' ORDER BY id",[row.id])).rows.map(x=>x.status),['draft','submitted','approved']);}
    });
    await t.test('C2: tiga ukuran BSDM, angka/sumber 2.8, tanpa penelitian/PkM duplikat',async()=>{
      const rows=(await pool.query('SELECT r.*,s.nomor_tabel,s.halaman_pdf FROM produktivitas_dosen_revisi r JOIN sumber_data s ON s.id=r.sumber_id ORDER BY kategori')).rows;assert.equal(rows.length,3);
      const map=new Map(rows.map(x=>[x.kategori,x]));for(const [key,target,real,capaian] of [['publikasi',245,62,25],['beban-mengajar',12,12.83,106.92],['pelatihan',60,112,186.67]]){const row=map.get(key);assert.equal(Number(row.target),target);assert.equal(Number(row.realisasi),real);assert.equal(Number(row.capaian_laporan),capaian);assert.equal(row.nomor_tabel,'2.8');assert.equal(row.halaman_pdf,43);assert.equal(row.row_version,3);assert.deepEqual((await pool.query("SELECT nilai_baru->>'status' AS status FROM audit_log WHERE tabel='produktivitas_dosen_revisi' AND row_id=$1 AND aksi='seed_approved' ORDER BY id",[row.id])).rows.map(x=>x.status),['draft','submitted','approved']);}
      assert.equal((await pool.query("SELECT u.kode FROM domain_unit d JOIN unit u ON u.id=d.unit_id WHERE d.domain='produktivitas-dosen'")).rows[0].kode,'BSDM');assert.equal((await pool.query("SELECT count(*)::int AS n FROM data_quality_flag WHERE kode=ANY($1::text[])",[['penelitian-target-produktivitas-berbeda','penelitian-realisasi-produktivitas-berbeda','pkm-target-produktivitas-berbeda']])).rows[0].n,3);
    });
    await t.test('Migrasi dan seed ulang idempotent, audit/password tidak bertambah/berubah',async()=>{
      const before=(await pool.query("SELECT count(*)::int AS n FROM audit_log")).rows[0].n;
      const hashes=(await pool.query('SELECT email,password_hash FROM users ORDER BY email')).rows;
      await migrate(pool); await seed(pool);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n,before);
      assert.deepEqual((await pool.query('SELECT email,password_hash FROM users ORDER BY email')).rows,hashes);
    });
    async function rollback(work) {
      const c=await pool.connect();
      try{await c.query('BEGIN'); await work(c);}finally{await c.query('ROLLBACK');c.release();}
    }
    await t.test('Runner migration gagal rollback DDL dan ledger; checksum perubahan ditolak',async()=>{
      const fixture=await mkdtemp(join(tmpdir(),'itpln-migration-test-'));
      const directory=pathToFileURL(fixture+'/');
      const original=new URL('../migrations/',import.meta.url);
      const files=(await readdir(original)).filter(f=>f.endsWith('.sql')).sort();
      for(const f of files) await writeFile(new URL(f,directory),await readFile(new URL(f,original)));
      await writeFile(new URL('999_failure_probe.sql',directory),'CREATE TABLE phase1_rollback_probe(id integer); SELECT missing_column FROM phase1_rollback_probe;');
      await assert.rejects(migrate(pool,directory),{code:'42703'});
      assert.equal((await pool.query("SELECT to_regclass('phase1_rollback_probe') AS name")).rows[0].name,null);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM schema_migrations WHERE nama='999_failure_probe.sql'")).rows[0].n,0);
      await writeFile(new URL(files[0],directory),(await readFile(new URL(files[0],original),'utf8'))+'\n-- changed checksum\n');
      await assert.rejects(migrate(pool,directory),/Checksum migration berubah/);
    });
    await t.test('FK dan CHECK angka nonnegatif menolak input',async()=>{
      for(const [column,value,code] of [['perempuan',-1,'23514'],['prodi_id',999999,'23503']]) {
        await rollback(async c=>{
          const r=(await c.query('SELECT * FROM mahasiswa_aktif LIMIT 1')).rows[0];
          const draft={...r,id:undefined,versi:2,status:'draft',is_current_approved:false,approved_by:null,approved_at:null,[column]:value};
          delete draft.id; delete draft.created_at; delete draft.updated_at;
          const keys=Object.keys(draft);
          await assert.rejects(c.query(`INSERT INTO mahasiswa_aktif(${keys.join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')})`,Object.values(draft)),{code});
        });
      }
    });
    await t.test('Revisi draft tidak mengubah view approved; edit approved ditolak',async()=>{
      await rollback(async c=>{
        const r=(await c.query('SELECT * FROM mahasiswa_aktif ORDER BY id LIMIT 1')).rows[0];
        const draft={...r,versi:2,previous_approved_id:r.id,total:r.total+10,status:'draft',is_current_approved:false,approved_by:null,approved_at:null};
        delete draft.id; delete draft.created_at; delete draft.updated_at;
        const keys=Object.keys(draft);
        await c.query(`INSERT INTO mahasiswa_aktif(${keys.join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')})`,Object.values(draft));
        assert.equal(Number((await c.query('SELECT sum(total) AS n FROM v_dashboard_mahasiswa')).rows[0].n),5080);
        await assert.rejects(c.query('UPDATE mahasiswa_aktif SET total=total+1 WHERE id=$1',[r.id]),{code:'23514'});
      });
    });
    await t.test('E1: preview terpisah, kedaluwarsa 15 menit dan audit metadata saja',async()=>{
      assert.equal((await pool.query("SELECT has_table_privilege('app_user','form_upload_preview','SELECT,INSERT,UPDATE') AS ok,has_table_privilege('app_user','form_upload_preview','DELETE') AS del")).rows[0].ok,true);assert.equal((await pool.query("SELECT has_table_privilege('app_user','form_upload_preview','DELETE') AS del")).rows[0].del,false);
      const events=(await pool.query("SELECT nilai_baru FROM audit_log WHERE tabel='form_excel'")).rows;assert.ok(events.every(x=>!('file' in x.nilai_baru)&&!('values' in x.nilai_baru)&&!('password' in x.nilai_baru)));await assert.rejects(pool.query("SELECT record_form_excel_event('template_apply','{\"file\":\"tidak-boleh\"}'::jsonb)"),/Metadata audit template tidak valid/);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM form_upload_preview WHERE expires_at-created_at<>interval '15 minutes'")).rows[0].n,0);
    });
    await t.test('Draft dibatalkan: CHECK, audit aman dan app_user tanpa DELETE',async()=>{
      const tables=(await pool.query("SELECT DISTINCT c.relname FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND k.contype='c' AND pg_get_constraintdef(k.oid) LIKE '%discarded%'")).rows;assert.equal(tables.length,25);assert.ok(tables.some(t=>t.relname==='pmb_peminat'));
      for(const {relname} of tables)assert.equal((await pool.query("SELECT has_table_privilege('app_user',$1,'DELETE') AS allowed",[relname])).rows[0].allowed,false);
      const f=(await pool.query("SELECT prosecdef,proconfig FROM pg_proc WHERE oid='audit_change()'::regprocedure")).rows[0];assert.equal(f.prosecdef,true);assert.ok(f.proconfig.some(x=>x.includes('search_path=')));
    });
    await t.test('Audit menolak UPDATE/DELETE dan tidak mengandung password_hash',async()=>{
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_log WHERE nilai_baru ? 'password_hash' OR nilai_lama ? 'password_hash'")).rows[0].n,0);
      await rollback(async c=>{await assert.rejects(c.query('DELETE FROM audit_log'),{code:'42501'});});
      await rollback(async c=>{await assert.rejects(c.query("UPDATE audit_log SET aksi='changed'"),{code:'42501'});});
    });
    await t.test('Lulusan institut tidak bercampur rincian prodi dan seed user tidak login',async()=>{
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM lulusan WHERE prodi_id IS NOT NULL")).rows[0].n,0);
      const user=(await pool.query("SELECT aktif,password_hash,is_system FROM users WHERE role='system'")).rows[0];
      assert.deepEqual(user,{aktif:false,password_hash:null,is_system:true});
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM kpi_capaian WHERE status<>'approved' OR approved_by<>(SELECT id FROM users WHERE role='system')")).rows[0].n,0);
    });
  } finally {await pool.end();}
});
