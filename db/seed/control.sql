SELECT 'mahasiswa_aktif_20252' AS metrik,sum(total)::text AS nilai,'5080' AS expected
FROM v_dashboard_mahasiswa WHERE periode_akademik_kode='20252' AND status_mhs='aktif'
UNION ALL SELECT 'mahasiswa_perempuan_20252',sum(perempuan)::text,'1494'
FROM v_dashboard_mahasiswa WHERE periode_akademik_kode='20252' AND status_mhs='aktif'
UNION ALL SELECT 'dosen_20252',sum(total)::text,'222' FROM v_dashboard_dosen WHERE periode_akademik_kode='20252'
UNION ALL SELECT 'tendik_total_20252',sum(laki+perempuan)::text,'30' FROM v_dashboard_tendik WHERE periode_akademik_kode='20252'
UNION ALL SELECT 'tendik_laki_20252',sum(laki)::text,'21' FROM v_dashboard_tendik WHERE periode_akademik_kode='20252'
UNION ALL SELECT 'tendik_perempuan_20252',sum(perempuan)::text,'9' FROM v_dashboard_tendik WHERE periode_akademik_kode='20252'
UNION ALL SELECT 'pmb_target_per_prodi',sum(target)::text,'2030' FROM v_dashboard_mahasiswa_baru
WHERE periode_akademik_kode='20261' AND tahun_masuk=2026 AND tanggal_snapshot='2026-06-30'
UNION ALL SELECT 'pmb_realisasi_daftar_ulang',sum(realisasi_daftar_ulang)::text,'1678' FROM v_dashboard_mahasiswa_baru
WHERE periode_akademik_kode='20261' AND tahun_masuk=2026 AND tanggal_snapshot='2026-06-30'
UNION ALL SELECT 'tracer_wirausaha_baris_tersedia',sum(wirausaha)::text,'2' FROM v_dashboard_tracer WHERE tahun_lulus=2025
UNION ALL SELECT 'lulusan_2025_institusi',sum(jumlah)::text,'1100' FROM v_dashboard_lulusan
WHERE tahun_lulus=2025 AND cakupan='institusi' AND prodi_id IS NULL
UNION ALL SELECT 'angkatan_total_20252',sum(total)::text,'5080' FROM v_dashboard_mahasiswa_angkatan WHERE periode_akademik_kode='20252' AND periode_laporan_kode='2026-S1'
UNION ALL SELECT 'angkatan_baris_20252',count(*)::text,'78' FROM v_dashboard_mahasiswa_angkatan WHERE periode_akademik_kode='20252' AND periode_laporan_kode='2026-S1'
UNION ALL SELECT 'pegawai_dosen_tetap',sum(jumlah)::text,'222' FROM v_dashboard_pegawai_ringkasan WHERE kategori='dosen_tetap' AND periode_laporan_kode='2026-S1'
UNION ALL SELECT 'pegawai_dosen_tidak_tetap',sum(jumlah)::text,'55' FROM v_dashboard_pegawai_ringkasan WHERE kategori='dosen_tidak_tetap' AND periode_laporan_kode='2026-S1'
UNION ALL SELECT 'pegawai_tendik_institusi',sum(jumlah)::text,'109' FROM v_dashboard_pegawai_ringkasan WHERE kategori='tendik' AND periode_laporan_kode='2026-S1'
UNION ALL SELECT 'pegawai_pkwt',sum(jumlah)::text,'68' FROM v_dashboard_pegawai_ringkasan WHERE kategori='pkwt' AND periode_laporan_kode='2026-S1'
UNION ALL SELECT 'jafung_total_baris',sum(tenaga_pengajar+asisten_ahli+lektor+lektor_kepala+guru_besar)::text,'223' FROM v_dashboard_dosen WHERE periode_akademik_kode='20252'
UNION ALL SELECT 'angkatan_prodi_tidak_cocok',count(*)::text,'0' FROM (SELECT a.prodi_id,sum(a.total) AS total FROM v_dashboard_mahasiswa_angkatan a WHERE a.periode_akademik_kode='20252' AND a.periode_laporan_kode='2026-S1' GROUP BY a.prodi_id) a
JOIN (SELECT prodi_id,sum(total) AS total FROM v_dashboard_mahasiswa WHERE periode_akademik_kode='20252' AND periode_laporan_kode='2026-S1' AND status_mhs='aktif' GROUP BY prodi_id) m ON m.prodi_id=a.prodi_id WHERE a.total<>m.total;
