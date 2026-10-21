# Fase 5E — E1 Template Excel dan unggahan menjadi draft

Lingkup E1: **BAA / Mahasiswa Aktif per prodi** dan **BSDM / Formasi / Jumlah Tenaga Kerja**. Form lain menunggu E2. Tidak reset database, mengubah `.env`, seed, endpoint dashboard, approval/four-eyes atau data approved dev. Tidak ada dependency baru.

| Bagian | Status |
|---|---|
| Registry, template, parser dan pratinjau bersama | Selesai; API/parser 47/47, database 18/18, Edge 36/36 |
| BAA Mahasiswa Aktif (19 prodi master) | Selesai dan diuji desktop/360px |
| BSDM Formasi (50 butir sumber, bukan master unit rekaan) | Selesai dan diuji desktop/360px |
| E2, perluasan form lain | Belum dimulai |

## Keputusan desain dan library

Memakai **fflate 0.8.3 yang sudah terpasang**, lisensi MIT, tanpa dependency transitif. Tidak memasang paket `xlsx` npm lama atau ExcelJS. [Dokumentasi resmi fflate](https://github.com/101arrowz/fflate) menyebut inti sekitar 8 kB minified dan ZIP sekitar 3 kB tambahan; berkas Node CommonJS yang terpasang berukuran **92.380 byte** (ukuran berbeda dari bundle browser terkompresi). Browser tetap memakai ekspor B1 existing; parser unggahan hanya di server. Dekompresi memakai **node:zlib bawaan**, dengan `maxOutputLength` agar batas tetap berlaku ketika ukuran ZIP dipalsukan. Parser XML terbatas dibuat lokal, tanpa evaluator formula, DTD, entity eksternal atau dependency XML tambahan.

`npm audit --json` pada **9 Oktober 2026** terhadap dependency terkunci: **0 kerentanan** (info/low/moderate/high/critical semuanya 0; total 100 dependency pada laporan npm). Hasil audit adalah kondisi advisori saat pemeriksaan, bukan jaminan tidak pernah ada kerentanan dalam riwayat library. Tidak ada audit historis menyeluruh atau klaim bahwa parser lokal kebal; batas/CRC/dekompresi/XML diuji khusus. Pembaruan library tetap memerlukan audit ulang.

Riwayat yang diperiksa: [changelog resmi](https://github.com/101arrowz/fflate/blob/master/CHANGELOG.md) mencatat perbaikan pembacaan buffer berlebih pada extra field ZIP64 di **0.8.3**, serta perbaikan realokasi buffer dekompresi di 0.8.1. [Advisori maintainer](https://github.com/101arrowz/fflate/security/advisories) tidak menampilkan advisori yang dipublikasikan saat diperiksa. Ini mendukung mempertahankan versi 0.8.3 yang dikunci, bukan menyebut versi lama aman. Server tidak memakai unzip fflate untuk berkas tak dipercaya; ZIP64/ukuran tak wajar ditolak sebelum dekompresi native yang berbatas.

Registry opt-in `excel-schema.js` mencatat kode form, versi **1**, adapter entitas dan field konteks. Kolom berasal langsung dari `input-schema.js`/`employment-schema.js`; server memakai `parseCell`, zod `validate` dan `validateReferences` yang sama dengan form manual. Hash SHA-256 meliputi versi, kunci domain, konteks, kolom dan kategori. Perubahan kontrak validator harus disertai kenaikan versi registry. Versi/hash dicatat dalam `_meta`, pratinjau dan event audit.

Workbook dibuat dinamis: **Petunjuk**, **Data**, **_meta** tersembunyi. Header dan kode/nama abu-abu terkunci; hanya kolom nilai yang terbuka. Perlindungan sheet untuk mencegah salah edit, bukan pembatas keamanan: server memeriksa ulang kode, duplikat, periode, header dan hash. Nama tidak dipakai untuk mencari entitas. Template BAA memakai master prodi aktif terurut; template formasi memakai kategori sumber registry yang sama dengan form manual, tanpa membuat unit baru. Template kosong merupakan tempat isian, bukan data contoh seed.

## Endpoint dan batas unggahan

- `GET /api/forms/:form/template?periode=<id>&...`: login, role pemilik dan unit sesi; admin mengikuti kewenangan existing. BAA juga memilih `periode_akademik_id` dan `status_mhs`; formasi memilih `tahun`.
- `POST /api/forms/:form/upload?...`: multipart satu field `file`, CSRF header wajib; menghasilkan pratinjau per sel, bukan draft.
- `POST /api/forms/:form/apply`: JSON `preview_id`, `valid_only`, `confirm_overwrite`, CSRF wajib; atomik dan hanya menghasilkan **draft**.

Anonim dengan CSRF valid ditolak 401; tanpa CSRF, middleware global tetap menolak 403 sebelum membaca berkas. Role/unit lain 403. Semua respons no-store. Upload dibatasi **5 MB**, satu ekstensi `.xlsx`, tipe MIME XLSX/octet-stream, maksimal sebanyak entitas form (19/50; parser global 501 baris data), 31 kolom, 100 anggota ZIP, 10 MB per XML, 20 MB total hasil dekompresi, rasio kompresi maksimal 200:1, kedalaman XML 32 dan 100.000 node per XML. ZIP CRC/ukuran aktual, local/central directory dan data descriptor diperiksa. Ekstensi `.xlsm`/`.csv`/ganda, prefix/suffix asing, paket korup, makro, objek tertanam, external links, enkripsi, XML DTD dan ZIP bomb ditolak.

Parser mendukung angka Excel, inline/shared strings, notasi angka Indonesia sesuai parser form, sel kosong/`-` menjadi NULL dan nol tetap nol. Angka negatif ditolak pada kedua form E1; kemampuan signed mengikuti kolom registry untuk E2. Teks `=`, `+`, `-`, `@` tidak pernah dijadikan formula; pada kolom angka ditolak, pada teks (misalnya evaluasi formasi) dipertahankan sebagai teks literal. Formula asli tidak dieksekusi: nilai cache boleh dibaca, formula tanpa cache menjadi error sel. XLSX hasil sistem memakai inline strings sehingga teks literal tetap bukan formula saat diunduh.

## Pratinjau, konflik dan audit

Migration **024_form_excel.sql** menambah `form_upload_preview` dan fungsi audit metadata allowlist dengan grant minimum app_user. Tidak menambah/mengubah seed angka. Berkas XLSX mentah hanya berada di memori selama request dan tidak disimpan permanen. Pratinjau terstruktur disimpan terpisah dari tabel domain/dashboard, terikat user/form/periode, berlaku **15 menit** dan sekali pakai. Jadi “tanpa menulis” berarti tidak menulis tabel data bisnis; pratinjau serta event audit memang harus tersimpan untuk langkah kedua. Isi normalisasi dibersihkan saat diterapkan atau digantikan unggahan baru; preview kedaluwarsa tidak dapat diterapkan, namun payload lama dapat tetap ada sampai unggahan berikutnya. Pembersihan berkala fisik oleh maintenance owner belum ditambahkan di E1.

Pratinjau menampilkan nilai lama/baru, jumlah sel yang akan berubah, warning form existing dan error nomor baris/kolom/alasan. Jika ada error, hanya bisa lanjut dengan pilihan eksplisit **Terapkan hanya baris valid** atau batalkan. Adanya draft/approved mengharuskan checkbox konfirmasi. Snapshot ID/row_version/status diperiksa lagi dalam transaksi; perubahan sejak pratinjau menyebabkan konflik dan wajib unggah ulang. Submitted terkunci; approved membuat revisi baru melalui `revision`, lalu `patchDraft`. Tidak pernah memanggil submit/publish, **termasuk ketika perlu_verifikasi=FALSE**. Pembatalan tidak menyentuh draft; token preview tetap tidak diterapkan dan akan kedaluwarsa.

Event `template_download`, `template_upload`, `template_apply` mencatat aktor/request/form/periode/versi/hash/jumlah/hasil validasi; tanpa berkas atau isi sel. Penulisan draft tetap memakai audit perubahan domain existing. Tidak mengubah alur verifikasi PRP, four-eyes, override atau aturan akses.

## Cara mencoba

1. Jalankan `npm run db:migrate`, `npm run db:app-role`, lalu `npm run dev`.
2. Login **baa@demo.itpln.invalid**; password awal mengikuti **DEMO_PASSWORD_BAA** dalam `.env`, atau password yang sudah diganti. Buka http://127.0.0.1:3000/input/baa.html → **Mahasiswa Aktif**.
3. Pilih periode/status, klik **Unduh Template**. Isi kolom nilai di sheet Data; jangan ubah kunci/header/_meta. Pilih berkas lalu **Unggah & Pratinjau**. Periksa perubahan/error/warning; konfirmasi bila ada data sebelumnya, lalu **Terapkan ke draft**.
4. Nilai muncul di tabel sebagai draft, dapat diedit. Dashboard belum berubah. Submit tetap tombol terpisah; PRP/admin mereview seperti sebelumnya.
5. Ulangi dengan **bsdm@demo.itpln.invalid**, password awal **DEMO_PASSWORD_BSDM** atau password baru, di http://127.0.0.1:3000/input/bsdm.html → **Formasi / Jumlah Tenaga Kerja**. Akun/password tidak dibuat ulang dan nilainya tidak dicetak.

Di `/pegawai-formasi.html` sumber metadata yang identik tampil sekali per panel dan label akademik diambil dari master, misalnya **Genap 2025/2026**. Perubahan ini hanya presentasi lokal, bukan endpoint/data/chart halaman lain.

## E2 — daftar form dan langkah tersisa

Belum diaktifkan: mahasiswa-angkatan, mahasiswa-baru, dosen, tendik, lulusan, tracer, tracer-ringkasan, pegawai-ringkasan, kpi-capaian, kpi-input, rka-target, akreditasi, penelitian, hki, pkm, prestasi, kerjasama, produktivitas-dosen, ami, keuangan, pegawai-pergerakan.

Perluasan memakai registry yang sama, bukan salinan parser/workflow/UI. Tambahkan opt-in versi, entitas dan konteks; adapter entitas yang lebih kompleks (angkatan, cakupan institusi/prodi, indikator KPI/input dan RKA) masih harus didaftarkan serta diuji. Unit/role/validator tetap berasal registry domain. Tanggal dan kunci tambahan perlu tes per adapter sebelum diaktifkan. Seluruh E2 menunggu instruksi pengguna.

## Verifikasi akhir E1

| Perintah | Hasil nyata |
|---|---|
| npm run db:migrate | 024 diterapkan di dev/test; tanpa reset |
| npm run db:app-role | Berhasil; grant SELECT/INSERT/UPDATE preview, tidak ada DELETE atau mutasi audit langsung |
| npm test | **47/47 lulus** |
| npm run db:verify | **18/18 lulus**, termasuk kontrol seed dan hak akses/audit preview |
| npm run db:check | **18 kontrol dev lulus**, 5.080 / 1.494 / 222 / 30 (21/9) |
| npm run test:ui | **36/36 Edge lulus**, desktop/360px, tanpa exception/CSP/overflow |
| npm audit --json | **0 kerentanan** |
| git diff --check; node --check modul baru | Lulus |

Tes API mencakup kolom/kunci registry, role/CSRF, berkas salah tipe/ukuran/korup, versi/hash lama, kode asing/duplikat, angka teks/negatif/formula, NULL/nol, penerapan hanya baris valid, konfirmasi draft, submitted terkunci, revisi approved dan pengaturan perlu_verifikasi FALSE tetap menghasilkan draft. Parser diuji untuk ZIP bomb termasuk ukuran deklarasi palsu, CRC, DTD/makro/eksternal serta formula dengan/tanpa cache. Edge mengunduh template melalui tombol, mengunggah XLSX melalui input berkas browser, memeriksa pratinjau tanpa row domain baru, lalu melihat draft pada form; view dashboard tetap kosong untuk periode fixture. Seluruh pengujian mutasi menggunakan `_test`, bukan dev.

Percobaan awal Edge di sandbox gagal membuka DevTools, lalu dijalankan dengan izin proses browser. Ekspektasi UI lama “tanpa input berkas” diperbarui hanya untuk dua form E1. Harness UI memiliki limit login **30** untuk jumlah akun/skenario fixture yang bertambah; limit runtime tetap **10** dan tes rate limit lama tetap lulus. Satu pengulangan E1 terhalang limit harness 20; perbaikan hanya pada harness. Tidak mengurangi tes lama atau mengubah auth/CSRF runtime.

Fingerprint SHA-256 dan jumlah seluruh baris approved pada **21 domain lama** identik dengan snapshot lokal sebelum D3; E1 tidak memperbarui approved dev. Kontrol PMB 2.030/1.678, wirausaha 2 dan ringkasan pegawai 222/55/109/68 juga tetap. Tidak mengubah `.env`, seed atau checksum migration lama; tidak menjalankan `db:reset`.

File baru E1: `db/migrations/024_form_excel.sql`, `server/routes/form-excel.js`, `server/services/form-xlsx.js`, `server/tests/form-xlsx.test.js`, `static-web/assets/js/excel-schema.js`, `static-web/assets/js/template-upload.js`, dokumen ini. Integrasi: `server/app.js`, `api.js`, `input.js`, `app.css`, `package.json` (perintah tes saja), tes API/database/UI dan `ui-server.js`, README/AGENTS/matriks. Kosmetik hanya pada `employment-page.js`. Perubahan fase sebelumnya yang sudah ada di working tree dipertahankan.

Batas dukungan: XLSX data sederhana dari template sistem, tanpa makro/gambar/embedded object/external link; bukan editor workbook Excel umum. Nilai formula cache mungkin belum mutakhir sehingga petunjuk menyarankan nilai biasa; tidak mengklaim penghitungan formula atau uji desktop Microsoft Excel. Pembersihan fisik preview kedaluwarsa berkala masih pekerjaan maintenance terpisah; akses token sudah ditolak setelah 15 menit. **E1 selesai. Berhenti dan tunggu “Lanjut E2”.**


Alur **unggah salah ? buang draft**: gunakan **Kembalikan** pada satu baris atau **Buang semua draft pada tampilan ini**, lalu konfirmasi jumlah baris. Fitur bersama seluruh form revisi hanya menerima draft milik unit/role yang berhak; CSRF, status dan row_version diperiksa dalam transaksi. Status menjadi **discarded / Dibatalkan**, tanpa DELETE fisik, dan jejak tetap tersedia di Riwayat. Form kembali ke approved pada kunci/periode yang sama, atau kosong bila belum pernah approved; submitted/approved/rejected tidak dapat dibuang. Audit pembatalan menyimpan aktor, form, periode dan jumlah tanpa isi sel. Migration 025 menambah status/guard/audit, 026 mempertahankan SECURITY DEFINER dan search_path fungsi audit agar app_user tetap tidak memiliki mutasi audit langsung. Pembersihan dev pada 9 Oktober 2026 memakai layanan transaksi/RBAC yang sama melalui app_user: **19 draft BAA akademik 20252/status aktif dibatalkan**, tidak ada draft Formasi BSDM (0). Draft yang ditemukan berada pada laporan **2026-S2**, dengan nilai yang berbeda dari contoh 2/1; untuk periode itu baris tanpa approved kembali kosong, bukan menyalin approved Semester I diam-diam. Kontrol sebelum/sesudah tetap **18/18, 5.080 mahasiswa / 1.494 perempuan / 222 dosen / 30 tendik**; fingerprint seluruh baris approved/submitted/rejected pada 23 domain identik. Tidak mengubah .env/seed atau menghapus audit. Tes API/parser **48/48** dan database **19/19** lulus; **test:ui 36/36 Edge lulus**, tanpa overflow/CSP/exception. UI mencakup dialog batal/konfirmasi per baris, konfirmasi jumlah massal, kembali ke approved/kosong, desktop dan 360px.


## Koreksi pasca-review

12 Oktober 2026 ? E1 Bagian A/B selesai; catatan ini memperbarui klaim historis tanpa menulis ulang arsip sebelumnya. Rincian dan status per ID: [REVIEW-KEAMANAN-E1](../REVIEW-KEAMANAN-E1.md#status-perbaikan).

- Parser A tetap byte-identik, 9/9 lulus. Perbaikan ZIP/XML/entity A dipertahankan; integrasi B mengisolasi parse/generate di worker_threads dengan resourceLimits/deadline.
- Gate sebelum body: batas per-user/global, dua slot aktif/antrean 5, penolakan 429/503; timeout HTTP dan semua koneksi DB runtime dibatasi. Tidak menambah dependency.
- Migration 027 sudah terpasang di dev/test sebelum lanjutan ini dan checksum cocok; tidak diedit/diterapkan ulang. Fungsi prune sempit dipanggil timer 5 menit, payload rows/issues/snapshot dikosongkan, retensi record 7 hari, cancel server dan kuota 3 preview aktif per pengguna/form. Audit tetap append-only, app_user tidak mendapat DELETE umum.
- Preview berkas tidak menulis data domain sebelum Apply. Perubahan manual dirty dapat disimpan terlebih dahulu oleh before/save; UI menyatakan ini secara eksplisit. Apply tetap DRAFT, tanpa submit/approval otomatis.
- Normalisasi path server/browser satu fungsi. Uji Edge Back/pagehide mencakup canonical serta alias encoded; tidak mengklaim semua browser/tab lain. Error operasional tidak menjadi pesan sel/driver terbuka.
- Audit SQL memvalidasi metadata dan aktor/form. E1-06 tetap risiko diterima: SQL arbitrer sebagai app_user/GUC bukan batas autentikasi pengguna akhir; perlindungan HTTP tidak disamakan dengan RLS.
- Verifikasi: db:migrate/db:app-role lulus; db:check 18 kontrol (5.080/1.494/222/30 tetap); db:verify 19/19; npm test 65/65; test:ui 36/36; npm audit 0 kerentanan. Fingerprint 23/23 domain dev sebelum/sesudah identik. Node aktual v24.19.0, baseline Node 22 LTS belum dijalankan.
- Semua fixture mutasi hanya _test; tanpa reset/perubahan .env/penimpaan approved dev/edit migration lama. E2 dan Fase 6 tidak dimulai.
