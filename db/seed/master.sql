-- Master awal: insert-only. Seed ulang tidak menimpa konfigurasi pengguna.
INSERT INTO unit(kode,nama,nama_terkonfirmasi) VALUES
 ('BAA','BAA',false),('BSDM','BSDM',false),('BKU','BKU',false),('BKM','BKM',false),
 ('BPKA','Bagian Pengembangan Karir dan Alumni',true),('LPPM','Lembaga Penelitian dan Pengabdian kepada Masyarakat',true),
 ('PJM','Pusat Jaminan Mutu',true),('PPA','Pusat Pemasaran dan Admisi',true),
 ('PRP','Pusat Perencanaan dan Pengembangan',true),('BSAR','BSAR',false),('BPAD','BPAD',false)
ON CONFLICT(kode) DO NOTHING;
INSERT INTO unit(kode,nama,nama_terkonfirmasi)
SELECT NULL,'Bagian Pengembangan Kemitraan',true
WHERE NOT EXISTS(SELECT 1 FROM unit WHERE nama='Bagian Pengembangan Kemitraan');

INSERT INTO domain_unit(domain,unit_id)
SELECT v.domain,u.id FROM (VALUES
 ('mahasiswa-aktif','BAA'),('lulusan','BAA'),('mahasiswa-baru','PPA'),
 ('dosen','BSDM'),('tendik','BSDM'),('tracer','BPKA'),('tracer-ringkasan','BPKA'),
 ('kpi-capaian','PRP'),('kpi-input','PRP'),('rka-target','PRP'),('keuangan','BKU'),
 ('penelitian','LPPM'),('hki','LPPM'),('pkm','LPPM'),('akreditasi','PJM'),('ami','PJM'),('prestasi','BKM')
) v(domain,kode) JOIN unit u ON u.kode=v.kode ON CONFLICT(domain) DO NOTHING;
INSERT INTO domain_unit(domain,unit_id)
SELECT 'kerjasama',id FROM unit WHERE kode IS NULL AND nama='Bagian Pengembangan Kemitraan'
ON CONFLICT(domain) DO NOTHING;

INSERT INTO periode_akademik(kode,tahun_ajaran,semester,urutan,aktif) VALUES
 ('20252','2025/2026','Genap',20252,true),('20261','2026/2027','Gasal',20261,false)
ON CONFLICT(kode) DO NOTHING;
INSERT INTO periode_laporan(kode,tahun,semester,mulai,selesai,urutan,aktif) VALUES
 ('2026-S1',2026,'S1','2026-01-01','2026-06-30',20261,true),
 ('2026-S2',2026,'S2','2026-07-01','2026-12-31',20262,false)
ON CONFLICT(kode) DO NOTHING;

INSERT INTO visibilitas_modul(kode_modul,akses) VALUES
 ('mahasiswa','public'),('mahasiswa-baru','public'),('dosen','public'),('tendik','public'),
 ('lulusan','public'),('prodi','public'),('tracer','authenticated'),('kpi','authenticated'),
 ('iku','authenticated'),('keuangan','authenticated'),('data_quality_flag','authenticated')
ON CONFLICT(kode_modul) DO NOTHING;
