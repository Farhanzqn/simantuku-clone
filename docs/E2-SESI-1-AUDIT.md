# E2 sesi 1 — audit dan penyelesaian 12 Oktober 2026

## Langkah 0 (sebelum perubahan kode lanjutan)

Audit git-less memakai pembacaan berkas, perbandingan byte dengan cadangan `.runtime`, ledger database dan eksekusi tes. Cadangan E1 lebih lama daripada E1-02b; selisih terhadap cadangan tersebut tidak seluruhnya dianggap perubahan E2.

| Bagian | Kondisi saat melanjutkan |
|---|---|
| `excel-schema.js` | Berbeda dari `.runtime/e2-s1/excel-schema.js`: dua form E1 ditambah delapan form sederhana E2. |
| `form-excel.js` | Berbeda dari cadangan E2: konteks PMB/tanggal, lulusan dua cakupan, kategori; audit wisuda memakai hash. Tetap memakai endpoint, parser/worker, gate, transaksi dan guard abort E1; slot dilepas melalui `finally`. |
| `input-schema.js` | Selisih terhadap cadangan E2 hanya deklarasi kategori Ringkasan Pegawai, empat kategori master existing. |
| UI bersama | `input.js` memasang `templateUpload` secara generik berdasarkan registry. `template-upload.js` berbeda dari cadangan E1 pada pesan bahwa isi berkas belum diterapkan; ini perbaikan E1 yang telah ada. Tidak perlu menambahkan tombol per halaman secara terpisah. |
| Fixture/tes | `excel-simple-cases.js` mencakup delapan form dan dua cakupan lulusan. API/UI berbeda dari cadangan E1; tes E2 sudah tertulis. Tidak ada cadangan E2 untuk kedua tes atau `ui-server.js`, sehingga bukan klaim diff terhadap titik putus yang pasti. |
| Periode/login fixture | Alokasi tahun laporan `max(tahun)+1` dan kode UUID sudah terpasang; API serta UI memakai `loginLimit:50` khusus harness. Default produksi tetap 10. Tidak perlu melonggarkan limiter produksi. |
| Migration 028 | Tidak ada cadangan 028. File cocok ledger `_test`, diterapkan 12 Oktober 2026 05:37:05 WIB. Belum terpasang di dev (27 migration). Seluruh checksum awal cocok: dev 27/27, test 28/28. |

Checksum 028: `a8b43b049b4fb421eb08db5f27fdd164efa943e66c87e7679f86595f2b0d6e22`.
Runner migration memegang advisory lock dan transaksi; ledger yang cocok dilewati, checksum berubah ditolak. Aman mengulang runner, bukan instruksi mengeksekusi SQL mentah di luar ledger.

Hasil awal:

- `npm test`: 75/77 lulus. Subtes produktivitas gagal bersama parent; fixture `1e18 + 1` dibulatkan menjadi `1e18`, sehingga sebenarnya masih di dalam batas validator.
- `db:check`: seluruh 18 kontrol lulus.
- `db:verify`: percobaan pertama bertumpang tindih dengan API pada `_test`, sehingga assertion seed-only melihat lima lulusan fixture. Setelah API selesai, pemeriksaan berurutan **19/19 lulus**, tanpa perubahan DB untuk memaksa hasil. Suite mutasi selanjutnya dijalankan berurutan.
- Fingerprint seluruh row 23 domain dev identik dengan `.runtime/e2-s1/dev-before.json`, termasuk approved.
- Log UI sesi terputus menunjukkan Edge DevTools tidak tersedia; belum ada bukti UI E2 berhasil saat audit awal.

## Penyelesaian

- Fixture batas angka memakai `max * 2` dan assertion bahwa nilai benar-benar melampaui batas; validator produksi tidak berubah.
- Tes UI lama masih mengharapkan unggah hanya pada dua form E1 dan tidak ada di BKM/kerja sama/produktivitas. Ekspektasi diperbarui sesuai daftar E2 eksplisit; assertion tanpa unggah pada PJM/LPPM/AMI tetap. Kegagalan pertama memutus login admin di subtes tab, sehingga subtes yang bergantung padanya ikut gagal; suite dijalankan ulang setelah koreksi.
- Setiap form menguji workbook valid, header/kolom hilang, tipe salah, negatif/di luar rentang, duplikat dan kesetaraan validator manual. Lulusan institusi satu baris menolak penambahan duplikat melalui batas jumlah baris.
- Setiap form menguji anonim 401 pada form/template/upload/apply/cancel, role yang salah, role benar tetapi unit salah (termasuk apply/cancel), halaman input HTML redirect login dan JSON 401/no-store. Tes existing mempertahankan dashboard internal login-only meski pengaturan visibilitas publik diubah.
- Preview tidak menulis domain; apply dengan `perlu_verifikasi=false` tetap seluruhnya DRAFT, tidak current-approved; apply kedua ditolak. Lulusan institusi tetap `prodi_id=NULL`. Policy fixture dipulihkan di `finally`; mutasi hanya `_test`.
- Migration 028 diterapkan pada dev melalui `db:migrate` pada 12 Oktober 2026 10:46:50 WIB, lalu runner dipanggil sekali lagi: selesai tanpa menjalankan ulang 028. Berkas 028 dan migration/seed lama dipertahankan. Pemeriksaan ledger setelahnya cocok 28/28 pada dev dan test.
- Cadangan sebelum pekerjaan lanjutan ada di `.runtime/e2-resume`; hash perlindungan `.env`, dependency manifests, migration dan seed disimpan lokal, tanpa menyalin isi rahasia ke laporan.

## Verifikasi akhir

- `npm test`: **77/77 lulus**, termasuk sembilan skenario E2 (delapan form, dua cakupan lulusan), parser dan regresi keamanan E1.
- `npm run test:ui`: **37/37 lulus**, termasuk unduh → unggah → pratinjau → DRAFT delapan form/dua cakupan lulusan, desktop dan 360px; assertion CSP/runtime tetap lulus.
- `npm run db:verify`: **19/19 lulus**, dijalankan setelah suite mutasi selesai. `npm run db:check`: **18 kontrol lulus**.
- `npm audit`: **0 kerentanan**, tanpa dependency baru.
- Fingerprint seluruh row terurut ID: **23/23 domain dev identik** terhadap awal E2; termasuk approved. Bukti hash `.runtime/e2-s1/dev-{before,after}.json`.
- **45 berkas terlindungi identik**, termasuk `.env`, package manifests, migration 001–028 dan seed. Ledger dev/test masing-masing 28/28 checksum cocok. Tidak ada reset, penimpaan approved dev atau penghapusan audit.
- Log pemeriksaan ada di `.runtime/e2-resume/{test-final,ui-final,verify-final,check-final}.log`; bukan untuk commit.

Batas runtime: Node v24.19.0 tersedia; Node 22 LTS belum diuji. UI memakai Edge headless. Percobaan UI sandbox tidak membuka DevTools; dijalankan ulang dengan akses proses berizin. Audit npm sandbox gagal mengakses registry; percobaan berizin berhasil dengan 0 kerentanan. Tidak mengklaim uji seluruh browser atau Microsoft Excel desktop pada sesi ini.
