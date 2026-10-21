-- Halaman turunan tidak mempunyai tabel input atau submission baru.
INSERT INTO visibilitas_modul(kode_modul,akses,aktif) VALUES('rasio-dosen-mahasiswa','public',true) ON CONFLICT(kode_modul) DO NOTHING;
