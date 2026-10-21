# Fase 5D — Audit input dan domain internal

Urutan D0 → D1 → D2 → D3. Tidak mengulang fase sebelumnya, tidak reset, tidak mengubah .env atau approved lama. Domain baru mengikuti TAMBAH-DOMAIN; Fase 5E belum dimulai.

| Bagian | Status | Verifikasi |
|---|---|---|
| D0 Audit form input | Selesai | API/parser 35/35, database 14/14, Edge 29/29 |
| Langkah 0 keamanan | Selesai | API/parser 36/36, database 15/15, Edge 30/30 |
| D1 Keuangan | Selesai | API/parser 38/38, database 16/16, Edge 32/32 |
| D2 KPI per perspektif | Selesai | API/parser 39/39, database 16/16, Edge 32/32; 28 indikator A–D |
| D3 Pegawai/formasi | Selesai | API/parser 40/40, database 17/17, Edge 34/34 |

## D0

Lihat [MATRIKS-INPUT.md](MATRIKS-INPUT.md). PPA/PMB serta BSDM/dosen/jafung/pendidikan sudah mempunyai form; tidak dibuat duplikat. Celah dilengkapi pada registry/adapter bersama: pilihan lulusan institusi pada BAA, Ringkasan Tracer Institusi pada BPKA, Input Pembilang/Penyebut KPI pada PRP. Data lama tetap; perubahan memakai revisi/approval biasa. Tidak menambah migration/seed/dependency untuk tiga bentuk existing ini. Kode input KPI berasal dari butir approved existing, bukan kode rekaan; indikator/kode baru memerlukan definisi PRP.

Pemilik yang belum jelas dicatat pada matriks: pemeliharaan nomenklatur/master prodi/pemetaan fakultas dan metrik Kinerja PT gabungan. Rincian beban mengajar/rekognisi belum tersedia; tidak dibuat dummy.

Form /input/baa.html → Lulusan / Wisuda menyediakan pilihan Per program studi / Institusi. Mode institusi memakai prodi_id NULL dan periode akademik NULL; sel bisa diisi tanpa periode wisuda wajib seperti mode prodi. /input/bpka.html → Ringkasan Tracer Institusi memilih tahun lulus serta label sementara/final, dengan referensi otomatis ke lulusan institusi approved pada periode/tahun yang sama. Responden wajib terisi dan tidak boleh melampaui denominator sesuai validasi existing. Kolom hasil ringkasan nullable; tidak dicampur dengan total wirausaha dari rincian prodi. /input/prp.html → Input Pembilang / Penyebut KPI menggunakan kode/satuan input approved yang sudah ada dan tanggal snapshot; perbaikan tetap melalui revisi, bukan mutasi approved. Tidak menurunkan denominator jafung dari total dosen atau menghitung ulang nilai resmi KPI diam-diam.

Tes API memakai fixture _test: BAA mengisi lulusan institusi, BPKA mengisi ringkasan, PRP/admin mereview, draft/submitted/rejected tidak terbit, revisi approved mengubah ringkasan, BAA/BPKA ditolak dari form lintas unit, dan input KPI PRP harus disetujui reviewer berbeda. Nilai capaian KPI resmi tidak berubah. Edge memeriksa nilai seed 1.100 / 328 / 118 dan 198, NULL/konteks institusi, tab dan 360px, serta memastikan membuka form tidak menulis row baru. Seluruh tes lama tetap dijalankan.

Satu percobaan awal Edge gagal pada tes password karena form halaman baru sudah muncul sebelum handler JS siap; tes berikutnya ikut gagal karena password/sesi fixture belum selesai diganti. Harness kini menunggu document.readyState complete dan pesan mismatch sebelum melanjutkan. Pengulangan terakhir 29/29 lulus. Logika autentikasi, rate limit, CSRF dan hak akses runtime tidak diubah.

## Verifikasi nyata pada batas D0

| Perintah | Hasil |
|---|---|
| npm run db:migrate | Berhasil; tidak ada migration baru D0 |
| npm run db:app-role | Berhasil; tetap app_user terbatas, rahasia tidak dicetak |
| npm run db:seed | Berhasil/idempotent; tidak menimpa data/password/pengaturan |
| npm run db:check (dev) | 18/18 kontrol lulus |
| npm run db:verify (_test) | 14/14 lulus |
| npm test | 35/35 lulus |
| npm run test:ui | 29/29 Edge lulus, desktop/360px |
| Git diff --check | Lulus |

Kontrol tetap mahasiswa aktif 5.080 / perempuan 1.494 / dosen 222 / tendik 30 (21/9), PMB 2.030/1.678, wirausaha tracer 2. Tidak mengubah .env, reset, menimpa approved dev, atau mengubah checksum migration/seed lama. Tidak menambah quality flag pada D0.

File baru: MATRIKS-INPUT.md dan FASE-5D.md. Perubahan D0: server/routes/forms.js, static-web/assets/js/input-schema.js/input.js, server/tests/api.test.js/ui.test.js, README.md dan AGENTS.md. Tidak ada file lama yang dihapus.

## Langkah 0 — keamanan

Migration 019_internal_visibility.sql menetapkan tendik dan seluruh modul internal sebagai authenticated. Seed ledger baru phase5d-internal-visibility-v1 dijalankan setelah seed visibilitas Fase 4 agar instalasi baru tidak membuka tendik kembali; seed lama/checksum tetap. API tendik mempunyai guard login eksplisit, sehingga pengaturan keliru public juga tidak membuka data. Halaman /statistik-tendik.html baru memakai view approved existing, form BSDM existing, filter B1, grafik, Total Data dan XLSX. Tidak menambah data atau menggabungkan rincian prodi 30 dengan institusi 109.

Audit: API KPI/IKU, AMI, pegawai-internal, quality flags, master KPI dan Target RKA sudah memaksa login. Halaman KPI dan kualitas data sebelumnya mengarahkan anonim ke login (302); kini menolak 401 sebelum HTML, sama seperti AMI dan tendik. Keuangan/formasi belum mempunyai endpoint/halaman dashboard, sehingga belum ada data yang terbuka; kebijakan existing tetap authenticated. Halaman ruang-unit memakai sesi/role dan hanya BSDM/admin memuat ringkasan pegawai internal. Endpoint /dashboard/pegawai hanya mengembalikan dosen tetap/tidak tetap publik. Tes juga mengubah sementara kebijakan internal menjadi public di database test dan memastikan guard tetap menolak anonim; konfigurasi dipulihkan.

## Keputusan skema D1 sebelum migrasi

Satu tabel keuangan_revisi, grain periode laporan + tahun + kategori (17 butir): lima ukuran Tabel 2.12, dua pendapatan 2.13, empat biaya 2.14, enam komponen laporan 4.19. Satuan tetap per kategori (kali, %, Rp/mahasiswa, Rp); kelompok dan satuan berasal dari konfigurasi bersama. Tidak menjumlahkan ukuran berbeda atau menyamakan cakupan empat tabel. Kolom target, realisasi, capaian_laporan, periode_sebelumnya, perubahan dan status_sumber nullable; perubahan bertanda negatif diterima, tanda kurung dinormalisasi hanya pada kolom tersebut. Periode sebelumnya tidak diberi kode semester rekaan. Laba/Rugi sumber disimpan, tidak diturunkan dari pendapatan dikurangi beban.

Pemilik BKU existing; perlu_verifikasi TRUE, workflow dan audit bersama, view hanya approved. Halaman/API keuangan login eksplisit. Seed v1 insert-only bersumber halaman PDF/cetak 58/50, 60/52, 61/53, 144/136; penjelasan rupiah PDF 145/137. KPI Rp0,417 M dinormalisasi Rp417.000.000 untuk flag pembanding terhadap pendapatan mahasiswa Rp59.395.010.115; nilai KPI tetap. Perbedaan pendapatan/beban 4.19 vs rincian 2.13/2.14 ditandai untuk konfirmasi cakupan; rujukan narasi 4.16 vs tabel 4.19 ditandai terpisah. Kontrak 2.25 tidak masuk modul ini.

## Batas sesi dan kelanjutan

**Fase 5D selesai sampai D3.** Bagian D0 sampai D2 tidak diulang; hasil D3 dan verifikasi akhir dicatat di bawah. Fase 5E belum dimulai dan menunggu instruksi pengguna.

Penelusuran awal D1 (read-only, belum menjadi data aplikasi atau flag baru):

- Tabel 2.12 PDF 58/cetak 50: lima rasio/ukuran dengan satuan berbeda (kali, %, Rp per mahasiswa). Jangan menjumlahkan rasio dengan nominal; status sumber dipertahankan.
- Tabel 2.13 PDF 60/cetak 52: pendapatan mahasiswa target Rp142.291.028.375/realisasi Rp59.395.010.115; non-mahasiswa Rp85.000.000.000/Rp2.112.640.000. KPI menulis Rp0,417 M pada Ringkasan Eksekutif PDF 3/cetak iii dan rincian KPI PDF 146/cetak 138. Wajib flag kutipan kedua sumber setelah satuan dinormalisasi, tanpa mengubah nilai KPI atau pendapatan.
- Tabel 2.14 PDF 61/cetak 53: empat komponen biaya, nilai target/realisasi Rp dan persentase sumber. Kontrak Tabel 2.25 bukan realisasi kas dan tidak digabung.
- Tabel 4.19 PDF 144/cetak 136: enam komponen, realisasi periode ini/sebelumnya/perubahan. Dua penurunan memakai kurung, bukan NULL atau nol; jangan gunakan parser angka nonnegatif untuk kolom perubahan. Narasi Rp ada pada PDF 145/cetak 137. Periode sebelumnya tidak disebut dengan kode semester; jangan menebak 2025-S2. Narasi menyebut Tabel 4.16 padahal tabelnya 4.19; tinjau flag rujukan. Pendapatan dan beban tabel ini berbeda cakupan/jumlah dengan rincian 2.13/2.14; catat sumber/definisi, jangan disamakan diam-diam.

D2 di atas adalah penelusuran historis; hasil selesai di bawah. D3 kemudian selesai, dengan penelusuran formasi dan rincian pegawai dicatat di bagian D3. Endpoint tendik wajib login setelah Langkah 0; ringkasan dosen tetap/tidak tetap tetap publik. Jangan menjumlahkan 30 tendik prodi dengan 109 institusi.

## D1 — selesai

Migration **020_finance.sql** membuat keuangan_revisi/view approved, satuan, audit/workflow dan grants minimum app_user; **021_finance_unit_guard.sql** mengisi satuan dari kategori sebelum guard workflow. Percobaan seed awal rollback karena kolom generated baru dihitung setelah BEFORE trigger, sehingga guard melihat satuan berubah ketika publikasi. Migration 021 memperbaiki urutan tanpa mengubah checksum 020; fungsi unit khusus keuangan tidak mengubah alur approval/four-eyes. Seed berhasil setelahnya, tidak meninggalkan butir parsial.

Seed **keuangan-2026-s1.json** dan ledger **finance-2026-s1-v1**, checksum insert-only: 17 butir draft → submitted → publish approved oleh seed nonaktif, owner-only. Setiap angka memiliki sumber tabel/halaman. Rasio bersatuan kali/%/Rp per mahasiswa disimpan terpisah; persentase laporan tidak dihitung ulang. Dua perubahan negatif Tabel 4.19 adalah **-5.310.639.000** dan **-45.994.239.000**. Kolom yang tidak berlaku NULL. Status 2.12 dipertahankan, tidak dihitung dari asumsi arah capaian. Periode sebelumnya tidak diberi kode semester; kontrak 2.25 tidak dipakai.

**GET /api/dashboard/keuangan** dan **/keuangan.html** menolak anonim 401, termasuk URL terenkode dan saat kebijakan keliru public. Viewer/unit aktif dapat membaca. Submenu **Kinerja → Keuangan** mempunyai penanda login. Dashboard menampilkan empat tabel terpisah, grafik tiap ukuran bersatuan sama, filter periode/tahun, Total Data, XLSX terfilter serta loading/kosong/error. Form **/input/bku.html** BKU/admin memakai registry/form bersama, 17 kategori, autosave/paste/riwayat, salin periode dan review PRP/admin. Validasi browser/server melarang isian kolom yang tidak berlaku pada kelompok; perubahan menerima negatif dan notasi kurung saat paste, kolom nonnegatif tetap menolak negatif. Tidak memakai template file atau dependency baru.

Empat flag baru internal, masing-masing mempunyai kutipan dua sumber atau lebih:

- **keuangan-kpi-pendapatan-berbeda**: KPI Rp0,417 M = Rp417.000.000 (Ringkasan Eksekutif PDF 3/cetak iii dan 4.20 PDF 146/cetak 138), vs mahasiswa Rp59.395.010.115 (2.13 PDF 60/cetak 52). Nilai KPI tidak diubah.
- **keuangan-rujukan-narasi-berbeda**: judul 4.19 vs rujukan 4.16 pada awal narasi PDF 144/cetak 136 yang berlanjut PDF 145/cetak 137.
- **keuangan-pendapatan-cakupan-berbeda**: 4.19 Rp144.942.035.000 vs jumlah dua rincian 2.13 Rp61.507.650.115. Jumlah pembanding diberi label hasil penjumlahan rincian, bukan angka total baru laporan.
- **keuangan-beban-cakupan-berbeda**: 4.19 Rp137.585.395.000 vs jumlah empat rincian 2.14 Rp60.761.846.000. Tidak dipaksakan sama atau digabung.

Pemeriksaan silang akhir menambahkan flag kelima **keuangan-kpi-non-mahasiswa-berbeda**: KPI A2 Rp0,025 M = Rp25.000.000 (4.20 PDF 146/cetak 138) vs Rp2.112.640.000 (2.13 PDF 60/cetak 52). Kedua kutipan/nilai ternormalisasi tersimpan, A2 tidak diubah. Tambahan memakai keuangan-pembanding-a2.json, seed-finance-comparison.js dan ledger finance-a2-comparison-v1; checksum seed keuangan yang sudah diterapkan tidak diubah.

Halaman kualitas data kini memakai satuan sumber, sehingga nominal Rp tidak diberi tanda %. Sumber utama/pembanding dan kutipan tersimpan di data_quality_flag serta data_quality_flag_sumber; tidak ditampilkan pada halaman publik.

BKU/PRP perlu mengonfirmasi satuan/cakupan KPI pendapatan, perbedaan laporan 4.19 terhadap 2.13/2.14, dan rujukan tabel. Kode periode sebelumnya tidak ditemukan. Tidak membuat angka perkiraan.

## D2 — selesai, tanpa tampilan duplikat

Audit Tabel 4.20 PDF 146–148/cetak 138–140 dan registry/approved view menemukan **28 indikator**: A Keberlanjutan 6, B Mahasiswa 7, C Bisnis Internal/Learning & Development 10, D Kepatuhan 5. Empat panel existing sudah menampilkan semuanya; diperjelas nama perspektif pada heading, tanpa menambah endpoint, tabel, migrasi atau seed duplikat. Form PRP existing tetap sumber revisi. Filter periode, Total Data dan XLSX per perspektif tetap memakai komponen B1. Persen capaian terhadap target mengikuti view existing, tanpa skor berbobot atau penghitungan ulang nilai resmi. Perspektif D yang arah/rumusnya belum disahkan tetap belum dapat dinilai.

Tes tambahan memakai periode fixture _test untuk keempat perspektif: BAA ditolak, draft/submitted/rejected tidak tampil, PRP tidak dapat menyetujui sendiri, approval admin dan revisi mengubah endpoint. UI memeriksa 6/7/10/5 baris serta tombol ekspor tiap panel. **Jafung resmi 59,60%, pembanding 58,08% dan denominator 198 tetap**; flag dua sumber existing tidak ditimpa.

## File dan cara mencoba D1/D2

File baru: migration 019/020/021, seed keuangan JSON, seed-internal-visibility.js, seed-finance.js, routes/finance.js, finance-schema.js/finance-page.js/tendik-page.js, keuangan.html/statistik-tendik.html/input/bku.html. Integrasi: seed.js, app.js, routes/dashboard.js/admin.js, validators/domains.js, input-schema.js/input.js, api.js/navbar.js/pages.js, tes API/parser/database/UI dan dokumentasi/matriks. Tidak menghapus file lama, menambah dependency, mereset database atau mengubah .env/approved lama.

Jalankan `npm run dev`, login lalu buka **http://127.0.0.1:3000/keuangan.html**, **/statistik-tendik.html**, **/capaian-iku-universitas.html**. BKU menggunakan **bku@demo.itpln.invalid**, password awal dari **DEMO_PASSWORD_BKU** di .env, atau password baru bila sudah diganti. Form **/input/bku.html**, kemudian review di **/verifikasi.html** oleh PRP/admin. Akun lain mengikuti FASE-4.md; tidak mencetak password.

## Verifikasi akhir pada batas D2 — 9 Oktober 2026

| Perintah | Hasil nyata |
|---|---|
| npm run db:migrate | Berhasil; 019/020/021 diterapkan dev/test, ulang idempotent |
| npm run db:app-role | Berhasil; app_user tetap terbatas, rahasia tidak dicetak |
| npm run db:seed | Berhasil/idempotent, termasuk ledger tambahan A2; approved lama/password/pengaturan formulir tidak ditimpa |
| npm run db:check (dev) | 18/18 kontrol lulus |
| npm run db:verify (_test) | 16/16 lulus; angka, provenance, satuan, NULL/negatif, flags, workflow seed dan idempotensi |
| npm test | 39/39 lulus; RBAC BKU/PJM/BSDM, privasi, empat perspektif, reject/approve/revisi dan parser negatif |
| npm run test:ui | 32/32 Edge desktop/360px lulus; tendik/keuangan/form BKU, KPI A–D, tanpa overflow/CSP/exception |
| Git diff --check / node --check modul keuangan | Lulus |

Query dev terakhir: **mahasiswa aktif 20252 5.080 / perempuan 1.494 / dosen 222 / tendik 30 (21/9)**. Kontrol PMB 2.030/1.678, wirausaha 2 dan ringkasan institusi 222/55/109/68 tetap. Tidak mengubah .env, data approved lama atau checksum migration/seed lama. Tidak ada dependency baru/penghapusan file lama. Satu ekspektasi API lama mengharapkan redirect 302 KPI; diperbarui menjadi 401 sesuai keputusan keamanan, suite terakhir hijau.

Catatan historis: sesi sebelumnya berhenti pada batas D2 yang bersih. D3 kemudian dilanjutkan dan selesai seperti dicatat di bawah. Fase 5E belum dimulai.

## Keputusan skema D3 sebelum migrasi

Penelusuran laporan: Tabel 2.9 PDF 44–46/cetak 36–38 menyediakan 50 baris (nomor 1–43 dan 45–51) jumlah tenaga kerja, target, realisasi persen sumber dan evaluasi. Grain formasi_revisi = periode laporan + tahun + butir sumber (kategori internal laporan-N); satuan jumlah/target orang dan capaian %. Nama unit sumber dipertahankan; tidak membuat kode unit/fakultas atau pemetaan master dari FKET/FTEN/PKA/dll. Nomor 44 tidak dibuat sebagai baris kosong rekaan. Persentase laporan disimpan terpisah dari hitungan jumlah/target; SPI 1100% dan BPAS 100% tetap nilai sumber. Catatan evaluasi menjadi teks agregat tanpa identitas.

Tabel 2.11 PDF 57–58/cetak 49–50 menyediakan empat jenis pergerakan (masuk 5, keluar 4, pensiun 2, pengangkatan baru 5). Grain pergerakan_pegawai_revisi = periode laporan + tahun + jenis; satuan orang, tidak dijumlah menjadi saldo pegawai karena kategori dapat bertumpang tindih. Tabel 2.10 membahas perubahan/penyesuaian jabatan, bukan jumlah formasi atau status pegawai; tidak digunakan untuk menghitung headcount/formasi.

Ringkasan institusi existing Tabel 2.7 PDF 43/cetak 35 (222/55/109/68) dan tendik per prodi Tabel 1.5 PDF 23/cetak 15 (30) tetap. Penjelasan 1.5 menyatakan rincian prodi; 2.7 menyebut statistik pegawai institusi. Selisih 30 vs 109 diberi flag cakupan, tanpa menganggap sisa 79 sebagai data unit lain. Formasi tidak dirinci menurut dosen/tendik/PKWT; tidak menyamakan jumlahnya dengan 222 atau 109. Tidak ditemukan rincian PKWT/tendik institusi per unit, gender, umur atau status kontrak individual: empty state, tanpa pembagian perkiraan.

Dua domain baru milik BSDM, perlu_verifikasi TRUE, workflow bersama draft/submitted/publish approved dan ledger insert-only. API formasi serta pergerakan dan halaman pegawai-formasi wajib login eksplisit walau kebijakan salah public. Dosen tetap/tidak tetap tetap memakai endpoint publik existing. Halaman internal memakai komponen B1 dan layout grafik sebelum perubahan tata letak (tidak menghidupkan kembali chart-grid). Flag yang direncanakan: cakupan tendik 30/109, SPI 1100% vs 5/5 dan narasi 100%, BPAS 100% vs 9/8 dan narasi penuh, nomor baris 44 tidak tercantum. Semua mempunyai dua kutipan sumber.

## D3 — selesai pada 9 Oktober 2026

Migration **022_employment.sql** membuat `formasi_revisi`, `pergerakan_pegawai_revisi`, view approved, indeks revisi current/working, audit/guard, grant minimum app_user dan visibilitas authenticated. Registry dan `employment-schema.js` menyediakan kategori/field yang sama untuk server dan browser. Pemilik BSDM; perlu_verifikasi default TRUE. Tidak membuat kode unit, fakultas atau pemetaan nama sumber baru.

Seed **pegawai-formasi-2026-s1.json**, script **seed-employment.js**, ledger/checksum **employment-2026-s1-v1** memasukkan 50 butir formasi dan empat pergerakan v1 melalui draft → submitted → publish approved oleh seed nonaktif, owner-only. Seed ulang insert-only mempertahankan koreksi dan pengaturan. Jumlah baris formasi 341 dan target 403 merupakan penjumlahan rincian sumber, bukan total baru pegawai institusi; tidak dibandingkan otomatis dengan dosen 222 atau tendik 109. Capaian sumber SPI 1100% dan BPAS 100% tetap, sementara hitungan terpisah 100% dan 112,5%. Target nol/kosong menghasilkan NULL untuk hitungan; nilai kosong tetap NULL.

Endpoint wajib login **GET /api/dashboard/{formasi,pegawai-pergerakan,pegawai-formasi}** hanya membaca view approved. Endpoint ringkasan gabungan memeriksa kebijakan pegawai internal dan publik; ekspor memeriksa kembali endpoint yang sama. **/pegawai-formasi.html** menolak anonim 401 termasuk path terenkode dan ketika kebijakan modul keliru public. Submenu **Dashboard Data → Dosen → Pegawai dan Formasi** ditandai kunci bagi pengunjung. Dosen tetap/tidak tetap tetap tersedia melalui endpoint publik existing; ringkasan institusi 222/55/109/68 serta tendik prodi 30 tidak diubah.

Halaman memakai filter periode laporan/tahun, Total Data, Kolom/Garis/Bar, XLSX terfilter, provenance tabel/halaman, loading/kosong/error dan empty state rincian PKWT. Layout grafik mengikuti kondisi sebelum perubahan tata letak yang dibatalkan. Form **/input/bsdm.html** mendapat tab **Formasi / Jumlah Tenaga Kerja** (50 baris) dan **Pergerakan Pegawai** (empat baris), dengan autosave, paste, riwayat, salin periode serta review PRP/admin existing. Membuka form tidak menulis draft. Tidak memakai template file/dependency baru. Peringatan capaian tidak memblokir nilai sumber, dan total tidak menjumlahkan persen atau pergerakan sebagai saldo.

Empat flag baru internal, masing-masing dengan dua kutipan dan provenance:

- **pegawai-tendik-cakupan-berbeda**: Tabel 1.5 PDF 23/cetak 15, 30 tenaga kependidikan pada rincian prodi; Tabel 2.7 PDF 43/cetak 35, ringkasan institusi 109. Tidak mengalokasikan selisih 79.
- **formasi-spi-persentase**: Tabel 2.9 PDF 44/cetak 36, 5/5 tetapi capaian 1100%; narasi PDF 47/cetak 39 menyebut 100%.
- **formasi-bpas-persentase**: Tabel 2.9 PDF 46/cetak 38, 9/8 tetapi capaian 100%; narasi PDF 47/cetak 39 menyebut pemenuhan penuh. Hitungan 112,5% diberi label terpisah.
- **formasi-nomor-44-tidak-tercantum**: dua kutipan baris 43 BPKA dan 45 BKK, PDF 46/cetak 38. Tidak membuat unit/baris 44 rekaan.

Migration **023_employment_provenance.sql** hanya membetulkan satu kata kutipan flag D3 sendiri: narasi 1.5 memakai “tenaga kependidikan”, sedangkan heading memakai “Tenaga Pendidikan”. Koreksi tercatat di audit; tidak mengubah angka/baris approved atau checksum seed yang sudah diterapkan. Seed instalasi baru menghasilkan kutipan narasi yang benar.

Data belum ditemukan: rincian 68 PKWT/109 tendik institusi menurut unit/gender/status kontrak, serta nomor baris 44. Tabel 2.10 tentang penyesuaian jabatan tidak dipakai sebagai headcount/formasi. BSDM perlu memastikan cakupan 30 vs 109, persentase SPI/BPAS, nomor 44 dan pemetaan nama unit sumber bila diperlukan. Tanpa nama, NIP atau identitas individu.

### Verifikasi akhir D3

| Perintah | Hasil nyata |
|---|---|
| npm run db:migrate | Berhasil; 022/023 diterapkan dev/test, pengulangan idempotent |
| npm run db:app-role | Berhasil; app_user tetap terbatas, rahasia tidak dicetak |
| npm run db:seed | Berhasil/idempotent; approved lama/password/pengaturan tidak ditimpa |
| npm run db:check | 18/18 kontrol dev lulus |
| npm run db:verify | 17/17 lulus; provenance, NULL, angka sumber, audit tiga status dan idempotensi |
| npm test | 40/40 lulus; BSDM/RBAC, 401, reject, approval/revisi dan NULL |
| npm run test:ui | 34/34 Edge desktop/360px lulus; filter URL, ekspor, tipe grafik, empty dan dua tab BSDM |

Pengulangan UI di sandbox sempat gagal sebelum halaman diuji karena Edge DevTools tidak tersedia. Pengulangan dengan izin proses browser lulus 34/34; tidak mengubah autentikasi/CSRF/rate limit atau melonggarkan tes. `git diff --check` dan `node --check` modul baru lulus. Grafik 50 kategori mengikuti komponen/layout lama sesuai pembatalan perubahan tata letak; untuk pembacaan rinci tersedia tabel lengkap dan XLSX, tanpa mengubah ukuran grafik bersama.

Fingerprint jumlah dan SHA-256 seluruh baris approved pada **21 domain lama identik** dengan sebelum D3. Kontrol tetap **5.080 / 1.494 / 222 / 30 (21/9)**, PMB 2.030/1.678, wirausaha 2. Tidak reset, mengubah .env, approved lama atau checksum migrasi lama.

File baru: migrations 022/023, seed JSON/script, routes/employment.js, employment-schema.js/employment-page.js dan pegawai-formasi.html. Integrasi: seed.js, app.js, validators/domains.js, input-schema.js/input.js, api.js/navbar.js, tes API/database/UI, matriks, README/AGENTS dan dokumen ini. Tidak menghapus file lama.

Untuk mencoba: `npm run dev`, login lalu buka **http://127.0.0.1:3000/pegawai-formasi.html**. BSDM/admin mengisi **/input/bsdm.html → Formasi / Jumlah Tenaga Kerja** atau **Pergerakan Pegawai**, lalu PRP/admin meninjau **/verifikasi.html**. Akun/password awal mengikuti nama variabel .env dalam FASE-4.md; tanpa mencetak nilainya. **Fase 5D selesai. Berhenti dan tunggu “Lanjut Fase 5E”.**
