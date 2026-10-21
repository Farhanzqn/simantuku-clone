# Fase 5A — Perbaikan dan fondasi domain

Tanggal: 8 Oktober 2026, Asia/Jakarta. Tidak menambah domain data baru atau dependency. `.env` tidak diubah; koreksi approved pengguna, password dan data sumber dipertahankan. Dokumen Fase 4 dilengkapi akun demo, alur manual, hasil historis serta keterbatasan.

## Sumber dashboard dan perbaikan mahasiswa

Audit mencakup seluruh route dashboard, view SQL, `api.js`, `home.js`, `pages.js`, header HTTP dan sumber seed. Tidak ditemukan cache data server, localStorage dashboard, atau pembacaan JSON seed saat runtime. Header tetap `Cache-Control: no-store`, fetch memakai `cache: no-store`; ETag dinonaktifkan agar respons tidak dipakai untuk validasi snapshot lama.

| Endpoint dashboard | Sumber runtime |
|---|---|
| mahasiswa, summary bagian mahasiswa, prodi bagian mahasiswa | v_dashboard_mahasiswa: hanya approved/current, per prodi/status/periode |
| mahasiswa-angkatan | v_dashboard_mahasiswa_angkatan: approved/current per prodi/angkatan/periode; metadata rekonsiliasi membaca mahasiswa aktif approved dengan filter yang sama |
| dosen, summary bagian dosen, prodi bagian dosen | v_dashboard_dosen approved/current |
| mahasiswa-baru dan summary PMB | v_dashboard_mahasiswa_baru approved/current |
| tendik | v_dashboard_tendik approved/current |
| lulusan dan summary lulusan institusi | v_dashboard_lulusan approved/current; cakupan institusi terpisah |
| tracer | v_dashboard_tracer approved/current; ringkasan dari v_dashboard_tracer_ringkasan dan denominator lulusan institusi approved/current |
| pegawai, pegawai-internal | v_dashboard_pegawai_ringkasan approved/current; kategori publik/privat terpisah |
| kpi | v_kpi_capaian approved/current, tetap login |
| beban-mengajar, rekognisi-dosen, kinerja-pt | State kosong; tanpa snapshot/dummy |

Statistik Mahasiswa sekarang memiliki ringkasan jumlah/perempuan/persentase, donut gender, donut jenjang dan grafik angkatan. Tabel, grafik prodi, gender, jenjang dan ringkasan memakai satu promise respons `/dashboard/mahasiswa` dengan filter yang sama. Helper `student-summary.js` mempertahankan NULL; persentase/gender lengkap hanya dihitung jika denominator dan komponennya lengkap. Summary API juga menghitung perempuan/persentase dari view mahasiswa yang sama.

Angkatan merupakan input BAA tersendiri, bukan pembagian hasil koreksi total. Endpoint/panel membaca revisi angkatan approved terbaru dan menampilkan total mahasiswa aktif approved terkini serta selisihnya. Mengubah total mahasiswa tidak mengarang alokasi angkatan. BAA perlu mengoreksi formulir angkatan jika ada selisih. Filter status selain aktif menampilkan state belum tersedia untuk rincian angkatan.

## Pengaturan dan login development

- Migration **010_form_policy.sql** menambah `definisi_formulir.perlu_verifikasi` default TRUE untuk seluruh domain existing. Role pengisi mengikuti registry, kepemilikan tetap dari domain_unit dan sesi.
- Admin membuka **http://127.0.0.1:3000/admin/formulir.html**. GET `/api/admin/formulir` dan PATCH `/api/admin/formulir/:domain` hanya admin; PATCH hanya menerima boolean perlu_verifikasi. Perubahan diaudit sebagai `form_policy_update`; trigger database juga menolak aktor non-admin. app_user hanya memiliki SELECT dan UPDATE kolom pengaturan yang diperlukan.
- TRUE mempertahankan alur unit → PRP/admin dan four-eyes. FALSE hanya mengubah submit berikutnya: draft → submitted → approved berlangsung atomik, dengan aktor/waktu, versi revisi dan penanda audit/review `auto-approved`. Pengajuan yang sudah submitted tidak diterbitkan oleh perubahan pengaturan. Konflik current approved masih menolak transaksi.
- Publikasi manual dan otomatis memakai fungsi `publish` yang sama; tidak menyalin logika versi/lock. Four-eyes dan override beralasan pada endpoint review manual tetap berlaku.
- Migration **011_tracer_current_denominator.sql** membuat denominator ringkasan tracer mengikuti lulusan institusi approved/current. Auto-approval lulusan tidak membuat approval baru atas data BPKA; persentase merupakan turunan kedua sumber approved. Jalur review manual existing tetap mempertahankan pembaruan referensi atomiknya.
- `.env.example` menambah `DEV_SKIP_PASSWORD_CHANGE=false`. TRUE hanya efektif bila NODE_ENV=development; tidak mengubah password atau flag database. Production mengabaikan variabel dan menulis peringatan bila di-set. Default tetap wajib ganti pada login pertama. Login, `/auth/me`, halaman privat dan guard tulis memakai kebijakan yang sama; RBAC/CSRF tetap berlaku. Tes mengisolasi opsi lokal agar selalu menguji default keamanan.

## Fondasi penambahan domain

Batas angka zod kini diambil dari kolom `formDefinitions` yang juga dipakai parser browser. Field/grain khusus tetap registry server; metadata tabel dashboard berasal dari registry domain. Seed pengaturan berasal dari registry yang sama dan hanya memasukkan definisi yang belum ada. Langkah yang masih manual ditandai dalam [TAMBAH-DOMAIN.md](TAMBAH-DOMAIN.md), termasuk SQL/grain/sumber, adapter bentuk form, guard halaman, view/agregat, navbar dan tes. Tidak menulis ulang form/workflow yang sudah berjalan.

## Verifikasi nyata

PostgreSQL native Windows 16.15, Node 24.19.0 yang tersedia. Panduan setup tetap Node 22 LTS. Fixture tes terpisah `_test`, dibersihkan; audit dipertahankan dan akun fixture dinonaktifkan. Tidak menjalankan reset.

| Perintah | Hasil |
|---|---|
| npm.cmd run db:migrate | Berhasil; migration 010 dan 011 diterapkan pada dev serta melalui setup tes pada test |
| npm.cmd run db:app-role | Berhasil; privilege tetap terbatas, tanpa mencetak password |
| npm.cmd run db:seed | Berhasil/idempotent; tidak menimpa koreksi, pengaturan atau password |
| npm.cmd run db:check pada dev | Gagal membandingkan baseline: mahasiswa 5.162/perempuan 1.555, satu prodi berbeda dengan rincian angkatan |
| npm.cmd run db:check pada _test | 18 kontrol lulus: seed 5.080/perempuan 1.494, dosen 222, tendik 30, kontrol sumber lainnya tetap benar |
| npm.cmd run db:verify | 8 tes lulus, termasuk kontrol seed, idempotensi, rollback dan audit |
| npm.cmd test | 25 tes API/parser lulus; konsistensi semua bacaan mahasiswa, draft/submitted/rejected, auto-approved, versi/audit, denominator tracer, kebijakan password dan RBAC |
| npm.cmd run test:ui | 11 tes Edge desktop/360px lulus, termasuk ringkasan gender/jenjang setelah approval dan pengaturan formulir admin |

Tes API memeriksa metadata rekonsiliasi angkatan berubah saat mahasiswa di-approve, serta rincian angkatan hanya muncul setelah approval formulirnya sendiri. Tes UI mempertahankan alur clipboard/autosave BAA → PRP; revisi dengan perempuan NULL menampilkan komposisi belum lengkap dan jenjang mengikuti 5.896 mahasiswa fixture, bukan seed.

Pemeriksaan sintaks JavaScript dan Git diff whitespace lulus. Perubahan Fase 4/5A masih working tree; tidak membuat commit tambahan atau memasukkan rahasia. Daftar perubahan Fase 5A:

- Migration 010/011; `db/scripts/seed-form-policy.js` dan integrasinya di `seed.js`.
- `server/app.js`, `routes/auth.js`, `routes/admin.js`, `routes/forms.js`, `routes/dashboard.js`, `services/data.js`, `services/password-policy.js`, `validators/domains.js`.
- `static-web/admin/formulir.html`, `assets/js/admin-ui.js`, `input.js`, `pages.js`, `home.js`, `student-summary.js`, `api.js`, `navbar.js`.
- Tes API/UI/parser, `.env.example`, README, AGENTS, SETUP-WINDOWS, FASE-4, FASE-5A dan TAMBAH-DOMAIN.

## Temuan yang belum selesai

Dev sudah mempunyai koreksi manual approved prodi 01, versi 4: 500 mahasiswa/100 perempuan, menggantikan seed 418/39. Karena itu total approved dev 5.162/1.555 berbeda dari baseline 5.080/1.494, sedangkan angkatan masih 5.080. Data ini tidak diubah untuk mengejar kontrol. Pemilik BAA perlu memastikan rincian angkatan sesuai koreksi nyata melalui formulir dan approval biasa. `db:check` dev tetap akan gagal selama berbeda dari baseline; kontrol seed `_test` tetap lulus.

Fakultas/pemetaan, domain baru, import historis UI dan uji Docker tetap di luar fase ini. Berhenti dan tunggu **"Lanjut Fase 5B"**.
