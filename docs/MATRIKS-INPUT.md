# Matriks dashboard dan form input

Audit D0, diperbarui sampai D3 pada 9 Oktober 2026. Berdasarkan `server/validators/domains.js`, `routes/{dashboard,forms,ratio,accreditation,research,achievements,cooperation,productivity,ami,finance,employment}.js`, `input-schema.js/input.js`, renderer dashboard, serta SELECT aktual `domain_unit` dan `visibilitas_modul` pada database dev. Bukan daftar berdasarkan ingatan. Semua form memerlukan login; admin dapat mengisi domain yang memiliki pemilik. Review PRP/admin mengikuti pengaturan perlu_verifikasi existing.

Kolom visibilitas menyatakan **data dashboard**, bukan form. Publik tetap tunduk PUBLIC_DASHBOARD. Path di bawah relatif terhadap http://127.0.0.1:3000.

E1: `/input/baa.html` → Mahasiswa Aktif dan `/input/bsdm.html` → Formasi / Jumlah Tenaga Kerja menyediakan **Template & Unggah** berbasis registry. Unggah hanya pratinjau; **Terapkan ke draft** tidak submit/approve. E2 sesi 1 memperluas pola yang sama ke Mahasiswa Baru (PPA), Tendik per Prodi, Ringkasan Pegawai, Produktivitas Dosen, Pergerakan Pegawai (BSDM), Lulusan prodi/institusi (BAA), Prestasi (BKM), dan Kerja Sama. Tiga belas form kompleks tetap ditunda; lihat [rencana E2](E2-RENCANA.md). Detail versi, batas berkas dan pengujian: [arsip/FASE-5E.md](arsip/FASE-5E.md). Kepemilikan/visibilitas pada matriks tidak berubah.

| Data | Halaman dashboard / API terkait | Form input / tab | Unit / role pengisi | Visibilitas | Status |
|---|---|---|---|---|---|
| Mahasiswa aktif, perempuan, status, gender/jenjang | /index.html; /statistik-mahasiswa.html; /api/dashboard/mahasiswa | /input/baa.html → Mahasiswa Aktif | BAA / baa | Publik | Ada; gender/jenjang/persentase dihitung otomatis dari approved |
| Mahasiswa per angkatan | /index.html; /statistik-mahasiswa.html; /api/dashboard/mahasiswa-angkatan | /input/baa.html → Mahasiswa per Angkatan | BAA / baa | Publik | Ada; terpisah dari total aktif, selisih tidak dialokasikan otomatis |
| Mahasiswa baru/PMB target dan daftar ulang | /index.html; /mahasiswa-baru.html | /input/ppa.html → Mahasiswa Baru | PPA / ppa; BAA pembaca | Publik | Ada sejak Fase 4; bukan form yang hilang |
| Lulusan per prodi/wisuda, IPK/masa studi | /lulusan.html; /api/dashboard/lulusan | /input/baa.html → Lulusan / Wisuda → Per program studi | BAA / baa | Publik | Ada; data per prodi belum tersedia, bukan dummy |
| Lulusan level institusi, kartu beranda | /index.html; /lulusan.html | /input/baa.html → Lulusan / Wisuda → Institusi | BAA / baa | Publik | Akses form institusi dilengkapi D0; prodi_id NULL, tidak dipecah |
| Tracer per prodi | /lulusan.html; /api/dashboard/tracer | /input/bpka.html → Tracer Study | BPKA / bpka | Publik | Ada; wirausaha dihitung dari rincian terisi, NULL bukan nol |
| Ringkasan tracer institusi/responden/cakupan sementara | /lulusan.html; meta.ringkasan API tracer | /input/bpka.html → Ringkasan Tracer Institusi | BPKA / bpka | Publik | Form dilengkapi D0; denominator wajib lulusan institusi approved yang sesuai; cakupan otomatis |
| Dosen per prodi, gender, S3, jafung | /index.html; /statistik-dosen.html | /input/bsdm.html → Dosen per Prodi | BSDM / bsdm | Publik | Ada sejak Fase 4; Non-S3/gender turunan otomatis tanpa menganggap NULL nol |
| Dosen tetap/tidak tetap institusi | /index.html; /api/dashboard/pegawai | /input/bsdm.html → Ringkasan Pegawai | BSDM / bsdm | Publik | Ada; tidak digabung dengan jumlah per prodi |
| Tendik per prodi (30, bukan institusi 109) | /statistik-tendik.html; /api/dashboard/tendik | /input/bsdm.html → Tendik per Prodi | BSDM / bsdm | Login halaman/API, diperbaiki Langkah 0 D1 | Ada; tidak dipakai untuk menghitung 109 |
| Tendik institusi/PKWT | /pegawai-formasi.html; /api/dashboard/pegawai-internal; /api/dashboard/pegawai-formasi | /input/bsdm.html → Ringkasan Pegawai | BSDM / bsdm | Login | Ada; ringkasan institusi tetap terpisah dari tendik prodi |
| Total tenaga kependidikan institusi (pengecualian agregat) | /index.html; /api/dashboard/tendik-total | /input/bsdm.html → Ringkasan Pegawai → Tenaga kependidikan | BSDM / bsdm | Publik: satu total approved/current saja | Keputusan pengguna 13 Oktober 2026 untuk ringkasan beranda; respons hanya total, tanpa gender/jafung/unit/PKWT. Modul, halaman dan API rincian existing tetap login-only; tidak digabung tendik prodi. [Kontrak dan alasan](KARTU-BERANDA.md#keputusan-visibilitas-tendik) |
| Rasio dosen:mahasiswa | /rasio-dosen-mahasiswa.html | Tidak memerlukan form baru: mahasiswa aktif BAA + dosen BSDM | BAA/BSDM pemilik sumber | Publik | Dihitung otomatis; pasangan periode/prodi approved dan cakupan lengkap |
| Nama/jenjang prodi dan jumlah mahasiswa/dosen | /daftar-prodi.html; /kinerja-prodi.html; /api/dashboard/prodi | Nilai mahasiswa/dosen memakai form BAA/BSDM; nama/jenjang dari master prodi seed | Nilai BAA/BSDM; perubahan nomenklatur master belum ditetapkan | Publik | Nilai otomatis; master nama/jenjang belum ada UI pemeliharaan |
| Akreditasi institusi/prodi/internasional | /akreditasi.html | /input/pjm.html → Akreditasi | PJM / pjm | Publik | Ada; institusi/internasional kosong sampai input approved |
| Peminat PMB institusi | /index.html; /api/dashboard/pmb-peminat | /input/ppa.html → Peminat PMB Institusi | PPA / ppa | Publik: agregat approved/current | 21.172 dari Tabel 4.1 halaman PDF 107/cetak 99, laporan 2026-S1. Migration baru 032; sumber v1 insert-only/audit. Terpisah dari pendaftar 8.912 dan daftar ulang per prodi 1.678; tidak dialokasikan ke prodi. |
| Penelitian | /penelitian.html | /input/lppm.html → Penelitian | LPPM / lppm | Publik, agregat | Ada; dana NULL bila tidak tersedia |
| HKI | /hki.html | /input/lppm.html → HKI | LPPM / lppm | Publik, agregat | Ada |
| PkM | /pkm.html | /input/lppm.html → PkM | LPPM / lppm | Publik, agregat | Ada |
| Prestasi mahasiswa | /prestasi-mahasiswa.html | /input/bkm.html → Prestasi Mahasiswa | BKM / bkm | Publik, agregat | Ada; bukan prestasi institusi Tabel 1.7 |
| Kerja sama | /kerja-sama.html | /input/kerjasama.html | Bagian Pengembangan Kemitraan / kerjasama, kode master NULL | Publik, agregat/nama institusi | Ada; kode resmi belum dipastikan, pemilik sudah ada |
| Produktivitas dosen institusi | /produktivitas-dosen.html | /input/bsdm.html → Produktivitas Dosen | BSDM / bsdm | Publik, agregat | Ada; tidak menggandakan penelitian/PkM |
| AMI kesiapan/kesenjangan awal dan rekap | /ami.html | /input/pjm.html → AMI | PJM / pjm | Login halaman/API | Ada; bukan hasil audit formal |
| Monitoring Capaian Kinerja Unit Kerja (KPI), perspektif A–D | /monitoring-kpi.html; /api/dashboard/kpi | /input/prp.html → Capaian KPI | PRP / prp | Login halaman/API | 28 KPI existing tetap, empat perspektif 6/7/10/5. Kedua URL capaian-iku lama redirect ke KPI. |
| Monitoring IKU Kemdiktisaintek | /monitoring-iku.html; /api/dashboard/iku?tahun=2026&periode=T2 | /input/prp.html → Monitoring IKU | PRP / prp; review PRP lain/admin | Login halaman/API | 19 indikator sumber T2 2026; tabel iku_indikator/iku_capaian, v_dashboard_iku approved/current; revisi berversi dan four-eyes. Tanpa template Excel. |
| Pembilang/penyebut KPI, termasuk denominator jafung 198 | v_kpi_input; tab internal, belum panel dashboard tersendiri | /input/prp.html → Input Pembilang / Penyebut KPI | PRP / prp | Login | Form dilengkapi D0 untuk kode input approved yang sudah didefinisikan; tidak menimpa nilai resmi KPI otomatis |
| Target RKA | /api/rka-target; pembanding internal input PRP | /input/prp.html → Target RKA | PRP / prp | Login | Ada; master sumber tidak ditimpa |
| Keuangan rincian 2.12–2.14/4.19 | /keuangan.html; /api/dashboard/keuangan | /input/bku.html → Keuangan | BKU / bku pada domain_unit | Login halaman/API | Ada sejak D1; 17 kategori bersatuan terpisah, nilai KPI PRP tetap terpisah |
| Formasi/jumlah tenaga kerja Tabel 2.9 | /pegawai-formasi.html; /api/dashboard/formasi | /input/bsdm.html → Formasi / Jumlah Tenaga Kerja | BSDM / bsdm | Login halaman/API | Ada; 50 nama unit sumber, capaian laporan terpisah dari hitungan otomatis |
| Pergerakan pegawai Tabel 2.11 | /pegawai-formasi.html; /api/dashboard/pegawai-pergerakan | /input/bsdm.html → Pergerakan Pegawai | BSDM / bsdm | Login halaman/API | Ada; empat kategori tidak dijumlah menjadi saldo/headcount |
| Rincian PKWT/tendik institusi per unit/gender | Empty state /pegawai-formasi.html | Ringkasan tersedia; belum ada form rincian tanpa sumber | BSDM / bsdm | Login | Tidak tersedia dalam laporan; tanpa pembagian perkiraan 68/109 atau selisih 79 |
| Kinerja PT gabungan | /kinerja-pt.html | Tidak ada form gabungan; akreditasi ada di PJM | PJM untuk akreditasi; pemilik ukuran gabungan lainnya belum ditetapkan | Publik, empty state | Belum ada data/form metrik gabungan; jangan mengarang |
| Beban mengajar per prodi | /beban-mengajar.html | Belum ada form rincian; rata-rata institusi ada pada tab produktivitas BSDM | BSDM | Publik, empty state | Belum ada data/form rincian; jangan menurunkan 12,83 SKS institusi ke prodi |
| Rekognisi dosen | /rekognisi-dosen.html | Belum ada form rincian | BSDM | Publik, empty state | Belum ada data/form, tanpa individu/dummy |
| Fakultas/pemetaan prodi, tren periode sebelumnya | Panel empty di /index.html; IKU Fakultas redirect | Tidak dibuat sebelum sumber/pemetaan dikonfirmasi | Belum ditetapkan untuk pemetaan | Publik empty; IKU login | Belum ada data; sengaja menunggu keputusan pengguna |
| Data quality flags | /kualitas-data.html; diff verifikasi | Dihasilkan seed/validasi; penyelesaian lewat endpoint internal existing | Unit pemilik flag; admin/PRP untuk review | Login | Otomatis, bukan form angka baru; kutipan/provenance dipertahankan |

## Perbaikan D0 dan keputusan yang tersisa

Tidak menduplikasi form PPA/BSDM yang sudah berjalan. Tidak membuat tabel/migrasi/seed baru untuk data existing, dan tidak menyentuh approved. Pilihan institusi BAA serta tab BPKA/PRP memakai registry, autosave, paste, draft/submit, salin periode, audit/revisi dan review bersama. Ringkasan tracer bukan agregasi rincian yang belum lengkap; angka sumber ringkasan tetap terpisah.

Perlu keputusan pemilik: siapa berwenang memelihara nomenklatur/master prodi dan pemetaan fakultas; ukuran serta pemilik panel Kinerja PT gabungan di luar akreditasi. Kode resmi Bagian Pengembangan Kemitraan tetap menunggu konfirmasi, tanpa mengubah pemilik yang sudah ada. Data kosong di Beban Mengajar/Rekognisi tidak dihitung sebagai “angka tampil tanpa form”; sumber rincian harus tersedia sebelum skema dirancang.

## Dashboard Pimpinan sesi 1 — pertanyaan ke PRP (12 Oktober 2026)

Sumber: transkripsi pengguna `iku.kemdiktisaintek.go.id T2 2026`, tahun 2026, realisasi triwulan II, status sumber **Sudah Diajukan**. Angka tidak dikoreksi. Status sumber dipisahkan dari persetujuan internal; seed v1 approved memakai pengecualian sistem seed seperti domain lain. Default kebijakan form tetap perlu_verifikasi TRUE.

| Baris | Nilai sumber yang dipertahankan | Pertanyaan PRP / penanda |
|---|---|---|
| IKU 1 b. S1 | Baseline 95,68; target 48,91; realisasi 95,68 | Apakah target lebih kecil dari baseline memang benar? Capaian 195,6% tetap ditampilkan. |
| Sub IKU 9.1 | Baseline 160,61%; target 175,57%; realisasi 73,28% | Konfirmasi definisi pendapatan terhadap aset dan baseline >100 untuk satuan %. |
| Sub IKU 9.2 | Realisasi induk 0,26%; sub: riset 5,76%, dosen 4,64%, laboratorium 0,00% | Apa denominator/cakupan/rumus induk sehingga tidak selaras dengan sub-indikator? Tidak dijumlah atau diganti. |
| IKU 3 | Baseline 1,40%; target 1,92%; realisasi 0,905% | Konfirmasi presisi tiga desimal; numeric dan tampilan tetap 0,905. |

Keempatnya mempunyai `catatan_verifikasi` serta flag `perlu_verifikasi` turunan di capaian dan badge UI. Flag kualitas ini berbeda dari kebijakan review form yang bernama sama. Catatan ikut revisi dan audit; PRP dapat memperbaruinya melalui draft/review. Catatan kaki D3*/S2** belum dijelaskan sumber, tidak dikarang.

Menu Dashboard Pimpinan: Akreditasi Institusi (halaman akreditasi existing, publik), Monitoring IKU (login), Monitoring Capaian Kinerja Unit Kerja (KPI, login). Beban Kerja Dosen/Proyeksi Kinerja ditunda; SKP tidak dibuat. Ambang/rata-rata dan audit pemisahan: [Dashboard Pimpinan sesi 1](DASHBOARD-PIMPINAN-SESI-1.md).

## Dashboard Pimpinan sesi 2 — pertanyaan PJM/BSDM (12 Oktober 2026)

Audit langsung DB/runtime dan keputusan: [Dashboard Pimpinan sesi 2](DASHBOARD-PIMPINAN-SESI-2.md).

| Pemilik | Temuan | Pertanyaan / tindakan yang menunggu sumber resmi |
|---|---|---|
| PJM | Institusi dan internasional belum ada baris; prodi 19 approved | Mohon peringkat institusi, lembaga, SK terbaru, tanggal mulai/akhir dan nilai resmi beserta sumber; internasional bila tersedia. |
| PJM | Nilai dan URL sertifikat belum ada kolom DB/form; 19 tanggal mulai NULL | Mohon definisi/skala nilai, tanggal mulai, tautan sertifikat resmi yang boleh dipublikasikan. Perluasan form/kolom menyusul setelah kontrak sumber dikonfirmasi; UI kini `-`. |
| PJM / pengelola master | 17 terpetakan, Geografi dan Kewirausahaan belum terpetakan | Konfirmasi identitas resmi terhadap Geospasial kode 14 / Bisnis Energi kode 17; tidak memetakan otomatis. Konfirmasi nomor SK sama pada kedua nama laporan. |
| PJM | Tanggal akhir D3 Mesin 12-01-2026, status sumber Aktif | Konfirmasi/perbarui melalui revisi, jangan mengoreksi approved diam-diam. Lencana tanggal terpisah dari status sumber. |
| PJM / pengelola master | Semua fakultas NULL | Mohon pemetaan resmi prodi → fakultas; sementara kelompok Vokasi/D3, S1, Pascasarjana/S2, Profesi. |
| BSDM | Hanya rata-rata institusi 12,83 SKS; BKD prodi-semester tidak ada | Putuskan usulan domain minimal pada dokumen sesi 2: prodi/semester, jumlah dosen, rata-rata SKS, persen memenuhi ketentuan, tanpa individu. Konfirmasi definisi BKD, denominator, ketentuan, sumber semester dan pemilik. |

Akreditasi tetap publik, hanya approved/current. Total utama 19 master = 19 rekap (17 berdata + 2 `-`), dua butir sumber belum terpetakan terpisah. Tidak ada selisih total saat audit, namun kesamaan total bukan konfirmasi pemetaan. BKD berhenti pada usulan; **menu Dashboard Pimpinan belum ditambah**. Proyeksi Kinerja/SKP di luar lingkup.
