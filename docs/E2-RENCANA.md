# E2 sesi 1 — template dan unggah form sederhana

## Langkah 0 — klasifikasi sebelum implementasi (12 Oktober 2026)

Dasar: MATRIKS-INPUT.md, excel-schema.js, input-schema.js, validator domain dan validasi referensi manual. Dari 23 domain, Mahasiswa Aktif dan Formasi sudah mendapat E1; 21 sisanya di bawah. Pemeriksaan master periode/prodi dan keunikan kunci bisnis tetap wajib untuk semua form, bukan rekonsiliasi lintas tabel. Sederhana berarti satu tabel datar dengan nilai dasar dan tanpa rekonsiliasi antar baris/data domain lain. Peringatan lokal satu baris tidak mengubah nilai sumber.

| Form / kode | Unit | Klasifikasi | Alasan |
|---|---|---|---|
| Mahasiswa Baru / mahasiswa-baru | PPA | Sederhana | Target/daftar ulang per prodi; tahun masuk dan tanggal snapshot menjadi konteks; peringatan target lokal satu baris. |
| Tendik per Prodi / tendik | BSDM | Sederhana | Dua jumlah gender per prodi, tidak direkonsiliasi dengan institusi 109. |
| Ringkasan Pegawai / pegawai-ringkasan | BSDM | Sederhana | Satu jumlah per kategori institusi; kategori tidak dijumlahkan. |
| Lulusan / lulusan (prodi dan institusi) | BAA | Sederhana | Jumlah/IPK/masa studi pada satu tabel; konteks cakupan/tahun/wisuda, institusi prodi_id NULL; tanpa pembagian atau rekonsiliasi dengan rincian prodi. |
| Prestasi Mahasiswa / prestasi | BKM | Sederhana | Jumlah per prodi/tahun; mahasiswa dan penghargaan ukuran terpisah. |
| Kerja Sama / kerjasama | Bagian Pengembangan Kemitraan | Sederhana | Ringkasan kategori datar dan teks mitra; cakupan tidak dijumlahkan, tanpa lookup domain lain. Kode unit master tetap NULL. |
| Produktivitas Dosen / produktivitas-dosen | BSDM | Sederhana | Tiga kategori tetap, target/realisasi/capaian sumber; tanpa rekonsiliasi penelitian/PkM. |
| Pergerakan Pegawai / pegawai-pergerakan | BSDM | Sederhana | Empat jumlah kategori/tahun, tanpa perhitungan saldo/headcount. |
| Mahasiswa per Angkatan / mahasiswa-angkatan | BAA | Kompleks | Dimensi per angkatan/rentang tahun; ditunda sesuai lingkup pengguna. |
| Dosen per Prodi / dosen | BSDM | Kompleks | Rekonsiliasi total jabatan fungsional terhadap total dosen; ditunda untuk penanganan selisih sumber. |
| Tracer Study / tracer | BPKA | Kompleks | Cakupan responden/lulusan dan kategori hasil tracer; ditunda eksplisit. |
| Ringkasan Tracer Institusi / tracer-ringkasan | BPKA | Kompleks | Denominator merujuk lulusan institusi approved pada periode/tahun sama. |
| Capaian KPI / kpi-capaian | PRP | Kompleks | Jenis indikator, nilai alternatif, basis dan metrik; lookup indikator. |
| Input Pembilang/Penyebut KPI / kpi-input | PRP | Kompleks | Definisi kode input/indikator/satuan dan denominator terpisah. |
| Target RKA / rka-target | PRP | Kompleks | Revisi merujuk master target RKA, sumber tidak ditimpa. |
| Akreditasi / akreditasi | PJM | Kompleks | Entitas institusi/prodi/internasional dan belum terpetakan; validasi jenjang lintas master. |
| Penelitian / penelitian | LPPM | Kompleks | Ditunda eksplisit untuk kajian skema/judul/dana penelitian. |
| HKI / hki | LPPM | Kompleks | Ditunda eksplisit untuk kajian target/pengajuan/persetujuan. |
| PkM / pkm | LPPM | Kompleks | Ditunda eksplisit untuk kajian kegiatan/skema/dana. |
| AMI / ami | PJM | Kompleks | Entitas dan rekap memakai kolom serta denominator berbeda. |
| Keuangan / keuangan | BKU | Kompleks | Kelompok rasio/pendapatan/biaya/laporan memakai aturan kolom dan satuan berbeda, termasuk periode pembanding. |

Data tanpa form pada matriks (rekognisi, rincian beban mengajar, rincian PKWT, fakultas, metrik PT gabungan) tidak dibuat dalam E2. Form login-only tetap demikian.

## Implementasi yang diizinkan

Hanya delapan form sederhana di atas. Registry dan adaptor konteks/entitas E1 diperluas; endpoint, parser/worker, kuota, limiter, semaphore, validasi manual dan transaksi workflow tetap dipakai. Unggah/pratinjau tidak mengubah domain; apply hanya DRAFT bahkan jika perlu_verifikasi FALSE. Tidak ada dependency baru, perubahan migration/seed lama, .env atau approved dev. Migration 028 memperluas allowlist audit Excel untuk delapan form; berkas yang sudah terpasang di test dipertahankan checksum-nya dan diterapkan lewat ledger di dev.

## Hasil dan gerbang

Delapan form sederhana selesai: Mahasiswa Baru, Tendik per Prodi, Ringkasan Pegawai, Lulusan (prodi dan institusi), Prestasi, Kerja Sama, Produktivitas Dosen, Pergerakan Pegawai. Tombol Unduh Template dan Unggah & Pratinjau menggunakan komponen bersama yang sama dengan BAA; apply selalu DRAFT, termasuk policy tanpa verifikasi.

Tiga belas form kompleks pada tabel tetap ditunda: Mahasiswa per Angkatan, Dosen per Prodi, Tracer Study, Ringkasan Tracer Institusi, Capaian KPI, Input KPI, Target RKA, Akreditasi, Penelitian, HKI, PkM, AMI, Keuangan. Fase 6 tidak dimulai.

Audit awal dan bukti penyelesaian: [E2-SESI-1-AUDIT.md](E2-SESI-1-AUDIT.md). Fixture periode unik dan batas login khusus harness sudah ditemukan terpasang saat sesi dilanjutkan; sisa kegagalan berasal dari pembulatan fixture batas desimal dan assertion UI yang masih membatasi unggah ke E1. Limiter produksi dan validator manual tidak dilonggarkan.

Gerbang akhir 12 Oktober 2026: `npm test` **77/77**, `test:ui` **37/37**, `db:verify` **19/19**, `db:check` **18 kontrol**, `npm audit` **0 kerentanan**, fingerprint dev **23/23 identik**. Migration 028 terpasang dev/test, ledger/checksum cocok; runner dev diulang tanpa penerapan ulang. Node v24.19.0 dan Edge diuji; baseline Node 22 LTS belum diuji.

## Bug unduhan template Excel

**Status terkini 13 Oktober 2026:** penyebab watch-mode telah ditemukan dan diperbaiki; lihat [bisect runtime nyata](#diagnosis-runtime-nyata-13-oktober-2026-node-watch). Catatan diagnosis terdahulu berikut dipertahankan sebagai bukti historis.

### Langkah 0: diagnosis sebelum perubahan kode (12 Oktober 2026)

Status: **akar kerusakan berkas pengguna belum terkonfirmasi**, jangan tandai selesai. Unduhan dilaporkan lewat Brave pada sekitar 11:40 WIB. Path/URL yang diberikan masih placeholder; byte berkas asli belum tersedia. Instance saat unduhan historis belum dapat dibuktikan.

- Harness lokal menjalankan route/worker produksi GET /api/forms/:form/template dengan SELECT master saja; auth/audit disimulasikan agar diagnosis tidak menulis session/audit/DB. 10 form + lulusan institusi = 11 respons 200, 4.106?5.672 byte, magic 504b0304, MIME XLSX tepat, attachment .xlsx, Content-Length cocok, tanpa charset/Content-Encoding. Byte mentah dan header tanpa cookie: .runtime/xlsx-diag/before/. Cakupan seluruh middleware nyata akan diuji pada suite API _test.
- Semua 8 part XML tiap template dapat diparse .NET XmlDocument. ZIP berisi Content_Types, package/workbook relationships, workbook, styles dan 3 worksheet. docProps/sharedStrings tidak dibuat (opsional); teks inlineStr. Generator tidak memiliki dropdown/dataValidation existing; proteksi kunci dan sheet _meta tetap. Audit struktur rinci dicatat setelah tes struktur permanen.
- ExcelJS 4.4.0 dipasang **hanya di .runtime/xlsx-diag/scratch**, bukan manifest/lock proyek. Sepuluh template awal terbaca; lulusan institusi diulang setelah parameter harness diperbaiki (periode_wisuda kosong bukan konteks valid; parameter dihilangkan).
- Microsoft Excel desktop 16.0 tersedia. COM tersembunyi/read-only berhasil membuka template Mahasiswa Aktif dan save-as fixture dua baris; parser menerima hasil save-as tersebut. Otomasi COM bukan konfirmasi manual pengguna. Log rinci .runtime/xlsx-diag/excel16-before.json.
- Frontend api.js memakai response.blob(), template-upload.js memakai Object URL; tidak mengubah byte lewat text/JSON. Nama unduhan diambil dari nama form allowlist, sesuai Content-Disposition. Route mengirim Buffer; tidak ada middleware compression/pembungkus JSON pada respons sukses.
- Temuan interoperabilitas terpisah: ZIP default ExcelJS menulis version-needed=10 dengan DEFLATE (method 8), ditolak kebijakan E1 yang mengharuskan 20 untuk DEFLATE. Jangan melonggarkan pemeriksaan itu. Gunakan output STORE dari penulis independen; direktori ZIP kosong perlu diperiksa terpisah.
- Tidak mengubah generator berdasarkan dugaan: template yang baru diunduh belum mereproduksi pesan invalid format. Berkas gagal dan instance historis tetap diperlukan untuk menyatakan akar masalah unduhan.

Rujukan struktur: [Microsoft SpreadsheetML](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document?tabs=cs); penulis independen [ExcelJS](https://github.com/exceljs/exceljs).


### Lanjutan 13 Oktober 2026: unduhan 0 byte

#### Langkah 0, sebelum perubahan kode aplikasi

- Berkas asli `D:\farhan itpln\mahasiswa-aktif-template (1).xlsx` dibaca: **0 byte**. Tidak ditulis/diganti. Snapshot resume-before di `.runtime/xlsx-diag/` dibanding baseline terakhir: **24/24 domain dev** (seluruh row terurut ID, termasuk IKU/approved), **68/68 berkas terlindungi** identik. Baseline terakhir Dashboard Pimpinan sesi 2 juga diperiksa pada penutupan.
- Cadangan terbaru `.runtime/xlsx-diag/backup/`: 16/17 berkas identik, hanya `server/tests/api.test.js` berbeda (memanggil tes interoperabilitas baru). API frontend dan tes UI saat mulai masih identik. Cadangan terbaru **tidak memuat** parser/generator/route Excel; tidak ada klaim diff byte parser terhadap snapshot itu. Route dibanding cadangan lebih lama `.runtime/e2-resume/form-excel.js`: kini menghitung baris berisi nilai/error, mengabaikan baris kosong berformat, mempertahankan nomor baris sumber. Generator sekarang menghasilkan tiga sheet/proteksi valid; kebutuhan perubahan generator tidak terbukti.
- Pekerjaan sesi terputus: parser menerima enam direktori ZIP kosong ber-allowlist (tetap memakai anggaran 100 anggota), deklarasi Default VML pasif tanpa part/relationship aktif, serta fixture ExcelJS STORE/shared/inline/absolute dan Excel 16. Baris fisik tetap maksimum 502. Makro, ZIP64, VML aktif, direktori berisi/traversal dan batas ukuran tetap ditolak. Tes parser lama sendiri belum mencakup semua pengecualian baru; regresi negatif ditambahkan pada sesi ini.
- Hasil nyata awal: `npm test` **83 lulus, 2 gagal, 1 skip / 86 total**. Satu subtes ExcelJS gagal mengakses protection.locked; induknya ikut gagal. `db:verify` **20/20**, `db:check` **18 kontrol lulus**. Tidak reset DB; seluruh fixture/mutasi suite hanya pada _test, suite DB berurutan.
- Penyebab assertion ExcelJS: `scratch/node_modules/exceljs/lib/xlsx/xform/style/protection-xform.js` menghilangkan model proteksi default locked=true. Tes kini memakai default tersebut, tetap mewajibkan sheetProtection serta unlocked=false untuk sel input. Generator tidak diubah untuk membuat assertion hijau.

#### Diagnosis dan batas kesimpulan

1. Timer existing **10.000 ms**, bukan revoke langsung setelah click. Anchor sebelumnya tidak dipasang pada DOM. Riwayat Brave khusus nama template diperiksa melalui salinan read-only sementara (salinan SQLite sudah dihapus; hanya metadata unduhan terkait disimpan). Entri berkas (1) mencatat **received_bytes=0, total_bytes=0, state=1, interrupt_reason=0**, URL blob localhost:3000, durasi sekitar **5,62 detik**. Ini menunjukkan unduhan Blob kosong selesai, tidak mendukung diagnosis timer sepuluh detik/interupsi. Tidak membaca cookie atau riwayat situs lain.
2. CSP tetap Helmet existing; tanpa penambahan blob: atau pelemahan script/object/connect policy. Tes Edge/Brave profil baru dapat menyimpan template sah; tidak ada pelanggaran CSP. Sebelum perbaikan aplikasi, Brave headless **39/39** dengan klik nyata/berkas disk untuk 10 form + lulusan institusi, semuanya PK dan terbaca ExcelJS. Percobaan Edge awal menemukan kekeliruan harness nama lulusan berulang (CDP menimpa nama); harness diganti allowAndName/GUID agar menguji setiap unduhan terpisah. Uji tautan ulang pertama mengklik ruang kosong pada bounding box gabungan teks yang membungkus di 360px; koordinat diganti rect fragmen teks, kemudian klik nyata dan assertion file yang sama lulus.
3. Tidak ada konsumsi body ganda pada kode awal: response.blob() sekali. Akan tetapi, **200 kosong diterima sebagai Blob ukuran 0 dan diteruskan ke a.click() tanpa validasi**. Probe sebelum perubahan membuktikan formTransfer mengembalikan Blob 0 byte untuk 200 kosong. Ini celah aplikasi yang terkonfirmasi dan ditutup.
4. Route normal menghasilkan Buffer valid; auth/CSRF/limiter/antrean/timeout memakai status error existing. Worker sebelumnya memiliki fallback `Buffer.from(m.result ?? [])`, sehingga pesan sukses tanpa result dapat menjadi Buffer kosong. Kini fallback tersebut ditolak; validasi output dijalankan sebelum attachment. Tidak ada bukti bahwa fallback ini terjadi pada unduhan historis.
5. **Asal persis payload kosong pada instance/profil Brave historis belum terkonfirmasi.** Riwayat tidak merekam respons fetch pendahulu, dan runtime port 3000 historis tidak tersedia saat diagnosis. Jangan menyatakan Excel/ZIP atau timer sebagai akar historis yang sudah terbukti. Perbaikan menutup jalur penyimpanan kosong dan memberi error yang dapat ditindaklanjuti bila kondisi berulang.

Rujukan: [masa hidup Blob URL (MDN)](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob), [status/penyelesaian unduhan Chromium](https://chromium.googlesource.com/chromium/src/+/HEAD/components/download/internal/common/download_item_impl.cc). Rujukan ini menjelaskan mekanisme; bukti kejadian lokal berasal dari berkas/metadata/test di atas.

#### Perubahan

- `api.js`: konsumsi arrayBuffer sekali; wajib status 200, tanpa redirect, MIME XLSX, Content-Length cocok, ukuran 22 byte?5 MiB, signature ZIP/EOCD, dan SHA-256 cocok dengan header server. Respons kosong/HTML/terpotong/korup ditolak sebelum URL unduhan dibuat. Body error non-JSON mendapat pesan fallback; 401 tetap memberi session-expired dan CSRF invalid tetap mereset token.
- `template-upload.js`: anchor nyata di DOM, tautan **Simpan ulang template**, URL bertahan selama dokumen aktif lalu dilepas pada pagehide; tanpa timer sepuluh detik. Form/periode dicek lagi setelah fetch. UI menyebut unduhan dimulai, tidak mengklaim browser telah selesai menyimpan. Tidak mengubah autosave sebelum transfer atau workflow Apply.
- Worker memvalidasi paket keluaran dengan parser existing di thread terisolasi. Guard utama menolak output kosong/tidak lengkap dengan **503 EXCEL_INVALID_OUTPUT**, tanpa attachment 200 kosong; route menambahkan `X-Template-SHA256` setelah audit berhasil. Abort diperiksa lagi sebelum send. Slot tetap hanya dilepas di finally; limiter, deadline, auth, CSRF, grant dan konfigurasi produksi tetap.
- Tes browser kini memakai klik CDP nyata ? Browser.downloadProgress completed ? baca berkas disk ? ukuran >0, PK, ExcelJS, 10 form + dua cakupan lulusan. Unduhan ulang setelah 11 detik diuji. Fault injection UI mencakup 200 kosong, HTML, ZIP terpotong, checksum salah, 401/403/429/503 dan network error; wajib alert dan nol unduhan/berkas tambahan. Tidak mengganti URL.createObjectURL/anchor.click pada jalur unduh template. Tes export dashboard lama tetap terpisah.
- ExcelJS 4.4.0 tetap memakai instalasi scratch dari sesi sebelumnya, **tanpa dependency proyek baru**. Tes UI sengaja membutuhkan pembaca independen tersebut; lokasi `.runtime/xlsx-diag/scratch/node_modules/exceljs/excel.js`. Tidak mengklaim openpyxl berjalan jika tidak tersedia.

#### Gerbang akhir

- npm test: **88 lulus, 0 gagal, 1 skip / 89 total** (openpyxl tidak tersedia); ExcelJS dan fixture Excel 16 lulus.
- Edge UI: **40/40**, desktop/360px, 13 unduhan ke disk (11 cakupan + ulang pertama/setelah 11 detik), ukuran 4.153?5.710 byte, PK dan ExcelJS. Tidak ada CSP/runtime exception. Brave UI final **40/40**, 13 unduhan disk juga lulus (4.152?5.706 byte), termasuk penolakan respons gagal dan tautan ulang setelah 11 detik.
- db:verify **20/20** dan db:check **18 kontrol lulus**, setelah UI selesai. Fingerprint akhir **24/24 domain dev identik**, termasuk IKU/approved; **68/68 berkas terlindungi identik** terhadap xlsx-before, resume-before dan Dashboard Pimpinan sesi 2 after. Berkas Brave asli tetap 0 byte dan waktu ubah tetap. Fungsi generator dan parser identik dengan cadangan awal sesi lanjutan (tambahan hanya guard keluaran terpisah). Tidak reset, mengubah .env/migration/seed/dependency, approved atau dashboard sesi 1?2.
- npm audit: **0 kerentanan** (registry berhasil setelah akses berizin; hasil sandbox yang gagal tidak dipakai).
- Runtime Node **v24.19.0**, Edge **155.0.4283.45**, Brave **155.1.97.56**. Node 22 LTS belum diuji. ExcelJS memakai scratch, Excel 16 COM tersembunyi/read-only membuka ketiga contoh; tidak setara uji manual pada profil Brave pengguna.

Log/bukti lokal: `.runtime/xlsx-diag/resume-*.log`, `resume-npm-audit.json`, `browser-*/`, `resume-comparison.json`. Artefak runtime tidak untuk commit.

#### Uji manual singkat

Tiga template kosong berkonteks dev 2026 tersedia di `.runtime/xlsx-diag/mahasiswa-aktif-template.xlsx`, `formasi-template.xlsx`, dan `mahasiswa-baru-template.xlsx`. Dibuat melalui route/worker dengan SELECT master dan auth/audit diagnostik, tanpa mutasi dev. ExcelJS membaca ketiganya; Excel 16 COM read-only juga berhasil membuka tiga sheet. Properti RepairMode tidak tersedia (null), sehingga tidak dijadikan klaim pembuktian repair. Template API/UI berperiode _test di subfolder lain bukan untuk unggah ke dev.

1. Jalankan/restart aplikasi agar kode server baru aktif, muat ulang halaman Brave, masuk sebagai pemilik form. Pilih Laporan 2026-S1; Mahasiswa Aktif akademik 20252/status aktif, Formasi tahun 2026; PMB akademik 20261/tahun masuk 2026/snapshot 2026-06-30.
2. Klik **Unduh Template**; pastikan riwayat Brave dan ukuran berkas >0. Boleh menunggu >10 detik pada dialog simpan; jika perlu gunakan **Simpan ulang template**. Buka XLSX di Excel.
3. Isi dua baris pada sheet Data, hanya kolom input; kode/nama/header/_meta tetap. Simpan sebagai .xlsx. Unggah pada form/periode yang sama, periksa preview lalu **Terapkan ke draft** (centang konfirmasi revisi bila perlu).
4. Pastikan hasil **DRAFT**, jangan Submit/Approve untuk percobaan. Pilih **Buang draft**, konfirmasi; approved sebelumnya tetap. Jangan membuang draft kerja lain. Untuk template dengan baris master lainnya tetap berisi kode/nama, preview dapat mencakup baris lainnya dengan input kosong: tinjau seluruh preview sebelum menerapkan.
5. Bila Brave masih gagal, UI sekarang harus memberi error alih-alih menyimpan 0 byte. Catat pesan UI dan status/Content-Length respons template di DevTools; jangan membagikan cookie/token.

### Diagnosis runtime nyata 13 Oktober 2026: Node watch

#### Akar masalah dan bukti

- **Regresi Part B pada penerimaan pesan worker**, khususnya `node --watch` yang dipakai `npm.cmd run dev` dalam panduan. Node mengaktifkan `WATCH_REPORT_DEPENDENCIES`; loader ESM dalam worker mengirim `{ 'watch:import': [url] }` melalui parentPort sebelum hasil workbook. `worker.once('message')` menganggap pesan pertama tersebut hasil aplikasi, lalu langsung terminate worker. `execArgv:[]` tidak menghilangkan variabel lingkungan watch.
- Dengan fallback lama `Buffer.from(m.result ?? [])`, pesan internal tanpa result menjadi Buffer 0 byte. Dengan guard terbaru, kondisi sama menjadi **503 EXCEL_INVALID_OUTPUT**. Kedua gejala direproduksi melalui login HTTP asli, sesi PostgreSQL, CSRF, otorisasi/app_user dan audit asli; tidak menyimulasikan auth/audit.
- Log sebelum perbaikan: request_id `69f48f5a-be10-4299-a213-85499f1e17cf`, `keys:["watch:import"]`, result_type undefined, result_bytes null, deadline 5.000 ms/heap 64 MiB. Bukti bisect tersimpan `.runtime/xlsx-diag/bisect-guard-watch.log`, request_id `0b5edf0c-f83d-47f6-b076-8c163510a803`. Source internal Node lokal (`internal/modules/esm/loader` dan `internal/worker`) mengonfirmasi pengiriman/forward pesan watch pada port yang sama.
- Lingkungan yang terverifikasi: Windows, path proyek berspasi, Node **v24.19.0**, PostgreSQL native port 5432, `satu_data_itpln_dev`, app_user bukan superuser/createdb/createrole, NODE_OPTIONS tidak disetel. Node 22 LTS belum diuji. Konfigurasi Excel default: active 2, queue 5, deadline 5 detik, heap 64 MiB, limiter download 30/user/menit; tidak diubah.

| Percobaan salinan terpisah di .runtime/xlsx-diag/bisect | Hasil route template Produktivitas Dosen, dev 2026 |
|---|---|
| Kode sebelum fix + entry `node server/app.js` (script npm start) | HTTP 200, 4.290 byte, PK |
| Kode sebelum fix + entry `node --watch server/app.js` (script npm run dev) | HTTP 503 EXCEL_INVALID_OUTPUT, pesan pertama watch:import |
| Watch + fallback lama dari cadangan + tanpa guard keluaran di salinan | HTTP 200, **0 byte** |
| Watch + rekonstruksi manual sebelum worker (dispatch langsung generator/parser; route/gate/DB/audit sama) | HTTP 200, 4.290 byte, PK |
| Watch + protokol worker yang diperbaiki, semua batas default sama | HTTP 200, 4.290 byte, PK |

Cadangan `.runtime/e1-b-before` **sudah mengandung worker/Part B**, bukan snapshot sebelum B yang utuh. Karena itu percobaan tanpa worker dilabeli rekonstruksi manual, bukan menjalankan snapshot historis. Salinan eksperimen tidak mengganti runtime proyek. Log/body/ringkasan lima percobaan: `bisect-*.log`, `bisect-*.body`, `bisect-results.json`; body gagal bukan workbook. Tidak ada ekstraksi ZIP di atas proyek.

Kesimpulan: jalur file Windows berspasi, heap/resourceLimits, semaphore/limiter maupun validasi paket terhadap data dev bukan penyebab kegagalan yang direproduksi. Byte dari generator yang sama lulus guard ketika hasil worker yang benar diterima. Migrasi **027–030** pada dev terpasang dengan checksum file/ledger cocok; SELECT master, session dan EXECUTE audit diizinkan bagi app_user. Audit runtime: `db-runtime-audit.json` (metadata aman).

GET data persis dengan `?periode_laporan_id=1&tahun=2026` menghasilkan **422**, karena route data hanya menerima periode laporan/akademik. UI existing mengirim kedua parameter periode yang benar dan semua GET data pada smoke mendapat 200. **Lima 503 data historis belum direproduksi**; tidak mengklaim watch sebagai penyebabnya dan tidak memperluas kontrak route data.

#### Perbaikan minimum

- Worker menandai pesan aplikasi dengan `type:'excel:result'`. Penerima memakai `on('message')`, melewati laporan dependensi Node watch, lalu hanya mengonsumsi hasil aplikasi yang valid. Result hilang/null/kosong tetap ditolak **503 EXCEL_INVALID_OUTPUT**; deadline tetap membatasi worker yang tidak pernah memberi hasil. Tidak ada fallback kosong atau eksekusi parser di main thread.
- Log JSON kegagalan memuat request_id, task, kode/pesan, bentuk pesan (key allowlist/tipe/jumlah key), ukuran hasil, deadline/heap, serta kode/pesan error atau exit worker bila ada. Tidak mencetak workbook, nilai sel, isi laporan dependensi/path impor, cookie, token, password, connection string atau parameter SQL.
- ZIP64/makro/VML aktif, batas ZIP/XML/ukuran/baris, heap, deadline, limiter, antrean, CSRF/RBAC/login-only dan audit tetap. Slot Excel hanya dilepas di finally setelah handler/transaksi/rollback selesai. Upload/apply tetap hanya DRAFT. Tidak mengubah generator/parser, dashboard, .env, migration/seed/manifest/lock atau dependency proyek.

#### Verifikasi dan batas akses

- Tes terarah worker **3/3**: result wajib ada, laporan dependensi watch sebelum hasil, generate/parse valid, deadline/abort/pemulihan tetap. Tes terarah entry **3/3**: start/dev asli masing-masing menjalankan Edge dan Brave, **11 unduhan** (10 form, lulusan prodi/institusi), klik CDP nyata, berkas disk >0/PK/ExcelJS dan metadata konteks sesuai; semua GET data/template 200. Tiga fixture ExcelJS/Excel 16 diunggah melalui route asli pada masing-masing mode dan diterapkan **DRAFT**, mutasi hanya `_test`.
- Entry regression menjalankan **argv persis script package.json**, `node server/app.js` dan `node --watch server/app.js`, tanpa ui-server.js/createApp override, bypass auth/audit atau kenaikan limiter. Ditambahkan ke `test:ui`; login memakai form nyata dan akun fixture admin hanya pada `_test`.
- Server dev `http://127.0.0.1:3000` dijalankan dengan `npm.cmd start`, kemudian `npm.cmd run dev`. Password Demo ADMIN dari .env maupun kandidat pengguna tidak cocok; akun tidak direset. Reproduksi/smoke dev memakai login **Demo BSDM** yang sah, bukan impersonasi admin. Lima template BSDM (Formasi, Tendik, Ringkasan Pegawai, Produktivitas Dosen, Pergerakan Pegawai) terunduh lewat klik UI asli pada **Edge dan Brave**; ukuran 4.106–5.672 byte, semua PK/ExcelJS, GET data 200. Bukti `real-dev-results.json`. Login/session/audit normal menulis metadata autentikasi; **domain bisnis dev hanya SELECT**, tidak upload/apply di dev.
- Tiga contoh dev baru: `.runtime/xlsx-diag/{formasi,produktivitas-dosen,pegawai-pergerakan}-template.xlsx`. Ketiganya hasil unduhan UI nyata, terbuka read-only pada **Excel desktop 16.0 build 20430**, tiga sheet; bukti `real-excel16.json`. COM tersembunyi bukan konfirmasi manual pada profil browser pengguna. File sementara password telah dihapus; tidak menyimpan password di log/dokumen.
- **Gerbang lengkap dijalankan satu kali, berurutan, semuanya exit 0:** `npm test` **89 lulus/0 gagal/1 skip (90 total)**, skip hanya openpyxl tidak tersedia; `test:ui` **43/43**, termasuk regresi entry asli start/dev pada Edge/Brave; `db:verify` **20/20**; `db:check` semua **18 kontrol lulus**; `npm audit` **0 kerentanan**, endpoint registry berhasil. ExcelJS dan fixture Excel 16 berjalan, bukan skip. Log `real-final-*.log`, `real-final-audit.json`, `real-final-gates.json`. Suite lengkap tidak diulang; tes terarah sebelum gerbang dicatat terpisah di atas.
- Fingerprint akhir **24/24 domain dev identik** (seluruh row termasuk approved/IKU) dan **68/68 berkas terlindungi identik** terhadap awal tugas, pra-gerbang, serta baseline Dashboard Pimpinan sesi 2. App entry, route data/dashboard, navbar, input, CSS global, parser/generator dan frontend transfer byte-identik dengan cadangan/hash sebelum tugas. Bukti `real-comparison.json`, `*-real-before.json`, `*-real-pre-final.json`, `*-real-after.json`. Tidak reset, tidak mengubah approved/.env/migration/seed/dependency; seluruh mutasi pengujian hanya `_test`. Hasil dashboard sesi 1–2 tetap.

Status akhir: perbaikan akar watch-mode selesai dengan bukti bisect dan regresi. **Login Demo ADMIN dev/profil Brave pengguna masih perlu konfirmasi pengguna**, karena password tidak cocok; tidak melakukan pemulihan akun tanpa instruksi. Node 22 LTS dan lima 503 GET data historis belum terverifikasi. Server diagnostik yang dijalankan agen telah dihentikan; restart server pengguna sebelum smoke manual.

#### Smoke manual wajib untuk setiap perubahan Excel berikutnya

1. Restart terminal server dengan `npm.cmd run dev` **dan** coba `npm.cmd start` pada giliran terpisah; hentikan instance lama agar port 3000 tidak dipakai dua server. Catat `node -v` dan perintah startup, muat ulang Brave/Edge lalu login melalui form.
2. Unduh dari tombol UI nyata pada seluruh 10 form + dua cakupan lulusan; cek berkas disk >0 dan bisa dibuka di Excel desktop. Minimal smoke saat diagnosis memakai Formasi/Produktivitas Dosen/Pergerakan Pegawai, laporan 2026-S1 dan tahun 2026. Tiga contoh di atas dapat dipakai untuk membandingkan.
3. Isi dua baris pada sheet Data, kolom input saja; jangan ubah kode/nama/header/_meta. Simpan XLSX di Excel asli. Pada konteks form sama, unggah → periksa semua baris preview → Terapkan ke draft → pastikan **DRAFT**, jangan Submit/Approve. Blank input pada baris master lain tetap ikut preview, sehingga tinjau seluruh daftar sebelum menerapkan.
4. Buang **hanya draft percobaan** dengan tombol Buang draft/Kembalikan yang tersedia; jangan menyentuh draft kerja lain. Approved sebelumnya harus tetap. Pengujian mutasi otomatis wajib `_test`; percobaan dev ini dilakukan pengguna secara sadar.
5. Bila gagal, simpan status respons dan request_id, lalu cari log `excel_worker_failure` dengan ID tersebut. Respons gagal harus 503/error UI, bukan unduhan 200 kosong. Jangan membagikan cookie/token/password. Smoke watcher ini wajib walaupun suite harness hijau.
