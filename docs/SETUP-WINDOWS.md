# Setup Windows — Node 22 LTS dan PostgreSQL 16 native

Jalur utama menggunakan PostgreSQL native di `127.0.0.1:5432`, owner lokal `itpln`, database `satu_data_itpln_dev` dan `satu_data_itpln_test`. Runtime Express memakai `app_user` terbatas. Docker Compose tetap tersedia sebagai alternatif port 5433. Jangan menjalankan reset untuk upgrade database existing.

## 1. Instalasi

Instal Node.js **22 LTS** untuk Windows dari [Node.js](https://nodejs.org/en/download) dan PostgreSQL **16** dari [PostgreSQL Windows downloads](https://www.postgresql.org/download/windows/). Pada installer PostgreSQL, sertakan server dan command line tools, gunakan port 5432, simpan password administrator `postgres`, dan izinkan service lokal berjalan. Stack Builder tidak dibutuhkan.

Buka PowerShell baru, kemudian:

```powershell
node --version
npm.cmd --version
$pgBin = 'C:\Program Files\PostgreSQL\16\bin'
& (Join-Path $pgBin 'psql.exe') --version
Get-Service '*postgresql*'
```

Gunakan `npm.cmd` jika execution policy PowerShell menolak `npm.ps1`; tidak perlu melonggarkan policy. Sesi verifikasi proyek memakai Node 24.19.0 yang sudah tersedia dan PostgreSQL native 16.15; panduan mesin baru tetap memakai Node 22 LTS. Docker tidak diperlukan.

## 2. Buat owner lokal dan dua database

Untuk instalasi baru, masuk sebagai administrator PostgreSQL; `-W` meminta password tanpa menaruhnya pada command line:

```powershell
& (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p 5432 -U postgres -d postgres -W
```

Di prompt psql, jalankan sekali:

```sql
CREATE ROLE itpln LOGIN SUPERUSER;
\password itpln
CREATE DATABASE satu_data_itpln_dev OWNER itpln;
CREATE DATABASE satu_data_itpln_test OWNER itpln;
\q
```

`\password` meminta password interaktif. `itpln` superuser mengikuti lingkungan lokal pengguna dan diperlukan untuk provisioning role oleh migrasi. Credential ini tidak dipakai server HTTP. Jika role/database sudah ada dan Fase 1 sudah lulus, lewati langkah CREATE; pertahankan data dan password existing. Koneksi loopback sebaiknya menggunakan `scram-sha-256` di pg_hba.conf, bukan `trust`.

## 3. Konfigurasi proyek

Dari root proyek:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd ci
```

Isi `.env` melalui editor. Nilai yang diperlukan:

| Variabel | Isi |
|---|---|
| NODE_ENV | development |
| DEV_SKIP_PASSWORD_CHANGE | false secara default; true hanya development, diabaikan dan diperingatkan di production |
| PGHOST / PGPORT | 127.0.0.1 / 5432 |
| PGDATABASE | satu_data_itpln_dev |
| PGTEST_DATABASE | satu_data_itpln_test, terpisah dari dev |
| PGUSER / PGPASSWORD | itpln / password owner langkah 2 |
| APP_DB_USER / APP_DB_PASSWORD | app_user / password berbeda minimal 16 karakter |
| SESSION_SECRET | nilai acak minimal 32 karakter; disarankan 48 byte acak |
| HOST / PORT | 127.0.0.1 / 3000 |
| PUBLIC_DASHBOARD | true atau false, keputusan publikasi pimpinan |
| DEMO_PASSWORD_* | masing-masing minimal 12 karakter untuk seed pertama |

Semua secret hanya di `.env`, yang diabaikan Git. Contoh `.env.example` sengaja tidak mempunyai secret. Mengubah DEMO_PASSWORD_* tidak mereset akun yang sudah di-seed. `POSTGRES_*` hanya untuk alternatif Compose. Runtime pool memakai APP_DB_* dan menolak fallback ke owner; host/port/nama DB memakai PGHOST/PGPORT/PGDATABASE bersama.

## 4. Migrasi, provisioning app_user dan seed

```powershell
npm.cmd run db:migrate
npm.cmd run db:app-role
npm.cmd run db:seed
npm.cmd run db:check
npm.cmd run db:verify
npm.cmd test
```

`db:migrate` menerapkan migration bernomor/checksum dalam transaksi. Migration 006 membuat role `app_user`; migration 007 menambahkan provenance input manual dan fungsi audit terbatas. Migration 008 menambah mahasiswa_angkatan, pegawai_ringkasan, approved views, kepemilikan unit dan visibilitas pegawai. Seed tambahan mempunyai ledger tersendiri sehingga checksum seed Fase 1 tetap utuh. `db:app-role` memasang password role dari APP_DB_PASSWORD menggunakan koneksi owner tanpa mencetak nilainya. Role PostgreSQL bersifat global pada cluster: dev/test memakai password app_user yang sama, tetapi privilege harus diterapkan pada masing-masing database. Kedua perintah tes menerapkan migrasi/seed yang belum ada pada database `_test` menggunakan owner, lalu tes HTTP memakai pool app_user. Pengulangan seed tidak menimpa data, password atau koreksi.

Urutan upgrade Fase 1 yang sudah terpasang sama, tanpa CREATE DATABASE dan tanpa reset. Jika hanya ingin menyiapkan database test secara manual:

```powershell
$savedDevDatabase = $env:PGDATABASE
try {
  $env:PGDATABASE = 'satu_data_itpln_test'
  npm.cmd run db:migrate
  npm.cmd run db:seed
} finally {
  if ($null -eq $savedDevDatabase) { Remove-Item Env:PGDATABASE -ErrorAction SilentlyContinue }
  else { $env:PGDATABASE = $savedDevDatabase }
}
```

Jangan menjalankan tes terhadap dev. `db:verify`/`npm test` menolak PGTEST_DATABASE yang sama dengan PGDATABASE atau tidak berakhiran `_test`. Tes API membuat fixture sendiri, membersihkan baris domain/periode fixture, dan menyisakan audit append-only serta akun fixture nonaktif untuk menjaga referensi audit.

## 5. Jalankan API

```powershell
npm.cmd run dev
# Alternatif tanpa watcher: npm.cmd start
```

Buka **http://127.0.0.1:3000/** atau **http://127.0.0.1:3000/index.html** di browser. `npm run dev` juga dapat digunakan jika npm.ps1 diizinkan PowerShell. Semua halaman Fase 3 memakai API pada origin yang sama: browser mengambil `/api/dashboard/summary`, Express memakai app_user, dan PostgreSQL native mengembalikan data approved. Kartu seed menampilkan Dosen **222**, Mahasiswa Aktif **5.080** (Genap 2025/2026), Mahasiswa Baru **1.678** (daftar ulang, per Juni 2026), Lulusan **1.100** (tahun 2025, level institusi). Tidak ada angka fallback/dummy pada halaman.

Default PUBLIC_DASHBOARD=true dan modul akademik public memungkinkan tampilan tanpa login. Jika akses memerlukan autentikasi, halaman menampilkan pesan login dan nilai kosong, tetap mengikuti kebijakan server. Jangan membuka index.html langsung (`file://`) atau melalui Live Server editor; gunakan URL Express di atas agar halaman/API berada pada origin yang sama. Jika PORT diubah di env, gunakan port itu pada URL. Tombol "Muat ulang data" mengambil approved terkini tanpa perlu restart browser.

Di PowerShell lain:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
Invoke-RestMethod http://127.0.0.1:3000/api/dashboard/summary
```

`Ctrl+C` menghentikan Express; service PostgreSQL tetap berjalan. Server hanya menyajikan `static-web`, bukan root proyek/laporan/`.env`. Seluruh halaman detail sudah memakai API. Buka login.html untuk masuk, lalu ganti-password.html jika diminta pada login pertama. Form unit dan verifikasi sekarang tersedia; panduan BAA ke PRP di [arsip/FASE-4.md](arsip/FASE-4.md). Daftar alamat ada di [arsip/FASE-3.md](arsip/FASE-3.md).

Untuk klien API, GET `/api/auth/csrf` dahulu, pertahankan cookie, lalu kirim header `X-CSRF-Token` pada seluruh POST/PATCH. Login menggunakan email dan password; response mengembalikan token baru setelah session diregenerasi. Akun demo `admin`, `viewer`, `baa`, `ppa`, `bsdm`, `bpka`, `bku`, `bkm`, `lppm`, `pjm`, `prp` memakai email `<role>@demo.itpln.invalid`. Seed awal mewajibkan ganti password melalui `/api/auth/change-password` dengan `old_password`/`new_password` melalui halaman ganti-password.html sebelum melanjutkan. Akun sistem seed tidak bisa login.

Produksi memakai `NODE_ENV=production`, HTTPS agar cookie secure dapat dikirim, SESSION_SECRET yang stabil, dan credential app_user saja pada lingkungan runtime. Jika reverse proxy lokal terminasi HTTPS digunakan, set `TRUST_PROXY=loopback` dan batasi akses langsung backend. Perubahan PUBLIC_DASHBOARD memerlukan restart; perubahan visibilitas_modul dibaca setiap request. PUBLIC_DASHBOARD=false mewajibkan login seluruh dashboard; true tetap menghormati modul privat. KPI/IKU dan quality flags mempunyai batas minimum login. Keputusan publikasi final tetap pada pimpinan.

Dashboard Pimpinan sesi 1: `/monitoring-kpi.html` untuk KPI unit kerja, `/monitoring-iku.html` untuk IKU Kemdiktisaintek (keduanya login). Kedua URL `/capaian-iku-universitas.html` dan `/capaian-iku-fakultas.html` redirect ke KPI. Jalankan `db:migrate` lalu `db:seed`; runner seed baru `seed-pimpinan.js` memanggil seed existing tanpa mengubah berkas/ledger lama, lalu seed IKU insert-only. Angka sumber 2026 T2 dan penanda PRP dijelaskan dalam [audit sesi](DASHBOARD-PIMPINAN-SESI-1.md).

## 6. Hak database

app_user mempunyai SELECT/INSERT/UPDATE pada tabel aplikasi yang diperlukan dan USAGE pada sequence terkait. Role ini tidak mempunyai DDL, SUPERUSER, CREATEDB, CREATEROLE, BYPASSRLS, DELETE tabel, maupun INSERT/UPDATE/DELETE langsung pada audit_log. Audit dibuat oleh trigger/fungsi SECURITY DEFINER milik owner; fungsi khusus hanya menghapus session untuk logout/pruning. TEMPORARY dicabut dari PUBLIC pada database proyek agar app_user tidak dapat membuat tabel sementara; ini juga memengaruhi role non-owner lain yang hanya mewarisi privilege PUBLIC.

Migration baru untuk tabel/domain tambahan harus secara eksplisit memberi privilege minimum. app_user tidak diberi default privilege pada semua tabel masa depan. Audit hanya admin melalui API; role database dapat SELECT audit untuk menjalankan route admin, sehingga RBAC HTTP tetap wajib. Rahasia/password/hash/session token tidak masuk audit.

## 7. Docker sebagai alternatif

Siapkan Docker Desktop/Compose, isi POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD sesuai credential owner `.env`, dan ubah PGPORT ke **5433**. Native PostgreSQL 5432 dapat tetap berjalan karena port berbeda, tetapi kedua cluster mempunyai data terpisah.

```powershell
docker compose up -d db
docker compose ps
# Tunggu healthy. Sekali pada cluster baru:
docker compose exec -T db createdb -U itpln -O itpln satu_data_itpln_test
npm.cmd run db:migrate
npm.cmd run db:app-role
npm.cmd run db:seed
npm.cmd run db:check
npm.cmd run db:verify
npm.cmd test
npm.cmd run dev
```

Volume existing mempertahankan credential/data; mengubah POSTGRES_PASSWORD pada env tidak mengganti password di volume. Jangan menghapus volume atau menjalankan db:reset untuk mengatasi mismatch password. Jalur Docker belum diuji pada sesi ini; hasil verifikasi menggunakan native Windows.

## 8. Pemecahan masalah

- Excel 503 EXCEL_INVALID_OUTPUT/unduhan kosong khusus `npm.cmd run dev`: regresi penerimaan pesan internal Node watch telah diperbaiki 13 Oktober 2026. Restart server terbaru. Penerima worker harus melewati `watch:import`/`watch:require` dan menunggu pesan aplikasi `excel:result`; jangan menghapus guard/batas worker. Smoke wajib memakai **kedua** startup start/dev, login dan klik unduh nyata, kemudian buka/simpan/unggah Excel menjadi DRAFT pada `_test` atau percobaan pengguna yang terkontrol. Bukti dan langkah lengkap: [diagnosis E2](E2-RENCANA.md#diagnosis-runtime-nyata-13-oktober-2026-node-watch). Bila berulang, cocokkan request_id dengan log `excel_worker_failure`, tanpa mengirim rahasia.

- ECONNREFUSED: periksa service PostgreSQL, PGHOST/PGPORT, dan cluster native/Compose yang dipilih.
- 28P01: periksa password owner untuk skrip atau APP_DB_PASSWORD untuk API; jalankan db:app-role setelah mengganti password aplikasi.
- 42501 saat startup/API: pastikan migration 006/007/008/009 terpasang pada database yang dipilih. Jangan memberi app_user superuser untuk memperbaikinya.
- 403 CSRF: GET token dan gunakan cookie yang sama; ganti token setelah login/ganti password.
- PASSWORD_CHANGE_REQUIRED: panggil change-password dahulu dengan token session terbaru.
- 401 dashboard: periksa login, PUBLIC_DASHBOARD dan visibilitas_modul; modul privat membutuhkan login.
- 409 workflow: muat ulang row_version; untuk approved buat revision, bukan PATCH langsung.

Daftar endpoint backend tersedia di [arsip/FASE-2.md](arsip/FASE-2.md); tambahan API dan seluruh halaman di [arsip/FASE-3.md](arsip/FASE-3.md). Jalankan `npm.cmd run test:ui` untuk pemeriksaan Edge desktop dan 360px; tes menggunakan database `_test`, bukan dev. Microsoft Edge perlu terpasang; EDGE_BINARY dapat menunjuk executable lain jika lokasinya berbeda. Bukti tangkapan layar tersimpan di .runtime/phase3 dan diabaikan Git. Form dan akses Fase 4 ada di [arsip/FASE-4.md](arsip/FASE-4.md). Berhenti pada Fase 4 dan menunggu **"Lanjut Fase 5"**.

## Upgrade Fase 4

Jalankan db:migrate, db:app-role dan db:seed pada database existing. Migration 009 menambah isian parsial NULL, masa studi lulusan dan rka_revisi. Seed kebijakan Fase 4 memakai ledger baru: tracer menjadi public, AMI/pegawai/formasi dan modul privat lain authenticated. Pengulangan berikutnya tidak menimpa keputusan konfigurasi admin. Setelah npm.cmd run dev, buka /input/baa.html untuk BAA, /verifikasi.html untuk PRP, /admin/users.html untuk admin. Password awal berasal dari DEMO_PASSWORD_BAA/PRP/ADMIN; setelah diganti gunakan password terbaru.

## Upgrade Fase 5A

Urutan tetap `npm.cmd run db:migrate`, `npm.cmd run db:app-role`, `npm.cmd run db:seed`, kemudian pemeriksaan dan `npm.cmd run dev`. Migration 010 menambah pengaturan formulir; migration 011 memastikan denominator tracer membaca lulusan institusi approved terkini. Tidak diperlukan reset. Admin membuka `/admin/formulir.html` untuk mengubah perlu_verifikasi; default TRUE.

Opsi DEV_SKIP_PASSWORD_CHANGE hanya melewati kewajiban ganti password pada development. Flag asli di database tetap tersimpan, sehingga produksi kembali mewajibkannya. Nilai password `.env` tidak berubah. Tes API/UI mengisolasi opsi ini supaya konfigurasi lokal tidak menghilangkan pengujian default keamanan.

`db:check` membandingkan dashboard approved dengan baseline laporan. Jika hasil input manual sudah disetujui, nilai dev dapat berbeda; jangan reset atau menimpa revisi untuk mengejar kontrol. Kontrol seed tetap diperiksa pada `_test` melalui `db:verify`; detail hasil nyata ada di [arsip/FASE-5A.md](arsip/FASE-5A.md). Berhenti dan tunggu **"Lanjut Fase 5B"**.
