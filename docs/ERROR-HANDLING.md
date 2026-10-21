# Penanganan error aplikasi

## Umpan balik form dan pratinjau — 14 Oktober 2026

Tahap audit selesai dan dilaporkan sebelum kode. Baseline: .runtime/form-feedback/backup; fingerprint SELECT seluruh 25 domain dev serta 72 berkas terlindungi diambil sebelum edit. Mutasi pengujian hanya _test.

| Temuan sebelum kode | Bukti / keputusan |
|---|---|
| 25 formulir, 10 halaman unit, renderer bersama | input.js / formDefinitions; KPI nilai tanggal/teks, IKU, angkatan, akreditasi, AMI dan keuangan ikut jalur yang sama |
| Status polos dan pesan Submit berdasar metadata policy | statusText/submit existing; pengganti harus memakai status baris balasan bulk-submit |
| Label persen duplikat | inspect: mahasiswa/dosen, tendik; label S3 persen juga diperjelas tanpa mengubah rumus |
| Parser angka/tanggal bersama | parseCell + metadata input-schema dipakai server dan browser; amiErrors/financeErrors bersama; validator server tidak diubah |
| Perempuan > total adalah warning | warnings dipakai quality() server; tetap warning dekat sel, bukan larangan baru |
| 422 fields dibuang klien | transport kini mempertahankan field path aman; pesan driver/validator mentah tidak ditampilkan |
| Baris Excel invalid tidak masuk rows | upload mengembalikan issues per row/column; tampilkan baris masalah dan nilai tidak tersedia, jangan mengarang sel |
| Apply parsial diizinkan eksplisit | server valid_only; tombol diblokir sampai opsi dipilih; hanya baris valid menjadi DRAFT |
| Mobile sebelumnya vertikal | kini tabel semantik, scroll horizontal lokal/keyboard; header dan jumlah kolom diperiksa |

Tahap implementasi awal: form-feedback.js menyediakan lima lencana, versi sekunder, status card, toast, satu modal native dengan role/aria/fokus/Escape serta reduced motion. Submit memakai balasan server dan memeriksa struktur/status sebelum sukses; Apply wajib balasan draft. Timeout/jaringan/5xx/respons invalid memakai pesan hasil tak pasti existing, konflik meminta muat ulang. Kunci proses dan pemulihan CSRF existing dipertahankan. Sel terisi memakai parseCell existing; NULL tanpa centang; warning kualitas terpisah dari aria-invalid. Detail 422 tanpa indeks baris tidak cukup mengidentifikasi satu baris dalam batch: tandai field terkait pada batch yang dikirim, jangan mengklaim lokasi pasti. Validasi referensi/master/relasi DB tetap otoritatif di server; centang berarti format isian valid, bukan persetujuan server.

Cakupan: seluruh 25 form registry pada BAA/PPA/BSDM/BPKA/PRP/PJM/LPPM/BKU/BKK/kerjasama. Excel mengikuti 10 form existing (termasuk dua cakupan lulusan); form lain tidak memperoleh unggahan baru, sesuai batas kontrak/API dan penundaan E2. Form administrasi akun/kebijakan bukan form input domain, tetap memakai lapisan error existing.

### Matriks cakupan aktual

| Form | Unit/kode existing | Status/dialog/validasi | Excel |
|---|---|---|---|
| keuangan | BKU | Tercakup | Tidak tersedia pada kontrak existing |
| produktivitas-dosen | BSDM | Tercakup | Pratinjau existing tercakup |
| kerjasama | KERJASAMA | Tercakup | Pratinjau existing tercakup |
| prestasi | BKM | Tercakup | Pratinjau existing tercakup |
| penelitian | LPPM | Tercakup | Tidak tersedia pada kontrak existing |
| hki | LPPM | Tercakup | Tidak tersedia pada kontrak existing |
| pkm | LPPM | Tercakup | Tidak tersedia pada kontrak existing |
| akreditasi | PJM | Tercakup | Tidak tersedia pada kontrak existing |
| ami | PJM | Tercakup | Tidak tersedia pada kontrak existing |
| mahasiswa-aktif | BAA | Tercakup | Pratinjau existing tercakup |
| mahasiswa-angkatan | BAA | Tercakup | Tidak tersedia pada kontrak existing |
| lulusan | BAA | Tercakup | Pratinjau existing tercakup |
| mahasiswa-baru | PPA | Tercakup | Pratinjau existing tercakup |
| pmb-peminat | PPA | Tercakup | Tidak tersedia pada kontrak existing |
| dosen | BSDM | Tercakup | Tidak tersedia pada kontrak existing |
| tendik | BSDM | Tercakup | Pratinjau existing tercakup |
| pegawai-ringkasan | BSDM | Tercakup | Pratinjau existing tercakup |
| tracer | BPKA | Tercakup | Tidak tersedia pada kontrak existing |
| iku-capaian | PRP | Tercakup | Tidak tersedia pada kontrak existing |
| kpi-capaian | PRP | Tercakup | Tidak tersedia pada kontrak existing |
| rka-target | PRP | Tercakup | Tidak tersedia pada kontrak existing |
| tracer-ringkasan | BPKA | Tercakup | Tidak tersedia pada kontrak existing |
| kpi-input | PRP | Tercakup | Tidak tersedia pada kontrak existing |
| formasi | BSDM | Tercakup | Pratinjau existing tercakup |
| pegawai-pergerakan | BSDM | Tercakup | Pratinjau existing tercakup |

Tidak ada form input domain yang dikecualikan dari renderer visual. Lima belas form tanpa Excel tidak ditambahi fitur unggah/API baru; ini batas existing, bukan form yang terlewat. Checkbox/selektor konteks mempertahankan master/server sebagai otoritas. AMI/keuangan memetakan hasil fungsi bersama ke kolom yang disebut, bukan menyalin aturan kategorinya. Responden wajib pada tracer institusi memakai pemeriksaan existing, sedangkan NULL yang diizinkan tetap kosong.

Tahap verifikasi terarah: Edge **8 lulus/0 gagal/1 skip disengaja** (runner terarah mengecualikan entry Excel; suite lengkap akan menjalankannya). Seluruh 25 form × 1440/360 tanpa overflow halaman; dialog/fokus/Escape/reduced motion, validasi/NULL, policy server berubah setelah metadata dimuat, klik ganda, fault timeout/network/503/invalid/409/422, serta Excel campuran 18 valid + 1 bermasalah lulus. BAA kontras minimum 7,65:1. Bukti ui-target-4.log dan form-coverage.json. Percobaan awal memperbaiki abs-position teks pembaca layar yang lolos clipping tabel dan perangkap Tab modal; fixture periode kini menunggu konteks hasil load, bukan mengasumsikan kosong (approved sebelumnya memang disalin existing).

Gerbang npm test awal: **124 lulus/0 gagal/1 skip** (openpyxl). Suite UI lengkap awal **63/63** (termasuk pembandingan kanvas dan entry Edge/Brave) lulus. Setelah tinjauan akhir pemetaan spesifik AMI/keuangan, Responden wajib existing dan struktur pratinjau, gerbang final dimulai ulang berurutan: npm test **125 lulus/0 gagal/1 skip** (openpyxl), bukti release-test.log. Suite UI final, DB verify/check dan audit telah selesai; hasil final di bawah.


### Gerbang final umpan balik — berurutan, hasil aktual

| Urutan | Perintah | Hasil | Bukti di .runtime/form-feedback/ |
|---|---|---|---|
| 1 | npm test | **125 lulus / 0 gagal / 1 skip**, 126 total; skip openpyxl | release-test.log |
| 2 | npm run test:ui | **64/64**, tanpa skip; Edge/Brave, seluruh regresi error dan Excel existing | release-ui.log |
| 3 | npm run db:verify | **21/21**, database _test | release-db-verify.log |
| 4 | npm run db:check | **18 kontrol lulus**, child PGDATABASE = PGTEST_DATABASE, guard terpisah _test | release-db-check.log |
| 5 | npm audit --json | **0 kerentanan** info/low/moderate/high/critical, pemeriksaan terkini | release-audit.json |

UI final membuktikan seluruh 25 form × 1440/360 tanpa overflow halaman, scroll lokal, jumlah/header kolom cocok dan tidak kosong, lencana tidak membungkus, versi sekunder dan NULL tanpa centang. Kontrol BAA serta tombol modal yang diukur >=48px. Modal berpusat horizontal/vertikal pada viewport, role/aria/label/deskripsi, Tab/Escape/fokus balik dan reduced motion lulus. Submit nyata mengikuti submitted/auto-approved meski policy server berubah sesudah metadata dimuat; klik ganda menghasilkan satu write dan satu dialog. Fault timeout/jaringan/503/respons invalid/409/422 tidak pernah menghasilkan sukses. 422 **nyata** untuk teks 2001 karakter menghasilkan pesan batas server 2000, request_id dan fokus kolom Status sumber; AMI/keuangan memfokuskan kolom yang ditolak fungsi bersama, Responden tracer wajib menandai NULL yang tidak diizinkan. Error yang diperbaiki hilang; NULL yang diizinkan tetap NULL. Excel campuran **18 valid + 1 bermasalah** menampilkan baris invalid yang dihilangkan server dari rows, lokasi sel/error, serta Apply disabled sampai valid-only dipilih; penerapan nyata menghasilkan 18 DRAFT, tanpa submit/approval. Simpan/Buang draft memakai toast; riwayat menerima fokus. Regresi lapisan error, CSRF terbatas, autosave berhenti, sesi/draf, unduhan disk Edge/Brave dan entry start/dev tetap lulus.

BAA kontras teks minimum **7,65:1**; token lencana memakai warna status DESAIN. Screenshot final dialog/pratinjau dua lebar disalin ke feedback-{dialog,preview}-{1440,360}.png. Perbandingan **empat halaman × dua lebar (8 pasangan)** membuktikan dimensi container/bitmap kanvas identik dengan cadangan sebelum edit (canvas-comparison.json). Browser di sandbox gagal membuka DevTools; pengulangan browser/registry memakai akses proses yang diotorisasi. Ini batas lingkungan, bukan pengurangan kontrol aplikasi.

Fingerprint akhir: **25/25 domain dev** (seluruh baris, termasuk approved) dan **72/72 berkas terlindungi identik** terhadap sebelum edit; bukti dev-{before,after}.json dan protected-{before,after}.json. Dev hanya SELECT, mutasi seluruh gerbang pada _test. Tidak mengubah validator server, kontrak API, skema, migration/seed, .env, dependency atau approved dev. Inventaris SHA-256 sebelum/sesudah (changes.json), bukan Git diff karena Git tidak tersedia: **12 berkas**, enam produksi (empat diubah/dua baru), tiga tes dan tiga docs; tidak ada file lama dihapus. Cadangan tetap dipertahankan. Runtime **Node v24.19.0; Node 22 belum diuji**. Fase/tugas lain tidak dimulai.


**Aturan terkini:** tindak lanjut CSRF di bagian terakhir memperbolehkan satu replay write khusus **HTTP 403 + kode tepat CSRF_INVALID**, sesudah token baru dan `/auth/me` HTTP 200. Larangan retry write untuk kegagalan sementara/hasil tak pasti tetap berlaku. Audit serta angka gerbang implementasi awal di bawah adalah bukti historis sebelum pengecualian terbatas ini.

## Tahap 1 — audit sebelum kode (14 Oktober 2026)

Audit ini ditulis sebelum perubahan aplikasi. STATUS dan DESAIN telah dibaca. Cadangan `static-web`, `server`, STATUS dan DESAIN: `.runtime/error-handling/backup/`. Fingerprint awal: **25 domain dev, 72 berkas terlindungi** (`.env`, manifest/lock, seluruh migration/seed/script DB). Dev hanya SELECT; fixture dan simulasi kedaluwarsa hanya pada DB terpisah `_test`.

### Reproduksi server asli

Perintah `.runtime/error-handling/audit.mjs` benar-benar meluncurkan **npm start** dan **npm run dev**, runtime `app_user`, timeout/limiter/semaphore bawaan, tanpa mengubah `.env`. Bukti aman: `audit.json`, `audit-{start,dev}.log`; tidak menyimpan cookie/token/password/berkas unggahan. Peluncuran dalam sandbox gagal mencapai startup; pengulangan dengan akses proses berhasil. Node **v24.19.0**; Node 22 belum diuji.

| Pengukuran | npm start | npm run dev | Kesimpulan terbukti |
|---|---|---|---|
| Login pertama, sesi/token normal | 200 / 1218 ms | 200 / 46 ms | Tidak gagal pertama |
| Template worker pertama / kedua | 200 / 484 / 619 ms | 200 / 99 / 90 ms | Keduanya 4621 byte; tidak ada cold-worker failure |
| Preview pertama / kedua | 200 / 916 / 346 ms | 200 / 111 / 106 ms | Tidak gagal pertama; tidak perlu apply untuk audit |
| Token sebelum login dipakai setelah login merotasi sesi | 403 CSRF_INVALID / 10 ms | 403 CSRF_INVALID / 13 ms | Refresh token + **percobaan manual** berikutnya 200 (321 / 104 ms) |
| Idle singkat 1,5 detik | /auth/me 200 | /auth/me 200 | Tidak membuktikan idle panjang aman |
| Expire sesi `_test` secara terkendali, token lama | 403 CSRF_INVALID / 19 ms | 403 CSRF_INVALID / 26 ms | Setelah refresh menjadi 401 LOGIN_REQUIRED, bukan sukses; CSRF berjalan sebelum autentikasi route |
| Login salah ke-10 sesudah 1 login sukses | 429 / Retry-After 888 dtk | 429 / Retry-After 892 dtk | Limit 10/15 menit bekerja; percobaan langsung berikutnya tetap 429 |
| SQL pg_sleep(11), pool aplikasi `_test` | 57014 / 10091 ms | Pool sama | statement_timeout 10 detik terukur; query berikutnya pulih |
| Aset api.js | 200 / no-store | 200 / no-store | Respons baru tersedia; tidak ada service worker aplikasi |

**Batas kesimpulan:** kondisi token lama setelah rotasi sesi membuktikan pola ditolak pertama lalu sukses setelah refresh. Hal ini bisa terjadi pada tab lama; hubungan dengan insiden asli pengguna **belum terbukti** karena tidak ada rekaman permintaan gagal asli. Sesi habis, limiter, SQL timeout dan worker dingin tidak boleh disebut penyebab insiden itu. Idle 8 jam alami, antrean di beban nyata, cache tab/browser lama dan artefak insiden asli belum direproduksi. Batas worker 5 detik, antrean 10 detik, statement 10 detik, lock 3 detik telah diperiksa pada `excel-resources.js`/`db.js`; kontrol ini tetap.

### Inventaris klien sebelum perubahan

Pencarian `fetch(` / `XMLHttpRequest` seluruh `static-web/assets/js`: **dua fetch, keduanya di api.js; tidak ada XHR**. Berikut seluruh modul pemanggil jaringan langsung/tidak langsung; file schema/model/render murni tidak melakukan I/O.

| Modul / halaman | Penanganan existing dan gap |
|---|---|
| api.js (request, formTransfer) | JSON langsung; network/timeout mentah, tanpa retry/Retry-After/request_id; CSRF_INVALID hanya mengosongkan token; promise getUser gagal disimpan terus. Transfer sudah memvalidasi MIME/length/ZIP/checksum; wajib dipertahankan. |
| auth.js (login, ganti password) | finally memulihkan tombol; pesan khusus 429 membuang waktu tunggu; check() memakai pesan generik. |
| navbar.js (me/logout) | me gagal ditelan; logout memakai pesan generik, tombol pulih. |
| input.js (10 unit, seluruh form registry) | Autosave serial; dirty dipertahankan pada gagal; error e.message; reload tabel punya retry; submit/discard/simpan belum menonaktifkan seluruh tindakan terkait. Tidak ada aksi manual error yang konsisten. |
| template-upload.js (template/upload/apply/cancel) | busy/finally ada, apply tidak tampak disabled selama request; error e.message; transfer tidak retry; keberhasilan kosong JSON belum ditolak. |
| verification.js (tunggal/massal) | Massal terkunci dan menyebut hasil tak pasti; tunggal busy internal tetapi tombol tidak disabled; queue/diff error hanya teks. |
| admin-ui.js (users/reset/policy/audit) | finally untuk writes; load error teks tanpa tindakan; form bisa mengubah konteks saat pending. |
| ui.js (render/error/export) | Pesan generik 401/403/lain, tidak membedakan kelas; link login existing; gagal ekspor membuang detail aman. |
| home.js | Promise.allSettled per kartu; pesan error generik dan tombol muat ulang existing. |
| pages.js | Dashboard akademik/KPI/kualitas/ruang-unit/placeholder memakai render/error; gagal quality-flags KPI ditelan menjadi array kosong. |
| filter-bar.js | Master load dilempar ke boot halaman, tidak ada retry sendiri. |
| accreditation-page.js | render/error dan retry boot dengan reload. |
| achievements-page.js, ami-page.js, cooperation-page.js, finance-page.js, productivity-page.js, ratio-page.js, research-page.js, tendik-page.js | render/error bersama; boot error panel generik, sebagian tanpa retry. |
| employment-page.js | render/error; kegagalan catatan kualitas diberi pesan generik sendiri. |
| iku.js | Pesan e.message dan Muat ulang data; tidak ada request_id/tindakan per kelas. |

Server `app.js`: UUID/header sudah ada; error API JSON terpusat tetapi tanpa log request selesai yang aman; 404 HTML memakai final handler Express; error HTML terautentikasi tampil JSON. Redirect anonim HTML privat memakai safeNext harus dipertahankan. Handler limiter login tidak memuat request_id pada body; klien dapat memakai header tanpa mengubah kontrak.

## Keputusan implementasi

- Satu transport klien untuk JSON dan transfer, pesan lokal Indonesia, request_id dari header/body yang dibatasi. Tidak meneruskan detail server/driver.
- GET/HEAD saja retry sementara maksimum dua kali; backoff dan Retry-After (detik/tanggal), indikator terlihat. Pengecualian write yang kini disetujui: **satu** pengulangan sesudah **403 CSRF_INVALID** dari middleware, token baru, serta `/auth/me` 200. Kegagalan timeout/network/429/5xx/respons invalid tetap tidak mengulang write. Sesi habis memakai alur login existing.
- Timeout/network/write 5xx/response invalid berarti hasil mungkin sudah tersimpan; pengguna memeriksa riwayat sebelum ulang. Draf tetap di DOM; masuk ulang melalui tab baru agar tidak membuang input. Tidak menyimpan draft/token/password ke localStorage.
- Halaman error statis 400/401/403/404/413/429/500/503, CSS/JS lokal, serta maintenance mandiri untuk proxy. HTML memakai status asli/no-store; API mempertahankan JSON dan kode existing. Log aman berisi UUID, metode, kelompok route tetap, status/kode, durasi dan admitted/aborted; tanpa URL/query/body/user/token/stack/SQL.
- Tidak mengubah auth/RBAC/CSRF middleware, limiter/semaphore, kontrak API, DB, dependency, migration/seed, `.env` atau approved dev. Ukuran kanvas tetap.

## Implementasi

- `api.js` memakai satu transport untuk request JSON dan multipart/biner. `error-policy.js` mengklasifikasikan status/koneksi/timeout/response; pesan tidak memakai `error.message` dari server. Request ID dibatasi karakter/panjang, berasal dari header (termasuk limiter login existing) atau envelope JSON.
- GET/HEAD maksimum **3 request total** (awal + 2 retry), backoff 400/800 ms, hanya network/502/503/504/429. Timeout/cancel, 400/401/403 non-CSRF/404/409/413/422/500, JSON invalid dan template corrupt tidak retry. Retry-After detik/tanggal menjadi batas tunggu minimum. Bila tunggu >10 detik, langsung tampil error dengan tombol manual menunggu sampai waktunya; tidak mempertahankan spinner selama menit-menit limiter login. Indikator `Mencoba lagi… n/2` muncul selama backoff dan dibersihkan di finally.
- POST/PUT/PATCH/DELETE hanya boleh diputar ulang otomatis **satu kali per permintaan** untuk pasangan **status 403 dan kode tepat CSRF_INVALID**: middleware existing menolak sebelum route/limiter/preview berjalan. Token baru wajib diperoleh dan `/auth/me` harus **HTTP 200** terlebih dahulu. Request kedua memakai method/path/body yang sama; JSON diserialisasi sekali dan multipart mempertahankan objek File yang sama. CSRF kedua berhenti dengan pesan; 403 hak akses, timeout/network/429/5xx/respons invalid tidak mengulang write. Endpoint token dan pemeriksaan sesi tidak dapat memicu refresh rekursif. GET/HEAD tetap dalam batas existing; fokus/visibilitas tab menghapus cache token/user dan token awal dideduplikasi.
- `error-ui.js` menyediakan pesan/tindakan/request_id dan pemberitahuan global bagi seluruh pemanggil, termasuk error master/menu/catatan tambahan yang sebelumnya ditelan. `ui.js` memakai renderer yang sama pada panel dan ekspor. Login/password, seluruh form input registry, transfer/cancel/apply, verifikasi tunggal/massal, admin, IKU dan navbar memakai callback manual yang memulihkan proses UI. Konflik meminta muat ulang; aksi massal gagal meminta refresh antrean/periksa riwayat sebelum konfirmasi baru.
- Autosave yang gagal berhenti sampai **Simpan manual**; perubahan sel berikutnya tidak mengulang write yang hasilnya belum pasti. Dirty/value tetap di DOM, beforeunload existing tetap. Tindakan input/filter/tab/transfer dikunci selama proses dan dipulihkan; edit sel selama save tetap memakai stamp existing. Login ulang membuka tab baru dengan safeNext existing agar draft tab asal tetap ada. Tidak menaruh form, password/token/session dalam storage browser.
- Validasi biner existing (status, MIME, length, ZIP/EOCD dan checksum sebelum Blob) dipertahankan; JSON 200 kosong/HTML/struktur salah/204 tidak menjadi sukses. HEAD memang boleh tanpa body.
- `server/middleware/error-response.js` mempertahankan envelope/kode/pesan/fields API existing. Navigasi HTML menerima status/halaman error khusus; anonim privat tetap redirect login yang sama untuk URL valid maupun tidak dikenal. Halaman/aset error dan maintenance publik dilayani tanpa I/O sesi supaya tetap terbaca saat DB sesi gagal; guard semua modul/API privat tetap. Seluruh error no-store dan helmet/CSP existing tetap.
- `request-log.js`: satu UUID buatan server, header `X-Request-ID`, log `http_result` berisi metode allowlist, kelompok route tetap, status/kode, duration_ms, excel_admitted dan aborted. Semua error/disconnect serta sukses auth/Excel dicatat; tidak ada path/query/body/cookie/nama/email/stack/SQL/driver-message. Logger worker hanya status/kode/ukuran/batas resource; kontrol worker/semaphore **tidak berubah**. API limiter login tetap tanpa request_id pada body sesuai kontrak; header dipakai klien.
- Halaman `errors/{400,401,403,404,413,429,500,503}.html` memakai logo asli, shell/navbar/footer/token yang sama, container, fokus keyboard, tombol >=48px, request_id aman dan bantuan PRP. Tidak ada inline script. CSS status tambahan tidak mengubah selector/ukuran Chart.js.

## Operasional IT — persiapan 6D, tanpa deploy

`static-web/maintenance.html` adalah **satu berkas mandiri**, dengan CSS inline dan logo PNG asli tertanam sebagai data URI; tanpa JavaScript, fetch, font/CDN atau aset Express. Dapat dibuka sebagai file lokal ketika Express tidak berjalan. Teksnya tidak mengklaim tindakan sebelumnya gagal/berhasil: periksa riwayat setelah layanan pulih. Berkas tidak mengarang nomor/email bantuan yang belum diberikan; kanal kontak personal PRP perlu ditetapkan PRP/IT.

1. IT menyalin **hanya** maintenance.html ke lokasi statis milik proxy/web server, di luar upstream Express. Jangan memasang root repository sebagai document root. Distribusi ini belum dilakukan pada sesi ini.
2. Atur fallback upstream **502/503/504** (koneksi ditolak, timeout atau pemeliharaan) menjadi isi berkas tersebut dengan status **503**, `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`; boleh menambah `Retry-After` sesuai estimasi IT. Jangan memakai redirect 200 atau retry upstream otomatis untuk metode tulis.
3. Kontrak API tetap: batasi fallback HTML pada navigasi yang menerima HTML. Request `/api` tetap JSON/status existing dari aplikasi; bila upstream mati, proxy memberi 502/503/504 dengan JSON generik, tanpa detail driver/host/path. Klien juga memahami non-JSON gateway dan kegagalan total jaringan.
4. CSP untuk maintenance: script tidak diperlukan (`script-src 'none'`); izinkan CSS inline berkas ini (`style-src 'unsafe-inline'`) dan gambar data URI (`img-src data:`); batasi frame/base sesuai kebijakan IT. Ini konfigurasi proxy khusus berkas maintenance, **bukan** perubahan helmet/CSP aplikasi.
5. Simpan ID korelasi di log proxy dan header `X-Request-ID`. Halaman mandiri tidak mengeksekusi script pembaca header; ID dapat dilihat pada pesan klien/catatan proxy. Jangan menyisipkan pesan upstream/URL mentah ke HTML. Halaman aplikasi menampilkan UUID servernya secara normal.
6. Uji di staging bersama IT: hentikan upstream **staging** saja, coba URL navigasi dan `/api`, periksa status/no-store/Retry-After, buka 360px, lalu pulihkan upstream. Jangan menghentikan PostgreSQL/dev bersama atau menguji pemadaman produksi dari checkout ini.

## Verifikasi aktual

- Komponen/HTTP pada gerbang terakhir: **18/18** (13 kasus error baru + 5 existing). Termasuk seluruh kelas, retry/count write, CSRF/token endpoint tanpa rekursi, respons invalid, safeNext, log tanpa sentinel sensitif, HTML/JSON, fault injection DB sesi (HTML 503/API 500 existing/aset error tetap 200), serta error sesudah header menutup body parsial tanpa reporter stack Express.
- Edge terarah kedua: **8 lulus, 0 gagal, 1 skip disengaja** (suite Excel existing dikecualikan pada runner terarah; akan dijalankan gerbang lengkap). Delapan status × 1440/360 tanpa overflow, tombol >=48px/logo/ID/CSP, 12 kelas pesan/tindakan, retry terlihat, write/login manual, cookie hasil login baru pada tab lama memicu satu 403 + satu refresh tanpa replay, sesi expired hanya satu POST dan input tetap, serta maintenance dibuka via file:// tanpa Express. Kegagalan awal harness berasal sintaks top-level await pada Runtime.evaluate; diperbaiki menjadi async IIFE. Bukti `ui-target-2.log`, screenshot `.runtime/phase3/error-*`, `maintenance-*`, `session-expired-draft-360.png`.
- Perbandingan baseline browser terarah: empat halaman (beranda/mahasiswa/dosen/PMB) × dua lebar, seluruh dimensi container dan bitmap kanvas identik dengan salinan sebelum edit. Rincian `.runtime/error-handling/canvas-comparison.json`. Opsi `ERROR_BASELINE_DIR` hanya dipakai ketika cadangan tersedia; suite normal tidak bergantung pada `.runtime`.
- Gerbang UI lengkap pertama: **53 lulus/3 gagal** (termasuk parent). Navbar menganggap maintenance mandiri wajib memuat navbar.js; assertion diperbaiki dengan pengecualian eksplisit maintenance yang diuji mandiri. Alur admin menemukan indikator retry tersembunyi dibuat pada request biasa dan mengambil selector status tes; renderer diperbaiki agar completion request tanpa retry tidak membuat indikator. Assertion keberhasilan admin/DB tetap dipertahankan. Seluruh kasus error baru lulus pada gerbang pertama tersebut.

### Gerbang implementasi awal, berurutan (sebelum tindak lanjut CSRF)

| Urutan | Perintah / cakupan | Hasil | Bukti lokal |
|---|---|---|---|
| 1 | `npm test` | **116 lulus, 0 gagal, 1 skip** (openpyxl); 117 total | `gate-test-release.log` |
| 2 | `npm run test:ui` | **56/56**, 0 skip; regresi existing + delapan kasus error baru | `gate-ui-final.log` |
| 3 | `npm run db:verify` | **21/21** pada `_test` | `gate-db-verify.log` |
| 4 | `npm run db:check`, PGDATABASE child process = PGTEST_DATABASE | **18 kontrol lulus**, NULL/sumber lulus | `gate-db-check.log`, `check-test.mjs` |
| 5 | `npm audit --json` | **0** info/low/moderate/high/critical | `gate-audit-final.json` |

Seluruh bukti tabel berada di `.runtime/error-handling/`. Test mutasi hanya memakai `_test`; check-test.mjs memverifikasi nama berakhiran `_test` dan berbeda dari dev sebelum meluncurkan perintah, tanpa mengedit `.env`. UI dan pengulangan registry memerlukan akses di luar sandbox. Percobaan audit sandbox gagal endpoint; angka nol berasal **pengulangan berhasil saat ini**, bukan audit historis.

UI akhir membuktikan kedelapan status pada 1440/360, request_id/logo/tombol >=48px/no overflow/CSP, klasifikasi/tindakan yang aman, retry GET maksimum dua kali dengan indikator, POST login sekali hingga klik manual, CSRF tab lama refresh tanpa replay, **offline DevTools nyata**, autosave gagal tidak diulang meski sel diedit lagi, tombol pulih, Simpan manual berhasil, dan sesi expired mempertahankan draft dengan link safeNext di tab baru. Entry `npm start`/`npm run dev` existing dengan limiter asli tetap lulus: masing-masing Edge/Brave 11 unduhan nyata nonzero/PK/ExcelJS, ditambah tiga fixture ExcelJS/Excel 16 melalui preview/apply hanya DRAFT. Kontras UI existing minimum 5,07:1 pada kartu dan 7,65:1 pada BAA; screenshot error 503/360 dan maintenance diperiksa visual.

Fingerprint akhir: **25/25 domain dev (seluruh baris, termasuk approved) dan 72/72 berkas terlindungi identik** terhadap snapshot sebelum edit. Bukti `dev-{before,after}.json`, `protected-{before,after}.json`. Cadangan/baseline tidak dihapus. Daftar perubahan `.runtime/error-handling/changes.json`; tidak ada migration/seed/dependency/.env/schema atau approved dev yang berubah. Runtime Node v24.19.0; Node 22 belum diuji. Uji proxy staging/pemadaman upstream bersama IT dan konfigurasi kanal bantuan PRP masih merupakan pekerjaan operasional 6D, bukan deploy pada tugas ini. Insiden awal pengguna tetap belum bisa dikaitkan dengan suatu sebab tanpa rekaman gagal asli; request_id/kode/durasi baru mempersiapkan penangkapan bukti berikutnya.

## Tindak lanjut — pemulihan CSRF otomatis terbatas (14 Oktober 2026)

Instruksi pengguna terbaru menggantikan kebijakan manual-only untuk penolakan CSRF yang terbukti terjadi sebelum route. Perubahan produksi hanya pada `api.js` dan `error-policy.js`; middleware auth/RBAC/CSRF, limiter/semaphore, kontrak API dan skema tetap. Cadangan baru sebelum edit: `.runtime/csrf-retry/backup/`; snapshot dev SELECT dan hash berkas terlindungi disimpan terpisah dari bukti awal.

Urutan yang diizinkan untuk write:

1. Terima respons **HTTP 403**, JSON `error.code === 'CSRF_INVALID'` (perbandingan tepat/case-sensitive). Status lain dengan kode yang sama, 403 FORBIDDEN/HTML/kode lain, serta timeout/jaringan/5xx tidak memenuhi syarat.
2. Tandai jatah pemulihan pada **permintaan ini** sudah dipakai sebelum operasi async berikutnya. Kosongkan token lama, ambil token melalui `/auth/csrf`; token harus tetap memenuhi validasi existing.
3. Periksa `/auth/me` dan wajib mendapat **HTTP 200**, bukan sekadar `response.ok`. Jika 401, alur sesi habis existing tetap: tidak ada write kedua, isian tetap, safeNext/login tab baru. Bila token/me gagal atau sesi belum dapat dipastikan, hentikan pemulihan tanpa replay.
4. Ulangi sekali dengan method/path/body yang ditangkap sejak awal. JSON diserialisasi sebelum refresh supaya edit caller selama penantian tidak mengganti payload. FormData disalin sekali untuk menjaga entry string dan **File asli yang sama**, lalu digunakan kembali oleh fetch; berkas tidak dibaca ulang dari input yang mungkin berubah.
5. Respons kedua yang masih CSRF_INVALID berhenti dengan pesan Indonesia **Pemulihan otomatis berhenti**, request_id penolakan terakhir, dan tindakan manual. Jika respons kedua timeout/network/5xx, tampilkan hasil tak pasti/periksa riwayat existing; **tidak ada write ketiga**. Batas GET/HEAD/backoff/Retry-After existing dipertahankan, termasuk campuran kegagalan sementara dan CSRF.

Endpoint `/auth/csrf` dan `/auth/me` (juga variasi huruf besar/query/trailing slash) tidak mengawali pemulihan CSRF sendiri, sehingga tidak ada rekursi/deadlock. Tidak ada perubahan API auth atau pengecualian pre-auth: write login yang mendapat CSRF_INVALID juga hanya dapat diulang otomatis bila `/auth/me` mengonfirmasi sesi valid.

Uji terarah awal: komponen/error **23/23**, Edge kasus server asli lulus (2 termasuk parent, 1 suite Excel sengaja skip pada runner terarah). Pada tab dengan cookie hasil login baru tetapi token JavaScript lama, **upload, apply, dan submit masing-masing [403,200] tanpa klik kedua**. Tiap operasi hanya satu refresh token + satu pemeriksaan sesi. Kedua upload memakai File identik; satu preview/kuota, satu audit upload, satu audit apply, 19 draft tanpa duplikasi dan tepat satu transisi draft → submitted. Tidak ada approve. Pengujian membuat periode/fixture baru hanya pada `_test`, membersihkan baris fixture domain/periode, dan mempertahankan audit. Bukti terarah `.runtime/csrf-retry/{components-final.log,ui-target.log}`; bukti rinci dari suite lengkap `.runtime/phase3/csrf-retry-proof.json`.

### Gerbang tindak lanjut, berurutan — hasil aktual

| Urutan | Perintah / cakupan | Hasil | Bukti `.runtime/csrf-retry/` |
|---|---|---|---|
| 1 | `npm test` | **121 lulus/0 gagal/1 skip** (openpyxl), 122 total; komponen error 23/23 | `gate-test-final.log` |
| 2 | `npm run test:ui` | **56/56**, 0 skip; seluruh regresi error/halaman/Excel existing | `gate-ui.log` |
| 3 | `npm run db:verify` | **21/21**, `_test` | `gate-db-verify.log` |
| 4 | `npm run db:check`, melalui wrapper existing dengan PGDATABASE child = PGTEST_DATABASE | **18 kontrol lulus**, NULL/sumber tetap | `gate-db-check.log` |
| 5 | `npm audit --json` | **0 kerentanan** pada pemeriksaan terkini | `gate-audit.json` |

UI/registry memakai akses di luar sandbox sesuai kendala browser/registry yang sebelumnya terukur. Semua tes mutasi hanya `_test`; dev hanya SELECT fingerprint. Kasus unit tambahan menguji status/kode tepat (termasuk kode CSRF_INVALID pada 401/422/429/5xx yang **tidak** memicu pemulihan), JSON tidak berubah meski caller mengedit payload saat `/auth/me`, identitas/nama/isi/File multipart, setiap metode tulis, satu jatah per request, CSRF kedua berhenti, token/me gagal/non-200 tanpa replay/rekursi, sesi habis tetap, serta timeout/network/5xx sesudah replay tanpa write ketiga. GET campuran kegagalan sementara/CSRF tetap maksimal tiga request total.

Suite UI lengkap menyimpan bukti HTTP nyata `.runtime/phase3/csrf-retry-proof.json`: upload/apply/bulk-submit masing-masing **[403,200]**, identitas File kedua unggahan **[true,true]**, **1** record preview, **18 draft + 1 submitted** setelah satu submit, audit upload/apply/transisi submit masing-masing sekali. Berkas JSON ini hanya metadata fixture `_test`, tidak berisi token/cookie/password/unggahan. Kasus sesi expired tetap satu POST dan isian tidak hilang. Entry npm start/dev serta unduhan nyata Edge/Brave existing tetap lulus.

Fingerprint sesudah seluruh gerbang: **25/25 domain dev dan 72/72 berkas terlindungi identik**, termasuk seluruh approved dev, `.env`, manifest/lock, migration/seed/script DB. Bukti `dev-{before,after}.json`, `protected-{before,after}.json`. `changes.json` menunjukkan hanya **enam** berkas berubah: `api.js`, `error-policy.js`, dua berkas tes error, dokumen ini dan STATUS; tidak ada berkas baru, perubahan backend/keamanan/skema/dependency, aset/CSS/HTML/kanvas atau data dev. Runtime Node v24.19.0; Node 22 belum diuji. Tidak melanjutkan deploy/fase/tugas lain.
