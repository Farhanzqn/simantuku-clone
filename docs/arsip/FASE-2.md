# Fase 2 — API, autentikasi dan workflow

Fase 2 selesai, termasuk tambahan pengguna: **empat kartu index.html membaca API dashboard dengan branding ITPLN** sebagai contoh jalan penuh. Berhenti dan menunggu **"Lanjut Fase 3"**. Integrasi halaman detail berada pada Fase 3, halaman login/input pada Fase 4. File vendor/halaman detail lama dipertahankan; snapshot angka/grafik universitas asal pada index diganti kartu API.

## Lingkungan dan implementasi

Jalur utama: Node 22 LTS untuk setup, PostgreSQL 16 native Windows `127.0.0.1:5432`, database dev/test terpisah. Verifikasi sesi ini memakai Node **24.19.0** yang tersedia dan PostgreSQL **16.15 native**. Docker Compose tetap alternatif port 5433, belum diuji pada sesi ini. Panduan dari nol ada di [SETUP-WINDOWS.md](SETUP-WINDOWS.md).

- `006_app_role.sql`: role terbatas app_user, SELECT/INSERT/UPDATE tabel yang diperlukan, SELECT views/sumber/audit, sequence USAGE, tanpa DDL/DELETE/mutasi audit. Session dibersihkan lewat fungsi khusus owner; audit trigger SECURITY DEFINER, bukan grant INSERT audit kepada aplikasi.
- `007_api_support.sql`: provenance input manual dan fungsi audit logout/import dengan daftar aksi terbatas. Migration lama tidak diubah; checksum tetap berlaku.
- `db:app-role`: memasang APP_DB_PASSWORD melalui koneksi owner tanpa mencetak rahasia. APP_DB_USER/APP_DB_PASSWORD terpisah dari PGUSER/PGPASSWORD; HTTP menolak fallback ke owner dan startup memeriksa atribut role.
- `server/app.js`: Express 5, Helmet, JSON dibatasi, request_id/error aman, static hanya static-web, listener loopback. Tidak menyajikan `.env`, laporan atau root repo.
- `server/services/session-store.js`: session PostgreSQL, get/set/touch/logout/pruning, bukan memory. Cookie httpOnly/sameSite=lax, secure di produksi, masa berlaku delapan jam.
- `server/routes/auth.js`: bcrypt, regenerate session/token saat login/ganti password, CSRF termasuk login/logout, rate limit IP 10/15 menit, ganti password wajib untuk demo awal, session_version mencabut sesi lain setelah password/role/status berubah.
- Middleware RBAC dan SQL scope memakai role/unit dari user session yang dibaca ulang dari database. Body tidak dapat memasukkan unit_id/status/approved_by/metadata workflow. Kepemilikan domain dan kode unit di master database; PMB ditulis PPA, BAA hanya pembaca approved PMB.
- Workflow transaksi: draft → submitted → approved/rejected; rejected diedit menjadi draft; approved direvisi sebagai baris baru. FOR UPDATE, advisory lock business key dan row_version menangani konflik. Pengaju tidak bisa approve sendiri; admin override eksplisit dengan alasan wajib tercatat `approve_override`, `is_override=true`, alasan dan request_id.
- Validasi zod: unknown field ditolak, angka nonnegatif/female≤total/S3≤total, tanggal/ID/grain lulusan/jenis KPI, referensi master, denominator tracer approved. Warning dosen/PMB disimpan atomik dengan audit; koreksi warning menghasilkan resolution tercatat.
- CSV template/preview/commit: JSON berisi string CSV, batas 500.000 karakter/200 baris, error bernomor baris, referensi/duplikasi divalidasi, `-` menjadi NULL, commit atomik sebagai draft dan idempotent. Preview berlaku satu jam. Import tidak auto-submit/approve.
- Dashboard hanya SELECT approved/current views; payload publik tidak membawa metadata pengaju/audit/draft. Summary memeriksa visibilitas semua modul akademik penyusunnya. KPI/IKU dan quality flags wajib login, tracer default privat. Modul nonaktif ditolak; PUBLIC_DASHBOARD=false membutuhkan login seluruh dashboard. Keputusan publikasi final pada pimpinan.

Role database app_user dapat SELECT audit untuk route admin; akses HTTP tetap hanya admin. Hak DELETE session tidak diberikan pada tabel, hanya fungsi sempit logout/pruning. TEMP dicabut dari PUBLIC pada kedua database proyek agar app_user tidak memiliki DDL sementara; pemilik/superuser tetap dapat maintenance. Tidak ada default grant untuk tabel masa depan.

## Kontrak endpoint final

Seluruh path berikut memiliki prefix **`/api`**. `Publik*` berarti PUBLIC_DASHBOARD=true dan seluruh modul terkait aktif/public; selain itu login wajib. `Login` berarti seluruh role manusia aktif (viewer, admin, dan role unit); akun seed/system tidak dapat login. Semua POST/PATCH membutuhkan cookie session dan header X-CSRF-Token, termasuk login anonim. Akun must_change_password wajib mengganti password sebelum menulis data lain.

| Method / endpoint | Role / akses |
|---|---|
| GET `/health` | Publik, liveness minimal |
| GET `/auth/csrf` | Publik, membuat token/session anonim |
| POST `/auth/login` | Publik dengan CSRF, kredensial valid dan rate limit |
| GET `/auth/me` | Login |
| POST `/auth/logout`, `/auth/change-password` | Login; ganti password membutuhkan password lama |
| GET `/master/prodi`, `/master/periode-akademik`, `/master/periode-laporan` | Publik* (modul prodi) |
| POST `/master/prodi`; PATCH `/master/prodi/:id` | admin / baa |
| POST `/master/periode-akademik`, `/master/periode-laporan`; PATCH masing-masing `/:id` | admin |
| GET `/dashboard/summary` | Publik*; mahasiswa, PMB, dosen dan lulusan, tanpa KPI/flags |
| GET `/dashboard/mahasiswa`, `/dashboard/mahasiswa-baru`, `/dashboard/dosen`, `/dashboard/tendik`, `/dashboard/lulusan`, `/dashboard/prodi` | Publik* sesuai modul; approved terkini |
| GET `/dashboard/tracer` | Login secara default; visibilitas modul tracer |
| GET `/dashboard/kpi` | Login, modul kpi dan iku harus aktif |
| GET `/dashboard/beban-mengajar`, `/dashboard/rekognisi-dosen` | Publik* (dosen); kosong, menunggu BSDM |
| GET `/dashboard/kinerja-pt` | Publik* (prodi); akreditasi NULL, menunggu PJM |
| GET `/data/:domain`, `/data/:domain/:id` | Login, scope unit sendiri; admin/prp seluruh unit; BAA membaca PMB approved |
| POST `/data/:domain`; PATCH `/data/:domain/:id` | Pemilik domain sesuai tabel berikut / admin; PATCH draft/rejected + row_version |
| POST `/data/:domain/:id/revision`, `/:id/submit` | Pemilik domain / admin, row_version |
| POST `/data/:domain/bulk-draft`, `/data/:domain/bulk-submit` | Pemilik domain / admin; maksimal 200 baris, atomik |
| GET `/verification/submissions` | prp / admin, antrean submitted |
| GET `/verification/:domain/:id/diff` | prp / admin, prior/diff/flags |
| POST `/verification/:domain/:id/approve`, `/:id/reject` | prp / admin; four-eyes; override hanya admin dengan alasan; reject wajib review_note |
| GET `/imports/:domain/template`; POST `/imports/:domain/preview` | Pemilik domain / admin |
| GET `/imports/:batchId` | Pemilik preview / admin |
| POST `/imports/:batchId/commit` | Pemilik preview / admin, tetap harus memenuhi role/unit domain |
| GET/POST `/admin/users`; PATCH `/admin/users/:id` | admin |
| POST `/admin/users/:id/reset-password` | admin; password sementara, revoke session, wajib ganti |
| GET `/admin/audit` | admin, filter/pagination, payload teredaksi |
| GET/POST `/admin/units`; PATCH `/admin/units/:id` | admin |
| GET `/admin/domain-units`; PATCH `/admin/domain-units/:domain` | admin, kepemilikan unit di database |
| GET `/admin/visibilitas-modul`; PATCH `/admin/visibilitas-modul/:kode` | admin |
| GET `/quality-flags` | Login; hanya catatan umum/approved terkini, tanpa payload draft/identitas pengaju |
| POST `/quality-flags/:id/resolve` | prp / admin, note wajib |
| GET `/kpi/indikator`, `/rka-target` | Login, modul kpi aktif |
| POST `/kpi/indikator`, `/rka-target`; PATCH masing-masing `/:id` | prp / admin; indikator yang sudah approved tidak dapat diubah historis |

| :domain allowlist | Penulis selain admin | Pemilik master awal |
|---|---|---|
| mahasiswa-aktif, lulusan | baa | BAA |
| mahasiswa-baru | ppa | PPA; BAA pembaca |
| dosen, tendik | bsdm | BSDM |
| tracer, tracer-ringkasan | bpka | BPKA |
| kpi-capaian, kpi-input | prp | PRP |

Role bku/bkm/lppm/pjm/kerjasama dapat membaca approved melalui dashboard sesuai visibilitas, tetapi endpoint input backlog belum tersedia. BSAR/BPAD tidak mempunyai role input. Domain keuangan/penelitian/HKI/PkM/kemitraan/AMI/akreditasi/prestasi tetap backlog Fase 5, bukan endpoint dummy.

Response berhasil `{data,meta}` (meta opsional); error `{error:{code,message,fields,request_id}}` (fields opsional). Status 401 login, 403 RBAC/CSRF/nonaktif, 404 di luar scope/tidak tersedia, 409 versi/workflow, 422 validasi/constraint, 429 rate limit. Nilai numeric PostgreSQL tertentu berupa string agar presisi tidak hilang; NULL tetap NULL.

GET `/data/:domain` menerima limit (1–100, default 50), offset, status, periode_laporan_id/periode_akademik_id/prodi_id sesuai domain. Queue menerima limit/offset/domain/unit_id. Quality flags menerima limit/offset/resolved (`true|false`)/unit_id/tabel; audit menerima limit/offset/user_id/tabel. Filter unit_id pada queue/flags adalah filter reviewer, bukan sumber scope penulis. Dashboard menerima periode_akademik_id/periode_laporan_id/prodi_id/jenjang/tahun/status/tanggal_snapshot sesuai domain; query tidak dikenal ditolak.

CSV preview body `{csv,periode_laporan_id,periode_akademik_id?}`; commit body `{}`. Field domain/template mengikuti schema allowlist. Periode luar CSV menentukan batch, bukan unit dari CSV. Template 19 prodi untuk domain per prodi; KPI/ringkasan institusi tidak dibagi ke prodi. Bulk-submit `{rows:[{id,row_version}]}`; reject `{row_version,review_note}`; approve `{row_version,override?,override_reason?,review_note?}`. Revision tidak menerima payload approved baru; koreksi dilakukan lewat PATCH draft revisi.

## Hasil verifikasi nyata

`npm test`: **13 tes lulus** (satu parent + dua belas subtest), nol gagal. HTTP memakai app_user, setup/cleanup fixture memakai owner hanya pada `_test`.

1. app_user menolak DDL public/TEMP, UPDATE/DELETE/INSERT langsung audit dan akses schema_migrations.
2. Login/tulis tanpa CSRF ditolak; cookie httpOnly/lax, Helmet aktif; session tersimpan PostgreSQL.
3. BAA ditolak menulis BSDM/PMB, unit_id body ditolak, female>total ditolak; lintas unit detail 404.
4. Draft/submitted/rejected tidak muncul dashboard; approved muncul; revisi tidak mengganti published sebelum approval; submitted terkunci; versi stale 409.
5. Dua approval bersamaan menghasilkan satu 200 dan satu 409.
6. PRP/admin self-approval ditolak; override admin tanpa alasan ditolak; override beralasan dan marker audit terbukti.
7. KPI/flags privat, toggle visibilitas dan saklar global dipaksa; summary tidak membocorkan KPI/flags.
8. CSV error per baris/reference, commit idempotent, bulk gagal rollback row dan audit; tanda '-' tracer benar-benar NULL.
9. Password-change wajib, session lain dicabut; role/status change dan logout mencabut akses; audit tanpa hash/password.
10. Login berulang mencapai 429 pada limiter yang dikonfigurasi untuk tes.
11. DATE PMB mempertahankan snapshot bisnis yang sama saat approval/revisi, tanpa pergeseran timezone; BAA membaca hanya PMB approved.

Smoke startup server runtime juga lulus: pemeriksaan role app_user, HTTP health/summary sesuai seed, dan `.env`/dokumen laporan/file seed di luar static-web tidak dapat diakses. Server smoke dihentikan setelah pemeriksaan; service PostgreSQL tetap berjalan.

`npm run db:verify`: **8 tes integritas database lulus**, termasuk seed idempotent, rollback migration gagal, checksum, FK/CHECK dan audit append-only. `npm run db:check`: semua query kontrol dev lulus:

| Metrik | Hasil |
|---|---:|
| Mahasiswa aktif 20252 / perempuan | 5.080 / 1.494 |
| Dosen 20252 | 222 |
| Tendik laki / perempuan / total | 21 / 9 / 30 |
| PMB target / daftar ulang | 2.030 / 1.678 |
| Wirausaha tracer rincian | 2 |
| Lulusan 2025 institusi | 1.100 |

66 sel tracer '-' tetap NULL, 38 denominasi per prodi tetap NULL; nol eksplisit PSPPI tetap 0. Flag jafung mempertahankan Ringkasan Eksekutif 59,60% (PDF3/cetakiii) dan Tabel4.20 58,08% (PDF147/cetak139). Nilai resmi/denominator 198 tidak berubah. Service database native pengguna tidak dihentikan. Tidak menjalankan reset, menghapus volume, atau mengekstrak ZIP di atas proyek.

## Batas fase berikutnya

Empat kartu beranda memakai GET `/api/dashboard/summary`, angka Intl.NumberFormat('id-ID'), label periode akademik/laporan/snapshot dari API, dan kondisi loading/kosong/error dengan retry. Endpoint summary kini juga mengembalikan tahun_ajaran/semester_akademik. Navbar/footer memilih branding ITPLN untuk index, dengan wordmark teks karena aset logo resmi belum tersedia; tanpa logo/kontak universitas asal. Script/CSS eksternal berjalan dengan Helmet CSP tanpa unsafe-inline.

Tambahan Fase 2 diuji pada browser Edge headless nyata di desktop 1280px dan mobile 360px: angka dari database tampil **222 / 5.080 / 1.678 / 1.100**, label Genap 2025/2026 dan per Juni 2026 serta lulusan tahun 2025 benar, tanpa overflow horizontal, branding/tautan universitas asal tidak muncul. Simulasi response browser membuktikan 401 menampilkan kebutuhan login, nilai NULL menjadi kosong, nilai 0 tetap 0, koneksi gagal menjadi error, dan retry kembali mengambil nilai nyata. Tidak ada exception JavaScript atau pelanggaran CSP. Screenshot lokal di `.runtime/home-desktop.png` dan `.runtime/home-mobile.png`; script smoke/profil browser di .runtime tidak menjadi dependency runtime. Tes API dijalankan lagi setelah penambahan metadata summary: **13 tes lulus**, nol gagal. Server smoke/browser dihentikan setelah verifikasi; PostgreSQL pengguna tetap berjalan.

Jalankan `npm run dev`/`npm.cmd run dev`, kemudian buka **http://127.0.0.1:3000/**. Panduan native Windows 5432 tetap jalur utama; Docker alternatif belum diuji. Integrasi halaman detail dan redirect IKU Fakultas mengikuti Fase 3, login/form UI Fase 4, domain backlog Fase 5, backup/restore dan smoke menyeluruh Fase 6. Jangan mulai Fase 3 sebelum pengguna mengatakan **"Lanjut Fase 3"**.
