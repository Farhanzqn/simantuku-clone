# Dashboard Pimpinan sesi 2 — 12 Oktober 2026

## Langkah 0: audit DB dan runtime

Audit SELECT langsung dev sebelum implementasi, inventaris information_schema, registry `server/validators/domains.js`, form `input-schema.js`, route dashboard/productivity/accreditation. Bukti lokal `.runtime/pimpinan-s2/audit-db.json`; tidak untuk commit. Tidak mengakses/scraping pjm.itpln.ac.id.

- `akreditasi_revisi` dan `v_dashboard_akreditasi`: 19 baris prodi approved/current pada 2026-S1; institusi 0, internasional 0. Peringkat: Baik 11, Baik Sekali 6, Unggul 1, Terakreditasi 1. Peringkat/lembaga/nomor SK/tanggal akhir terisi pada 19 baris; seluruh tanggal mulai NULL. Kolom nilai dan URL sertifikat belum ada pada DB/view/form PJM.
- Master: 19 prodi aktif, tanpa pemetaan fakultas. Tujuh belas baris approved terhubung. S1 Geografi dan S1 Kewirausahaan belum terpetakan; jangan diasumsikan sebagai S1 Geospasial (14) / S1 Bisnis Energi (Kewirausahaan) (17). Dua prodi master tersebut tampil `-`. Kedua nama sumber memiliki nomor SK sama; perlu konfirmasi PJM, bukan koreksi otomatis.
- Beban kerja dosen: tidak ditemukan tabel/form/domain BKD, kolom SKS/ketentuan per prodi-semester, maupun data individu. `/beban-mengajar.html` dan API existing adalah empty state publik. Form BSDM Produktivitas Dosen hanya agregat institusi Tabel 2.8: target beban mengajar 12, realisasi 12,83 SKS, capaian laporan 106,92%. Ini bukan persentase dosen memenuhi BKD, tidak dipecah ke prodi atau semester dan tidak dipindahkan ke domain BKD.

## Akreditasi: keputusan dan implementasi

Inspirasi struktur: [Akreditasi UNJA](https://dashboard.unja.ac.id/akreditasi?theme=dark), ditinjau 12 Oktober 2026. Hanya susunan status/rekap/daftar; CSS/aset/teks dibuat sendiri memakai token ITPLN. Tidak mengubah CSS/navbar/footer bersama atau konfigurasi/tinggi kanvas existing.

- Hero + tahun laporan, filter jenjang/prodi, tiga kartu, Status Institusi (SK pada versi approved terkini, masa berlaku, nilai, lembaga dan sertifikat), matriks peringkat × jenjang dengan jumlah/persen/baris-kolom total, daftar Vokasi D3 / Sarjana S1 / Pascasarjana S2 / Profesi. Pengelompokan fakultas menunggu pemetaan resmi.
- Tahun memilih **satu snapshot laporan terbaru yang memiliki approved pada tahun tersebut**, bukan gabungan semester atau status historis tepat 31 Desember. API tetap mendukung parameter periode_laporan_id existing; bila diberikan, periode eksplisit didahulukan. Tahun tanpa approved tidak mengambil tahun lain. UI menjelaskan semantik ini.
- Total kartu/rekap/daftar utama menggunakan master aktif terfilter: 19 = 19, termasuk dua baris tanpa data. Rekap utama: Baik 9, Baik Sekali 6, Unggul 1, Terakreditasi 1, belum tersedia 2. Persen setiap sel menggunakan total master terfilter, bukan denominator jenjang. Jumlah peringkat berbeda 4, tidak termasuk NULL.
- Dua butir belum terpetakan disajikan di panel terpisah, tidak menjadi prodi master tambahan. Grafik existing tetap seluruh 19 butir laporan (Baik 11), dengan catatan cakupan jelas. Kesamaan angka total sumber dan master **bukan bukti pemetaan benar**.
- Pemeriksaan jumlah rekap vs kartu vs daftar dilakukan di API/UI. Bila berbeda, UI menampilkan peringatan kecil. Audit saat ini tidak menemukan selisih total (19/19); kekosongan/pemetaan tetap diungkap. Jika ada beberapa butir per prodi dalam snapshot, rekap memakai butir pertama sesuai urutan API dan memperingatkan duplikat, tidak menghitung prodi dua kali. Tidak memilih peringkat terbaik secara rekaan.
- Lencana turunan tanggal akhir: sudah lewat, atau akan habis <=12 bulan kalender terhadap tanggal hari ini Asia/Jakarta (batas inklusif, tahun kabisat ditangani). Tidak menampilkan flag/diff/audit internal, tidak mengganti status sumber. Nilai/Sertifikat `-` karena belum tersedia; tautan hanya HTTP(S) bila tersedia, tanpa menebak URL.
- API tetap memakai visibility akreditasi publik dan view approved/current; tidak membaca draft/submitted untuk tampilan. Loading/error/retry melalui tombol Muat ulang, empty state dan scroll tabel berfokus keyboard. Tanpa dependency/migration/seed baru, tanpa perubahan data dev.

## Bagian (b): berhenti untuk keputusan pengguna

BKD per prodi/semester belum ada. Tidak membuat halaman/API/menu BKD, tidak mengubah akses halaman publik Beban Mengajar existing. Dengan demikian tes anonim 401 BKD belum berlaku; endpoint BKD baru belum dibuat. Monitoring KPI/IKU serta modul internal lain tetap login-only.

Usulan minimum (belum diimplementasikan): satu domain `beban_kerja_dosen` milik BSDM, grain `(prodi_id, periode_akademik_id)` dengan FK master; `jumlah_dosen` integer >=0, `rata_rata_sks` numeric >=0 nullable, `persentase_memenuhi` numeric 0–100 nullable. NULL berarti belum tersedia, bukan nol. Tambahkan sumber/definisi ketentuan, periode laporan bila diperlukan workflow, dan metadata versi/status/audit mengikuti registry existing; hanya satu current approved per grain. Tanpa nama/NIDN/identitas individu. API dan halaman harus requireLogin; dashboard hanya approved/current. Jangan menghitung persentase memenuhi dari rata-rata SKS.

Keputusan diperlukan: konfirmasi bahwa scope tersebut BKD penuh atau hanya pengajaran; denominator jumlah dosen yang dinilai; definisi/rujukan ketentuan; pemilik BSDM; semester sumber dan hubungan periode laporan; apakah persen diberi langsung atau diturunkan dari jumlah dosen memenuhi. Implementasi menunggu keputusan, tidak membuat skema besar atau contoh data.

## Verifikasi

Selesai untuk bagian (a); bagian (b) berhenti sesuai batas pengguna. Baseline lokal: 24 domain (termasuk IKU), 68 berkas terlindungi (.env, manifest/lock, migration/seed/script DB). Snapshot dan cadangan lokal `.runtime/pimpinan-s2/`; tidak untuk commit. Mutasi suite hanya database `_test` terpisah, dijalankan berurutan. Tidak reset DB.


| Gerbang akhir | Hasil nyata |
|---|---|
| npm test | 82/82: agregasi NULL/unmapped/duplikat, konsistensi termasuk mismatch, batas 12 bulan/tahun kabisat, URL sertifikat, tahun tanpa data/validasi, serta alur PJM draft/submitted/rejected tidak bocor dan revisi approved. |
| test:ui | 39/39: desktop/360px, rekap 19, daftar master 19 + panel sumber 2, institusi kosong, filter D3, error/retry, mismatch memunculkan role alert, empty, keyboard, reduced motion dan kontras hero. Regresi aplikasi/privasi/Excel existing tetap lulus. |
| db:verify | 20/20, dijalankan sesudah UI selesai; database _test. |
| db:check | 18 kontrol lulus; tidak mengubah angka dev. |
| npm audit | 0 kerentanan. |
| Fingerprint akhir | 24/24 domain dev identik, hash seluruh row terurut ID termasuk approved dan IKU. |
| Berkas terlindungi | 68/68 identik: .env, package.json/lock, migration/seed/script DB lama. |

UI awal gagal membuka Edge DevTools dalam sandbox; dijalankan kembali dengan izin proses lokal. Audit awal gagal menghubungi registry dalam sandbox; ulang berizin berhasil. Inspeksi screenshot menemukan kontras teks hero lemah, diperbaiki dengan token putih; suite UI final diulang 39/39. Screenshot diperiksa: desktop dan 360px, file lokal .runtime/phase3/pimpinan-s2-accreditation-desktop.png dan pimpinan-s2-accreditation-360.png. Log lengkap .runtime/pimpinan-s2/{test,ui,verify,check}.log, npm-audit.json, comparison.json; tidak untuk commit.

Batas bukti: Node v24.19.0/Edge, Node 22 LTS dan browser lain belum diuji. Tidak deployment, tidak reset, tidak menghapus file lama, tidak mengubah .env/approved/migration/seed lama, tidak memasang dependency. Navbar/footer/CSS bersama tidak diubah. Pemetaan fakultas, data institusi/nilai/sertifikat dan BKD tetap menunggu sumber/keputusan resmi.
