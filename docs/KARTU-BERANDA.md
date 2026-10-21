# Kartu ringkasan beranda — 13 Oktober 2026

## Koreksi sumber dan desain — tindak lanjut pengguna

PDF yang diberikan pengguna (`Laporan Manajemen ITPLN 2026 FINAL.pdf` di direktori Laporan Manajemen) identik SHA-256 dengan salinan sumber proyek: `E141B6AF50D31F63FF7BBF42E2E93C9BC0442D52E713B70E82ACC44AC625D221`. Ekstraksi lokal Tabel 4.1, halaman PDF 107/cetak 99 menyebut Peminat **21.172**, target 20.000; Pendaftar **8.912**, target 8.000; Peserta **6.228**, target 6.000. Periode Januari–Juni/Semester I 2026 dijelaskan halaman PDF 105/cetak 97. Nilai daftar ulang **1.678** pada API existing adalah metrik berbeda; tidak boleh diganti menjadi jumlah peminat atau diberi label Peminat tanpa mengganti sumber/domain.

Audit live app_user: tidak ada kolom peminat/pendaftar di schema publik, tidak ada indikator KPI bernama peminat/pendaftar, dan view akreditasi institusi approved/current masih kosong. Form PPA Mahasiswa Baru saat ini menyimpan target/daftar ulang **per prodi**; angka peminat institusi tidak boleh dialokasikan ke prodi. Pengguna mengonfirmasi peringkat institusi **B** pada tindak lanjut ini. Konfirmasi tersebut belum menjadi baris approved; nomor SK, lembaga dan tanggal berlaku belum diberikan. Jangan mengarang metadata, mengisi konstanta frontend atau menerbitkan data melewati workflow PJM.

Desain sebelum delapan kartu tersedia dalam cadangan `.runtime/home-summary/backup/static-web/` dan screenshot `home-summary-baseline-desktop.png`. Perbedaan yang ditemukan: CSS tambahan mengganti gradasi lembut dengan putih, mengecilkan ikon 36px menjadi 28px dan memindahkan periode dari atas angka ke bawah angka. Pengguna meminta kembali ke tampilan sebelum perubahan, tetap delapan kartu. Perbaikan dibatasi CSS lokal beranda; API, urutan/angka kartu, hero dan kanvas dipertahankan.

Pengguna menyetujui usulan perluasan sumber Peminat. Implementasi: migration **032**, tabel `pmb_peminat` dengan grain institusi `(periode_laporan_id, periode_akademik_id, tahun_masuk, tanggal_snapshot)`, `jumlah_peminat` nullable, versi/status/current/previous, trigger audit/guard bersama, indeks current/working/antrean, grants minimum serta view `v_dashboard_pmb_peminat`. Registry/form PPA memakai satu baris **Institusi ITPLN**, tahun masuk/snapshot dan periode akademik PMB 20261. Membuka form tidak menulis; edit approved melalui revisi, submitted terkunci, discard hanya draft. Tidak menambah template Excel.

API read-only `/api/dashboard/pmb-peminat` hanya memuat agregat approved/current, periode dan provenance publik; parameter prodi ditolak. Filter laporan/akademik/tahun opsional, memilih satu snapshot terbaru, tidak menjumlah semester atau versi. Kartu kelima menjadi **Peminat PMB** dari endpoint tersebut, bukan dari summary daftar ulang. Label/source menampilkan lingkup institusi dan Tabel 4.1/halaman cetak bila tersedia. Modul KPI tetap privat.

Pemuatan awal mengikuti aturan seed laporan proyek (TAMBAH-DOMAIN butir 15): **berkas sumber/runner baru** `db/seed/pmb-peminat-2026-s1.json` dan `db/scripts/seed-home-public.js`, checksum/ledger insert-only, tiga status draft → submitted → approved dengan audit dan aktor sistem seed nonaktif, owner-only. Ini merupakan pengecualian pemuatan awal existing, bukan approval manusia oleh aktor yang sama; workflow isian manusia tetap four-eyes dan default review TRUE. Migration 032 hanya menambahkan domain baru pada allowlist seed fungsi guard existing. Isian manusia yang sudah ada tidak ditimpa. `node db/scripts/migrate.js` lalu `node db/scripts/seed-home-public.js` memasang sumber baru; perintah `npm run db:seed` lama tetap utuh dan tidak memanggil pemuatan Peminat. Tidak mengubah byte seed/migration/script lama atau manifest/dependency.

Akreditasi institusi B menggunakan **input pengguna**, tidak ditulis pada kode frontend, migration, atau seed. Payload lokal `.runtime/home-correction/akreditasi-institusi-input.json` diajukan melalui login PJM serta POST normal; laporan 2026-S1, id 20, status submitted. Nomor SK/lembaga/tanggal tetap NULL. Pengguna sudah menyetujui publikasi; autentikasi reviewer PRP/admin dengan kredensial konfigurasi gagal. Tidak mereset password, membuat reviewer baru, memalsukan sesi atau memakai SQL owner untuk bypass approval. Pengguna memilih mereview langsung di halaman Verifikasi; status API akhir diperiksa setelah tindakan itu.

Pengembalian desain memakai komponen `app.css` existing: gradasi lembut, ikon 36px/berbayang, periode di atas angka. Grid delapan kartu tetap dua baris × empat desktop, dua kolom 768/360. CSS tambahan yang mengganti warna/ukuran/urutan dihapus, hanya perluasan grid/aksen baru dan adaptasi mobile yang dipertahankan. Animasi 420ms/hover 2px/reduced motion existing tetap.

Verifikasi koreksi: `npm test` **103 lulus/0 gagal/1 skip** openpyxl; `test:ui` **48/48** (termasuk form PPA satu baris, sumber, tidak menulis saat dibuka, desain lama dan seluruh regresi); `db:verify` **21/21**, `db:check` lulus, `npm audit` **0**. Uji API membuktikan source/seed idempotent, app_user tanpa DELETE, unknown prodi ditolak, RBAC/CSRF, draft/submitted/rejected privat, approved/revisi/NULL/nol. DB test memperluas jumlah tabel discarded dari 24 menjadi 25 dan memeriksa tabel baru secara eksplisit, tanpa melonggarkan larangan DELETE. Log lengkap `.runtime/home-correction/gate-*`; screenshot kartu 1440/360 serta form PPA diperiksa; kontras konservatif terendah **5,07:1** terhadap warna gradasi terpekat.

Sesudah tambahan sitasi Tabel 4.1 pada kartu, pemeriksaan terarah akhir **5/5** (`gate-ui-target.log`). Smoke read-only pada database dev melalui server/role app_user asli, Edge 1440/360, membuktikan nilai kartu sama dengan API, Peminat **21.172**, dua kolom mobile/empat desktop, tanpa overflow, tendik hanya total dan seluruh API rincian existing 401. Bukti `dev-public-evidence.json`, `dev-public.log`, `dev-cards-{1440,360}.png`. Akreditasi publik masih `-` saat smoke ini karena pengajuan id 20 masih submitted; persetujuan chat pengguna tidak diperlakukan sebagai sesi reviewer aplikasi.

Fingerprint akhir membandingkan **seluruh baris lama** (bukan hanya approved): 24/24 domain lama identik, 69/69 berkas terlindungi baseline identik. Penambahan eksplisit yang diotorisasi: satu baris domain Peminat dan satu baris institusi Akreditasi id 20; tidak menimpa approved/prodi existing. Tiga berkas DB baru adalah migration 032, sumber JSON Peminat dan wrapper seed baru. Keenam kanvas × lima lebar regresi **30/30 dimensi identik**. Bukti `fingerprint-comparison.json` mencatat jumlah lama/baru serta hash bagian baris lama, daftar berkas baru dan ukuran kanvas. Node v24.19.0, Node 22 belum diuji; seluruh tes mutasi tetap `_test`, pemuatan sumber/dev hanya yang disetujui pengguna.

## Audit sebelum kode

Beranda sudah memiliki empat kartu pada `assets/js/home.js`: Dosen, Mahasiswa aktif, Mahasiswa baru, Lulusan. Kartu Mahasiswa baru sebenarnya memakai `realisasi_daftar_ulang`; kartu Lulusan memakai `cakupan='institusi'`. Deretan existing diperluas dan label diperjelas, tanpa deretan ringkasan kedua. Grafik Dosen Tetap/Tidak Tetap merupakan rincian berbeda dari agregat dosen per prodi; keduanya tidak dijumlahkan.

Pemeriksaan SELECT melalui app_user menemukan 19 prodi aktif, 19 baris akreditasi prodi approved/current (17 terpetakan, dua nama sumber belum terpetakan), tanpa baris institusi approved/current. Ringkasan pegawai institusi memuat total tendik 109. Tendik prodi 30 memiliki cakupan berbeda dan tidak dipakai.

## Kontrak kartu dan sumber

| Kartu | Sumber | Makna |
|---|---|---|
| Dosen | `/api/dashboard/summary` → `dosen` | Agregat dosen publik per prodi, snapshot terbaru sesuai filter |
| Mahasiswa aktif | summary → `mahasiswa` | Status aktif, periode akademik/laporan ditampilkan |
| Program Studi | `/api/dashboard/prodi` | Jumlah master prodi aktif; tidak berubah mengikuti periode data |
| Tenaga kependidikan | `/api/dashboard/tendik-total` | Satu total institusi, bukan tendik prodi |
| Peminat PMB | `/api/dashboard/pmb-peminat` | Agregat peminat institusi, tahun masuk/snapshot; Tabel 4.1, berbeda dari daftar ulang |
| Lulusan institusi | summary → `lulusan` | Hanya cakupan institusi, tahun lulus |
| Prodi terakreditasi | `/api/dashboard/akreditasi` → `meta.prodi` | Jumlah prodi master aktif yang memiliki peringkat terisi; sumber belum terpetakan tidak menambah jumlah |
| Akreditasi institusi | akreditasi → `meta.institusi` | Peringkat serta tanggal masa berlaku bila tersedia; kosong tetap `-` |

Summary mempertahankan pemilihan snapshot existing. API akreditasi mempertahankan periode laporan aktif bila filter kosong, atau periode laporan eksplisit. Tidak menjumlah lintas semester. Bila snapshot akreditasi tidak memiliki baris prodi, kartu jumlah terakreditasi menampilkan `-`; nol hanya sah jika snapshot berisi baris tetapi tidak ada prodi master dengan peringkat. Sumber yang gagal hanya mengubah kartu terkait menjadi error; retry memuat ulang, tanpa mempertahankan angka lama pada kartu gagal.

## Keputusan visibilitas tendik

Instruksi pengguna pada tugas ini memberi pengecualian publik untuk **satu angka total tenaga kependidikan institusi**, agar ringkasan beranda mewakili SDM institusi tanpa membuka rincian pegawai. `GET /api/dashboard/tendik-total` hanya menghasilkan `{data:{total: number|null}}`. Query membaca `v_dashboard_pegawai_ringkasan` yang sudah menyaring approved/current, hanya kategori tendik, memilih satu snapshot terbaru berdasarkan urutan laporan/akademik. Tidak menjumlah semester. Filter hanya ID laporan/akademik yang tervalidasi; parameter rincian ditolak.

Endpoint memakai gerbang global `PUBLIC_DASHBOARD` dan visibilitas `pegawai-publik` existing. Tidak mengubah konfigurasi visibilitas DB atau endpoint lain. Tidak ada sumber/ID aktor, kategori PKWT, jenis kelamin, jabatan, unit, riwayat atau data form dalam respons. `/dashboard/tendik`, `/pegawai-internal`, `/formasi`, `/pegawai-formasi`, `/pegawai-pergerakan` tetap wajib login. Halaman privat tetap redirect login untuk HTML dan 401 untuk JSON. Delapan kartu sama pada anonim dan login sesuai instruksi pengganti A–D.

## Mengisi akreditasi institusi tanpa perubahan skema

Sudah didukung `akreditasi_revisi` dan `v_dashboard_akreditasi` (migration 013 existing), validator domain, dan renderer Input PJM. Baris institusi menggunakan `butir='institusi'`, `cakupan='institusi'`, `prodi_id=NULL`, `jenjang=NULL`. Kolom peringkat, nomor SK, lembaga, berlaku mulai/sampai dan status sumber sudah tersedia. Tanggal yang tersedia adalah tanggal awal/akhir berlaku; tidak ada kolom terpisah tanggal penetapan SK, sehingga tanggal SK tidak boleh dipaksakan sebagai tanggal mulai berlaku.

1. PJM login → Input PJM → Akreditasi; pilih periode laporan serta **Nasional dan institusi**.
2. Isi baris **Institusi** sesuai SK: peringkat, nomor SK, lembaga, tanggal mulai/akhir berlaku yang diketahui dan status sumber. Kolom yang belum diketahui dibiarkan kosong.
3. Simpan DRAFT dan Submit. Verifikator lain memeriksa sumber lalu menyetujui melalui workflow existing (four-eyes, alasan/catatan dan audit tetap).
4. Kartu pada periode tersebut menampilkan nilai setelah approved/current. Koreksi approved memakai revisi baru. Tidak menulis peringkat atau data institusi pada kode, seed, migration, maupun database dev.

## Bukti dan batas verifikasi

Cadangan berkas sebelum edit, fingerprint seluruh domain dev/berkas terlindungi, log dan ukuran kanvas sebelum/sesudah berada di `.runtime/home-summary/`; tidak untuk commit. Screenshot Edge disimpan di `.runtime/phase3/home-summary-{1440,360}.png` serta `home-institution-approved-{1440,360}.png`. Tes mutasi hanya `_test`, tidak reset database.

Gerbang dijalankan berurutan: `npm test` **101 lulus, 0 gagal, 1 skip** (openpyxl opsional); `npm run test:ui` **47/47**; `npm run db:check` **semua kontrol lulus**; `npm audit --json` **0 kerentanan**. Log `gate-test-final.log`, `gate-ui-final.log`, `gate-db-check.log`, `gate-audit-final.json`. Registry tidak terjangkau dalam sandbox, kemudian audit diulang dengan akses jaringan berizin; hasil nol berasal dari respons terbaru, bukan hasil lama.

Suite UI mencakup perbandingan kedelapan nilai dengan API, publik/login, whitelist satu field total tendik, API rincian 401, NULL, keyboard retry, skeleton/reduced motion, error parsial/total dan retry, serta akreditasi institusi kosong → draft → submitted → approved melalui aktor berbeda pada `_test`. Peringkat fixture dibuat dinamis; nilai kartu berasal dari baris approved, bukan konstanta frontend. Tanggal mulai/akhir tampil. Nilai tendik NULL → 0 → 137 dalam tes API membuktikan endpoint mengikuti approval/revisi, tidak mengambil konstanta atau menjumlah versi/periode.

Regresi Edge beranda 1280/1440/1920/2560/360 dan tambahan 768: alignment container, tanpa overflow, empat kolom desktop/dua kolom mobile-tablet, tinggi kanvas 340/300px. Sesudah pemeriksaan screenshot, label panjang 360 dirapikan agar memakai lebar judul penuh di bawah ikon; seluruh kasus beranda diuji ulang terarah **4/4**, log `ui-final-cosmetic.log`. Screenshot `.runtime/home-summary/cards-{1440,360}.png` diperiksa visual. Kontras teks kartu minimum **6,05:1**; reduced motion juga menghentikan skeleton.

Perbandingan memakai salinan HTML/JS sebelum edit pada server pembanding lokal; berkas proyek tidak dipulihkan/ditimpa. Pengukuran awal tepat sesudah resize menangkap lebar kanvas sementara yang masih berasal dari viewport sebelumnya; baseline diukur ulang setelah dua animation frame, sama dengan pemeriksaan akhir. Enam kanvas pada lima lebar regresi **30/30 dimensi identik**, bukti `canvas-settled-before-*.json`, `canvas-after-*.json`, `canvas-comparison.json`, `ui-baseline-settled-final.log`. CSS ukuran grafik dan hero tidak diedit.

Fingerprint akhir **24/24 domain dev identik**, termasuk seluruh versi/approved; **69/69 berkas terlindungi identik** (.env, manifest/lock, migration, seed dan script DB). Bukti `dev-{before,after}.json`, `protected-{before,after}.json`. Tidak reset/menulis approved dev/menambah dependency/mengubah skema. Cadangan delapan berkas existing di `.runtime/home-summary/backup/`; berkas baru CSS halaman, helper tes dan dokumen audit tidak menggantikan berkas lama. Node runtime v24.19.0; Node 22 belum diuji.

Percobaan awal tes API mengungkap fixture tendik baru ikut terbaca oleh assertion rincian pegawai existing; fixture kini dibersihkan segera dalam `finally` pada `_test`, tanpa melonggarkan assertion. UI awal mengungkap fokus retry hilang ketika tombol dinonaktifkan; fokus kini dipulihkan setelah selesai bila pengguna masih berada pada body. Overflow sementara pada 768 hilang setelah menunggu resize Chart.js, tanpa perubahan aturan ukuran kanvas. Seluruh hasil akhir di atas berasal dari pengulangan yang lulus; log percobaan awal tetap disimpan.
