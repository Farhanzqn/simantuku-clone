import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createPool, reportError } from '../../server/services/db.js';

export async function check(pool) {
  const sql=await readFile(new URL('../seed/control.sql',import.meta.url),'utf8');
  const rows=(await pool.query(sql)).rows;
  for(const row of rows) assert.equal(row.nilai,row.expected,`Kontrol ${row.metrik}`);
  console.table(rows.map(({metrik,nilai})=>({metrik,nilai})));
  const seed=JSON.parse(await readFile(new URL('../seed/laporan-2026-s1.json',import.meta.url),'utf8'));
  const tracer=(await pool.query("SELECT prodi_kode,kerja_kurang_3_bulan,kerja_lebih_3_bulan,sesuai_bidang,wirausaha,studi_lanjut,jumlah_lulusan,responden FROM v_dashboard_tracer WHERE tahun_lulus=2025 ORDER BY prodi_kode")).rows;
  assert.equal(tracer.length,19);
  let nulls=0;
  for(let i=0;i<19;i++) {
    assert.equal(tracer[i].prodi_kode,seed.prodi[i].kode);
    const fields=['kerja_kurang_3_bulan','kerja_lebih_3_bulan','sesuai_bidang','wirausaha','studi_lanjut'];
    for(let j=0;j<5;j++) {
      assert.equal(tracer[i][fields[j]],seed.prodi[i].tracer[j],`Tracer ${seed.prodi[i].kode}/${fields[j]}`);
      if(seed.prodi[i].tracer[j]===null) nulls++;
    }
    assert.equal(tracer[i].jumlah_lulusan,null); assert.equal(tracer[i].responden,null);
  }
  assert.equal(tracer[4].kerja_lebih_3_bulan,0,'Nol eksplisit PSPPI tetap 0');
  console.log(`Tracer: ${nulls} sel '-' terbukti NULL; 38 denominasi prodi NULL; nol eksplisit PSPPI tetap 0.`);
  const sources=(await pool.query(`SELECT s.kode AS sumber,s.dokumen,s.nomor_tabel,s.halaman_pdf,s.halaman_cetak,fs.nilai_numerik
    FROM data_quality_flag f JOIN data_quality_flag_sumber fs ON fs.flag_id=f.id JOIN sumber_data s ON s.id=fs.sumber_id
    WHERE f.kode='kpi-jafung-dua-sumber' ORDER BY s.halaman_pdf`)).rows;
  assert.equal(sources.length,2); assert.equal(Number(sources[0].nilai_numerik),59.6); assert.equal(sources[0].halaman_pdf,3);
  assert.equal(Number(sources[1].nilai_numerik),58.08); assert.equal(sources[1].halaman_pdf,147);
  console.table(sources);
  const official=(await pool.query("SELECT nilai_numerik FROM v_kpi_capaian WHERE indikator_kode='C9'")).rows[0];
  assert.equal(Number(official.nilai_numerik),59.6);
  const denominator=(await pool.query("SELECT nilai_numerik FROM v_kpi_input WHERE kode_input='dosen_tetap_nidn_non_pln'")).rows[0];
  assert.equal(Number(denominator.nilai_numerik),198);
  const pending=(await pool.query("SELECT count(*)::int AS n FROM v_kpi_capaian WHERE perspektif='D' AND persen_capaian IS NOT NULL")).rows[0].n;
  assert.equal(pending,0,'Perspektif D tidak dinilai sebelum rumus/arah disahkan');
  console.log('Semua query kontrol lulus.');
  return {rows,nulls,sources};
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const pool=createPool();
  try { await check(pool); }
  catch(error){reportError(error);}
  finally{await pool.end();}
}
