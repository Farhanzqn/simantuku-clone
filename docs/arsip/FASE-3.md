# Fase 3 — UI dari API dan grafik ITPLN

Fase 3 selesai. Semua halaman memakai api.js, navbar/footer bersama, Chart.js lokal dan branding ITPLN/YPK PLN. Berhenti di sini dan tunggu **"Lanjut Fase 4"**. Form input lengkap, import preview dan diff verifikasi belum dikerjakan pada fase ini; ruang unit hanya membaca data sesuai role.

## Checkpoint dan file

Repository Git lokal dibuat pada awal fase dengan commit **9a2dd4b — Fase 2 selesai**. Author hanya konfigurasi lokal ITPLN Local; tidak ada remote/push. Git portable berada di `.runtime/tools/mingit/cmd/git.exe`. Perubahan Fase 3 berada di working tree untuk ditinjau.

`.gitignore` mengecualikan .env, node_modules, .runtime, backup, PDF/ekstraksi laporan, ZIP, private key dan credential. `.gitattributes` menjaga byte migration/seed agar checkout Windows tidak mengubah checksum. Tidak ada reset database atau penimpaan data pengguna.

Empat aset lama dipindahkan, bukan dihapus: `logoUP.png`, `Logo_LPM.png`, `V2_Logo_SIMANTUKU.png`, `lambang_unggul.png` kini berada di `archive/legacy/images`. Arsip tidak disajikan Express. Library vendor, font dan pemberitahuan lisensinya dipertahankan. Pemeriksaan seluruh static-web untuk Pancasila, NeoSIAK, NeoSisdam, univpancasila dan angka lama 364/6986/1886/3068 tidak menemukan sisa.

## Sumber tambahan dan database

Migration **008_dashboard_sources.sql** menambah dua domain dengan workflow, approved views, trigger audit, kepemilikan unit dan privilege minimum app_user. Migration 001–007 dan seed/master awal tidak diubah.

| Data | Sumber | Hasil | Pemilik |
|---|---|---|---|
| mahasiswa_angkatan | Tabel 2.5, PDF 39–41/cetak 31–33 | 78 baris, angkatan 2018–2025; 5.080 mahasiswa; subtotal setiap prodi cocok dengan data aktif | BAA |
| pegawai_ringkasan | Tabel 2.7, PDF 43/cetak 35 | Dosen tetap 222, tidak tetap 55, tenaga kependidikan 109, PKWT 68 | BSDM |

`db/seed/dashboard-2026-s1.json` memakai ledger/checksum tersendiri `dashboard-2026-s1-v1`. Seed tambahan idempotent, transaksional dan langsung approved oleh akun sistem seed, dengan provenance laporan. Seed lama tetap utuh. Revisi mengikuti workflow biasa. Tendik 30 pada rincian prodi dan 109 pada ringkasan institusi mempunyai cakupan sumber berbeda; tidak dijumlahkan atau saling menggantikan.

Dosen tetap/tidak tetap memakai modul pegawai-publik. Tendik/PKWT memakai pegawai-internal dengan batas minimum login yang tetap berlaku jika konfigurasi modul diubah menjadi public. Endpoint publik juga tetap menolak kategori internal meskipun pemanggil sudah login.

## Tambahan endpoint

Seluruh akses tetap menghormati visibilitas_modul dan PUBLIC_DASHBOARD. PUBLIC_DASHBOARD=false mewajibkan login semua dashboard. KPI, tracer, quality flags dan pegawai internal tetap membutuhkan login. Dashboard hanya mengembalikan approved terkini.

| Endpoint GET | Akses default | Isi |
|---|---|---|
| /api/dashboard/mahasiswa-angkatan | Publik | Angkatan/prodi, filter periode akademik/laporan, jenjang dan prodi |
| /api/dashboard/pegawai | Publik | Hanya dosen tetap/tidak tetap |
| /api/dashboard/pegawai-internal | Viewer dan seluruh role login | Hanya tendik/PKWT |
| /api/dashboard/prodi | Publik | Nama, jenjang, mahasiswa dan dosen approved |
| /api/dashboard/kpi | Viewer dan seluruh role login | Target, realisasi, arah dan persen capaian, tanpa bobot/skor |
| /api/quality-flags | Viewer dan seluruh role login | Catatan, referensi tabel, halaman PDF/cetak dan kedua sumber jafung |

Kontrak endpoint lain dan workflow tetap mengikuti [FASE-2.md](FASE-2.md). Domain mahasiswa-angkatan hanya BAA/admin, pegawai-ringkasan hanya BSDM/admin melalui middleware dan filter unit query; unit dari sesi, bukan body. Admin/PRP memverifikasi dengan aturan four-eyes yang sama.

Response dashboard menambahkan meta.sumber (dokumen, tabel, halaman PDF/cetak) dan catatan_kualitas untuk tooltip. **Hanya dua cuplikan publik** melalui kolom catatan_publik: selisih total jafung 223 vs 222, dan definisi PMB berbeda dengan KPI 61,95%. Cuplikan hanya diambil untuk sumber_id baris approved yang sedang ditampilkan, bukan seluruh flag. Rincian flag, metadata internal dan endpoint quality tetap login; tautan publik mengantar pengguna ke login terlebih dahulu.

## Perilaku halaman

- Beranda: empat kartu API, mahasiswa per angkatan, donut jenjang/status yang tersedia, dosen tetap/tidak tetap, jafung, S3/non-S3. Label periode dan sumber tampil pada panel; donut berisi total dan tooltip komposisi. Tren periode sebelumnya dan dua panel fakultas kosong karena data/pemetaan belum tersedia.
- Statistik mahasiswa: filter akademik, laporan, status, jenjang, prodi; Bar/Donut/Area; tabel rincian dan perempuan. Status belum tersedia menghasilkan kosong, bukan angka nol.
- PMB: target vs realisasi daftar ulang per prodi; catatan definisi 61,95% mengarah ke flag privat. Default tahun masuk 2026/akademik 20261, snapshot per Juni 2026.
- Lulusan: total 1.100 level institusi tahun 2025; rincian prodi kosong. Tracer wajib login dan berlabel sementara **328 responden dari 1.100**; wirausaha dari baris terisi = 2, catatan total laporan 8 belum tersedia rinciannya. NULL ditampilkan **belum ada data**.
- Dosen: per prodi, jafung, S3/non-S3 dan gender; flag 223 vs 222 pada panel terkait. KPI jafung resmi tetap 59,60%, denominator 198 terpisah; 58,08% disimpan sebagai pembanding, bukan mengganti angka resmi.
- Kinerja prodi/daftar prodi: 19 prodi, jenjang dan total mahasiswa/dosen. Fakultas dan akreditasi tidak dibuat.
- Kinerja PT, beban mengajar, rekognisi dosen: state kosong **Belum ada data, menunggu input unit terkait**. Tidak ada contoh/dummy.
- KPI: 28 indikator 2026 dikelompokkan perspektif A–D, hanya target, aktual dan persen capaian tanpa skor berbobot. Arah/nilai belum dapat dibandingkan diberi catatan, bukan dipaksakan menjadi rasio.
- IKU Fakultas: tidak ada item navbar; route HTTP redirect 302 ke IKU Universitas. Mapping/fakultas menunggu pengguna.
- Login/ganti password: API session/CSRF yang sudah ada; login pertama wajib mengganti password; tujuan setelah login dibatasi halaman lokal. Navbar menampilkan item internal sesuai role, logout dan ganti password. Ruang unit baca saja; viewer tidak mempunyai menu input/verifikasi.

Setiap grafik/tabel memiliki loading, kosong, error dan konteks periode/sumber; format id-ID, tanggal Asia/Jakarta, rincian grafik dalam tabel, form berlabel dan navigasi keyboard. Detail privat tidak disisipkan ke HTML publik. Tidak ada hotlink aset universitas lain.

## Menjalankan dan alamat pemeriksaan

Jalur utama tetap **Node 22 LTS + PostgreSQL 16 native Windows**, host 127.0.0.1, port 5432, owner itpln, database satu_data_itpln_dev dan satu_data_itpln_test. HTTP memakai app_user. Setup dari nol di [SETUP-WINDOWS.md](SETUP-WINDOWS.md), Docker hanya alternatif.

Untuk upgrade database Fase 2 yang sudah ada:

```powershell
npm.cmd run db:migrate
npm.cmd run db:app-role
npm.cmd run db:seed
npm.cmd run db:check
npm.cmd run dev
```

Buka URL Express berikut di Edge, bukan file HTML/Live Server. Jika PORT berbeda, sesuaikan port.

| Halaman | Alamat | Akses default |
|---|---|---|
| Beranda | http://127.0.0.1:3000/ | Publik |
| Statistik mahasiswa | http://127.0.0.1:3000/statistik-mahasiswa.html | Publik |
| Mahasiswa baru | http://127.0.0.1:3000/mahasiswa-baru.html | Publik |
| Lulusan | http://127.0.0.1:3000/lulusan.html | Institusi publik, tracer login |
| Statistik dosen | http://127.0.0.1:3000/statistik-dosen.html | Publik |
| Kinerja prodi | http://127.0.0.1:3000/kinerja-prodi.html | Publik |
| Daftar prodi | http://127.0.0.1:3000/daftar-prodi.html | Publik |
| Kinerja PT | http://127.0.0.1:3000/kinerja-pt.html | Kosong |
| Beban mengajar | http://127.0.0.1:3000/beban-mengajar.html | Kosong |
| Rekognisi dosen | http://127.0.0.1:3000/rekognisi-dosen.html | Kosong |
| KPI universitas | http://127.0.0.1:3000/capaian-iku-universitas.html | Login |
| Catatan kualitas | http://127.0.0.1:3000/kualitas-data.html | Login |
| Masuk | http://127.0.0.1:3000/login.html | Publik |
| Ganti password | http://127.0.0.1:3000/ganti-password.html | Login |
| Ruang unit | http://127.0.0.1:3000/ruang-unit.html | Unit/admin/PRP, baca saja |

Akun demo memakai `<role>@demo.itpln.invalid`, password DEMO_PASSWORD_* yang dipasang pada seed pertama. Seed ulang tidak mengganti password akun existing. Akun seed tidak dapat login. Login viewer cukup untuk KPI/tracer/quality; BSDM/admin mempunyai panel pegawai internal di ruang unit.

## Verifikasi yang dijalankan

PostgreSQL native **16.15**, Node **24.19.0** yang tersedia di mesin pengerjaan; panduan instalasi memakai Node 22 LTS. Docker tidak diuji.

| Perintah | Hasil |
|---|---|
| npm.cmd test | 14 tes lulus: RBAC, CSRF, four-eyes/override audit, approved-only, workflow/CSV, akses sumber baru dan redirect HTML |
| npm.cmd run db:verify | 8 tes lulus: idempotensi, checksum/rollback, approved views, audit dan integritas |
| npm.cmd run db:check | 18 kontrol lulus pada dev |
| npm.cmd run test:ui | 9 tes lulus di Edge headless desktop 1280px/mobile 360px, termasuk tambahan navbar |

Kontrol utama: mahasiswa aktif 5.080/perempuan 1.494; dosen 222; tendik rincian 30 (21 laki-laki/9 perempuan); PMB target 2.030/realisasi 1.678; wirausaha 2; lulusan institusi 1.100; angkatan 5.080/78 baris dan tidak ada selisih subtotal prodi; pegawai 222/55/109/68; total jafung 223 sesuai flag.

Tes Edge memeriksa enam grafik beranda, filter periode/status/jenjang/prodi, Bar/Donut/Area, kosong/error/retry, PMB, prodi, akses anonim vs login, KPI tanpa bobot, dual source flag, tracer sementara dan 104 sel NULL, navbar role, ganti password, tujuan login aman, keyboard, tanpa overflow 360px, tanpa exception JavaScript atau pelanggaran CSP. Screenshot lokal di `.runtime/phase3/{home-desktop,home-mobile,dosen-desktop,lulusan-desktop}.png`, tidak disajikan aplikasi dan diabaikan Git. Tes memakai database `_test` dan fixture sendiri; audit dipertahankan, akun fixture dinonaktifkan, service PostgreSQL pengguna tetap berjalan.

## Tambahan navbar Fase 3

Navbar.js menjadi satu sumber pada seluruh halaman yang disajikan: Dashboard Data dengan kelompok Mahasiswa/Dosen, Kinerja dengan PT/Prodi, dan Capaian IKU dengan Universitas serta Catatan Kualitas. Fakultas tetap disembunyikan. Wordmark ITPLN dan nama Satu Data ITPLN mengarah ke beranda.

Pengunjung melihat Masuk → di kanan. IKU/quality mempunyai penanda kunci dan tautan login dengan tujuan halaman tersimpan. Setelah login, tombol berubah menjadi nama pengguna dengan menu Input Data sesuai role (viewer tidak mempunyai menu input), Ganti Password dan Keluar. Input Data menuju ruang unit baca saja yang sudah tersedia; form lengkap tetap Fase 4. Ganti password wajib pada login pertama tetap berlaku.

Dropdown dapat dibuka dengan Enter/Space, pindah tautan dengan panah atas/bawah dan Home/End, serta ditutup dengan Escape sambil mengembalikan fokus. Tab bekerja secara alami; klik/fokus di luar menutup menu. Pada 360px, hamburger membuka menu vertikal dengan dropdown di dalamnya. Tambahan tes Edge menggunakan event keyboard native, memeriksa kunci/tujuan login, navbar seluruh halaman, menu akun BSDM, batas viewport dan hamburger. Screenshot tambahan: `.runtime/phase3/navbar-desktop.png`, `navbar-mobile.png`, `navbar-account-mobile.png`.
