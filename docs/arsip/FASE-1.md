# Fase 1 — database, migrasi, seed dan query kontrol

Catatan ini adalah bukti historis Fase 1. Status terbaru sudah Fase 2; jalur utama sekarang PostgreSQL native Windows port 5432, mengikuti [SETUP-WINDOWS.md](SETUP-WINDOWS.md) dan [FASE-2.md](FASE-2.md). Langkah portable/Docker di bawah mencatat lingkungan saat Fase 1, bukan setup utama terkini.

Implementasi Fase 1 selesai; berhenti dan menunggu **"Lanjut Fase 2"**. Express/API/login dan refactor frontend belum dikerjakan. Docker Compose dibuat tetapi belum diuji lewat Docker karena Docker tidak tersedia di mesin sesi ini. SQL, migration runner, seed dan views diuji pada PostgreSQL nyata versi 16.15.

## Artefak

- `docker-compose.yml`: PostgreSQL 16, loopback host port 5433, named volume, healthcheck.
- `.env.example`, `.gitignore`, `package.json`, `package-lock.json`: konfigurasi tanpa secret, dependency terkunci (`pg`, `dotenv`, `bcrypt`), skrip database. `.env` lokal dengan rahasia acak diabaikan Git dan tidak dicetak.
- `server/services/db.js`: koneksi parameter konfigurasi, transaksi, timezone Asia/Jakarta. Belum ada server HTTP.
- `db/migrations/001_master.sql`: master unit/pemetaan domain/prodi/user, dua dimensi periode, visibilitas, sumber, KPI/RKA, session, audit dan flags.
- `002_domain_data.sql`: sembilan tabel input dengan workflow dan versi; FK, CHECK nonnegatif, perempuan<=total, S3<=total, indeks periode/prodi dan partial unique keys.
- `003_workflow_audit.sql`: ledger seed, trigger audit teredaksi/append-only, proteksi approved/submitted, four-eyes dan metadata override admin. RBAC HTTP/query tetap pekerjaan Fase 2; akun database migration saat ini pemilik schema, bukan akun produksi dengan privilege terbatas.
- `004_dashboard_views.sql`: approved-only views domain dan agregat, KPI rasio backend SQL tanpa skor berbobot. Lulusan institut/prodi berbeda group, tidak dijumlahkan bersama.
- `005_integrity.sql`: catatan resolution wajib dan referensi ringkasan tracer ke lulusan institut dengan tahun/periode/denominasi sesuai.
- `db/seed/master.sql`, `laporan-2026-s1.json`: master SQL dan fixture sumber JSON lengkap, termasuk semua NULL tracer.
- `db/scripts/{migrate,seed,check,reset}.js`, `db/seed/control.sql`, `db/tests/database.test.js`: migration/seed idempotent, kontrol dan tes integritas, reset interaktif.

Tidak membuat tabel backlog penelitian/HKI/PkM/keuangan/kerja sama/akreditasi/AMI/prestasi; hanya master domain pemilik. Tidak menghapus file lama. API/role middleware/import CSV mengikuti Fase 2. Metadata/template import_batch sudah disiapkan tanpa endpoint.

## Seed dan provenance

19 prodi dengan kode internal 01–19; 20252 Genap 2025/2026 dan 20261 Gasal 2026/2027; laporan 2026-S1/S2. Periode aktif seed 20252 dan laporan 2026-S1 untuk konteks sumber, bukan pernyataan semester berjalan hari ini. PMB akademik 20261/tahun masuk 2026/snapshot 2026-06-30, laporan 2026-S1.

Semua input seed approved, is_current_approved=true, approved_by akun sistem seed dan sumber `Laporan Manajemen ITPLN Semester I 2026`. Akun seed aktif=false, role system, password_hash NULL; tidak login. Approved_at adalah waktu seed sebenarnya; snapshot sumber terpisah. Seed_runs checksum memastikan pengulangan tidak menimpa koreksi, status, konfigurasi maupun password. Akun demo berpassword bcrypt dari env, wajib ganti; email domain `.invalid` hanya demo.

Lulusan 2025 jumlah 1.100 disimpan sekali sebagai cakupan institusi/prodi_id NULL; tracer_ringkasan mereferensikannya, responden 328, cakupan 29,82%, sementara. Tidak membuat rincian wisuda/prodi atau nama/SKS dosen dummy. Wirausaha baris Informatika 2, prodi lainnya NULL; total sumber 8 disimpan sebagai observasi ringkasan, bukan agregat UI.

KPI resmi dosen berjafung 59,60%; denominator 198 dan numerator 118 tersimpan sebagai dua input KPI approved tersendiri. `data_quality_flag_sumber` menghubungkan flag `kpi-jafung-dua-sumber` ke dua record sumber nyata:

| Sumber | Nilai | Halaman PDF fisik | Halaman cetak |
|---|---:|---:|---|
| Ringkasan Eksekutif | 59,60% | 3 | iii |
| Tabel 4.20, indikator C.4 | 58,08% | 147 | 139 |

Detail flag juga menyimpan kedua nama/nilai/halaman. Pembanding tetap "perlu verifikasi BSDM"; tidak menimpa nilai resmi. Flags lain mencakup jafung per prodi/agregat, TOTAL tendik tertukar, definisi PMB berbeda, tracer sementara dan wirausaha belum lengkap, arah perspektif D. Arah D disimpan sebagai asumsi lower_is_better dengan arah_terkonfirmasi=false sehingga view tidak menghitung rasio/warna yang belum disahkan. Skor berbobot selalu NULL/TODO.

## Perintah verifikasi dan hasil

Node portable 22.23.3 dipakai karena Node global tidak terdeteksi; dependency diinstal menggunakan `npm install --ignore-scripts --no-audit --no-fund` dan bcrypt binary bawaan diperiksa. [Binary PostgreSQL resmi EDB](https://www.enterprisedb.com/download-postgresql-binaries) digunakan sebagai fallback; bukan mengganti stack deployment Docker.

Perintah dijalankan dari root proyek dengan PATH sementara ke Node portable:

```powershell
npm run db:migrate
npm run db:seed
npm run db:check
npm run db:seed
npm run db:verify
```

Hasil akhir: lima migration berhasil; seed pertama berhasil, seed ulang melewati data yang sudah terpasang; delapan tes lulus (satu parent test + tujuh subtest), nol gagal. Setelah migration integritas tambahan, migrate/seed/verify dijalankan lagi dan tetap lulus.

Pemeriksaan akhir `db:check` pada database pengembangan juga lulus. Query inventaris menghasilkan 5 migration, 19 prodi, 15 quality flags dan 12 user (11 demo + seed); `SHOW timezone` pada koneksi aplikasi menghasilkan Asia/Jakarta. Pemeriksaan SHA-256 terhadap ZIP asal: 39 file diperiksa, 0 berubah. Server portable berhasil dihentikan, cluster dipertahankan.

| Query kontrol approved | Hasil |
|---|---:|
| Mahasiswa aktif 20252 | 5.080 |
| Perempuan mahasiswa aktif 20252 | 1.494 |
| Dosen 20252 | 222 |
| Tendik total 20252 | 30 |
| Tendik laki-laki / perempuan | 21 / 9 |
| Target PMB per prodi | 2.030 |
| Realisasi daftar ulang per prodi | 1.678 |
| Wirausaha tracer dari baris tersedia | 2 |
| Lulusan 2025 level institusi | 1.100 |

`db:check` membandingkan setiap sel tracer 19×5 terhadap fixture. **66 sel '-' tersimpan NULL**, 38 denominasi jumlah_lulusan/responden per prodi juga NULL. Nol eksplisit kerja>3bulan PSPPI tetap 0. Kedua sumber flag beserta halaman, capaian resmi 59,60%, denominator 198 dan tidak adanya penilaian D diperiksa melalui query database.

Tes juga membuktikan seed/migration ulang tidak menambah audit atau mengubah hash password; migration gagal rollback DDL/ledger; checksum berubah ditolak; FK dan CHECK menolak data tidak valid; draft revisi tidak mengubah approved view; approved tidak dapat diedit langsung; audit UPDATE/DELETE ditolak dan tidak menyimpan password_hash; akun seed dinonaktifkan. `db:reset` tidak dijalankan karena bersifat destruktif; guard development/local/_dev/konfirmasi manual tersedia pada skrip.

## Reproduksi portable pada mesin sesi ini

Cara utama tetap Docker di README. Fallback ini hanya memakai file TEMP yang diunduh saat pengerjaan; tidak tersedia otomatis pada mesin baru. Cluster pengembangan/test telah di-seed dan dipertahankan di TEMP, server dihentikan setelah pengujian untuk membebaskan port 5433. Untuk menyalakan kembali jika file TEMP masih ada:

```powershell
$phaseTools = Join-Path $env:TEMP 'itpln-phase1-tools'
$env:PATH = (Join-Path $phaseTools 'node-v22.23.3-win-x64') + ';' + $env:PATH
& (Join-Path $phaseTools 'pg16-minimal\bin\pg_ctl.exe') -D (Join-Path $phaseTools 'cluster') -l (Join-Path $phaseTools 'postgres.log') -o '-p 5433 -h 127.0.0.1' -w start
npm run db:check
npm run db:verify
& (Join-Path $phaseTools 'pg16-minimal\bin\pg_ctl.exe') -D (Join-Path $phaseTools 'cluster') -m fast -w stop
```

Jangan menjalankan Docker dan portable bersamaan pada port 5433. Cluster portable dan volume Docker adalah database terpisah; Docker baru perlu migrate/seed dari awal. Credential `.env` lokal sama dengan yang dipakai inisialisasi cluster portable. Tidak menginstal service Windows atau mengubah PATH global. Eksekusi initdb/pg_ctl memerlukan sesi pengguna biasa di luar restricted-token sandbox.

## Batas fase

Belum ada bukti `docker compose up/config` berhasil karena Docker tidak tersedia. Belum ada login/API maupun dashboard ITPLN di browser; view/database sudah siap untuk dihubungkan Fase 2–3. Keputusan visibilitas ada di master dan PUBLIC_DASHBOARD, tetapi penerapan akses HTTP harus dibangun Fase 2. Lanjut hanya setelah pengguna mengatakan **"Lanjut Fase 2"**.
