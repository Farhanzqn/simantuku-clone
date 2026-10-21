# Review keamanan E1 — XLSX, draft, logout dan redirect

Tanggal: 12 Oktober 2026. Lingkup: BAA/Mahasiswa Aktif dan BSDM/Formasi, komponen bersama, buang draft, serta navigasi privat.

## Ringkasan (5 baris)

1. Ditemukan satu masalah **Tinggi**: atribut XML dapat memicu kerja kuadratik dan memblokir event loop server melalui unggahan kecil oleh akun pengisi yang sah.
2. Dua masalah **Sedang**: belum ada pembatasan frekuensi/konkurensi pekerjaan Excel dan belum ada pembersihan pratinjau kedaluwarsa secara berkala.
3. Pemeriksaan kode mendukung isolasi pemilik preview, CSRF, transaksi, pemeriksaan versi, draft-only dan pembatalan logis; tidak ditemukan jalur HTTP untuk melewati approval.
4. Uji parser existing **5/5 lulus**; 17 pemeriksaan tambahan dan dua kasus data descriptor lulus, tetapi probe adversarial menemukan celah yang belum dicakup tes existing.
5. Review tidak mengakses database dev maupun test, tidak menjalankan reset/migrasi/seed, dan hanya menulis dokumen ini; hasil DB/UI historis tidak dianggap verifikasi baru.

## Metode dan batas bukti

- Membaca STATUS, arsip FASE-5E, implementasi, migrasi 006/024/025/026, validator, ekspor, serta bagian tes terkait. Arsip FASE-4 tidak diperlukan karena auth/RBAC diperiksa langsung pada kode.
- Menjalankan `node --test server/tests/form-xlsx.test.js`: 5 lulus, 0 gagal. Probe tambahan dijalankan melalui stdin Node, dengan workbook dan perubahan byte **di memori**, tanpa berkas uji permanen atau koneksi database.
- Runtime eksperimen yang tersedia adalah **Node v24.19.0**, bukan baseline Node 22 pada dokumentasi. Waktu ukur bersifat lokal, bukan benchmark produksi.
- Tidak menjalankan npm test lengkap, db:verify/db:check, Edge, npm audit, uji beban paralel atau race PostgreSQL. Sebagian suite tersebut membuat fixture/migrasi atau screenshot; review ini membatasi eksperimen pada fungsi murni. Analisis locking/grant adalah bukti kode, bukan pembuktian konfigurasi database aktif.
- `file:baris` berikut merujuk versi workspace saat review. Tidak ada perbaikan yang diterapkan.

## Tabel temuan

| ID | Severity | Lokasi file:baris | Skenario konkret | Dampak | Perbaikan minimal yang disarankan | Status perbaikan (12 Oktober 2026) |
|---|---|---|---|---|---|---|
| E1-01 | **Tinggi** | `server/services/form-xlsx.js:22`, `:31`, `:50`; `server/routes/form-excel.js:27–29` | Pengisi BAA/BSDM dengan sesi dan CSRF sah mengunggah XLSX yang memiliki XML tambahan berisi atribut `a="&&&&…"`, memakai ZIP metode STORE. Regex entity mencari `;` berulang dari setiap `&`; atribut tidak menjalani pemeriksaan ampersand yang diterapkan pada teks biasa. Bahkan anggota XML yang tidak dirujuk workbook ikut diparse. | Kerja kuadratik sinkron pada event loop yang juga melayani login/dashboard. Workbook 83.830 byte dengan 80.000 ampersand diterima oleh pembaca workbook dan memakan sekitar **2.546 ms**. Batas 5 MB, rasio, kedalaman dan node tidak mencegahnya. Ukuran lebih besar/unggahan berulang dapat mengganggu layanan seluruh pengguna. | Tolak ampersand tidak valid pada atribut sebelum decoding; gunakan pemindai entity satu lintasan dengan batas panjang. Tambahkan tes regresi waktu/kompleksitas. Batas atribut dan isolasi parser dengan deadline merupakan pertahanan tambahan. | Selesai A; parser 9/9 tetap, ditambah isolasi worker B. |
| E1-02 | **Sedang** | `server/routes/form-excel.js:23–29`, `:44–54`; `server/routes/auth.js:12`; `server/app.js:104`; `server/services/db.js:22–24` | Akun pengisi yang sah mengirim banyak download/upload/apply sekaligus. Limiter hanya dipasang pada login. Setiap body upload dapat dibuffer sekitar 5 MB sebelum menunggu query konteks; download juga membuat ZIP sinkron dan event audit. | Tidak ada batas global/per-user untuk jumlah buffer atau pekerjaan Excel yang menunggu. Batas per berkas bukan batas memori proses; pool 10 koneksi tidak membatasi jumlah request yang antre. Beban CPU/heap/DB tetap dapat menumpuk setelah E1-01 diperbaiki. | Limiter per user dan global, semaphore pekerjaan Excel dengan antrean terbatas **sebelum** membaca body, serta timeout pekerjaan/query yang sesuai. Jangan mengandalkan timeout fetch browser sebagai penghentian pekerjaan server. | Selesai B1/B5; pembatas, semaphore, worker dan timeout teruji. |
| E1-02b | **Sedang** | `server/services/excel-resources.js`, `server/routes/form-excel.js` | Disconnect melepas slot melalui `res.close` sementara validasi/query/transaksi DB masih berjalan. Abort sebelumnya hanya menghentikan worker. | Pekerjaan DB dapat melebihi dua slot aktif per proses. | Slot aktif dilepas hanya di finally seluruh handler; guard abort antar query dan sebelum COMMIT; ROLLBACK tetap diizinkan. | Selesai; regresi disconnect setelah INSERT dan selama ROLLBACK lulus. |
| E1-03 | **Sedang** | `db/migrations/024_form_excel.sql:3–9`; `server/routes/form-excel.js:44–46`, `:51`, `:54`; `static-web/assets/js/template-upload.js:21`; `server/services/session-store.js:3` | Pengisi mengunggah evaluasi Formasi, membatalkan pratinjau atau meninggalkannya melewati 15 menit, lalu tidak mengunggah lagi. Pembatalan hanya membersihkan UI; timer maintenance existing membersihkan sesi, bukan preview. Unggahan berulang juga terus menambah record preview/audit. | TTL menolak **apply**, tetapi bukan kebijakan retensi. `rows` terakhir menyimpan nilai unggahan dan nilai sebelumnya tanpa batas waktu; preview expired lama mempertahankan `issues`/`snapshot`. Teks evaluasi bebas dapat berisi informasi yang semestinya tidak disimpan lama. Record dan metadata terus bertambah. | Maintenance owner/fungsi sempit untuk mengosongkan payload expired dan menghapus record preview sesuai masa retensi; jangan menghapus audit. Batalkan token di server saat pengguna membatalkan, tambahkan kuota dan indeks expiry bila diperlukan. Tidak perlu memberi DELETE umum kepada app_user. | Selesai B2/B5; maintenance, cancel, kuota dan retensi teruji. |
| E1-04 | **Rendah** | `server/services/form-xlsx.js:44–50`; `docs/arsip/FASE-5E.md:18`, `:30` | ZIP dengan central directory benar, tetapi CRC/ukuran pada local header dipalsukan, masih diterima. Extra field ZIP64 ID `0x0001` berisi ukuran besar juga diterima karena extra field dilewati, bukan diperiksa. Keduanya direproduksi di memori. | Klaim penolakan seluruh ZIP64 dan konsistensi local/central terlalu luas; format ambigu lolos kebijakan format ketat. **Tidak ditemukan bypass CRC aktual atau batas dekompresi**: parser tetap memakai ukuran/CRC central dan memeriksa hasil nyata. | Untuk non-descriptor, cocokkan CRC/ukuran local dengan central. Validasi extra field dan tolak ID ZIP64 serta versi/penanda unsupported secara eksplisit; tambahkan kasus uji. | Selesai A; tidak diubah pada lanjutan B. |
| E1-05 | **Rendah** | `server/services/form-xlsx.js:22–32`, `:50`; `server/validators/domains.js:9`; `server/routes/form-excel.js:40–46` | XML yang berisi U+0000 mentah pada teks/CDATA diterima; nilai tersebut juga lolos validator teks Formasi. Selain itu `TargetMode="Ext&#101;rnal"` lolos pemeriksaan eksternal karena regex bekerja pada XML mentah. Namespace asing dianggap sama berdasarkan local name. | Input XML tidak valid dapat mencapai parameter JSONB dan menyebabkan kegagalan request alih-alih error sel yang jelas; JSONB PostgreSQL tidak dapat merepresentasikan U+0000. Penolakan external relationship dapat dilewati secara sintaksis. **Tidak ada fetch eksternal, XXE atau eksekusi formula** pada jalur ini. | Validasi karakter XML pada teks/CDATA/atribut, namespace/root yang didukung dan nilai atribut setelah decoding. Periksa relationship secara struktural, bukan substring XML mentah; tambahkan error sel untuk karakter tidak didukung. | Selesai A; tidak diubah pada lanjutan B. |
| E1-06 | **Info** | `db/migrations/024_form_excel.sql:9–21`; `server/routes/form-excel.js:22`; `db/migrations/006_app_role.sql:12–15` | Pihak yang sudah memiliki akses SQL sebagai app_user dapat memanggil fungsi audit dengan key yang diizinkan, misalnya `result` berisi objek/nilai sel, serta memilih actor melalui GUC `app.user_id`. Allowlist hanya memeriksa nama key tingkat atas. | Jaminan metadata-only berlaku pada pemanggil HTTP yang membangun metadata sendiri, **bukan batas keamanan terhadap kompromi kredensial DB/SQL execution**. Tidak ditemukan endpoint E1 yang meneruskan metadata audit bebas dari klien. Hak SELECT/UPDATE preview juga bersifat seluruh tabel, tanpa RLS. | Dokumentasikan batas kepercayaan ini. Tambahkan tipe/panjang/struktur metadata dan pemeriksaan actor/form pada fungsi bila ingin jaminan sampai lapisan DB; jangan menganggap UUID atau SECURITY DEFINER mengautentikasi pengguna akhir. | Risiko diterima; metadata SQL diperketat, kompromi kredensial DB di luar batas HTTP. |
| E1-07 | **Info** | `static-web/assets/js/api.js:19–21`; `server/app.js:67–77`; `server/tests/ui.test.js:410–415` | URL sah `/pegawai%2dformasi.html` dinormalisasi server menjadi halaman privat, tetapi regex frontend terhadap `location.pathname` tidak mengenalinya. Probe membuktikan `clientPrivate=false`; penutupan DOM pada `pagehide` tidak dijalankan untuk alias ini. | Perlindungan tambahan terhadap salinan BFCache tidak mencakup semua alias URL yang dilindungi server. Reload `pageshow` dan no-store tetap ada. **Belum dibuktikan ada tampilan data sesaat pada Back di browser**, sehingga ini celah cakupan/hardening, bukan klaim bypass akses. | Samakan normalisasi path privat browser/server atau gunakan penanda privat dari server. Tambahkan tes Back untuk path terenkode sebelum menjanjikan tidak ada tampilan cache pada semua varian URL. | Selesai B3; normalisasi bersama dan Back encoded lulus di Edge. |

Tidak ditemukan temuan Kritis dalam lingkup dan metode ini. Info di atas tidak disamakan dengan exploit HTTP yang telah berhasil.

## Bukti eksperimen parser

### E1-01: beban CPU tanpa ZIP bomb klasik

Probe membuat workbook minimal valid, menambahkan `xl/unused.xml` dengan isi `<r a="` + `'&'.repeat(N)` + `"/>`, lalu mengemasnya memakai ZIP `level:0` dan memanggil `readWorkbook`. Metode STORE membuat rasio 1:1; CRC/ukuran sah. Untuk request nyata, anggota yang sama dapat ditambahkan ke template sistem tanpa mengubah Data/_meta; parsing terjadi sebelum pemeriksaan metadata.

| Ampersand N | Ukuran workbook | Waktu readWorkbook | Hasil |
|---:|---:|---:|---|
| 20.000 | 23.830 byte | 163 ms | Diterima |
| 40.000 | 43.830 byte | 646 ms | Diterima |
| 80.000 | 83.830 byte | 2.546 ms | Diterima |

Penggandaan panjang mendekati empat kali waktu. Eksperimen sengaja berhenti pada 80.000 karakter; tidak mengirim serangan ke server berjalan atau mencoba ukuran maksimum. Tidak mengklaim angka waktu yang sama pada produksi.

### Pemeriksaan tambahan yang berhasil

- 17 kelompok pemeriksaan: empat nama traversal/nested ZIP ditolak; 101 anggota ditolak; nama duplikat ditolak; penggunaan ulang offset local/overlap ditolak; CRC aktual salah ditolak; kedalaman 33 dan node 100.001 ditolak; DTD/XXE dan entity tak dikenal ditolak; indeks `A1048576`, `XFD1`, `AF1` ditolak; tujuh string injection aman saat ekspor/ditolak pada angka; dan safeNext menolak URL berbahaya.
- Dua probe descriptor: descriptor **12 byte** dan **16 byte dengan signature** diterima bila CRC/ukuran benar, ditolak setelah CRC descriptor diubah.
- Tes existing juga menolak deklarasi ukuran dekompresi palsu, data tambahan setelah ZIP, rasio ekstrem, ekstensi ganda/CSV/XLSM, serta formula tanpa cache. Hasil suite 5/5 tidak mencakup E1-01.
- Satu percobaan awal probe tambahan salah mengharapkan `AE1` ditolak; AE adalah kolom ke-31 yang memang diizinkan. Ekspektasi eksperimen diperbaiki menjadi `AF1` (kolom ke-32); tidak ada file tes proyek yang diubah.
- Probe penerimaan yang tidak sesuai kebijakan: CRC/ukuran local palsu, extra ZIP64, raw NUL/CDATA NUL, namespace asing, serta External yang di-encode entity. Tidak menggunakan ini untuk menulis draft/DB.

## Pemeriksaan teknis per batas keamanan

### ZIP dan alokasi memori

`form-xlsx.js:39–49` memeriksa panjang berkas, central directory, jumlah anggota, ukuran deklarasi, rasio dan range **sebelum inflate**. `:50` memakai `inflateRawSync` dengan `maxOutputLength=min(10 MiB, ukuran_deklarasi+1)`; panjang hasil, jumlah input terpakai dan CRC central diperiksa. Pemalsuan ukuran menjadi kecil tidak membuka inflate tak terbatas. Batas total deklarasi 20 MiB juga efektif terhadap output ZIP yang diterima karena hasil tiap anggota harus sama dengan deklarasi.

Range berurutan wajib mulai dari offset 0 dan tidak overlap; gap hanya descriptor tervalidasi. Nama duplikat, slash awal, backslash dan `..` ditolak. Anggota hanya `.xml`/`.rels`, harus valid UTF-8 dan diparse XML; nested ZIP biner tidak didekompresi rekursif, tidak ada ekstraksi filesystem sehingga tidak ada penulisan traversal. EOCD ZIP64/sentinel ukuran besar tertahan batas format/ukuran; **extra field ZIP64 biasa belum ditolak** (E1-04). CRC adalah integritas format, bukan autentikasi: penyerang boleh menghitung ulang CRC atas isi yang dibuatnya sendiri.

Batas ini **bukan batas heap 20 MiB**. Buffer multipart, hasil inflate, string UTF-16, tree/atribut XML, array sel/shared strings dan JSON preview membutuhkan alokasi tambahan. Parser memparse setiap XML pada pemeriksaan ZIP lalu memparse XML workbook terpilih lagi (`:50–54`). Jumlah/panjang atribut tidak dibatasi tersendiri; validasi node dilakukan setelah atribut dibuat (`:31–32`). Hal ini dan pemrosesan sinkron memperkuat kebutuhan E1-01/E1-02.

### XML, sel dan shared strings

Tidak ada resolver jaringan/filesystem, DTD/entity declaration ditolak, entity numerik/basic tidak diekspansi rekursif (`:21–22`). Billion laughs berbasis DTD tidak berjalan. Depth/node membatasi tree, tetapi bukan jumlah atribut atau biaya regex. Karakter kontrol raw/CDATA dan namespace belum diperiksa setara XML standar (E1-05).

Shared strings diparse di server dengan batas XML/node umum, tetapi tidak memiliki kuota khusus jumlah/panjang; tidak ada alokasi array berdasarkan atribut `count`/`uniqueCount`. Indeks shared string harus integer yang benar-benar ada (`:53`, `:59`). Baris maksimum 502 termasuk header dan kolom indeks 0–30 diperiksa **sebelum** penempatan pada sparse array (`:55–63`). Karena itu indeks Excel ekstrem yang diperiksa tidak memicu array jutaan elemen. Panjang sel teks bisnis baru dibatasi Zod menjadi 2.000 setelah parsing (`server/validators/domains.js:9`); sel pada sheet lain/anggota tak dipakai tetap menghabiskan pekerjaan parser terlebih dahulu.

### Alur injection sampai titik keluar

1. `form-xlsx.js:57–61`: formula tidak dievaluasi; cache dibaca, formula tanpa `<v>` menjadi error. Cache dapat dibuat sendiri atau basi, sama seperti nilai manual; bukan sumber data yang diotentikasi.
2. `form-excel.js:40–41` dan `input-schema.js:32–40`: numeric Excel melewati validasi domain; teks angka Indonesia diparse, kosong/`-` menjadi NULL; nol tetap nol. Teks `=1+1`, `+SUM`, `-SUM`, `@SUM`, tab+`=` dan CR+`@` ditolak pada kolom angka. Pada kolom teks menjadi literal; whitespace tepi di-trim, bukan dieksekusi. Tanda `-` tunggal adalah pengecualian yang memang bermakna NULL.
3. `services/data.js:26–52`: insert/update memakai parameter query; identifier berasal registry, bukan isi XLSX. Formasi memiliki teks evaluasi; BAA E1 hanya angka.
4. `template-upload.js:15–17`, `ui.js:2`, `:29` dan `input.js:55`: nilai ditempatkan dengan `textContent`/properti input, bukan interpolasi `innerHTML`. Preview/dashboard tidak menjadikan `<img ...>` sebagai HTML.
5. `static-web/assets/js/excel.js:2–6` serta `form-xlsx.js:7`, `:17`: string diekspor sebagai **inlineStr**, XML escaped; tidak pernah dibuat node `<f>`. Probe tujuh string menghasilkan tujuh inlineStr tanpa formula/tag HTML aktif. Tidak ada jalur ekspor CSV dalam lingkup ini.
6. `ui.js:26` memeriksa kembali endpoint asal sebelum ekspor; kegagalan sesi mencegah unduhan. Nilai terfilter yang sudah ditampilkan diekspor, bukan field privat tambahan.

### RBAC, preview dan transaksi

- Route Excel memakai requireLogin, registry E1, role pemilik/admin dan unit dari domain master (`form-excel.js:12–18`; `services/data.js:13–17`). Admin memang dapat mengisi domain; ini kewenangan existing, bukan celah lintas unit.
- CSRF global berjalan sebelum router/raw multipart (`app.js:43`, `:58`; `security.js:8–12`). Anonim dengan token CSRF valid mendapat 401; tanpa token POST dapat lebih dulu mendapat 403. Tidak ada klaim semua POST anonim selalu 401.
- Apply menerima UUID dan dua boolean saja. SELECT preview dibatasi **id + user_id + domain** serta `FOR UPDATE` (`form-excel.js:50–51`). Admin pun tidak otomatis dapat menggunakan preview pengguna lain. Periode berasal payload server yang telah dicocokkan saat upload, bukan body apply baru.
- Dua apply pada token sama akan antre pada lock preview; setelah transaksi pertama commit, yang berikutnya melihat status applied dan gagal. TTL diperiksa setelah memperoleh lock. Ini kesimpulan dari kode/semantik transaksi PostgreSQL, **belum diuji paralel pada DB di sesi ini**.
- Advisory lock per grain dan SELECT current `FOR UPDATE`, ditambah snapshot ID/row_version/status mencegah penerapan preview usang (`:21`, `:52`). Tidak ada data baru saat upload: hanya reads domain, record preview dan event audit (`:40–46`).
- Apply meminta konfirmasi bila sudah ada record, menghalangi submitted, membuat revision untuk approved, dan memakai patchDraft/createDraft (`:52–54`). PatchDraft memeriksa status/version; createDraft mengecek referensi/grain. Tidak memanggil submit/publish atau membaca perlu_verifikasi untuk auto-approval.
- Semua perubahan, konsumsi token dan audit apply berada dalam BEGIN/COMMIT/ROLLBACK (`services/db.js:27–37`, `services/data.js:6–11`). Kegagalan di tengah batch rollback. Tes existing memeriksa pengulangan apply berurutan dan submitted/revision, tetapi belum menguji dua apply bersamaan, expiry, maupun preview milik akun kedua dengan role sama (`server/tests/api.test.js:514–548`).

### Buang draft

Route sebenarnya adalah **POST `/api/data/:domain/discard-drafts`**, bukan handler pada forms.js (`server/routes/data.js:11`, `:19–20`). Body ketat berisi confirmed=true, maksimum 500 id/version. Layanan memeriksa role/unit, duplikat, mengunci row secara urut, dan mengharuskan status draft/version sesuai sebelum UPDATE discarded (`services/data.js:55–63`). Tidak ada DELETE dan rejected/submitted/approved ditolak.

Trigger mengulangi pemeriksaan aktor aktif, role/unit dan perubahan hanya status/version/waktu; discarded terkunci (`025_discard_drafts.sql:24–38`). Audit pembatalan hanya id/status/periode/form/jumlah; nilai sel dibuang dari event tersebut (`:97–100`). Migration 026 memulihkan SECURITY DEFINER/search_path; hak mutasi langsung audit tidak diberikan. Satu bulk menghasilkan event per row dengan jumlah batch, bukan satu event total; jangan menjumlahkan `jumlah_baris` seluruh event sebagai jumlah draft unik.

Forms GET mengecualikan discarded dari data kerja dan menyediakan jejaknya terpisah (`forms.js:22–25`); UI memuat approved pada grain sama atau mengosongkan baris tanpa approved setelah pembatalan (`input.js:71–88`). Dialog menyebut jumlah, lalu membawa id/version; Riwayat tetap tersedia (`input.js:68–70`). Tes API existing meliputi rollback batch, cross-unit, versi, perubahan dashboard yang tetap nihil, serta rejected yang ditolak (`api.test.js:490–512`). Dibaca, tidak dijalankan ulang.

### Buffering, timeout, DB dan audit

- `express.raw` membatasi multipart menjadi 5 MiB + 16 KiB; batas berkas diperiksa lagi setelah envelope (`form-excel.js:27`; `form-xlsx.js:66–68`). Implementasi terpasang `node_modules/raw-body/index.js:162–169` menolak Content-Length melebihi batas sebelum pengumpulan body, dan `:257–268` menghentikan buffering saat chunk melewati batas. Bukan buffering body sebesar apa pun lalu baru ditolak. HTTP content-encoding dapat di-inflate oleh body-parser, tetapi batas tetap pada stream hasilnya.
- Ada timeout fetch browser 30 detik untuk transfer dan 15 detik request biasa (`api.js:12`, `:25`). Tidak ada deadline parser sinkron, limiter Excel, query/lock timeout eksplisit pada pool, atau konfigurasi timeout aplikasi pada listen. Timeout HTTP bawaan Node/proxy tidak diverifikasi dan tidak menghentikan regex sinkron yang memblokir event loop. Pool hanya membatasi koneksi DB, bukan semua request/body.
- Migration 024 memberi SELECT/INSERT/UPDATE preview, tanpa DELETE. Migration 006 mencabut DDL/privilege audit langsung; app-role.js hanya memasang password role dengan quote_literal dan tidak mencetak nilainya. Konfigurasi role aktif tidak diuji ke DB.
- Preview berisi nilai terstandardisasi, nilai `before`, error, snapshot dan context; tidak menyimpan ZIP mentah. Form E1 tidak memerlukan identitas individu, tetapi kolom teks bebas tetap dapat diisi pengguna dengan informasi sensitif. TTL tidak menghapus payload (E1-03).
- Metadata event Excel dibangun server dengan field/count tetap (`form-excel.js:22`, `:25`, `:46`, `:54`, `:56`). **Audit perubahan domain biasa tetap menyimpan isi row**, sebagaimana diakui arsip (`025:95–114`); larangan isi sel pada event template/discard tidak berarti tidak ada nilai bisnis sama sekali dalam audit.
- SECURITY DEFINER audit memakai search_path tetap, PUBLIC execute dicabut, dan INSERT target dikualifikasi public (`024:10–21`). Allowlist key tidak memvalidasi isi nested/tipe/actor secara independen (E1-06).

### Template, redirect, cache, log dan error

- `_meta`/SHA-256 bukan signature rahasia: pengguna bisa mengubahnya. Tidak menambah hak karena context/header/kode/master/duplikat/validator diverifikasi lagi server (`form-excel.js:11`, `:30–41`). Hash meliputi registry/keys/columns/categories; implementasi validator tidak di-hash otomatis sehingga bump versi harus disiplin. Kunci sheet terkunci adalah bantuan pengguna, bukan batas keamanan.
- Filename unduhan dibuat dari kode form allowlist + suffix tetap (`:13`, `:25`); bukan filename unggahan atau teks query. Tidak ditemukan injeksi Content-Disposition. MIME/nama tidak dipercaya sendirian: byte ZIP/XML diperiksa. Tidak mengklaim deteksi universal semua polyglot; variasi format yang diterima dijelaskan pada temuan.
- `navigation.js:1–2` menggunakan allowlist halaman, origin tetap, decode pathname, penolakan `//`, backslash, whitespace/control dan fallback `/index.html`. Probe menolak URL luar, slash/backslash encoded, double-encoded yang bukan halaman allowlist, dan CRLF. Query yang mengandung teks URL luar tidak dijadikan target navigasi tersendiri. Tidak ditemukan open redirect pada jalur yang diperiksa.
- `app.js:67–96` menormalisasi halaman privat sebelum static; anonim navigasi HTML GET/HEAD diarahkan ke login dengan next aman, request JSON/API tetap 401. API/HTML privat dan download normal mendapat no-store (`:39`, `:77`, `:93`); aset publik tetap memakai perilaku static. Error parsing JSON yang terjadi sebelum middleware no-store (`:36`) bukan respons data privat dan tidak dijamin memiliki header tersebut.
- Logout menghancurkan sesi PG, menghapus cookie, membersihkan cache user/CSRF, lalu `location.replace('/index.html')` (`auth.js:23–24`, `api.js:8`, `:28–30`, `navbar.js:47`). Halaman privat canonical disembunyikan saat pagehide dan BFCache pageshow memuat ulang; alias encoded masih gap E1-07. Client yang masih aktif dapat menampilkan pesan sesi berakhir (`ui.js:4`). Data DOM pada tab privat lain yang tidak dinavigasi **tidak otomatis terhapus** hanya karena logout di tab pertama; tidak ada mekanisme broadcast lintas tab di kode yang diperiksa.
- `app.js:94–97` menyembunyikan stack/path/pesan error internal, mengirim pesan terkontrol dan request_id. `form-xlsx.js:65` membungkus exception parser; log database menampilkan kode/nama error saja (`services/db.js:40–43`). Tidak ada log raw XLSX/password pada jalur yang diperiksa. `form-excel.js:41` memasukkan `e.message` ke issue untuk error non-validasi saat validateReferences; query E1 di fungsi itu memakai identifier tetap dan parameter ID, tetapi sebaiknya membedakan HttpError dari kegagalan operasional agar pesan driver tidak diteruskan. Tidak ditemukan reproduksi kebocoran isi berkas/stack dari jalur ini.

## Klaim FASE-5E yang terverifikasi

Terfalsifikasi/terbatasnya klaim tertentu dipisahkan pada bagian berikut; “terverifikasi kode” tidak berarti telah dites kembali terhadap DB/browser aktif.

| Klaim arsip | Bukti pemeriksaan |
|---|---|
| Dua form opt-in, registry bersama, E2 belum aktif | `excel-schema.js:1–5`, `form-excel.js:11–18`; kode form lain tidak terdaftar Excel. |
| fflate 0.8.3 MIT, tidak menambah parser dependency, inflate native berbatas | package terpasang `node_modules/fflate/package.json`, berkas `lib/node.cjs` 92.380 byte; `form-xlsx.js:1–2`, `:50`. Tidak ada dependency runtime transitif di package fflate yang diperiksa. |
| Template dinamis, tiga sheet, hidden meta, header/kunci terkunci, master bukan nama bebas | `form-excel.js:18`, `:23–24`, `:33–41`; `form-xlsx.js:14–17`; tes parser roundtrip lulus. Jumlah master dev 19 tidak dibaca ulang dari DB. |
| Versi/hash/context diverifikasi; server menggunakan validator form yang sama | `form-excel.js:11`, `:31–41`; `input-schema.js:32–40`; `validators/domains.js:27–40`. |
| Batas ukuran/anggota/ratio, dekompresi palsu dibatasi, indeks sel terbatas | `form-xlsx.js:39–50`, `:55–56`, `:66–68`; tes existing dan probe di atas. Berlaku pada byte/struktur tertentu, bukan budget CPU/heap global. |
| Tidak mengeksekusi formula; cache saja; NULL berbeda dari nol; XLSX literal | `form-xlsx.js:57–61`, `form-excel.js:40`, `excel.js:2–6`; probe injection dan tes existing. |
| Login/role/unit/CSRF, preview terikat pengguna/form/periode | `form-excel.js:12–18`, `:32`, `:51`; `services/data.js:13–22`; `app.js:43`. |
| TTL 15 menit, status sekali pakai, snapshot konflik, confirm/valid_only, apply hanya draft | `024:3–6`; `form-excel.js:50–54`; shared revision/patch/create. Guard race dibaca, bukan uji concurrent baru. |
| Raw file tidak disimpan permanen; preview memang ditulis DB | Tidak ada operasi file di handler/parser; `form-excel.js:44–46`, `024:2–6`. |
| Event template metadata-only dan audit domain tetap berjalan | `form-excel.js:22`, `:25`, `:46`, `:54`; `025:95–114`, dengan batas SQL pada E1-06. |
| UI pratinjau/perbandingan, valid-only eksplisit, konfirmasi, cancel, feedback | `template-upload.js:12–23`; output menggunakan el/textContent. Tidak mengulang uji desktop/360px. |
| Buang draft discarded, tanpa DELETE, status/role/version dijaga, riwayat tersedia | `data.js:55–63`, `routes/data.js:19–20`, `025:24–38`, `:97–100`, `026:3–4`, `forms.js:22–25`, `input.js:68–88`. |
| Dashboard tidak membaca preview/draft | `routes/dashboard.js:9`, `routes/employment.js:6` menggunakan view dashboard; jalur apply tidak publish, discard tidak menyentuh approved. Predicate view approved diperiksa pada migrasi terkait. |
| Kosmetik sumber/periode lokal, tidak mengubah endpoint | `static-web/assets/js/employment-page.js:5` deduplikasi dokumen/tabel dan label periode dari master. Ini presentasi, bukan bukti kontrol keamanan. |
| Tes mutasi diarahkan _test | `server/tests/api.test.js:14–15`, `ui.test.js:14–15`, `db/tests/database.test.js:14–19` memeriksa nama _test terpisah sebelum migrate/seed. |

## Klaim yang tidak bisa diverifikasi / tidak sesuai kode

- **ZIP64 sepenuhnya ditolak sebelum dekompresi** (`arsip/FASE-5E.md:18`): tidak sesuai untuk extra field ZIP64 yang diuji; ukuran besar/sentinel masih dibatasi. **Local/central diperiksa** (`:30`) benar sebagian, bukan pemeriksaan CRC/ukuran lokal menyeluruh (E1-04).
- **Paket korup/external links selalu ditolak** (`:30`, `:79`): terlalu luas. Parser menerima ampersand atribut mentah, kontrol raw/CDATA, namespace asing dan External yang memakai entity. Tidak ada fetch/eksekusi, tetapi kebijakan format tidak sepenuhnya ditegakkan (E1-01/E1-05).
- **Batas XML menjamin pekerjaan terbatas secara aman**: angka batas memang ada, tetapi tidak membatasi kompleksitas CPU atau heap total. Atribut besar/banyak diproses sebelum pemeriksaan node; ini batas keamanan tambahan yang belum ada, bukan bukti ZIP bomb output tak terbatas.
- **Isi preview dibersihkan** (`:36`): `rows` dibersihkan saat apply/unggah berikutnya; `issues` tidak pernah dikosongkan oleh kedua jalur, snapshot hanya dikosongkan saat apply. TTL sendiri tidak membersihkan apa pun. Dokumen telah mengakui belum ada maintenance; review menilai dampaknya di E1-03.
- **Pratinjau tanpa menulis data bisnis**: benar pada handler upload. Namun tombol UI memanggil `before()` → `save()` untuk menyimpan perubahan manual yang masih dirty sebelum download/upload/apply (`template-upload.js:10`, `input.js:113`). Jadi klaim “klik unggah tidak menulis draft sama sekali” hanya benar bila form bersih; nilai dari berkas tetap tidak diterapkan sebelum Apply.
- **Semua teks mentah persis dipertahankan**: teks di-trim oleh parser form/Zod; tanda `-` tunggal menjadi NULL, sesuai aturan khusus. Ini bukan formula execution. Nilai cached formula tidak dihitung/diotentikasi server.
- **Semua event audit tanpa isi sel**: hanya event `form_excel`/discard. Audit draft biasa menyimpan row; arsip sudah menyebut pembeda ini. Allowlist SQL sendiri hanya pada key tingkat atas (E1-06).
- **Seluruh respons no-store**: benar untuk jalur normal setelah middleware sesi, bukan error JSON/body yang lebih awal. **Back pasti tidak menampilkan data pada semua browser/alias/tab** belum dapat dipastikan: mekanisme canonical ada, tetapi E1-07 serta tab lain perlu pengujian khusus.
- **Angka tes historis 47/48, DB 18/19, UI 36; audit 0 kerentanan; fingerprint 21/23 domain; pembersihan 19 draft dev dan angka kontrol** (`:58–82`): tidak diverifikasi ulang dan tidak dibuktikan hanya dengan membaca kode. Review tidak menjalankan DB/Edge/npm audit atau membandingkan snapshot historis. Riwayat advisory/changelog library pada tanggal lama juga tidak diaudit ulang.
- Suite API existing membuktikan skenario secara tertulis, tetapi belum memiliki pengujian paralel apply yang eksplisit atau tes expiry/IDOR preview antar dua akun satu role. Jangan menyamakan tes double apply berurutan dengan uji race. Ukuran/proteksi template terhadap Microsoft Excel desktop juga belum diuji ulang.

## Urutan perbaikan yang disarankan

1. **E1-01 sebelum perluasan E2**: perbaiki decoder atribut secara linear dan tambah regresi adversarial. Jangan hanya memperbesar timeout atau mengandalkan rasio ZIP.
2. **E1-02**: batasi request/buffer/pekerjaan per pengguna dan global sebelum body buffering; tetapkan deadline parser dan query. Ukur heap/CPU dengan beban terkontrol di lingkungan test.
3. **E1-03**: tetapkan retensi, invalidasi cancel, dan maintenance preview terjadwal dengan hak minimum; pertahankan audit append-only.
4. **E1-04/E1-05**: selaraskan pemeriksaan ZIP/XML dengan format yang benar-benar didukung, tolak karakter invalid sebelum parameter DB, serta perbaiki klaim dokumentasi yang terlalu luas.
5. Tambahkan tes DB _test untuk dua apply bersamaan, preview akun lain dengan role sama, expiry, konflik upload/edit/discard; tes browser Back canonical dan encoded serta lintas tab. E1-07 memerlukan bukti browser sebelum disebut kebocoran nyata.
6. **E1-06**: perjelas threat model app_user dan perketat metadata audit bila memerlukan pertahanan di lapisan DB. Hindari perubahan otorisasi/approval hanya untuk menutup celah parser.

Review awal selesai. Pernyataan di atas menggambarkan kondisi sebelum perbaikan; status implementasi terkini berikut menggantikannya.

## Status perbaikan

### Audit awal lanjutan Bagian B — 12 Oktober 2026

- Git tidak tersedia pada PATH/lokasi instalasi umum; inventaris memakai waktu ubah, bukan klaim diff terhadap commit Bagian A.
- Bagian A (00:24–00:27 WIB): `server/services/form-xml.js`, `form-xlsx.js`, `server/tests/form-xlsx.test.js`, `fixtures/excel-e1.xlsx`. Tidak diubah pada lanjutan ini.
- Integrasi B (00:28–00:30 WIB): `server/services/excel-worker.js`, `excel-resources.js`, `session-store.js`, `server/routes/form-excel.js`, `server/app.js`, `server/tests/api.test.js`, `db/migrations/027_excel_security.sql`, `static-web/assets/js/{api,navigation,template-upload}.js`. Dokumen review masih mencatat kondisi sebelum perbaikan.
- Migration 027 sudah terpasang: dev 12 Oktober 00:30:09 WIB; test 00:30:52 WIB. Checksum kedua ledger dan file sama: `02caa059d89fd6562ca45c229b089ffa8e642fefc21d583e04440f3df1b7f04c`. Isinya lengkap: prune SECURITY DEFINER terbatas (payload expired/konsumsi dikosongkan, retensi 7 hari, batch 1.000, audit tidak disentuh), status cancel, indeks, validasi metadata/aktor audit. Tidak diterapkan ulang atau diedit; koreksi SQL jika diperlukan harus melalui 028.
- `npm test` awal: **52/52 lulus**, termasuk parser Bagian A **9/9**. Suite memeriksa database `_test` terpisah sebelum fixture/migrasi/seed; migration 027 dilewati ledger.

| Butir | Status audit awal | Sisa pekerjaan |
|---|---|---|
| B1 | Sebagian | Gate per-user/global, antrean sebelum body, worker resourceLimits/deadline dan timeout transaksi Excel ada; lengkapi timeout query di luar transaksi dan bukti pembatas/responsivitas. |
| B2 | Sebagian | Migration, timer maintenance, cancel dan rotasi 3 preview per user/form ada; verifikasi isolasi, kuota, expiry, cleanup serta audit tetap utuh. |
| B3 | Sebagian | Browser sudah decode/normalisasi; server masih fungsi terpisah. Satukan dan tambah tes Back alias encoded. |
| B4 | Sebagian | HttpError dibedakan, SQL audit diperketat, catatan simpan manual tersedia; tambah bukti kegagalan operasional/metadata dan selaraskan pesan preview. |
| B5 | Belum | Tambahkan race apply, pemilik berbeda role sama, expiry/prune/cancel, kuota, 429/503, deadline dan responsivitas. |

Audit selesai sebelum perubahan kode lanjutan. Hasil akhir berikut menggantikan status awal, tanpa mengulang implementasi Bagian A.

### Hasil akhir Bagian B

| Butir | Status akhir | Implementasi dan bukti |
|---|---|---|
| B1 | Selesai | Per pengguna/menit: unggah 6, unduh 30, apply/cancel 12; global 120 per proses. Dua slot aktif + antrean 5, tunggu maksimal 10 detik, gate sebelum raw/JSON body. Worker parse/generate memakai resourceLimits (old generation 64 MiB, young 8 MiB, stack 4 MiB), deadline 5 detik dan terminate. HTTP produksi: request 30 detik, header 10 detik, socket idle 30 detik. Semua koneksi app_user kini statement_timeout 10 detik, lock_timeout 3 detik, idle transaction 15 detik; owner maintenance tidak diubah. |
| B2 | Selesai | 027 dipertahankan utuh; tidak perlu 028. Maintenance PgSessionStore setiap 5 menit memanggil fungsi prune (maksimal 1.000 per batch), membersihkan rows/issues/snapshot expired atau consumed dan menghapus preview berusia >7 hari; tanpa DELETE umum app_user atau penghapusan audit. Cancel terikat pemilik/form dan CSRF. Maksimal 3 preview aktif per pengguna/form; unggahan berikutnya menginvalidasi yang tertua, serialisasi advisory lock. |
| B3 | Selesai | Server dan browser memakai fungsi normalizedPagePath yang sama. Edge membuktikan pagehide hidden dan Back setelah logout redirect login tanpa DOM privat, baik canonical maupun /pegawai%2dformasi.html dan /%69nput/baa.html. |
| B4 | Selesai | Error referensi bisnis tetap HttpError; fault driver menghasilkan 503 terkontrol tanpa pesan driver/preview baru. Audit SQL menolak tipe/key/nested/panjang/aktor/form invalid. Catatan penyimpanan perubahan manual tetap tampil; pesan preview kini tegas bahwa isi berkas belum diterapkan ke draft. |
| B5 | Selesai | Tambahan suite excel-security: dua apply serentak menghasilkan tepat 200/409 dan satu event form_excel; akun lain role/unit sama tidak bisa apply/cancel; expiry/prune/retensi menjaga audit; cancel; kuota unggahan paralel; 429 per-user/global dan 503 antrean/deadline sebelum body dibaca; health responsif; worker deadline/pemulihan; timeout SQL dan kebocoran driver. |

### Verifikasi akhir dan batas bukti

- db:migrate: lulus, 027 dilewati karena checksum/ledger cocok; tidak ada migration baru. db:app-role: lulus, tetap app_user tanpa fallback owner.
- db:check: **18 kontrol lulus**, 5.080 mahasiswa / 1.494 perempuan / 222 dosen / 30 tendik tetap. db:verify: **19/19**.
- npm test: **65/65**, termasuk parser A **9/9** dan suite tambahan B **13/13** (angka mengikuti penghitung Node termasuk parent test). Suite DB berjalan berurutan agar maintenance test tidak bersamaan dengan fixture suite API.
- npm run test:ui: **36/36**, desktop/360px, no CSP/runtime exceptions, termasuk empat varian Back canonical/encoded serta dua form Excel. Percobaan sandbox pertama gagal membuka Edge DevTools; dijalankan ulang dengan akses proses yang disetujui dan lulus, tanpa mengubah assertion.
- npm audit: **0 kerentanan** dari registry. Percobaan sandbox awal gagal mengakses endpoint; percobaan berizin dengan cache lokal .runtime berhasil. Tidak ada dependency baru atau perubahan package-lock.json.
- Tes baru sempat gagal sekali pada hitungan audit race: 20 event (19 domain + 1 form_excel) terhitung bersama. Assertion diperbaiki sesuai jenis event, menjadi tepat satu template_apply pada tabel form_excel; pemeriksaan 19 draft dan respons 200/409 tetap dipertahankan. Tidak ada kegagalan berulang >3 pada hal sama.
- Fingerprint SHA-256 seluruh row terurut ID pada **23/23 domain dev identik** sebelum/sesudah; bukti hash saja di .runtime/e1-b-before/domain-fingerprints{,-after}.json. Migration 027 dan empat berkas A (dua parser, tes, fixture) diverifikasi byte-identik. Cadangan file sebelum perubahan global ada di .runtime/e1-b-before; tidak untuk commit.
- Runtime verifikasi tersedia **Node v24.19.0**, bukan baseline Node 22 LTS; belum mengklaim eksekusi di Node 22. Browser yang diuji Edge; tidak mengklaim bukti semua browser atau penghapusan DOM tab lain yang tetap terbuka.
- **E1-06 risiko diterima (threat model):** otorisasi pengguna akhir berada pada HTTP/session/RBAC dan query pemilik. Kompromi kredensial app_user/kemampuan menjalankan SQL arbitrer dapat mengganti GUC app.user_id dan mengakses preview lintas pemilik karena tanpa RLS. Validasi metadata SQL membatasi format dan aktor terdaftar, bukan autentikasi pengguna akhir. Tidak ditemukan endpoint HTTP yang menerima metadata audit bebas. Pembatas/semaphore berlaku per proses; tidak mengklaim kuota lintas instance. ResourceLimits worker membatasi heap V8, bukan seluruh RSS/native Buffer.
- Tidak ada reset, perubahan .env, edit migration/seed lama, penimpaan approved dev, atau penghapusan audit. Mutasi fixture hanya pada _test. E2/Fase 6 tidak dimulai.

### E1-02b - tindak lanjut reviewer independen, 12 Oktober 2026

- **Selesai.** Slot aktif sekarang dimiliki wrapper handler: parsing body, otorisasi unit, worker, validasi DB, transaksi dan audit penolakan tercakup dalam satu `try/finally`. `res.close`/`req.aborted` hanya memberi sinyal abort; hanya antrean yang belum aktif boleh langsung dibuang. Pelepasan slot idempotent dan listener dibersihkan.
- Query otorisasi unit dipindah ke dalam slot. Guard memeriksa abort sebelum/sesudah query konteks, validasi referensi, serta seluruh query transaksi/shared draft helpers, termasuk BEGIN dan sebelum COMMIT. Abort saat menunggu koneksi tidak melanjutkan BEGIN. ROLLBACK memakai koneksi yang sama tanpa guard abort, dan slot ditahan sampai rollback serta pengembalian koneksi selesai. Audit penolakan dilewati ketika abort.
- Worker menerima sinyal yang sama dan dihentikan. Query SQL yang sudah dikirim ditunggu hingga selesai/error/timeout yang telah dikonfigurasi, lalu transaksi di-rollback; slot tetap dihitung selama menunggu. Tidak mengklaim pembatalan SQL seketika. COMMIT yang sudah dikirim bersifat atomik dan tidak bisa dibatalkan secara retroaktif; guard mencegah pengiriman COMMIT bila abort sudah diketahui.
- Regresi `excel-security.test.js`: disconnect setelah INSERT nyata pada database `_test`, tahan hasil query dan ROLLBACK dengan barrier, buktikan request berikutnya belum masuk DB, nol draft/audit apply parsial, preview tetap aktif, retry sukses. Konfigurasi satu slot menguji invariant secara ketat; default produksi tetap dua. Jalur sukses, error handler, JSON rusak dan disconnect body juga membuktikan pemulihan slot; tes worker mencakup deadline dan abort.
- Prune 2.105 record: payload tersisa 1.105 -> 105 -> 0; setelah umur retensi dipenuhi, record tersisa 1.105 -> 105 -> 0. Setiap tahap memanggil maintenance runtime satu kali (maksimal 1.000 per batch); audit identik. Fungsi/periode maintenance dan migration 027 tidak diubah; pada runtime batch berikutnya diproses pada tick maintenance berikutnya.
- Race cancel/apply pada preview sama, diuji dengan dua urutan peluncuran: tepat satu 200 dan satu 409, status akhir sesuai pemenang, tepat satu event audit, tetap 19 draft unik tanpa duplikasi.
- Tes UI lama memiliki race assertion: tabel selesai dimuat sebelum permintaan riwayat selesai. Ditambahkan penantian kondisi riwayat `Dibatalkan` sebelum assertion yang sama; kode UI tidak berubah.
- Verifikasi akhir sesi ini: `npm test` **68/68** (suite keamanan **16/16**, parser **9/9**); `db:check` **18 kontrol**; `npm audit` **0 kerentanan**. `npm run test:ui` **36/36** dan `db:verify` **19/19**. Fingerprint seluruh row terurut ID pada **23/23 domain dev identik** selama pemeriksaan akhir, termasuk approved; bukti hash saja di `.runtime/e1-02b/dev-{before,after}.json` (bukan untuk commit).
- Audit awal sandbox tidak dapat mengakses registry; percobaan berizin berhasil. Edge awal sandbox tidak membuka DevTools; percobaan berizin pertama menemukan race assertion di atas. Runtime **Node v24.19.0**; belum menguji Node 22 LTS.
- Tidak ada reset DB, perubahan .env, migration/seed lama, dependency baru, atau perluasan E2/Fase 6. Seluruh mutasi tes memakai database terpisah berakhiran `_test`.
