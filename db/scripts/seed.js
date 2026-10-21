import {seedEmployment} from './seed-employment.js';
import {seedInternalVisibility} from './seed-internal-visibility.js';
import {seedFinance} from './seed-finance.js';
import {seedFinanceComparison} from './seed-finance-comparison.js';
import {seedAMI} from './seed-ami.js';
import {seedProductivity} from './seed-productivity.js';
import {seedCooperation} from './seed-cooperation.js';
import {seedSourceComparisons} from './seed-source-comparisons.js';
import {seedFormPolicy} from './seed-form-policy.js';
import {seedAccreditation} from './seed-accreditation.js';
import {seedResearch} from './seed-research.js';
import {seedAchievements} from './seed-achievements.js';
import {seedForms} from './seed-forms.js';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import {seedDashboard} from './seed-dashboard.js';
import { createPool, transaction, reportError } from '../../server/services/db.js';

const tables = new Set(['mahasiswa_aktif','mahasiswa_baru','dosen_prodi','tendik_prodi','lulusan','tracer_study','tracer_ringkasan','kpi_capaian','kpi_input','data_quality_flag']);
const columnPattern = /^[a-z][a-z0-9_]*$/;
async function insert(client, table, row) {
  if (!tables.has(table) || Object.keys(row).some(key => !columnPattern.test(key))) throw new Error('Identifier seed tidak valid');
  const columns = Object.keys(row);
  return (await client.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES (${columns.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id`, Object.values(row))).rows[0].id;
}

async function seedBase(pool) {
  const json = await readFile(new URL('../seed/laporan-2026-s1.json', import.meta.url),'utf8');
  const master = await readFile(new URL('../seed/master.sql', import.meta.url),'utf8');
  const data = JSON.parse(json);
  if (data.prodi.length!==19 || data.kpi.length!==28 || data.prodi.some(p => p.tracer.length!==5 || p.tracer.some(v=>v!==null && (!Number.isInteger(v)||v<0)))) {
    throw new Error('Struktur seed laporan tidak sesuai.');
  }
  const checksum=createHash('sha256').update(json).update(master).digest('hex');
  return transaction(pool,async client => {
    await client.query('SELECT pg_advisory_xact_lock(16020261)');
    const existing = (await client.query('SELECT checksum FROM seed_runs WHERE kode=$1',['laporan-2026-s1-v1'])).rows[0];
    if (existing) {
      if (existing.checksum!==checksum) throw new Error('Seed terpasang berubah: gunakan migration/seed baru, jangan menimpa koreksi.');
      console.log('Seed sudah terpasang; data, password dan konfigurasi tidak ditimpa.');
      return;
    }
    const roles=['admin','viewer','baa','ppa','bsdm','bpka','bku','bkm','lppm','pjm','prp'];
    for (const role of roles) {
      if ((process.env[`DEMO_PASSWORD_${role.toUpperCase()}`]||'').length<12) {
        const error=new Error('Password demo diperlukan');
        error.safeMessage=`Isi DEMO_PASSWORD_${role.toUpperCase()} minimal 12 karakter.`;
        throw error;
      }
    }
    const seedUser = (await client.query(`INSERT INTO users(nama,email,password_hash,role,is_system,aktif,must_change_password)
      VALUES ('seed','seed@system.itpln.invalid',NULL,'system',true,false,false)
      ON CONFLICT(email) DO NOTHING RETURNING id`)).rows[0]
      || (await client.query("SELECT id FROM users WHERE email='seed@system.itpln.invalid' AND is_system AND role='system' AND NOT aktif")).rows[0];
    if (!seedUser) throw new Error('Identitas akun seed tidak sah.');
    await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.action','seed_approved',true),set_config('app.request_id',$2,true)",[String(seedUser.id),randomUUID()]);
    await client.query(master);
    const units = new Map((await client.query('SELECT id,kode FROM unit')).rows.map(u=>[u.kode,u.id]));
    const owners = new Map((await client.query('SELECT domain,unit_id FROM domain_unit')).rows.map(u=>[u.domain,u.unit_id]));
    for (const role of roles) {
      const hash=await bcrypt.hash(process.env[`DEMO_PASSWORD_${role.toUpperCase()}`],12);
      await client.query(`INSERT INTO users(nama,email,password_hash,role,unit_id)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING`,
        [`Demo ${role.toUpperCase()}`,`${role}@demo.itpln.invalid`,hash,role,units.get(role.toUpperCase())??null]);
    }
    const sources=new Map();
    for (const s of data.sources) {
      const result=await client.query(`INSERT INTO sumber_data(kode,dokumen,sha256,nomor_tabel,halaman_pdf,halaman_cetak,catatan,rentang_mulai,rentang_akhir)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'2026-01-01','2026-06-30') ON CONFLICT(kode) DO NOTHING RETURNING id`,
        [s.kode,s.kode==='keputusan_pengguna'?'Konfirmasi pengguna Fase 0':data.dokumen,s.kode==='keputusan_pengguna'?null:data.sha256,s.nomor_tabel,s.halaman_pdf,s.halaman_cetak,s.catatan]);
      sources.set(s.kode,result.rows[0]?.id || (await client.query('SELECT id FROM sumber_data WHERE kode=$1',[s.kode])).rows[0].id);
    }
    const akademik=new Map((await client.query('SELECT id,kode FROM periode_akademik')).rows.map(p=>[p.kode,p.id]));
    const laporan=(await client.query("SELECT id FROM periode_laporan WHERE kode='2026-S1'")).rows[0].id;
    const meta=(domain,source,academic=null)=>({periode_laporan_id:laporan,periode_akademik_id:academic,unit_id:owners.get(domain),
      versi:1,status:'approved',is_current_approved:true,approved_by:seedUser.id,approved_at:new Date(),created_by:seedUser.id,
      sumber_id:sources.get(source),sumber:data.dokumen});
    const flags=[];
    for (const p of data.prodi) {
      await client.query(`INSERT INTO prodi(kode,urutan,nama,jenjang) VALUES ($1,$2,$3,$4) ON CONFLICT(kode) DO NOTHING`,[p.kode,p.urutan,p.nama,p.jenjang]);
      const prodi=(await client.query('SELECT id FROM prodi WHERE kode=$1',[p.kode])).rows[0].id;
      await insert(client,'mahasiswa_aktif',{...meta('mahasiswa-aktif','t1_3',akademik.get('20252')),prodi_id:prodi,total:p.mahasiswa[0],perempuan:p.mahasiswa[1]});
      const keys=['total','perempuan','s3','tenaga_pengajar','asisten_ahli','lektor','lektor_kepala','guru_besar'];
      const dosenId=await insert(client,'dosen_prodi',{...meta('dosen','t1_4',akademik.get('20252')),prodi_id:prodi,...Object.fromEntries(keys.map((key,i)=>[key,p.dosen[i]]))});
      const jafung=p.dosen.slice(3).reduce((a,b)=>a+b,0);
      if (jafung!==p.dosen[0]) flags.push({kode:`dosen-jafung-${p.kode}`,tabel:'dosen_prodi',row_id:dosenId,unit_id:units.get('BSDM'),sumber_id:sources.get('t1_4'),severity:'warning',rule_code:'jafung_total',pesan:`${p.nama}: jafung ${jafung} vs total ${p.dosen[0]}; perlu verifikasi BSDM`,detail:{jafung,total:p.dosen[0],prodi_kode:p.kode}});
      await insert(client,'tendik_prodi',{...meta('tendik','t1_5',akademik.get('20252')),prodi_id:prodi,laki:p.tendik[0],perempuan:p.tendik[1]});
      await insert(client,'mahasiswa_baru',{...meta('mahasiswa-baru','t4_6',akademik.get('20261')),prodi_id:prodi,tahun_masuk:2026,tanggal_snapshot:data.snapshot,target:p.pmb[0],realisasi_daftar_ulang:p.pmb[1]});
      await insert(client,'tracer_study',{...meta('tracer','t1_6'),prodi_id:prodi,tahun_lulus:2025,jumlah_lulusan:null,responden:null,
        ...Object.fromEntries(['kerja_kurang_3_bulan','kerja_lebih_3_bulan','sesuai_bidang','wirausaha','studi_lanjut'].map((key,i)=>[key,p.tracer[i]]))});
    }
    const lulusanId=await insert(client,'lulusan',{...meta('lulusan','t1_6'),prodi_id:null,cakupan:'institusi',tahun_lulus:2025,periode_wisuda:null,jumlah:1100,ipk_rata:null});
    await insert(client,'tracer_ringkasan',{...meta('tracer-ringkasan','t1_6'),tahun_lulus:2025,lulusan_institusi_id:lulusanId,responden:328,
      kerja_kurang_3_bulan_sumber:309,kerja_lebih_3_bulan_sumber:19,sesuai_bidang_sumber:307,wirausaha_sumber:8,studi_lanjut_sumber:1,data_sementara:true});
    let jafungKpiId;
    for (const k of data.kpi) {
      const indikator=(await client.query(`INSERT INTO kpi_indikator(kode,tahun,perspektif,nama,formula,bobot,target_nilai,target_teks,target_tanggal,satuan,jenis,arah,arah_terkonfirmasi,unit_pemilik_id,sumber_id)
        VALUES ($1,2026,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [k.kode,k.perspektif,k.nama,k.formula,k.bobot,k.target_nilai,k.target_teks,k.target_tanggal,k.satuan,k.jenis,k.arah,k.arah_terkonfirmasi,units.get('PRP'),sources.get('t1_1')])).rows[0].id;
      const source=k.kode==='C9'?'ringkasan_eksekutif':k.perspektif==='C'?'t4_20_c':k.perspektif==='D'?'t4_20_d':'t4_20_ab';
      const capaian=await insert(client,'kpi_capaian',{...meta('kpi-capaian',source),indikator_id:indikator,tanggal_snapshot:data.snapshot,nilai_numerik:k.nilai_numerik,nilai_tanggal:k.nilai_tanggal,
        basis_nilai:k.basis_nilai,catatan:k.catatan,metrik_tambahan:k.metrik_tambahan});
      if(k.kode==='C9') {
        jafungKpiId=capaian;
        for (const [kode_input,nilai_numerik,src] of [['dosen_tetap_nidn_non_pln',198,'keputusan_pengguna'],['dosen_lektor_ke_atas',118,'t1_4']]) {
          await insert(client,'kpi_input',{...meta('kpi-input',src),indikator_id:indikator,kode_input,nilai_numerik,satuan:'dosen',tanggal_snapshot:data.snapshot});
        }
      }
    }
    for(const r of data.rka) await client.query(`INSERT INTO rka_target(kode_item,item,angka,satuan,tahun,jenjang,sumber_id) VALUES ($1,$2,$3,$4,2026,$5,$6)`,[r.kode_item,r.item,r.angka,r.satuan,r.jenjang,sources.get('t1_2')]);
    const flag=(kode,tabel,unit,source,pesan,detail,severity='warning',row_id=null)=>({kode,tabel,unit_id:units.get(unit),sumber_id:sources.get(source),pesan,detail,severity,rule_code:kode,row_id});
    flags.push(
      flag('tendik-total-tertukar','tendik_prodi','BSDM','t1_5','TOTAL Tabel 1.5 tertukar; baris dihitung: laki 21, perempuan 9, total 30',{laki:21,perempuan:9,total:30,total_sumber:[30,21,9]}),
      flag('jafung-total-institut','dosen_prodi','BSDM','t1_4','Jafung 223 vs dosen 222; Asisten Ahli baris 44 vs narasi 43; perlu verifikasi BSDM',{jafung:223,dosen:222,asisten_ahli_baris:44,asisten_ahli_narasi:43}),
      flag('pmb-definisi-berbeda','mahasiswa_baru','PPA','t4_6','Daftar ulang per prodi dan realisasi KPI PMB berbeda definisi/periode; perlu klarifikasi PPA/PRP',{target_per_prodi:2030,realisasi_per_prodi:1678,target_kpi:2000,persen_kpi:61.95}),
      flag('tracer-sementara','tracer_ringkasan','BPKA','t1_6','Data sementara: 328 responden dari 1.100 lulusan (29,82%)',{responden:328,lulusan:1100,cakupan:29.82},'info'),
      flag('tracer-wirausaha-rincian','tracer_study','BPKA','t1_6','laporan menulis total 8, rincian per prodi belum tersedia',{jumlah_baris_tersedia:2,total_sumber:8,alokasi_selisih:null}),
      flag('kpi-jafung-dua-sumber','kpi_capaian','BSDM','ringkasan_eksekutif','KPI jafung resmi 59,60%; pembanding Tabel 4.20 58,08%; perlu verifikasi BSDM',{
        nilai_resmi:59.6,denominator:198,numerator:118,
        sumber:[{nama:'Ringkasan Eksekutif',nilai:59.6,halaman_pdf:3,halaman_cetak:'iii'},
          {nama:'Tabel 4.20',nilai:58.08,halaman_pdf:147,halaman_cetak:'139'}]},'warning',jafungKpiId),
      flag('kpi-arah-d','kpi_indikator','PRP','t1_1','Arah penilaian/rumus perspektif D dan skor berbobot menunggu konfirmasi PRP',{perspektif:'D',skor_berbobot:null})
    );
    for(const f of flags) {
      const flagId=await insert(client,'data_quality_flag',f);
      if(f.kode==='kpi-jafung-dua-sumber') for(const [source,value] of [['ringkasan_eksekutif',59.6],['t4_20_c',58.08]]) {
        await client.query('INSERT INTO data_quality_flag_sumber(flag_id,sumber_id,nilai_numerik,satuan) VALUES ($1,$2,$3,$4)',[flagId,sources.get(source),value,'%']);
      }
    }
    await client.query('INSERT INTO seed_runs(kode,checksum,user_id) VALUES ($1,$2,$3)',['laporan-2026-s1-v1',checksum,seedUser.id]);
    console.log('Seed approved: 19 prodi, 28 KPI, 19 target RKA, 11 user demo dan akun sistem seed.');
  });
}

export async function seed(pool){await seedBase(pool);await seedDashboard(pool);await seedForms(pool);await seedInternalVisibility(pool);await seedProductivity(pool);await seedEmployment(pool);await seedFormPolicy(pool);await seedAccreditation(pool);await seedResearch(pool);await seedAchievements(pool);
  await seedSourceComparisons(pool);
  await seedCooperation(pool);await seedAMI(pool);await seedFinance(pool);await seedFinanceComparison(pool);}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const pool=createPool();
  try { await seed(pool); }
  catch(error){ reportError(error); }
  finally { await pool.end(); }
}
