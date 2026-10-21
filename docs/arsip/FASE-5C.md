# Fase 5C — Kerja sama, produktivitas dosen, AMI

Tidak mengulang B1–B5, tidak mengubah .env/data approved lama, tanpa reset atau dependency baru. Checklist TAMBAH-DOMAIN berlaku untuk setiap bagian.

| Bagian | Status | Tes |
|---|---|---|
| C1 Kerja sama | Selesai | API/parser 32/32, database 12/12, Edge 23/23 |
| C2 Produktivitas dosen | Selesai | API/parser 33/33, database 13/13, Edge 25/25 |
| C3 AMI | Selesai | API/parser 34/34, database 14/14, Edge 28/28 |

## Keputusan skema C1 sebelum migrasi

Empat tabel berbeda cakupan, sehingga tidak dijumlahkan menjadi total institusi atau mitra unik. Grain: periode laporan + tahun + kelompok sumber. `kerjasama_revisi` menyimpan jumlah sesuai sumber, jumlah baris sumber, sel Total kosong dan jumlah per status (selesai, berjalan, tahap/proses penjajakan, dibatalkan). Semua angka nullable; status yang tidak dirinci tetap NULL. Jenis dokumen MoU/MoA/PKS/IA tidak ditebak dari kolom numerik Tabel 2.24. Kategori/lingkup dan satuan ditentukan oleh kelompok, bukan perkiraan asal perusahaan.

- Tabel 2.3, PDF 33–38/cetak 25–30: akademik dalam negeri. Ada 170 baris; penjumlahan 169 sel Total tersedia = 235, baris 80/PT PLN UP3 BIMA kosong (NULL). Jangan menyebut 235 sebagai jumlah mitra unik atau total lengkap. Simpan bukti nomor baris/nilai/halaman pada seed dan flag untuk sel kosong. Klasifikasi narasi per jenis tidak dipakai karena sel gabungan tabel dan narasi tidak bisa dipadankan dengan yakin.
- Tabel 2.4, PDF 38/cetak 30: akademik luar negeri, tiga baris Total=1, jumlah 3. Nama institusi AseanSpace, ICBC, HR&CDI dapat ditampilkan; tidak memperluasnya dengan sembilan calon mitra yang hanya disebut dalam narasi.
- Tabel 2.24, PDF 84–86/cetak 76–78, narasi PDF 87/cetak 79: 29 kemitraan kelembagaan nasional, selesai 6, berjalan 14, tahap penjajakan 5, proses penjajakan 3, dibatalkan 1. Rincian dan narasi cocok. Tidak otomatis mencampurkan dengan tabel akademik atau horizontal.
- Tabel 2.25, PDF 87–89/cetak 79–81: 12 portofolio horizontal, selesai 4, berjalan 7 (termasuk ejaan sumber On Progres), dibatalkan 1. Status penjajakan tidak dirinci, tetap NULL. Nominal kontrak tidak disajikan pada modul publik kerja sama karena keuangan wajib login; tidak dijadikan pendapatan/realisasi kas.

Nama mitra yang ditampilkan hanya institusi, opsional pada agregat. Seed nama tersedia untuk tiga mitra internasional; daftar nama lengkap pada kelompok lain tidak diringkas secara otomatis dari sel gabungan. UI menandai nama belum tersedia, bukan menebak atau menganggap daftar sudah lengkap. Tidak menyimpan nama individu/PIC/auditor. Form menyediakan kolom teks nama institusi opsional dan kolom angka, memakai autosave/paste/riwayat yang sudah ada.

Master memiliki **Bagian Pengembangan Kemitraan**, unit_id dibaca dari domain_unit `kerjasama`, kode **NULL**. Role `kerjasama` sudah ada dan dapat mengisi; admin juga dapat mengisi. Tidak membuat kode Kerma/BPKL/BPKU berdasarkan singkatan narasi yang belum dikonfirmasi. Akun dapat dibuat admin dengan role kerjasama dan unit tersebut; belum menambah akun demo/password atau menyentuh .env. Perlu_verifikasi default TRUE, review PRP/admin, view approved dan visibilitas publik.

Endpoint rencana: GET /api/dashboard/kerjasama; halaman /kerja-sama.html (Kinerja → Kerja Sama), form /input/kerjasama.html. Filter periode laporan/tahun, grafik status terpisah per kelompok, Total Data, XLSX terfilter dan loading/kosong/error memakai B1.

## C1 selesai

Migration **016_cooperation.sql**, seed **kerjasama-2026-s1.json**, ledger **cooperation-2026-s1-v1**, script seed-cooperation.js, routes/cooperation.js, cooperation-page.js, kerja-sama.html, input/kerjasama.html. Empat baris v1 melalui draft/submitted/publish approved oleh seed owner-only. Nilai sumber dan NULL tervalidasi; status tersedia 29/12 cocok dengan rincian. Flag baru **kerjasama-akademik-total-kosong** menyimpan baris 80, kutipan Tabel 2.3 PDF 35/cetak 27 dan bukti 170 baris, 169 sel terisi = 235. Tidak ada perbandingan angka antar empat tabel sebagai konflik karena cakupannya berbeda.

Tes C1: RBAC lintas unit/halaman, master tanpa kode, default review, draft/submitted/reject privat, approve/revisi publik, PUBLIC_DASHBOARD=false menolak anonim, sumber/nama institusi/status/ekspor/empty dan form 360px. Migration/seed dev/test berhasil; npm test 32/32, db:verify 12/12, Edge 23/23. Tidak membuat akun demo baru; admin dapat menambah akun role kerjasama dengan unit yang ada melalui /admin/users.html.

## Keputusan C2 sebelum migrasi

Tabel 2.8 **PDF 43/cetak 35** berada di bagian 2.2 Bidang SDM; narasi PDF 44/cetak 36 menyebut tindak lanjut BSDM. Pemilik baru produktivitas-dosen = BSDM. Tiga ukuran unik institusi: publikasi ilmiah target 245/realisasi 62/capaian laporan 25%; rata-rata beban mengajar target 12/realisasi 12,83 SKS/capaian 106,92%; pelatihan target 60/realisasi 112/capaian 186,67%. Satuan berbeda, tidak dijumlahkan; tanpa sitasi/nama dosen atau rincian prodi yang tidak ditemukan.

Penelitian/PkM Tabel 2.8 tidak disalin menjadi angka dashboard baru; halaman tetap menunjuk penelitian/PkM Fase 5B sebagai sumber resmi 4.7/4.9. Tiga flag perbedaan yang sudah ada tetap digunakan dan ditampilkan sebagai referensi internal saat verifikasi produktivitas, tanpa menimpa atau menggandakan flag/data. Persentase laporan disimpan tersendiri; persentase hitung boleh ditampilkan dengan label terpisah. Grafik dipisahkan tiap ukuran agar SKS tidak dijumlah dengan publikasi/pelatihan. Form tab BSDM memakai kategori + tahun, kolom target/realisasi/capaian laporan. Beban mengajar per prodi pada halaman lama tetap empty sampai ada sumber rincian.

## C2 selesai

Migration **017_faculty_productivity.sql** menambah allowlist domain `produktivitas-dosen`, tabel produktivitas_dosen_revisi/view approved/grants/guard, kebijakan publik. Seed **produktivitas-dosen-2026-s1.json**, script seed-productivity.js dan ledger **productivity-2026-s1-v1** memasukkan master kepemilikan BSDM secara insert-only setelah master tersedia (termasuk instalasi baru), lalu tiga baris v1 draft/submitted/publish approved. Tidak mengubah checksum migration/seed lama. perlu_verifikasi default TRUE. Capaian hitung memakai realisasi/target × 100, NULL bila denominator nol/kosong; capaian laporan tetap nilai sumber.

Endpoint **GET /api/dashboard/produktivitas-dosen**, halaman **/produktivitas-dosen.html**, submenu **Dashboard Data → Dosen → Produktivitas Dosen**. Form di tab **Produktivitas Dosen /input/bsdm.html**. Filter periode laporan/tahun, tiga grafik terpisah, tabel institusi, Total Data, XLSX terfilter, sumber/label periode dan loading/kosong/error memakai B1. Tidak membuat sitasi yang tidak ada dalam tabel atau membuka data individual.

Verifikasi PRP/admin menampilkan tiga flag LPPM yang sudah ada lewat referensi baca saja, tanpa membuat salinan atau mengubah isinya. Endpoint dashboard tidak mengambil flags/aktor. Tes membuktikan BSDM bisa input, BAA tidak bisa tulis, kategori penelitian/PkM/sitasi dan field nama_dosen ditolak; draft/submitted/rejected privat, approval/revisi mengubah dashboard dan target nol menghasilkan NULL. Database memeriksa sumber/angka/desimal/seed audit dan jumlah flag tetap tiga. Edge memeriksa SKS 12,83, sumber 2.8, tiga grafik, empty/ekspor serta tab BSDM pada 360px. Hasil: npm test **33/33**, db:verify **13/13**, Edge **25/25**.

File baru C2: migration 017, seed JSON, seed-productivity.js, routes/productivity.js, productivity-page.js, produktivitas-dosen.html. Integrasi C1/C2: seed.js, formDefinitions/validators, input.js, navbar/api.js, app.js, routes/data.js (referensi flags internal), tes API/database/UI, README/AGENTS/dokumentasi. Tidak ada dependency baru.

## Keputusan skema C3 sebelum migrasi

Rincian 28 entitas Tabel 4.12 (PDF 128–130/cetak 120–122) identik dengan pengulangan Tabel 4.14 (PDF 132–133/cetak 124–125). Disimpan satu butir per entitas, bukan dua salinan. Tabel 4.15 (PDF 134–135/cetak 126–127) memakai instrumen berbeda: jumlah standar dan kesenjangan awal disimpan dalam kolom terpisah dari skor/realisasi kesiapan. Provenance utama, pembanding dan evaluasi diri terpisah. Empat butir rekap Tabel 4.13 (PDF 131/cetak 123) hanya menyimpan jumlah prodi per kelompok; tidak digabung dengan 28 entitas.

Kontrol rincian cocok: rata-rata kesiapan prodi 52,13%, unit 72,23%; distribusi 1/7/5/6; standar/kesenjangan prodi 1.357/1.050, unit 116/18, institusi 1.473/1.068 (72,5%). Tidak ada flag selisih angka. Dua flag semantik diperlukan untuk judul “Evaluasi Hasil AMI” vs penjelasan bahwa semester I bukan audit formal, serta narasi merujuk 4.14 padahal rincian kesenjangan berada pada 4.15.

Grain `periode_laporan + tahun + kategori` dalam ami_revisi; pemilik PJM existing, perlu_verifikasi TRUE. Nama sumber dipertahankan tanpa pemetaan/kode baru. Sembilan status unit NULL; nol eksplisit PDSI tetap nol. Tidak membuat minor/mayor/OBS atau auditor/auditee. Halaman dan API wajib login, termasuk ketika saklar publik aktif. Label menyatakan evaluasi diri/kesenjangan awal, bukan audit formal.

## Batas C2 (historis)

Catatan historis: sesi C1/C2 berhenti pada batas C2 yang bersih. C3 kemudian dilanjutkan dan sudah selesai; hasil akhir dicatat di bagian C3 di bawah. Fase 5D belum dimulai.

Penelusuran awal C3 (historis; kini diterapkan, hasil akhir di bawah):

- Unit pengisi PJM dan domain `ami` sudah tersedia pada master; visibilitas existing authenticated. Tetap wajib login pada API dan halaman, termasuk saat PUBLIC_DASHBOARD=true. Pengunjung anonim harus ditolak 401/403 pada keduanya, bukan hanya menyembunyikan navbar.
- Tabel 4.12 PDF **128–130/cetak 120–122** berisi 19 prodi + 9 unit pendukung, skor standar, realisasi, persentase kesiapan, status. Tabel 4.14 PDF **132–133/cetak 124–125** mengulang rincian tersebut: bandingkan dan jangan menggandakan angka. Sembilan status unit pendukung '-' harus NULL.
- Tabel 4.13 PDF **131/cetak 123**: distribusi prodi ≥80% = 1; 60–<80% = 7; 40–<60% = 5; <40% = 6. Narasi rata-rata 52,13% prodi/72,23% unit pendukung harus dicocokkan dengan rincian sebelum seed.
- Tabel 4.15 PDF **134–135/cetak 126–127**: standar/indikator dan kesenjangan awal 28 entitas. Narasi menyebut 1.068 dari 1.473 (72,5%), prodi 1.050/1.357 (77,38%), unit 18/116 (15,52%); wajib kontrol dari rincian. Minor/mayor/OBS tidak dirinci terpisah, jangan dipecah.
- Pendahuluan bagian 4.3 PDF **128/cetak 120** menyebut AMI formal baru semester II. Narasi PDF **135/cetak 127** menegaskan angka semester I merupakan **potensi ketidaksesuaian/kesenjangan awal/evaluasi diri**, bukan temuan audit formal. Judul 4.15 “Evaluasi Hasil AMI” dan rujukan narasi 4.14 perlu penjelasan/flag bila digunakan. Jangan menampilkan status seolah audit formal sudah selesai.
- Nama S1 Geografi, S1 Data Science, BPA/BKMK/BLKA/BPRP/PDSI/BSFU harus dipertahankan sebagai nama sumber atau dipetakan hanya bila yakin; jangan membuat kode master/fakultas dari singkatan laporan. Tanpa auditor/auditee individual.

## Verifikasi akhir pada batas C2

| Perintah | Hasil nyata |
|---|---|
| npm run db:migrate | Berhasil; 016/017 diterapkan di dev/test, pengulangan idempotent |
| npm run db:app-role | Berhasil; runtime app_user tetap terbatas |
| npm run db:seed | Berhasil/idempotent; ledger baru insert-only, data approved lama/password/pengaturan dipertahankan |
| npm run db:check (dev) | 18/18 kontrol lulus |
| npm run db:verify (test) | 13/13 lulus, termasuk 18 kontrol seed |
| npm test | 33/33 lulus |
| npm run test:ui | 25/25 Edge desktop/360px lulus, tanpa overflow/CSP/exception |
| Git diff --check | Lulus |

Kontrol tetap mahasiswa aktif **5.080**, perempuan **1.494**, dosen **222**, tendik **30 (21 laki-laki/9 perempuan)**. PMB 2.030/1.678 dan wirausaha tracer 2 juga tetap. Tidak mengubah .env, mereset database atau menimpa approved lama.

Flag baru C1/C2 hanya **kerjasama-akademik-total-kosong**; tiga flag perbedaan produktivitas dari Fase 5B direferensikan kembali, bukan digandakan. Data tidak ditemukan: nilai Total baris 80 Tabel 2.3, sitasi, rincian beban mengajar per prodi, rincian status akademik, serta daftar mitra institusi lengkap yang bisa dipadankan tanpa menebak dari sel gabungan. Nominal kontrak yang memang ada di Tabel 2.25 sengaja tidak masuk dashboard publik karena kebijakan keuangan wajib login.

Keputusan/data yang perlu pemilik: konfirmasi kode resmi Bagian Pengembangan Kemitraan (master tetap NULL), lengkapi Total baris 80, pastikan perbedaan definisi penelitian/PkM yang telah ditandai LPPM. C3 perlu keputusan skema setelah mencocokkan semua rincian AMI; jangan menyebut kesiapan semester I sebagai hasil audit formal.

Untuk mencoba: `npm run dev`; buka **http://127.0.0.1:3000/kerja-sama.html** dan **http://127.0.0.1:3000/produktivitas-dosen.html**. Form: **/input/kerjasama.html** (role kerjasama dengan unit master yang sudah ada, atau admin) dan **/input/bsdm.html → Produktivitas Dosen** (BSDM/admin). Tidak membuat akun/password demo baru: admin dapat membuat akun Kerja Sama di /admin/users.html dengan role kerjasama, lalu memilih unit “Belum ada kode · Bagian Pengembangan Kemitraan”. Password BSDM/admin mengikuti variabel .env yang sudah didokumentasikan di FASE-4.md, tanpa menampilkan nilainya.

## C3 — selesai pada 9 Oktober 2026

Migration **018_ami.sql** membuat `ami_revisi`, view `v_dashboard_ami`, FK provenance utama/pembanding/evaluasi diri, unique current/working, trigger workflow/audit dan grant app_user terbatas. Registry dan konfigurasi bersama `ami-schema.js` menyediakan 28 nama entitas + empat rekap. Pemilik PJM dan kebijakan authenticated memakai master existing; perlu_verifikasi default TRUE. Tidak membuat unit/kode/fakultas atau pemetaan Geografi/Data Science/BPA/BKMK/BLKA/BPRP/PDSI/BSFU.

Seed **ami-2026-s1.json**, ledger/checksum **ami-2026-s1-v1**, insert-only. Sebanyak 32 butir v1 melewati draft → submitted → publish approved dengan aktor seed nonaktif dan pengecualian sistem owner-only. Tabel 4.12 dan 4.14 terbukti identik; hanya satu copy kesiapan. Tabel 4.13 menyimpan rekap sumber terpisah; dashboard membandingkannya dengan hitungan dari revisi approved terbaru. Tabel 4.15 menyimpan standar/kesenjangan dalam kolom terpisah, bukan selisih skor kesiapan. Setiap baris bersumber nomor tabel/halaman PDF/cetak; sembilan status unit NULL dan nol eksplisit kesenjangan PDSI tetap 0.

Endpoint **GET /api/dashboard/ami** hanya membaca view approved dan menerima periode laporan/tahun. **API dan /ami.html menolak anonim 401**, termasuk URL halaman terenkode, sekalipun PUBLIC_DASHBOARD=true. Pengguna terautentikasi termasuk viewer boleh membaca; modul nonaktif tetap ditolak. Tulis AMI hanya PJM dengan unit sesi atau admin; review PRP/admin memakai workflow, four-eyes dan audit yang sama. HTML/API tetap no-store. Pengaturan visibilitas tidak dapat membuat AMI terbuka bagi anonim karena guard login eksplisit.

Halaman **/ami.html**, submenu **Kinerja → AMI — Evaluasi Diri**, memakai filter URL, Total Data, grafik Kolom/Garis/Bar, XLSX terfilter, sumber lengkap/label periode dan loading/kosong/error. Ringkasan prodi/unit, rekap sumber vs hitungan, rincian kesiapan dan kesenjangan awal ditampilkan terpisah. Nama mengikuti laporan; bukan pemetaan master baru. Label menyebut **bukan audit formal** dan AMI formal baru semester II; tidak menampilkan nama auditor/auditee. Tab baru **AMI — Kesiapan dan Kesenjangan Awal** pada **/input/pjm.html** memakai form, clipboard, autosave, draft/submit, riwayat dan salin periode existing; tanpa template file. Validasi bersama melarang mencampur isian Rekap dengan metrik entitas, selain batas angka/NULL yang sama di browser/server. Membuka form tidak membuat draft.

Flag baru, internal dan bersumber dua kutipan:

- **ami-istilah-kesenjangan-awal**: judul Tabel 4.15 PDF 134/cetak 126 vs pendahuluan 4.3 PDF 128/cetak 120 bahwa audit formal baru semester II. Label UI mengikuti penjelasan narasi, tidak menyebut angka sebagai temuan formal.
- **ami-rujukan-narasi-berbeda**: narasi PDF 135/cetak 127 merujuk 4.14 untuk 1.068/1.473; rincian standar/kesenjangan berada pada 4.15 PDF 134–135/cetak 126–127. Angka tidak dikoreksi; rujukan silang ditandai untuk PJM.

Semua kontrol numerik cocok dengan narasi: prodi 52,13%, unit 72,23%; distribusi 1/7/5/6; prodi 1.050/1.357 (77,38%), unit 18/116 (15,52%), total 1.068/1.473 (72,5%). Tidak menambah flag selisih angka. Minor/mayor/OBS, auditor/auditee individual dan hasil AMI formal tidak tersedia: tidak dibuat. PJM perlu memastikan istilah/rujukan tabel dan melengkapi hasil formal semester II melalui input periode baru, serta mengonfirmasi pemetaan nama sumber bila diperlukan.

### Verifikasi akhir C3

| Perintah | Hasil nyata |
|---|---|
| npm run db:migrate | Berhasil; 018 diterapkan di dev/test, ulang idempotent |
| npm run db:app-role | Berhasil; app_user tetap terbatas, tanpa mencetak rahasia |
| npm run db:seed | Berhasil/idempotent; approved lama/password/pengaturan tidak ditimpa |
| npm run db:check | 18/18 kontrol dev lulus |
| npm run db:verify | 14/14 lulus; seed status/audit/provenance/NULL, rekap dan idempotensi |
| npm test | 34/34 lulus; PJM/RBAC, 401 halaman/API, draft/submitted/reject, approve/revisi, NULL dan validasi |
| npm run test:ui | 28/28 Edge lulus; desktop/360px, sumber, label, NULL, empty dan perubahan tabel/grafik setelah approval/revisi PRP |
| Git diff --check | Lulus |

Harness Edge memakai limit login 20 untuk akun fixture tambahan; runtime tetap 10, CSRF/helmet/auth tidak diubah dan tes rate limit tersendiri tetap lulus. Dua kegagalan awal tes database berasal dari ekspektasi urutan rekap dan nama kolom kunci sumber; satu kegagalan awal UI berasal dari selektor filter tahun. Semua diperbaiki pada tes, tanpa mengubah angka laporan. Kontrol utama tetap **5.080 / 1.494 / 222 / 30 (21/9)**; tidak mengubah .env, reset database atau data approved dev lama.

File baru C3: `db/migrations/018_ami.sql`, `db/seed/ami-2026-s1.json`, `db/scripts/seed-ami.js`, `server/routes/ami.js`, `static-web/ami.html`, `static-web/assets/js/ami-schema.js`, `static-web/assets/js/ami-page.js`, `server/tests/ui-server.js`. Integrasi: seed.js, app.js, validators/domains.js, input-schema.js/input.js, api.js/navbar.js, tes API/database/UI, README/AGENTS dan dokumen ini. Tanpa dependency baru atau penghapusan file lama.

Untuk mencoba: `npm run dev`, login lalu buka **http://127.0.0.1:3000/ami.html**. PJM/admin mengisi **/input/pjm.html → AMI**; PRP/admin meninjau di **/verifikasi.html**. Akun dan nama variabel password mengikuti **docs/FASE-4.md**; tidak membuat akun/password baru. **Fase 5C selesai. Berhenti; Fase 5D menunggu perintah pengguna.**
