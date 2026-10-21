# Fase 5B — Komponen bersama dan domain publik

Status kerja dicatat berurutan. `.env` dan koreksi approved pengguna dipertahankan. PostgreSQL native Windows tetap jalur utama; tanpa reset. Domain baru mengikuti checklist TAMBAH-DOMAIN.md dan workflow existing.

| Bagian | Status | Verifikasi |
|---|---|---|
| B1 Komponen bersama | Selesai | Tes komponen 2/2, npm test 27/27, Edge 12/12 |
| B2 Rasio dosen/mahasiswa | Selesai | npm test 28/28, Edge 13/13 |
| B3 Akreditasi | Selesai | npm test 29/29, database 9/9, Edge 15/15 |
| B4 Penelitian/HKI/PkM | Selesai | npm test 30/30, database 10/10, Edge 19/19 |
| B5 Prestasi mahasiswa | Selesai | npm test 31/31, database 11/11, Edge 21/21 |

## B1

Library ekspor yang dipilih dan dijelaskan sebelum instalasi: **fflate 0.8.3**, MIT, paket ZIP JavaScript tanpa dependency transitif. [Dokumentasi resmi](https://github.com/101arrowz/fflate/blob/master/README.md). Workbook XLSX dibuat sebagai paket Open XML sederhana, berisi nilai saja; bukan CSV berganti ekstensi. Modul browser dan lisensi disalin lokal ke vendor; tidak menggunakan CDN. Versi package dikunci.

Ekspor mengambil kolom dan baris yang sedang tampil setelah filter, mempertahankan NULL sebagai sel kosong, angka nol tetap angka, serta string sebagai inlineStr (tidak menjadi formula). Header mencatat panel/periode/sumber. Sebelum download, endpoint asal diperiksa kembali untuk menghormati sesi/visibilitas terkini; tidak mengambil field privat yang tidak ada dalam tabel/chart. Admin/audit/form input tidak otomatis mendapat ekspor dashboard.

Komponen baru: `filter-bar.js`, `excel.js`, perubahan bersama `ui.js`, dan integrasi `pages.js`/`home.js`. Filter divalidasi terhadap opsi master, disimpan dalam query string dan dipulihkan saat membuka URL. Fakultas hanya tersedia bila master prodi memiliki pemetaan. Grafik non-donut mendukung Kolom/Garis/Bar; mode Donut/Area lama dipertahankan. Tabel dashboard mempunyai kartu Total Data dan Download Excel, termasuk rincian grafik. Empty/error tidak menghasilkan angka dummy.

## B2

Migration **012_ratio_visibility.sql** menambahkan kebijakan publik `rasio-dosen-mahasiswa`; tidak menambah tabel input atau mengubah data sumber. Endpoint `GET /api/dashboard/rasio-dosen-mahasiswa` membaca view mahasiswa aktif dan dosen tetap approved terkini pada periode akademik/laporan yang sama, dengan filter jenjang/prodi. Endpoint juga menghormati kebijakan modul mahasiswa dan dosen, serta PUBLIC_DASHBOARD. Header API tetap no-store.

Rumus: mahasiswa aktif / dosen tetap, ditampilkan sebagai 1 : X. Tidak memasukkan dosen tidak tetap, tidak memakai snapshot seed, dan tidak menganggap NULL sebagai nol. Denominator nol menghasilkan NULL. Rasio gabungan pilihan filter hanya tersedia bila seluruh prodi terpilih mempunyai pasangan data lengkap; cakupan ditampilkan bila belum lengkap. Tabel 1.3 (PDF 17/cetak 9), Tabel 1.4 (PDF 22/cetak 14), dan Tabel 2.7 (PDF 43/cetak 35) tercantum sebagai rujukan; sumber revisi input unit tetap dibaca dari baris approved.

Halaman `rasio-dosen-mahasiswa.html` memakai komponen filter, Total Data, pengganti tipe grafik dan XLSX B1. Submenu ditambahkan di Dashboard Data → Dosen. Tidak membuat menu utama atau pemetaan fakultas baru. Semua data belum tersedia menghasilkan empty state, bukan grafik kosong.

Tes API membuktikan draft/submitted/rejected tidak mengubah rasio, approval dan revisi denominator mengubah rasio, pembagian nol menjadi NULL, BAA tidak dapat menulis dosen, filter liar ditolak, dan kebijakan login dipaksa. Tes Edge memeriksa rasio seed 5.080/222 = 22,88, 19 baris, filter URL satu prodi, sumber/rumus, tombol XLSX tabel/chart, navbar dan lebar 360px. Suite lama tetap lulus setelah ekspektasi jumlah submenu diperbarui dari enam menjadi tujuh.

## Verifikasi pada batas B2 — 8 Oktober 2026

| Perintah | Hasil nyata |
|---|---|
| npm run db:migrate | Berhasil; 012 diterapkan di dev dan test |
| npm run db:app-role | Berhasil; tidak mencetak rahasia |
| npm run db:seed | Berhasil/idempotent; koreksi dan password tidak ditimpa |
| npm run db:check (dev) | Gagal baseline: mahasiswa 5.162 vs 5.080; perempuan 1.555 vs 1.494; satu prodi berbeda dari rincian angkatan |
| npm run db:check (database test) | 18 kontrol lulus; mahasiswa 5.080/perempuan 1.494, dosen 222, tendik 30, PMB 2.030/1.678, wirausaha 2 |
| npm run db:verify | 8/8 lulus |
| npm test | 28/28 lulus |
| npm run test:ui | 13/13 Edge lulus, desktop dan 360px |
| Git diff --check dan node --check file rasio | Lulus |

Pada batas B2, dev mempunyai koreksi manual approved prodi 01 versi 4 (500 mahasiswa/100 perempuan), menggantikan seed 418/39; ini sudah dicatat di Fase 5A. Dosen dev tetap 222 dan tendik tetap 30. Tidak mengubah data pengguna agar kontrol baseline terlihat hijau. Hasil terbaru pada batas B3 dicatat di bawah. Tidak ada flag kualitas baru yang ditambahkan pada B1/B2.

## Batas pekerjaan dan kelanjutan

**Fase 5B selesai sampai B5.** B4/B5 dilanjutkan setelah batas B3 tanpa mengulang B1–B3. Seluruh bagian sudah diuji dan didokumentasikan. Berhenti di sini; Fase 5C belum dikerjakan dan menunggu instruksi pengguna.

Penelusuran awal laporan (historis; implementasi dan keputusan final B3–B5 dicatat di bawah):

- Akreditasi Tabel 4.17 (PDF 141–142/cetak 133–134) berisi 19 prodi. Tabel 4.18 berisi target, sehingga jangan dipakai sebagai realisasi. Status/SK institusi dan akreditasi internasional belum ditemukan. Nama S1 Geografi dan S1 Kewirausahaan pada tabel perlu ditelusuri terhadap master, tanpa mengarang pemetaan. SK yang sama pada keduanya dan tanggal D3 Mesin perlu diperiksa/ditandai bila seed dibuat.
- Penelitian Tabel 4.7 (PDF 116–117/cetak 108–109), HKI 4.8 (PDF 118/cetak 110), PkM 4.9 (PDF 119/cetak 111). Nominal dana belum ditemukan; tetap NULL. Narasi tahun penelitian dan judul tabel perlu dicocokkan dan dicatat sebagai flag bila berbeda.
- Tabel 1.7 (PDF 26/cetak 18) berisi prestasi institusi; jangan dihitung sebagai prestasi mahasiswa. Tabel 1.8 (PDF 27/cetak 19) berisi agregat mahasiswa 14 prodi; narasi total 122 (nasional 105, regional 8, internasional 9). Tanda '-' dan lima prodi yang tidak dirinci tidak boleh menjadi nol; bidang belum tersedia.

Untuk memeriksa hasil sekarang: `npm run dev`, buka http://127.0.0.1:3000/rasio-dosen-mahasiswa.html dan halaman lama Statistik Mahasiswa/Mahasiswa Baru/Lulusan/Kinerja Program Studi. Angka dev mengikuti koreksi approved pengguna. File baru B1: filter-bar.js, excel.js, fflate.js/lisensi, components.test.js; B2: migration 012, routes/ratio.js, ratio-page.js, rasio-dosen-mahasiswa.html. Integrasi bersama ada di app.js, api.js, navbar.js, ui.js, pages.js, home.js, app.css, package.json/lock dan tes API/UI.

## B3 — selesai pada 8 Oktober 2026

Checklist TAMBAH-DOMAIN dijalankan untuk `akreditasi`, unit PJM. Migration **013_accreditation.sql** membuat `akreditasi_revisi`, grain periode laporan + butir, FK, unique current/working, guard workflow, audit, view approved `v_dashboard_akreditasi`, grant terbatas app_user, dan visibilitas publik. Master kepemilikan akreditasi/PJM sudah tersedia; tidak membuat fakultas. Registry server + form memakai field yang sama dan kebijakan perlu_verifikasi default TRUE.

Sumber: **Tabel 4.17, PDF 141–142 / cetak 133–134**, 19 butir. Tabel 4.18 merupakan target dan sengaja tidak disimpan sebagai realisasi. Rekap tabel cocok dengan narasi halaman PDF 142: Baik 11, Baik Sekali 6, Unggul 1, Terakreditasi 1; tidak ada selisih jumlah yang memerlukan flag baru. Setiap baris menyimpan sumber_id ke provenance tabel/halaman dan sumber nama laporan. SK/lembaga dibaca dari SK; tanggal dinormalisasi ke date tanpa membetulkan angka sumber. Tanggal mulai tidak tersedia, tetap NULL.

17 butir dipetakan ke master. Nama lengkap yang identik dipadankan langsung; Program Profesi Insiyur → PSPPI dan D3 Mesin → D3 Teknik Mesin merupakan singkatan program/jenjang yang unik dalam master. Nama laporan tetap disimpan pada `nama_sumber`. **S1 Geografi dan S1 Kewirausahaan belum dipastikan**, sehingga prodi_id NULL dan memakai butir laporan tersendiri; tidak otomatis dihubungkan ke Geospasial/Bisnis Energi. Keduanya tetap masuk rekap 19 butir, dengan label belum terpetakan pada detail. Dua baris master yang belum mempunyai pasangan tetap kosong di formulir.

Seed insert-only dengan ledger/checksum `akreditasi-2026-s1-v1`; seed ulang mempertahankan koreksi. 19 baris v1 melalui **draft → submitted → approved**, tiga status terbukti di audit. Publikasi menggunakan fungsi `publish` yang juga dipakai review manual/auto-approved. Pengecualian sistem pada guard khusus seed v1 akreditasi, dijalankan koneksi owner, dengan aktor seed nonaktif dan provenance laporan; app_user tidak dapat memakai pengecualian tersebut. Four-eyes manual dan override admin tetap diuji oleh suite existing.

Form **/input/pjm.html** memakai input.js yang sama: autosave, clipboard teks/tanggal, draft/submit, salin periode, riwayat dan review PRP/admin. Berisi 19 baris master, dua butir belum terpetakan, satu institusi dan satu internasional institusi (23 baris). Tidak ada template file. Nomor SK/peringkat/lembaga berupa teks, masa berlaku berupa tanggal yyyy-mm-dd. Institusi dan internasional belum mempunyai data laporan: hanya tersedia isian kosong dan empty state dashboard sampai disetujui. Pilihan Cakupan isian Internasional menampilkan satu baris institusi dan 19 baris master prodi yang dapat diisi, tanpa seed perkiraan.

Dashboard **GET /api/dashboard/akreditasi** hanya membaca view approved, memilih periode laporan, jenjang dan prodi. Tidak mengambil aktor/audit/flag privat. Halaman **/akreditasi.html**, submenu **Kinerja → Akreditasi**, memiliki kartu institusi/internasional (empty state), donut peringkat, rekap jenjang × peringkat dengan persentase dari total butir terfilter, dan detail prodi. Filter URL, Total Data, XLSX, loading/kosong/error memakai komponen B1. Masa berlaku ditampilkan sebagai tanggal sumber; peringatan kedaluwarsa/<12 bulan hanya di input/verifikasi yang memerlukan login. Diff verifikasi juga menghitung ulang peringatan terhadap tanggal saat review agar tidak bergantung pada tanggal seed.

Flag baru (semua internal, tanpa catatan_publik):

- `akreditasi-belum-terpetakan-laporan-3` dan `akreditasi-belum-terpetakan-laporan-9`: nama belum dipastikan, kutipan Tabel 4.17/PDF 141.
- `akreditasi-sk-duplikat`: kutipan kedua prodi dengan SK `070/SK/LAMSAMA/Akred/S/V/2025`, PDF 141/cetak 133.
- `akreditasi-d3-mesin-tanggal`: dua kutipan, tanggal 12-01-2026/status Aktif dan narasi seluruh prodi aktif, PDF 142/cetak 134. Tanggal sumber tetap 2026-01-12.
- `akreditasi-masa-berlaku-prodi-02`, `-03`, `-04`, `-05`, `-18`: peringatan internal berdasarkan tanggal pemeriksaan, masing-masing dengan kutipan baris sumber. Tidak tampil sebagai alert publik.

Keputusan/data yang masih diperlukan: PJM memastikan dua pemetaan prodi, SK duplikat dan tanggal D3 Mesin; mengisi status/SK institusi, akreditasi internasional dan tanggal mulai yang tidak ditemukan. Tidak membuat perkiraan.

### Verifikasi nyata pada batas B3

| Perintah | Hasil |
|---|---|
| db:migrate | Berhasil; 013 diterapkan di dev/test |
| db:app-role | Berhasil; app_user tetap terbatas |
| db:seed, diulang | Berhasil/idempotent; tidak menimpa data approved/password |
| db:check dev | **18/18 kontrol lulus** |
| db:check database test | **18/18 kontrol lulus** |
| db:verify | **9/9 lulus**, termasuk rekap 19 butir, provenance, flags dan idempotensi |
| npm test | **29/29 lulus**; PJM/RBAC halaman+tulis, submit/approve/reject/revisi, default review, auto-approved, diff internal, audit seed |
| test:ui | **15/15 Edge lulus**, termasuk dashboard akreditasi dan form PJM pada 360px |
| Git diff --check | Lulus |

Hasil dev terbaru terbukti pada database `satu_data_itpln_dev`: mahasiswa 5.080/perempuan 1.494, dosen 222, tendik 30. Prodi 01 sekarang mempunyai approved **versi 5, 418/39**, sumber Input unit (approved_at 8 Oktober 2026 20:06 WIB), berbeda dari kondisi historis B2 versi 4. Pekerjaan B3 tidak memperbarui tabel mahasiswa/dosen/tendik; tidak menjalankan reset atau mengubah .env. Koreksi pengguna yang kini approved dipertahankan.

File baru B3: `db/migrations/013_accreditation.sql`, `db/seed/akreditasi-2026-s1.json`, `db/scripts/seed-accreditation.js`, `server/routes/accreditation.js`, `static-web/akreditasi.html`, `static-web/input/pjm.html`, `static-web/assets/js/accreditation-page.js`. Integrasi: seed.js, validators/domains.js, services/data.js, routes/data.js, app.js, input-schema.js/input.js, api.js/navbar.js, tes API/database/UI dan dokumentasi.

## B4 — selesai

Checklist TAMBAH-DOMAIN dijalankan untuk penelitian, HKI dan PkM, pemilik LPPM. Migration **014_research_domains.sql** membuat tiga tabel revisi dan view approved, kunci periode laporan + tahun + kategori, unique current/working, audit/guard dan grant app_user terbatas. FormDefinitions menyediakan kategori dan kolom bersama browser/server; zod menerima kategori dari konfigurasi yang sama. Adapter categories/year memakai input.js existing, tanpa salinan workflow atau dependency baru.

Sumber seed **penelitian-hki-pkm-2026-s1.json**:

- Penelitian Tabel 4.7 PDF 116–117/cetak 108–109: lima skema, target 130, realisasi 7. Dana semua NULL.
- HKI Tabel 4.8 PDF 118/cetak 110: empat jenis, target 160, diajukan 89, disetujui 87. Nol eksplisit laporan tetap nol.
- PkM Tabel 4.9 PDF 119/cetak 111: dua skema, target 29, realisasi 2. Dana semua NULL.

Sebelas baris v1 mengikuti draft → submitted → publish approved oleh sistem seed dengan pengecualian owner-only yang diperluas terbatas ke tiga domain baru; tiga status terbukti di audit. Ledger/checksum `research-2026-s1-v1` insert-only. Seed ulang tidak mengganti koreksi approved, password atau pengaturan perlu_verifikasi (default TRUE).

Flag internal baru **penelitian-tahun-narasi-berbeda** menyimpan kutipan narasi tahun 2025 dan judul Tabel 4.7 tahun 2026, keduanya PDF 116/cetak 108. Dua provenance dan nilai tahun juga dicatat di data_quality_flag_sumber. Tahun resmi 2026 mengikuti judul tabel; nilai tidak diubah mengikuti narasi. Catatan bibliografi singkat tampil di halaman penelitian; endpoint quality flags tetap memerlukan login.

Pemeriksaan silang akhir menambahkan tiga flag internal: **penelitian-target-produktivitas-berbeda** (105 vs 130), **penelitian-realisasi-produktivitas-berbeda** (3 vs 7), **pkm-target-produktivitas-berbeda** (25 vs 29). Sumber produktivitas adalah Tabel 2.8/PDF 43/cetak 35; rincian resmi penelitian Tabel 4.7/PDF 117/cetak 109 dan PkM Tabel 4.9/PDF 119/cetak 111. Setiap flag menyimpan kutipan kedua sumber dan dua baris data_quality_flag_sumber. Realisasi PkM sama-sama 2, sehingga tidak diberi flag selisih. LPPM perlu memastikan perbedaan cakupan/definisi; dashboard tetap memakai rincian 4.7/4.9. Seed tambahan `lppm-perbandingan-sumber.json`/`seed-source-comparisons.js` memakai ledger terpisah `lppm-source-comparisons-v1`, tanpa mengubah checksum seed/data approved yang sudah terpasang.

Endpoint publik **GET /api/dashboard/{penelitian,hki,pkm}** membaca view approved saja, dengan periode laporan dan tahun. Hanya kategori/jumlah/dana agregat dan provenance, tanpa nama dosen, aktor atau audit. Halaman **/penelitian.html**, **/hki.html**, **/pkm.html** berada di submenu Kinerja; filter URL, grafik Kolom/Garis/Bar, Total Data, XLSX dan state loading/kosong/error memakai B1. Dana tidak dihitung dari sumber pendanaan atau grafik. Form **/input/lppm.html** mempunyai tiga tab (5/4/2 baris), tahun kegiatan, periode laporan, clipboard, autosave, riwayat, draft/submit, salin periode dan verifikasi bersama; tanpa template file.

Tes setelah B4: **npm test 30/30**, **db:verify 10/10**, **Edge 19/19**. API menguji ketiga domain: akses LPPM vs BAA, periode/tahun, NULL dana, reject tidak mengubah dashboard, draft/submitted tidak publik, approval/revisi mengubah dashboard dan dana desimal bisa direvisi; unknown field/nama pribadi ditolak. Database memeriksa jumlah sumber, dana NULL, dua tahun bersumber, v1/audit serta idempotensi. Edge memeriksa masing-masing halaman desktop/360px, sumber, filter tahun, export, empty tanpa canvas dan tiga tab form LPPM.

File baru: migration 014, seed JSON, `db/scripts/seed-research.js`, `server/routes/research.js`, `static-web/assets/js/research-page.js`, tiga halaman publik dan input/lppm.html. Integrasi registry/form/grants/guard/navbar/seed/tests mengikuti checklist. Nominal dana tidak ditemukan; LPPM perlu memastikan tahun narasi. B5 dilanjutkan setelah batas B4 hijau.

## B5 — selesai pada 8 Oktober 2026

Checklist TAMBAH-DOMAIN dijalankan untuk `prestasi`, unit BKM. Migration **015_student_achievements.sql** membuat `prestasi_revisi`, grain periode laporan + tahun + prodi, indeks current/working, audit/guard, view approved dan grant terbatas. Visibilitas publik tunduk PUBLIC_DASHBOARD; formulir tetap memerlukan sesi dan role BKM/admin. Pengaturan perlu_verifikasi default TRUE, review PRP/admin, four-eyes, override dan audit memakai workflow bersama yang sudah ada.

Seed **prestasi-2026-s1.json** bersumber **Tabel 1.8, PDF 27/cetak 19**. Empat belas baris prodi v1 mengikuti draft → submitted → publish approved oleh akun seed nonaktif melalui koneksi owner. Ledger/checksum `prestasi-2026-s1-v1` menjaga idempotensi dan tidak menimpa koreksi. Jumlah sel terisi cocok dengan narasi: **122 mahasiswa berprestasi, 105 nasional, 8 regional/provinsi/wilayah, 9 internasional**. Jumlah mahasiswa dan penghargaan merupakan ukuran berbeda. Karena cocok, **tidak ada flag selisih prestasi baru**. Tabel 1.7 adalah prestasi institusi dan tidak dipakai. Nama prodi Tabel 1.8 cocok dengan master, termasuk Geospasial dan Bisnis Energi (Kewirausahaan); tidak menerapkan pemetaan nama berbeda pada akreditasi.

Tanda minus seluruhnya NULL, termasuk PKM DIKTI dan seluruh angka S1 Sains Data. Lima prodi master tanpa rincian (kode 01–05) tidak diberi baris seed rekaan. Dashboard menggabungkan master dengan approved terfilter untuk menampilkan 19 prodi, lima tanpa sumber dengan sel kosong. Jumlah hanya dari nilai tersedia; NULL tidak ditampilkan sebagai nol. Bila seluruh pilihan filter belum mempunyai data approved, respons/halaman menjadi empty state tanpa canvas. Dimensi bidang belum ditemukan dan tidak dibuat; nama/NIM tidak disimpan atau ditampilkan.

Endpoint publik **GET /api/dashboard/prestasi**: filter periode laporan, tahun, jenjang dan prodi; data hanya agregat approved, label master dan provenance. Halaman **/prestasi-mahasiswa.html**, submenu **Dashboard Data → Mahasiswa → Prestasi Mahasiswa**, memakai filter URL, grafik Kolom/Garis/Bar, Total Data dan XLSX terfilter, metadata periode/sumber serta state loading/kosong/error. Form **/input/bkm.html** memakai tabel 19 prodi, kolom angka, tahun, autosave, clipboard, draft/submit, salin periode dan riwayat bersama; tanpa template file.

Tes B5 membuktikan akses halaman/tulis BKM, penolakan BAA/lintas unit, default review TRUE, draft/submitted/rejected tidak publik, approval/revisi mengubah endpoint dan field NIM ditolak. Database memeriksa 14 baris, lima prodi tanpa rincian, total narasi, NULL, sumber 1.8 dan tiga status audit seed. Edge memeriksa 19 baris publik, nilai grafik 105/8/9, sumber, filter URL, empty tanpa chart serta form BKM pada desktop/360px. Harness API memakai limit login 20 untuk banyak akun fixture; konfigurasi runtime tetap 10, dengan tes rate limit tersendiri tetap lulus.

File baru B5: `db/migrations/015_student_achievements.sql`, `db/seed/prestasi-2026-s1.json`, `db/scripts/seed-achievements.js`, `server/routes/achievements.js`, `static-web/assets/js/achievements-page.js`, `static-web/prestasi-mahasiswa.html`, `static-web/input/bkm.html`. Integrasi B4/B5: seed.js, validators/domains.js, services/data.js, app.js, input-schema.js/input.js, api.js/navbar.js, tes API/database/UI, README dan AGENTS. Tidak ada dependency baru.

## Verifikasi akhir B4/B5 — 8 Oktober 2026

| Perintah | Hasil nyata |
|---|---|
| npm run db:migrate | Berhasil; 014/015 diterapkan di dev/test; pengulangan idempotent |
| npm run db:app-role | Berhasil; role app_user tetap terbatas, rahasia tidak dicetak |
| npm run db:seed | Berhasil/idempotent; approved lama, password dan pengaturan tidak ditimpa |
| npm run db:check (dev) | 18/18 kontrol lulus |
| npm run db:verify (test) | 11/11 lulus; termasuk 18 kontrol seed |
| npm test | 31/31 lulus |
| npm run test:ui | 21/21 Edge lulus; desktop dan 360px, tanpa overflow/CSP error |
| Git diff --check | Lulus |

Pada pengulangan Edge, navigasi menuju login admin sempat timeout dan menyebabkan tiga tes formulir berikutnya ikut gagal. Harness diperbaiki untuk menunggu DOM halaman baru setelah Page.navigate, sehingga tidak mengisi formulir login lama. Pengulangan terakhir lulus **21/21**; autentikasi, rate limit dan CSRF runtime tidak diubah.

Kontrol dev/test: mahasiswa aktif 20252 **5.080**, perempuan **1.494**, dosen **222**, tendik **30 (21/9)**; PMB **2.030/1.678**, wirausaha tracer **2**. Tidak menjalankan reset, mengubah .env atau memperbarui data dev approved yang sudah ada.

Data/keputusan tersisa: nominal dana penelitian/PkM tidak ditemukan (NULL), tahun narasi penelitian 2025 vs judul 2026 serta perbedaan Tabel 2.8 vs 4.7/4.9 perlu konfirmasi LPPM, bidang prestasi dan rincian lima prodi belum tersedia. Hal yang belum dipastikan pada B3 tetap menunggu PJM. Tidak ada implementasi B4/B5 setengah jadi; Fase 5C belum dimulai.

Untuk mencoba: `npm run dev`, buka **http://127.0.0.1:3000/penelitian.html**, **/hki.html**, **/pkm.html**, **/prestasi-mahasiswa.html**. Form unit ada di **/input/lppm.html** dan **/input/bkm.html** dengan login sesuai unit; akun demo/password mengikuti nama variabel .env pada docs/FASE-4.md, tanpa nilai password dalam dokumentasi.
