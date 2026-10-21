-- Views hanya versi approved terkini. Visibilitas HTTP diterapkan pada Fase 2.
CREATE VIEW v_dashboard_mahasiswa AS
SELECT d.*, p.kode AS prodi_kode, p.nama AS prodi_nama, p.jenjang,
  a.kode AS periode_akademik_kode, a.tahun_ajaran, a.semester AS semester_akademik,
  l.kode AS periode_laporan_kode
FROM mahasiswa_aktif d LEFT JOIN prodi p ON p.id=d.prodi_id
LEFT JOIN periode_akademik a ON a.id=d.periode_akademik_id
JOIN periode_laporan l ON l.id=d.periode_laporan_id
WHERE d.status='approved' AND d.is_current_approved;
CREATE VIEW v_dashboard_mahasiswa_baru AS
SELECT d.*, p.kode AS prodi_kode, p.nama AS prodi_nama, p.jenjang,
  a.kode AS periode_akademik_kode, a.tahun_ajaran, a.semester AS semester_akademik,
  l.kode AS periode_laporan_kode
FROM mahasiswa_baru d LEFT JOIN prodi p ON p.id=d.prodi_id
LEFT JOIN periode_akademik a ON a.id=d.periode_akademik_id
JOIN periode_laporan l ON l.id=d.periode_laporan_id
WHERE d.status='approved' AND d.is_current_approved;
CREATE VIEW v_dashboard_dosen AS
SELECT d.*, p.kode AS prodi_kode, p.nama AS prodi_nama, p.jenjang,
  a.kode AS periode_akademik_kode, a.tahun_ajaran, a.semester AS semester_akademik,
  l.kode AS periode_laporan_kode
FROM dosen_prodi d LEFT JOIN prodi p ON p.id=d.prodi_id
LEFT JOIN periode_akademik a ON a.id=d.periode_akademik_id
JOIN periode_laporan l ON l.id=d.periode_laporan_id
WHERE d.status='approved' AND d.is_current_approved;
CREATE VIEW v_dashboard_tendik AS
SELECT d.*, p.kode AS prodi_kode, p.nama AS prodi_nama, p.jenjang,
  a.kode AS periode_akademik_kode, a.tahun_ajaran, a.semester AS semester_akademik,
  l.kode AS periode_laporan_kode
FROM tendik_prodi d LEFT JOIN prodi p ON p.id=d.prodi_id
LEFT JOIN periode_akademik a ON a.id=d.periode_akademik_id
JOIN periode_laporan l ON l.id=d.periode_laporan_id
WHERE d.status='approved' AND d.is_current_approved;
CREATE VIEW v_dashboard_lulusan AS
SELECT d.*, p.kode AS prodi_kode, p.nama AS prodi_nama, p.jenjang,
  a.kode AS periode_akademik_kode, a.tahun_ajaran, a.semester AS semester_akademik,
  l.kode AS periode_laporan_kode
FROM lulusan d LEFT JOIN prodi p ON p.id=d.prodi_id
LEFT JOIN periode_akademik a ON a.id=d.periode_akademik_id
JOIN periode_laporan l ON l.id=d.periode_laporan_id
WHERE d.status='approved' AND d.is_current_approved;
CREATE VIEW v_dashboard_tracer AS
SELECT d.*, p.kode AS prodi_kode, p.nama AS prodi_nama, p.jenjang,
  a.kode AS periode_akademik_kode, a.tahun_ajaran, a.semester AS semester_akademik,
  l.kode AS periode_laporan_kode
FROM tracer_study d LEFT JOIN prodi p ON p.id=d.prodi_id
LEFT JOIN periode_akademik a ON a.id=d.periode_akademik_id
JOIN periode_laporan l ON l.id=d.periode_laporan_id
WHERE d.status='approved' AND d.is_current_approved;
CREATE VIEW v_dashboard_tracer_ringkasan AS
SELECT t.*, l.jumlah AS jumlah_lulusan, round(100.0*t.responden/nullif(l.jumlah,0),2) AS cakupan_persen,
  p.kode AS periode_laporan_kode
FROM tracer_ringkasan t JOIN lulusan l ON l.id=t.lulusan_institusi_id
JOIN periode_laporan p ON p.id=t.periode_laporan_id
WHERE t.status='approved' AND t.is_current_approved AND l.status='approved'
AND l.is_current_approved AND l.cakupan='institusi';

CREATE VIEW v_kpi_input AS SELECT * FROM kpi_input WHERE status='approved' AND is_current_approved;
CREATE VIEW v_kpi_capaian AS
SELECT c.*, i.kode AS indikator_kode,i.nama AS indikator_nama,i.perspektif,i.bobot,
  i.target_nilai,i.target_teks,i.target_tanggal,i.satuan,i.jenis,i.arah,i.arah_terkonfirmasi,
  p.kode AS periode_laporan_kode,
  CASE WHEN NOT i.arah_terkonfirmasi OR i.jenis='tanggal' THEN NULL
    WHEN c.basis_nilai='reported_percent' THEN c.nilai_numerik
    WHEN i.arah='higher_is_better' THEN round(100*c.nilai_numerik/nullif(i.target_nilai,0),2)
    WHEN i.arah='lower_is_better' THEN round(100*i.target_nilai/nullif(c.nilai_numerik,0),2)
  END AS persen_capaian,
  NULL::numeric AS skor_berbobot
FROM kpi_capaian c JOIN kpi_indikator i ON i.id=c.indikator_id
JOIN periode_laporan p ON p.id=c.periode_laporan_id
WHERE c.status='approved' AND c.is_current_approved;

CREATE VIEW v_dashboard_mahasiswa_agregat AS
SELECT periode_laporan_id,periode_akademik_id,periode_akademik_kode,periode_laporan_kode,
  status_mhs,sum(total) AS total,sum(perempuan) AS perempuan,count(*) AS prodi_terisi
FROM v_dashboard_mahasiswa GROUP BY 1,2,3,4,5;
CREATE VIEW v_dashboard_dosen_agregat AS
SELECT periode_laporan_id,periode_akademik_id,periode_akademik_kode,periode_laporan_kode,
  sum(total) AS total,sum(perempuan) AS perempuan,sum(s3) AS s3,
  sum(tenaga_pengajar) AS tenaga_pengajar,sum(asisten_ahli) AS asisten_ahli,
  sum(lektor) AS lektor,sum(lektor_kepala) AS lektor_kepala,sum(guru_besar) AS guru_besar
FROM v_dashboard_dosen GROUP BY 1,2,3,4;
CREATE VIEW v_dashboard_tendik_agregat AS
SELECT periode_laporan_id,periode_akademik_id,periode_akademik_kode,periode_laporan_kode,
  sum(laki) AS laki,sum(perempuan) AS perempuan,sum(laki+perempuan) AS total
FROM v_dashboard_tendik GROUP BY 1,2,3,4;
CREATE VIEW v_dashboard_mahasiswa_baru_agregat AS
SELECT periode_laporan_id,periode_akademik_id,periode_akademik_kode,periode_laporan_kode,tahun_masuk,tanggal_snapshot,
  sum(target) AS target,sum(realisasi_daftar_ulang) AS realisasi_daftar_ulang
FROM v_dashboard_mahasiswa_baru GROUP BY 1,2,3,4,5,6;
-- Institusi dan rincian prodi selalu berbeda group; tidak menjumlah keduanya.
CREATE VIEW v_dashboard_lulusan_agregat AS
SELECT periode_laporan_id,periode_akademik_id,tahun_lulus,cakupan,sum(jumlah) AS jumlah
FROM v_dashboard_lulusan GROUP BY 1,2,3,4;

