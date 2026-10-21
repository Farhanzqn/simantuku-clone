# Desain Dashboard Data PRP ITPLN

## Tabel status KPI — 19 Oktober 2026
- Hanya halaman KPI memuat kpi.css; kartu perspektif A–D tetap putih/judul serif, container existing 1680px, navbar/footer satu sumber dan kanvas halaman lain tetap. Implementasi lokal, tanpa CSS/aset/teks dashboard pihak lain.
- Kolom: No/Kode, Indikator, Target, Aktual, Capaian vs target, Keterangan, Snapshot, Detail. Sel capaian memakai latar penuh/teks tebal: hijau #176344/#e9f5ef, kuning #79520c/#fff4d9, merah #a12b3c/#fcecef, abu #42556b/#edf0f4. Status Keterangan memakai ikon centang/seru/silang/strip + teks, dengan catatan baris existing.
- Ambang bersama iku-schema.js: tercapai >=100, mendekati >=70 dan <100, belum tercapai <70; NULL/kosong belum dinilai. Persen server tidak dihitung ulang/dibatasi di 100; id-ID, tanpa skor berbobot. Legenda memakai konstanta yang sama, ringkasan seluruh periode tetap saat filter lokal di hero berubah.
- Detail Lihat disabled + aria-disabled/title dan teks Detail segera tersedia, tanpa navigasi. Kontrol >=48px, tabel semantik/caption dengan region fokus/scroll horizontal lokal di 360px; legenda dua kolom mobile. Animasi kartu ringkasan 220ms dan reduced motion; loading/kosong/error/retry memakai komponen existing.
- Cadangan/bukti .runtime/kpi-status. Edge 1440/360: tanpa overflow halaman, scroll keyboard, status batas/NULL, filter tanpa API baru, ringkasan, IKU, Detail nonaktif/loading/kosong/error/retry/reduced motion; kontras minimum empat status 6,28:1. Gerbang berurutan 126 tes + 1 skip, UI 67/67, DB 21/21 + 18 kontrol, audit 0; dev 25 domain/72 berkas terlindungi dan 8 pasangan ukuran container/bitmap kanvas identik. Runtime Node v24.19.0, Node 22 belum diuji. Rincian: [audit KPI](KPI-TABEL-STATUS.md).

## Umpan balik form — 14 Oktober 2026
- Seluruh 25 formulir pada 10 halaman input memakai form-feedback.js. Lencana ikon + teks: Draft abu-abu, Menunggu verifikasi amber, Disetujui hijau, Ditolak merah, Dibatalkan mengikuti discarded. Versi kecil terpisah; alasan penolakan melalui tombol Riwayat dan panel yang menerima fokus keyboard.
- Status keseluruhan menjadi kartu berikon tepat sebelum tabel: judul dan satu kalimat penjelasan. Toast Simpan Draft/Buang draft; modal tengah layar hanya setelah balasan Submit/Apply yang terkonfirmasi. Submitted dan auto-approved mengikuti status baris server, termasuk ketika metadata kebijakan sudah berubah. Apply menyatakan Data masuk sebagai DRAFT, belum diajukan.
- Modal native satu instance: role=dialog, aria-modal, judul/deskripsi, fokus tombol Tutup, Tab terjaga, Escape, fokus kembali ke pemicu; tanpa penutupan otomatis. Animasi ikon 240 ms, nonaktif pada reduced motion. Error/hasil tak pasti memakai kebijakan existing dan request_id aman; tidak ada modal sukses pada kegagalan.
- Tabel input kembali semantik pada 360px dengan scroll horizontal lokal dan keyboard; header tetap terlihat. Status/riwayat minimal 260px, lencana tidak membungkus, tidak ada kolom tambahan kosong. Aturan ini menggantikan tata letak sel vertikal mobile yang dicatat pada penyegaran 13 Oktober. CSS dibatasi input; kanvas tetap.
- Centang menyatakan format isian valid menurut parser/metadata bersama; NULL tanpa centang. Error berikon, pesan lokal, aria-invalid/describedby dan fokus pertama pada Simpan/Submit. Aturan referensi/master tetap diperiksa server. Peringatan kualitas existing (termasuk Perempuan > total) tetap warning, bukan aturan pemblokir baru. Pesan batas 422 diterjemahkan dari hasil server, tanpa menyalin batas ke validator kedua.
- Ringkasan memakai Persentase perempuan dan Persentase S3; angka/rumus tetap. Pratinjau menampilkan N baris valid, M bermasalah (jumlah baris unik), lokasi baris/kolom, serta placeholder pada nilai invalid yang tidak dikembalikan server. Apply bermasalah diblokir sampai opsi valid-only dan konfirmasi existing dipenuhi.
- Kontrol minimal 48px; token teks #42556b/#176344/#79520c/#a12b3c pada latar lembut; teks dinamis dibuat lewat textContent. Cadangan dan bukti .runtime/form-feedback. Cakupan/hasil gerbang rinci: [ERROR-HANDLING.md](ERROR-HANDLING.md#umpan-balik-form-dan-pratinjau--14-oktober-2026).

- Verifikasi final: 25 form × 1440/360 tanpa overflow; modal/fokus/Escape/Tab/reduced motion, 422 nyata, AMI/keuangan/Responden wajib, Excel campuran dan seluruh regresi lulus. Gerbang 125 tes + 1 skip, UI 64/64, DB 21/21 + 18 kontrol, audit 0. BAA kontras minimum 7,65:1; 8 pasangan dimensi kanvas identik; dev 25 domain/72 berkas terlindungi identik. Runtime Node v24.19.0, Node 22 belum diuji.

## Penanganan error — 14 Oktober 2026
- Pesan Indonesia dan tindakan memakai `error-policy.js`/`error-ui.js` melalui transport bersama: offline/jaringan, timeout, sesi, hak/CSRF, tidak ditemukan, konflik, validasi, limiter, server/unavailable dan respons invalid. Request ID aman ditampilkan tanpa detail server. Retry GET/HEAD terlihat; write hanya pengulangan manual dan hasil tak pasti mengarahkan pengguna memeriksa riwayat.
- Panel, login/password, semua unit/form, transfer Excel, verifikasi tunggal/massal, admin, navbar dan IKU memakai status/error bersama; tombol dipulihkan setelah proses. Autosave berhenti setelah gagal sampai Simpan manual. Masuk ulang memakai safeNext dan tab baru agar isian tab asal tetap ada.
- Halaman `errors/{400,401,403,404,413,429,500,503}.html`: identitas **Dashboard Data PRP ITPLN**, logo lokal asli, `.page-main`, kartu putih/judul serif biru, tombol >=48px, fokus keyboard dan 360px. Script/CSS lokal, tanpa inline script atau dependency baru. Navbar/footer tetap satu sumber; bantuan PRP ada di footer.
- `maintenance.html` mandiri memakai CSS inline/logo asli tertanam untuk proxy saat Express mati; tanpa script/aset eksternal. Tidak mengarang kontak PRP. Panduan 6D, audit sebelum kode, kontrak dan hasil pengujian: [ERROR-HANDLING.md](ERROR-HANDLING.md).
- Cadangan global `.runtime/error-handling/backup/`; perbandingan browser empat halaman × 1440/360 membuktikan dimensi container/bitmap kanvas sama. CSS baru dibatasi status dan halaman error; kanvas/konfigurasi grafik tetap.
- Gerbang akhir: npm test 116 lulus + 1 skip, UI 56/56, db:verify 21/21, db:check 18 kontrol pada _test, npm audit 0. Delapan halaman error × dua lebar tanpa overflow/CSP/detail bocor; offline nyata, CSRF tab lama, sesi/draf, autosave/tombol, respons kosong dan unduhan disk Edge/Brave lulus. Fingerprint dev 25 domain/72 berkas terlindungi identik. Node v24.19.0; Node 22 belum diuji. Pemeliharaan proxy belum deploy.

## Lingkup
- Alias unit pada tampilan: **BKK** menggantikan BKM pada judul input, menu/profil, administrasi role/unit, verifikasi dan label formasi. Kode `BKM`, role `bkm`, URL `input/bkm.html` dan rekaman sumber tetap. `BKMK` AMI merupakan singkatan berbeda dan tetap sesuai sumber.
- Alias dikelola `assets/js/unit-labels.js`; cadangan, smoke browser akun unit/admin dan screenshot 1440/360 tersedia di `.runtime/bkk-label-pre/`. Tes komponen 5/5 serta smoke terarah lulus; nilai option role tetap `bkm`. Pencarian fixture admin diperbaiki karena endpoint hanya menampilkan 200 pengguna; tidak mengubah pagination aplikasi.
- Sumber token/komponen: `static-web/assets/css/app.css`; font sistem, tanpa CDN/dependency.
- Tahap 1: Beranda, Statistik Mahasiswa, Input BAA; komponen/navbar/footer bersama.
- Tahap 1b: struktur index.html, presentasi home.js/footer.js dan tambahan tes struktur beranda.
- Binding ID/data-attribute, kueri, angka, teks sumber, validasi dan akses tetap.
- Arah visual: [Dashboard UNJA](https://dashboard.unja.ac.id/) dan screenshot pengguna; tanpa aset/teks UNJA.
- Tahap 3 mengganti wordmark teks dengan PNG resmi pengguna dari assets/images (path aktual, bukan assets/img); file gambar tidak diedit.
## Token
| Kelompok | Nilai utama |
|---|---|
| Primer | #125ca3; hover #0c477f; soft #edf5fd |
| Netral | page #f5f7fb; surface putih; border #dce4ee; text #1d3048; muted #53647a |
| Status | success #176344; warning #79520c; danger #a12b3c; latar lembut |
| Tipografi | system-ui/Segoe UI; 12/13/14/17/20 px; judul biasa 26–34, hero 32–54 px |
| Bobot/tinggi baris | 500/600/700; body 1,6; heading 1,25 |
| Spacing | --space-1/2/3/4/5/6/8 = 4/8/12/16/20/24/32 px |
| Radius/shadow | sm 8, md 12, lg 16 px; hero/klaster 20–24; shadow sm/md/lg/hover |
| Gerak | transisi 180 ms; KPI naik 2 px; skeleton 1,4 detik; reduced motion mematikan gerak |

## Delapan kartu beranda — 13 Oktober 2026
- Tindak lanjut pengguna: kembali ke **desain sebelum penambahan delapan kartu**. CSS lokal mempertahankan gradasi lembut, ikon 36px berbayang dan periode di atas angka dari `app.css`; token, serif, 1680px dan animasi existing tetap. Pada 360px ikon tetap 36px, judul memakai lebar penuh di bawahnya dan angka 32px agar dua kolom terbaca. Hero/kanvas tidak disentuh.
- Urutan akhir: Dosen, Mahasiswa aktif, Program Studi, Tenaga kependidikan, **Peminat PMB**, Lulusan institusi, Prodi terakreditasi, Akreditasi institusi. Peminat 21.172 berasal dari API domain institusi PPA baru yang disetujui pengguna; tidak memakai nilai daftar ulang 1.678. Keterangan sumber menyertakan Tabel 4.1/hlm. 99 bila ada pada metadata API.
- CSS khusus `assets/css/home-summary.css`, hanya dimuat index; empat kolom desktop (dua baris), dua kolom pada ≤1000px termasuk 360px. Container 1680px, grafik dan hero 3D mempertahankan aturan/ukuran existing.
- Garis atas dan gradasi mengikuti kartu existing; aksen empat kartu lama tetap, kartu tambahan memakai token primary/success/warning/primary-hover. Ikon SVG lokal di kanan atas, heading serif kapital kecil, periode lalu angka besar, keterangan/sumber di bawah. Tidak menyalin CSS/aset/teks UNJA.
- Angka id-ID; NULL `-`, peringkat berupa teks sumber. Skeleton existing, status aria-live dan aria-busy, error per sumber serta tombol retry existing; tanpa angka lama pada sumber gagal. Animasi masuk 420ms/jeda maksimum 180ms dan hover naik 2px mengikuti kartu bersama; reduced motion mematikan animasi/transisi/transform.
- Satu total tendik institusi diizinkan publik melalui endpoint khusus; rincian/modul tetap login-only. Delapan kartu sama bagi anonim dan login. Definisi snapshot, pemetaan prodi, cara input akreditasi institusi serta bukti uji: [KARTU-BERANDA.md](KARTU-BERANDA.md).
- Edge: empat kolom/dua baris desktop, dua kolom/empat baris pada 768/360, tanpa overflow 1280/1440/1920/2560/768/360; kontras teks kartu minimum **6,05:1**, keyboard retry mempertahankan fokus, skeleton dan reduced motion lulus. Label panjang pada 360 memakai lebar judul penuh di bawah lencana agar tidak terputus antarhuruf. Screenshot kartu `.runtime/home-summary/cards-{1440,360}.png` diperiksa visual.
- Suite lengkap **47/47**, dilanjutkan pemeriksaan terarah kosmetik final **4/4**; npm test **101 lulus/1 skip**, db:check lulus, audit **0**. Keenam ukuran kanvas identik pada lima lebar regresi setelah ResizeObserver selesai; tinggi desktop 340px/mobile 300px tetap. Fingerprint **24/24 domain dev** dan **69/69 berkas terlindungi** identik.
- Hasil di atas merupakan tahap awal. Sesudah koreksi desain/Peminat: suite Edge **48/48**, npm test **103 lulus/1 skip**, DB **21/21**, db:check lulus, audit **0**. Kontras konservatif terhadap warna gradasi terendah **5,07:1**; grafik/hero tetap. Bukti akhir dan penambahan data yang diotorisasi: [KARTU-BERANDA.md](KARTU-BERANDA.md#koreksi-sumber-dan-desain--tindak-lanjut-pengguna).

## Penyegaran input dan identitas — 13 Oktober 2026
- Nama tampilan: **Dashboard Data PRP ITPLN**, termasuk navbar/footer, judul tab, meta dan alt logo. Hak cipta footer: **© 2026 Farhanzqn**. Nama paket/database/route dan lisensi vendor tetap.
- Input unit memakai scope `.input-page`: teks `#0b1b2b`, pendukung/placeholder `#42556b`, garis `#ccd9e7`, header `#eaf2fa`, zebra `#f4f8fc`. Primer tetap `#125ca3`.
- Judul input dan judul kartu bersama memakai Georgia, "Times New Roman", serif; isi tetap system-ui. Label/sel 14px, kontrol/tombol 15px, tinggi kontrol minimal 48px dan tombol 46px. Jarak bagian 24–32px, padding sel 16px × 12px.
- Tabel input pada ≤700px menyusun sel per baris vertikal, label diulang dari atribut presentasi `data-label` pada renderer sel; header semantik tetap tersedia. Perhitungan, validasi, event dan urutan input tidak berubah.
- Kartu existing `.home-card`/`.kpi-card`, filter/template/riwayat input: fade/slide 420ms, jeda 60–180ms, hover naik 2px, bayangan biru 8–14%, border fokus/hover. Reduced motion mematikan animasi, transisi dan transform.
- Tidak mengubah selector ukuran panel/kanvas, tinggi grafik atau layout dashboard. Cadangan sebelum edit: `.runtime/ui-pre/css/` dan `.runtime/ui-pre/input/`; salinan file identitas berada di `.runtime/ui-pre/files/`.
- Screenshot BAA sebelum/sesudah 1440px dan 360px: `.runtime/ui-pre/baa-{before,after}-{1440,360}.png`. Edge memverifikasi halaman dan tabel tanpa overflow horizontal, kontras teks terendah 7,14:1 (≥AA), placeholder ≥4,5:1, kontrol ≥48px/font ≥15px, judul serif dan reduced motion. Screenshot awal/akhir diperiksa visual; screenshot penuh tambahan ada di `.runtime/phase3/baa-table-after-{1440,360}.png`.
- Gerbang akhir dijalankan masing-masing **satu kali**: `npm test` 89 lulus + 1 skip, `npm run test:ui` 44/44, `npm run db:check` semua kontrol lulus, `npm audit --json` 0 kerentanan. Log `.runtime/ui-pre/gate-{test,ui,db-check,audit}.log`. Tes dashboard existing menjaga alignment, grid dan tinggi kanvas 340px desktop/300px mobile.
- Snapshot sebelum/sesudah `.runtime/xlsx-diag/{dev,protected}-ui-{before,after}.json`: 24 domain identik (seluruh baris, termasuk approved); 68 berkas terlindungi identik, termasuk `.env`, package/lock, migrasi/seed dan skrip DB. Tes mutasi hanya di DB `_test`; dev hanya dibaca untuk fingerprint.
- Berkas tugas ini: 44 HTML di `static-web/` (termasuk 10 input), `assets/css/{app,input}.css`, `assets/js/{navbar,footer,input}.js`, `server/tests/ui.test.js`, `docs/{DESAIN,STATUS}.md`. Pada `input.js` hanya penambahan label presentasi sel. Daftar HTML tepat tersimpan di `.runtime/ui-pre/changed.json`; tidak menulis ulang arsip FASE.
## Aturan komponen
- Kartu judul halaman memakai `.section-hero`: gradasi `#0c477f`–`#125ca3`, teks putih, radius 16px dan padding responsif 24–40px. Filter dashboard umum serta IKU ditaruh di dalam kartu judul dengan permukaan putih, mengikuti pola Akreditasi. Beranda/Akreditasi/login memakai kartu existing.
- Pilihan formulir, petunjuk dan filter input dikelompokkan dalam `.input-context-card`; tindakan dan ringkasan total memiliki permukaan tersendiri. Form pengguna admin memakai kartu putih. Ringkasan mahasiswa/PMB/tracer memakai `renderKpiCards` existing, dengan angka, NULL dan penanda sementara yang sama.
- Penambahan kartu hanya presentasi: judul/kelas HTML, pembungkus input, lokasi DOM filter dan renderer angka. Tidak mengubah query, event, kalkulasi, API, skema, role atau data. Bayangan inset memberi garis panel tanpa mengurangi ukuran kanvas. Berkas: 39 HTML, `assets/css/{app,input}.css`, `assets/js/{filter-bar,input,pages}.js`, assertion UI dan docs DESAIN/STATUS. Daftar HTML tepat: `.runtime/ui-card-pre/changed.json`.
- Cadangan/screenshot/baseline: `.runtime/ui-card-pre/`. Smoke Edge server asli dengan fixture admin `_test`: 41 halaman × 1440/360 = 82 pemeriksaan, tanpa overflow, CSP atau exception. Lebar/tinggi setiap `.chart-container` identik sebelum/sesudah. Screenshot representatif statistik mahasiswa, input BKK, IKU, admin pengguna dan Akreditasi tersedia sebagai `*-{before,after}-{1440,360}.png`.
- Gerbang: npm test 89 lulus + 1 skip; db:check semua kontrol lulus; npm audit 0 kerentanan. Satu kali suite UI menghasilkan 42 pass/2 fail (assertion lama Rasio tanpa kartu dan parent-nya). Assertion diperbarui secara ketat ke kartu putih/padding 24px; subtes Rasio yang sama diuji ulang terarah dan lulus 2/2 termasuk parent. Kasus lainnya tetap lulus; suite lengkap tidak diulang. Log `gate-{test,ui,ui-ratio,db-check,audit}.log`; kontras form terendah 7,65:1.
- Fingerprint dev 24 domain dan 68 berkas terlindungi identik: `.runtime/xlsx-diag/{dev,protected}-cards-{before,after}.json`. Test yang memutasi hanya memakai `_test`; dev hanya SELECT. Screenshot memakai akun fixture, tanpa cookie/password.
- `.button` primer; `.secondary` sekunder; `.ghost` ringan; focus-visible ber-offset.
- Input/select/checkbox memakai token; validasi, state disabled dan keyboard existing tetap.
- `.data-panel`: garis inset, radius/shadow; padding dan ukuran kanvas tidak diubah.
- `.home-card`/`.kpi-card`: label kapital, angka tebal, tinggi sejajar; periode diberi ruang konsisten.
- Filter dan alat grafik membungkus alami; sumber/alat grafik tetap dalam urutan DOM existing.
- Tabel memiliki header halus, zebra/hover; scroll tabel tetap di dalam pembungkus.
- Summary, badge, pesan status/error dan empty state memakai token yang sama.
- Form unit mobile: Simpan/Submit dua kolom; Salin/Buang draft masing-masing satu baris penuh.
- Fokus biru dan reduced motion dihormati; kontras token teks/latar terendah Tahap 1 6,05:1.
## Struktur 1b
- Hero gradasi/pola biru: judul, kalimat ringkasan, akses cepat, badge, filter periode existing.
- KPI empat kartu beraksen dan SVG inline; overlap ringan 40 px desktop/28 px mobile.
- Hanya dua klaster existing: Mahasiswa (Akademik) dan Dosen (SDM); tidak menambah metrik privat.
- Klaster memakai tag, deskripsi, jumlah grafik/panel dan tautan detail; grid dua kolom tetap.
- Label **Periode data**, bukan tanggal update: API tidak menyediakan tanggal pembaruan umum.
- Jumlah klaster berasal konfigurasi; jumlah grafik dari canvas aktual; panel dihitung dari DOM.
- Pada seed: 2 klaster, 9 panel, 6 grafik tersedia; saat kosong/error hitungan grafik mengikuti DOM.
- Skeleton hanya state loading, teks status tetap untuk pembaca layar; error/kosong tetap jelas.
- Navbar sticky/menu akun/keyboard existing; CSS menambah shadow scroll bila browser mendukung.
- Footer global: tahun berjalan + Institut Teknologi PLN + PRP; tautan Beranda/Dashboard Data/Masuk.
## Status Tahap 1b
- Audit lanjutan: sudah ada header sticky/akun/mobile, hero lengkap beserta filter/badge/akses cepat, KPI berikon, dua klaster, skeleton dan footer global.
- Selesai: container tunggal .nav-top/.page-main/.itpln-footer, max-width 1680px, margin auto, padding-inline clamp(16px,3vw,48px); hero/KPI/klaster mengikuti lebar konten. Gap kartu beranda 24px, 16px pada <=640px; footer Masuk.
## Pemeriksaan dan batas
- Enam halaman lanjutan desktop/360px: statistik-mahasiswa, input/baa, verifikasi, keuangan, pegawai-formasi, AMI.
- Efek bersama: container konten/header/footer lebih lebar. Isi, akses, konfigurasi Chart.js dan tinggi area grafik tetap; lebar kanvas responsif mengikuti container.
- Uji struktur beranda: 1280/1440/1920/2560/360px, tepi sejajar, gap, dua kolom desktop/satu mobile, tanpa overflow; tinggi grafik 340/300px tetap.
- Grafik berlabel padat tetap mengikuti Chart.js existing; tidak mengganti aspect ratio/ukuran/palet.
- Smoke Edge 17 kombinasi halaman/lebar lulus: tanpa overflow/CSP/exception; semua tinggi kanvas identik baseline. Skeleton/reduced motion/anchor/error diuji; screenshot dari fixture test tanpa rahasia.
- Lanjutan 1b: npm test 48/48; Edge 36/36. Percobaan awal: riwayat draft tidak terbaca tepat waktu; ulang tanpa perubahan tes lulus.
Arsip screenshot Tahap 1/1b tersimpan di `screenshot-desain/` dan `screenshot-desain-1b/`.
Screenshot container 1b: [1440](screenshot-desain/1b-after-beranda-1440.png), [1920](screenshot-desain/1b-after-beranda-1920.png), [360](screenshot-desain/1b-after-beranda-360.png).
## Status Tahap 2
- Implementasi selesai: CSS bersama untuk seluruh dashboard, unit/input, verifikasi/admin, kualitas data, login/password. Redirect IKU Fakultas tetap.
- Tanpa token/komponen baru: aturan BAA diperluas ke semua body[data-unit]; panel/tabel/filter/tombol memakai token existing; auth berupa kartu terpusat.
- Kosmetik: chip periode KPI selebar isi kartu, min-height 64px; padding hero vertikal berkurang sekitar 15%; sumber 12px/line-height 1,8; panel klaster kosong align-self:start, ikon lingkaran dekoratif dan tinggi mengikuti isi.
- Tidak mengubah DOM/JS/tes, tinggi/aspect ratio kanvas, data, akses, .env, migrasi atau seed. Tidak menjalankan db:reset.

- Tes Tahap 2: npm test 48/48 dan test:ui 36/36 lulus pada percobaan pertama; tes existing tidak diubah.
- Smoke Edge 45/45: 15 halaman x 1440/1920/360px, tanpa overflow/CSP/exception; beranda, mahasiswa, BAA/BSDM, verifikasi, pegawai, keuangan, AMI, admin users/audit/formulir, ruang-unit, kualitas, login/password. Tahap 2 selesai.

## Status Tahap 3
- Selesai; 45/45 pemeriksaan Edge (15 halaman x 1440/1920/360) tanpa overflow/CSP/exception, semua logo naturalWidth > 0. Header dua tingkat global: pita logo putih/akun, bar logo warna + enam topik dan pencarian lokal dari daftar menu yang sama; tanpa fetch pencarian.
- ID lama dashboard-data-menu dan iku-menu dipertahankan; kinerja-menu menjadi pembungkus isi Kinerja. Role, penanda kunci, URL tujuan/login dan logout tetap.
- Pemetaan tambahan: Beban Mengajar/Rekognisi ke SDM; Kinerja PT/Prodi ke Kinerja. KPI tetap satu halaman empat perspektif. Tidak membuat tautan Daftar Navigasi Menu karena belum ada tujuan existing.
- Logo: header/hero memakai logo-itpln-lambang-putih.png; bar menu/footer memakai logo-itpln-lambang.png; login/password memakai logo-itpln-lengkap.png. Versi lengkap-putih tersedia tetapi tidak diperlukan. Lebar/tinggi eksplisit, object-fit contain; maksimum tampil 96px.
- Hero biru tua/teal, kaca ringan dengan fallback solid, tiga cahaya CSS 24 detik dan ornamen geometris/orbit 30 detik; ikon KPI berubin berbayang. PNG tidak digambar ulang/diubah warna.
- Reduced motion mematikan animasi dan miring; efek logo maksimum 5 derajat/transisi 200ms. Gerak hero hanya transform/opacity, dijeda saat tab tersembunyi. Tanpa WebGL/CDN/dependency baru.
- Tambahan CSS 6038 byte UTF-8; SVG menu dibuat inline melalui satu path lokal (enam ikon kecil), ornamen sepenuhnya CSS; serialisasi keenam SVG sekitar 846 byte, tanpa berkas SVG tambahan. Tidak mengubah Chart.js.
- File: navbar.js, footer.js, index.html, login.html, ganti-password.html, app.css, tes UI navbar dan dokumen ini; home.js tidak diubah. npm test 48/48, Edge 36/36 lulus.

Screenshot: [Beranda 1440](screenshot-desain/3-home-1440.png), [360](screenshot-desain/3-home-360.png), [menu](screenshot-desain/3-menu-1440.png), [login](screenshot-desain/3-login-360.png).

## Dashboard Pimpinan sesi 1 (12 Oktober 2026)

- Nama/URL halaman KPI: **Monitoring Capaian Kinerja Unit Kerja (KPI)**, `/monitoring-kpi.html`. Dua URL capaian-iku lama redirect HTTP 302 ke KPI. Renderer/perspektif/kanvas/data KPI tetap.
- Topik Kinerja menjadi **Dashboard Pimpinan**, memakai ID kompatibilitas `iku-menu`/`kinerja-menu`. Isinya Akreditasi Institusi (halaman existing, publik), Monitoring IKU, Monitoring Capaian Kinerja Unit Kerja (KPI). Dua terakhir diberi kunci/login next aman.
- Akreditasi dipindah dari Akademik & Mutu. Tautan Kinerja PT/Prodi tetap tersedia di Akademik & Mutu; Keuangan/Catatan Kualitas di Administrasi. Dropdown, keyboard, pencarian dan footer tetap memakai satu sumber navbar/footer.
- Navbar desktop dapat membungkus item untuk mengakomodasi judul panjang; perubahan hanya navigasi, tidak mengubah ukuran kanvas. Cadangan sebelum perubahan ada di `.runtime/pimpinan-s1/backup/`.
- IKU memakai token ITPLN dan CSS khusus halaman `iku.css`; tanpa CSS/aset pihak ketiga, CDN atau dependency baru. Filter tahun/T1–T4; empat kartu jumlah/rata-rata/mencapai/di bawah target; tabel per grup IKU, indentasi hierarki dan kolom sumber lengkap. Empat badge kualitas dan waktu publikasi internal Asia/Jakarta ditampilkan.
- Konfigurasi ambang `assets/js/iku-schema.js`: `tercapai:100`, `mendekati:70`. Hijau >=100, kuning >=70 dan <100, merah <70 berdasarkan nilai sebelum pembulatan. Bar maksimum visual 100; badge menampilkan nilai sebenarnya, termasuk 195,6%. Status juga berupa teks, bukan warna saja.
- Persen realisasi/target dari `v_dashboard_iku`, bukan kolom tersimpan. Rata-rata aritmetika seluruh baris terukur, termasuk sub-indikator, bukan skor berbobot. Target nol/null tidak dihitung; realisasi nol tetap 0,0%. Angka id-ID hingga 3 desimal, capaian 1 desimal.
- Tabel memiliki scroll lokal/fokus keyboard pada 360px, uraian membungkus; empat kartu menjadi dua kolom. Loading, kosong, error/retry dan reduced motion mengikuti pola aplikasi. Status sumber Sudah Diajukan berbeda dari workflow approved internal.
- Form PRP menambah tab Monitoring IKU dengan master 19 indikator, tahun/triwulan, baseline/target/realisasi, status sumber dan catatan verifikasi. Autosave/revisi/review/riwayat bersama; membuka form tidak menulis data. Tidak menyediakan template Excel.

Hasil pemeriksaan aktual dan batas bukti: [Dashboard Pimpinan sesi 1](DASHBOARD-PIMPINAN-SESI-1.md).

## Dashboard Pimpinan sesi 2 (12 Oktober 2026)
- Akreditasi publik diperbarui dengan hero/filter tahun, kartu, status institusi, matriks peringkat × jenjang dan daftar per jenjang; memakai CSS khusus halaman `accreditation.css`. Navbar/footer dan kanvas existing tetap.
- Rekap master dan daftar nama sumber belum terpetakan dipisahkan secara eksplisit; NULL tampil `-`, lencana masa berlaku turunan tanggal, tidak mengubah status sumber. Tabel scroll lokal dan dapat difokuskan keyboard pada 360px.
- Detail audit, semantik snapshot tahun, cakupan dan pengujian: [sesi 2](DASHBOARD-PIMPINAN-SESI-2.md). BKD menunggu keputusan skema/sumber; menu tidak ditambah.
