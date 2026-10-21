-- Agregat membaca denominasi approved terkini, tanpa approval lintas unit.
CREATE OR REPLACE VIEW v_dashboard_tracer_ringkasan AS
SELECT t.*, l.jumlah AS jumlah_lulusan, round(100.0*t.responden/nullif(l.jumlah,0),2) AS cakupan_persen,
  p.kode AS periode_laporan_kode
FROM tracer_ringkasan t JOIN lulusan reference_lulusan ON reference_lulusan.id=t.lulusan_institusi_id
JOIN lulusan l ON l.cakupan='institusi' AND l.prodi_id IS NULL
 AND l.periode_laporan_id=reference_lulusan.periode_laporan_id
 AND l.periode_akademik_id IS NOT DISTINCT FROM reference_lulusan.periode_akademik_id
 AND l.periode_wisuda IS NOT DISTINCT FROM reference_lulusan.periode_wisuda
 AND l.tahun_lulus=reference_lulusan.tahun_lulus AND l.status='approved' AND l.is_current_approved
JOIN periode_laporan p ON p.id=t.periode_laporan_id
WHERE t.status='approved' AND t.is_current_approved AND l.status='approved'
AND l.is_current_approved AND l.cakupan='institusi';
