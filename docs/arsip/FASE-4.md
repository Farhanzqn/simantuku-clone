# Fase 4 — Input unit, verifikasi dan admin

Checkpoint awal **d608c90 — Fase 3 selesai** telah dibuat. Fase 4 menyediakan input langsung per unit, autosave, persetujuan PRP/admin dan administrasi pengguna. Berhenti pada fase ini dan tunggu **"Lanjut Fase 5"**.

## Menjalankan

PostgreSQL 16 native Windows tetap jalur utama: 127.0.0.1:5432, owner itpln, database satu_data_itpln_dev dan satu_data_itpln_test. Runtime HTTP memakai app_user. Panduan dari nol di [SETUP-WINDOWS.md](SETUP-WINDOWS.md).

Untuk instalasi atau pembaruan yang belum menerapkan Fase 4:

```powershell
npm.cmd run db:migrate
npm.cmd run db:app-role
npm.cmd run db:seed
npm.cmd run dev
```

Jika migration dan seed Fase 4 sudah diterapkan, cukup jalankan `npm.cmd run dev`, lalu buka **http://127.0.0.1:3000/**. Biarkan terminal tersebut berjalan selama mencoba aplikasi.

Migration 009 menambahkan masa_studi_rata, mengizinkan NULL pada angka isian, mengubah batas perempuan/S3 terhadap total menjadi warning, dan membuat rka_revisi. Seed visibilitas Fase 4 mempunyai ledger tersendiri; pengulangan tidak mengubah konfigurasi lagi. Migration/seed sumber lama tetap dipertahankan. Penambahan owner domain di seed dashboard juga menangani instalasi baru yang menjalankan migration sebelum seed master.

## Akun demo

Password awal dibaca sendiri dari variabel di `.env` berikut; nilainya tidak dicantumkan dalam dokumentasi. Semua akun demo wajib mengganti password saat login pertama.

| Unit / role | Email | Variabel password awal | Akses utama Fase 4 |
|---|---|---|---|
| BAA | baa@demo.itpln.invalid | DEMO_PASSWORD_BAA | /input/baa.html |
| PPA | ppa@demo.itpln.invalid | DEMO_PASSWORD_PPA | /input/ppa.html |
| BSDM | bsdm@demo.itpln.invalid | DEMO_PASSWORD_BSDM | /input/bsdm.html |
| BPKA | bpka@demo.itpln.invalid | DEMO_PASSWORD_BPKA | /input/bpka.html |
| PRP | prp@demo.itpln.invalid | DEMO_PASSWORD_PRP | /input/prp.html dan /verifikasi.html |
| Admin | admin@demo.itpln.invalid | DEMO_PASSWORD_ADMIN | Semua form, verifikasi, /admin/users.html, /admin/audit.html |
| Viewer | viewer@demo.itpln.invalid | DEMO_PASSWORD_VIEWER | Dashboard sesuai visibilitas; tanpa input |
| BKU | bku@demo.itpln.invalid | DEMO_PASSWORD_BKU | Form unit belum tersedia pada fase ini |
| BKM | bkm@demo.itpln.invalid | DEMO_PASSWORD_BKM | Form unit belum tersedia pada fase ini |
| LPPM | lppm@demo.itpln.invalid | DEMO_PASSWORD_LPPM | Form unit belum tersedia pada fase ini |
| PJM | pjm@demo.itpln.invalid | DEMO_PASSWORD_PJM | Form unit belum tersedia pada fase ini |

Setelah password diganti, gunakan password terbaru. Mengedit `.env` atau menjalankan seed ulang tidak mereset password akun yang sudah ada. Jika lupa, admin dapat menetapkan password sementara melalui halaman pengguna; login berikutnya kembali mewajibkan ganti password. BSAR/BPAD hanya master unit, tanpa akun input. Akun sistem `seed` tidak dapat login.

## Coba alur BAA → PRP

1. Buka **http://127.0.0.1:3000/login.html**. Masuk sebagai **baa@demo.itpln.invalid**, dengan password awal dari **DEMO_PASSWORD_BAA** di `.env`. Jika akun sudah pernah mengganti password, gunakan password barunya. Seed ulang tidak mereset password.
2. Pada login pertama, isi password lama dan password baru di halaman ganti password. Selanjutnya buka **http://127.0.0.1:3000/input/baa.html**.
3. Pilih tab **Mahasiswa Aktif**, laporan **2026-S1**, akademik **20252**, status **aktif**. Data approved terakhir muncul sebagai nilai awal. Ubah satu sel Total, misalnya tambah 1 pada prodi pertama. Tunggu pesan **Draft tersimpan** atau tekan **Simpan Draft**.
4. Beranda masih menampilkan data approved lama. Tekan **Submit**. Baris pengajuan terkunci; status menjadi submitted. Data yang tidak diubah tidak dibuatkan revisi baru.
5. Keluar lewat menu akun, lalu masuk sebagai **prp@demo.itpln.invalid**, password awal **DEMO_PASSWORD_PRP**. Ganti password jika diminta.
6. Buka **http://127.0.0.1:3000/verifikasi.html**, pilih **Periksa** pada pengajuan BAA. Baca prodi, periode, pengaju, perbedaan nilai lama/baru dan quality flags. Isi **Catatan review**, lalu **Approve**. Untuk meminta koreksi gunakan **Reject**, juga dengan catatan.
7. Buka **http://127.0.0.1:3000/** atau Statistik Mahasiswa dengan periode yang sama. Angka sekarang mengikuti approved baru. BAA dapat membuka **Riwayat** pada baris untuk melihat status, siapa, kapan dan catatan review.

Pengajuan PRP sendiri harus disetujui admin atau verifikator lain. BAA tidak dapat membuka halaman verifikasi atau memanggil endpoint approve. Admin yang menyetujui pengajuannya sendiri wajib mencentang override dan mengisi alasan; audit mencatat approve_override/is_override. Semua request tulis tetap memakai CSRF dan unit dari sesi.

## Halaman dan akses

Semua alamat di bawah memakai awalan **http://127.0.0.1:3000**. Navbar/footer berasal dari sumber bersama; menu akun menautkan form sesuai role. Penjagaan server berlaku pula pada URL terenkode, bukan hanya menu yang disembunyikan.

| Halaman | Role | Tab / isi |
|---|---|---|
| /input/baa.html | BAA, admin | Mahasiswa aktif (status aktif/cuti/nonaktif), matriks prodi × angkatan, lulusan/wisuda (jumlah, IPK opsional, masa studi opsional) |
| /input/ppa.html | PPA, admin | Target dan daftar ulang, tahun masuk, tanggal snapshot |
| /input/bsdm.html | BSDM, admin | Dosen (gender, S3, jafung), tendik prodi, ringkasan pegawai |
| /input/bpka.html | BPKA, admin | Tracer per prodi, termasuk lulusan/responden dan lima hasil tracer |
| /input/prp.html | PRP, admin | Nilai/catatan KPI per indikator dan Target RKA |
| /verifikasi.html | PRP, admin | Antrean, diff per sel, flags, approve/reject dengan catatan |
| /admin/users.html | Admin | Tambah/edit nama, email, role, unit, status aktif; reset password |
| /admin/audit.html | Admin | Filter pengguna, tabel, waktu WIB; nilai lama/baru dan alasan override |

Password/hash/token/cookie tidak ditampilkan di audit.

## Cara mengisi

- Form per prodi selalu memakai 19 baris sesuai urutan master. Ringkasan pegawai memakai empat kategori institusi; KPI/RKA memakai master indikator/item. Fakultas dan pemetaan tidak dibuat.
- Pilih periode sebelum mengisi. Lulusan per prodi perlu periode wisuda; input jumlah dibuka setelah periode wisuda diisi. Matriks angkatan mempunyai rentang tahun (maksimum 20 tahun). RKA/KPI pada tahun tanpa master menampilkan state kosong.
- Nilai awal memakai approved terakhir yang tersedia. **Salin dari periode sebelumnya** mengambil approved periode terdahulu, kemudian pengguna memeriksa dan menyimpan sebagai draft. Membuka halaman saja tidak menerbitkan atau mengubah nilai.
- Tab mengikuti urutan isian; Enter/panah memindahkan sel. Ctrl+V menerima baris/kolom dari spreadsheet mulai sel aktif. Contoh `1.234`, `1,234`, `1 234` menjadi 1234 untuk kolom hitungan; IPK `3,75` atau `3.75` menjadi 3,75. Baris/kolom di luar tabel diabaikan.
- Sel kosong tetap NULL; angka 0 harus diisi eksplisit. Sel non-angka diberi penanda merah. Baris yang mengandung sel invalid tidak dikirim saat autosave; baris valid lain tetap bisa disimpan. Submit diblokir sampai ringkasan error selesai diperbaiki.
- Autosave setelah sekitar 900 ms berhenti mengetik, dengan antrean request dan pemeriksaan row_version. Simpan Draft tersedia manual. Revisi approved dibuat otomatis pada perubahan; submitted terkunci. Konflik versi meminta muat ulang dan tidak menimpa perubahan pihak lain.
- Total memakai nilai terisi; persentase dihitung bila denominator tersedia dan positif. Perempuan/S3 melebihi total, selisih jumlah jafung, serta daftar ulang melebihi target atau di bawah 10% target menjadi **warning**, bukan blokir. Angka negatif, hitungan pecahan, IPK di luar 0–4, atau responden melebihi jumlah lulusan menjadi error.
- Lulusan 1.100 level institusi tetap tersimpan terpisah; form BAA tidak membaginya ke prodi. Ringkasan tendik 109 dan rincian prodi 30 tetap berbeda cakupan. Denominator KPI jafung 198 dan sumber resmi 59,60% dipertahankan.
- Target RKA sumber disimpan dalam rka_target, koreksinya dalam rka_revisi. Endpoint baca memakai koreksi approved terakhir bila ada. Tulisan langsung pada master Target RKA melalui endpoint lama ditolak agar tidak melewati persetujuan.
- Import file tidak ada di halaman unit. Endpoint historis dibatasi admin/PRP dan tetap memeriksa kepemilikan domain (admin semua domain, PRP domain PRP); antarmuka import historis tidak dikerjakan pada fase ini.

## Endpoint tambahan / penyesuaian

| Metode / endpoint | Akses dan fungsi |
|---|---|
| GET /api/forms/meta | Unit dengan form/admin; daftar domain yang diizinkan, prodi, periode, master KPI/RKA khusus PRP/admin |
| GET /api/forms/:domain | Pemilik domain/admin; draft/submitted/rejected/current approved serta approved periode sebelumnya, query dibatasi unit sesi |
| POST /api/forms/:domain/draft | Pemilik domain/admin; penyimpanan beberapa baris atomik, revision otomatis, row_version, validasi dan flags |
| POST /api/data/:domain/bulk-submit | Pemilik domain/admin; submit draft dalam transaksi |
| GET /api/data/:domain/:id | Ruang akses data existing; ditambah events status dengan pelaku/waktu/review dari audit |
| GET /api/verification/submissions | PRP/admin; antrean dengan nama unit/pengaju, prodi dan periode, pagination |
| GET /api/verification/:domain/:id/diff | PRP/admin; nilai lama/baru dan flags baris lama/baru yang terkait |
| POST /api/verification/:domain/:id/approve atau reject | PRP/admin; catatan wajib, four-eyes/override, transaksi dan konflik versi |
| GET /api/admin/audit | Admin; filter tambahan mulai/selesai ISO timestamp selain user_id/tabel/limit/offset |

Domain form: mahasiswa-aktif, mahasiswa-angkatan, lulusan, mahasiswa-baru, dosen, tendik, pegawai-ringkasan, tracer, kpi-capaian, rka-target. Endpoint pengguna/reset password memakai API Fase 2. Schema, nama tabel dan kolom dinamis berasal dari allowlist server.

## Visibilitas Fase 4

Sesuai keputusan terbaru, keuangan, kpi/iku, ami, pegawai/formasi (termasuk pegawai-internal), dan data_quality_flag wajib login; modul lain publik jika PUBLIC_DASHBOARD=true. **Tracer sekarang publik**, menggantikan default Fase 3. PUBLIC_DASHBOARD=false tetap mewajibkan login semua dashboard. Dosen tetap/tidak tetap tetap publik; tendik institusi/PKWT wajib login. Halaman input/verifikasi/admin selalu membutuhkan sesi dan role yang sesuai, terlepas dari visibilitas dashboard.

## Verifikasi

Pemeriksaan ulang setelah sesi terputus selesai pada **8 Oktober 2026**: keempat perintah di bawah lulus. Pemeriksaan Git diff dan sintaks JavaScript juga lulus; tidak ditemukan penanda konflik atau file setengah jadi. Perubahan Fase 4 masih berada di working tree, belum dibuat commit akhir. `.env`, `node_modules`, dan `.runtime` tidak terlacak Git.

Lingkungan pengujian: PostgreSQL native 16.15 dan Node 24.19.0 yang tersedia; panduan instalasi tetap Node 22 LTS. Semua fixture dibuat di database `_test`, dibersihkan setelah selesai, akun fixture dinonaktifkan; audit dipertahankan. Service PostgreSQL pengguna tetap berjalan. Tidak menjalankan reset atau mengganti password demo pengguna.

- `npm.cmd test`: **19 tes lulus** untuk API/RBAC/CSRF/workflow, NULL, warning, konflik, catatan review, RKA, audit; ditambah parser spreadsheet dan turunan grafik yang menjaga NULL.
- `npm.cmd run db:verify`: 8 tes integritas/idempotensi/rollback/audit lulus.
- `npm.cmd run test:ui`: 11 tes Edge desktop/360px lulus, termasuk seluruh tab unit dan admin. Alur BAA mengubah total prodi pertama 418 → 1.234 dan perempuan menjadi NULL; dashboard tetap 5.080 sampai PRP approve, kemudian menjadi 5.896. Perubahan tersebut hanya fixture `_test`; data dev tidak dipakai untuk contoh pengujian.
- `npm.cmd run db:check`: 18 kontrol sumber laporan dipertahankan (5.080/1.494 mahasiswa, 222 dosen, tendik 21+9, PMB 2.030/1.678, wirausaha 2, angkatan 78 baris, pegawai 222/55/109/68). Kontrol ini mengacu seed laporan; setelah koreksi nyata disetujui, nilai dashboard memang dapat berbeda dari baseline laporan.

Screenshot lokal berada di `.runtime/phase3/input-baa-desktop.png`, `input-baa-mobile.png`, `admin-users-mobile.png`; nama direktori runner dipertahankan agar bukti Fase 3 tetap tersedia. Folder ini tidak masuk Git atau disajikan aplikasi.

## Keterbatasan yang diketahui

- Fakultas dan pemetaan prodi belum tersedia. Beban mengajar, rekognisi, serta domain unit di luar lima form yang tercantum belum diimplementasikan.
- Import historis memiliki endpoint terbatas admin/PRP; antarmuka import tidak termasuk Fase 4.
- Total mahasiswa dan rincian angkatan merupakan dua formulir terpisah. Koreksi total tidak menentukan angkatan yang harus diubah; BAA perlu mengoreksi rinciannya lewat approval tersendiri.
- Hasil tes otomatis memakai database `_test`. Pengguna juga mengonfirmasi alur manual BAA → PRP → dashboard berhasil; revisi approved nyata di dev dipertahankan. Query kontrol baseline laporan dapat berbeda dari dashboard setelah koreksi tersebut.
- Password pada `.env` merupakan password awal seed, bukan salinan password terkini. Reset harus melalui admin; seed ulang tidak memulihkan password awal.
- Docker belum diuji; hasil di atas memakai PostgreSQL native Windows dan Edge. Ringkasan tambahan Statistik Mahasiswa serta konfigurasi verifikasi per formulir ditangani dalam Fase 5A.
