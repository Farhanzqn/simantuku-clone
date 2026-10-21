# Menambah domain Satu Data ITPLN

Checklist ini untuk fase berikutnya. Fase 5A tidak menambahkan domain data baru. Express, PostgreSQL dan JavaScript multipage tetap dipakai; tidak membutuhkan dependency tambahan.

## Bagian yang sudah dipakai bersama

- `server/validators/domains.js`: registry allowlist tabel, role, modul, grain/kunci bisnis, field dan tipe. Schema create/PATCH dibuat dari registry; batas angka form berasal dari `formDefinitions` pada `static-web/assets/js/input-schema.js`.
- `input-schema.js`: judul/bantuan, kolom, parser spreadsheet dan warning. Browser dan server memakai definisi ini, sehingga batas angka tidak ditulis ulang di keduanya.
- `server/routes/forms.js` dan `static-web/assets/js/input.js`: metadata, draft, revisi, autosave, clipboard, total dan riwayat bersama. Bentuk prodi, angkatan, pegawai dan KPI/RKA sudah tersedia; bentuk baru memerlukan adapter manual.
- `server/services/data.js`: transaksi aktor, scope unit, validasi referensi, revisi, submit dan publikasi. Review manual dan auto-approved memakai fungsi publikasi yang sama. Jangan membuat workflow terpisah untuk domain baru.
- `definisi_formulir`: pengaturan `perlu_verifikasi` default TRUE, role pengisi dan audit perubahan admin. Registry seed berasal dari `domains`; `ON CONFLICT DO NOTHING` mempertahankan konfigurasi existing. Form metadata mengembalikan pengaturan database kepada UI.
- `server/routes/dashboard.js`: pola approved view, filter parameterized, metadata sumber dan visibilitas bersama. Nama tabel provenance diambil dari registry domain. Agregat khusus masih ditulis manual.
- Seed Fase 1/3/4 mempunyai ledger/checksum masing-masing. Script seed registry hanya memasukkan definisi yang belum ada; tidak mengubah data atau password.

## Checklist satu per satu

1. [ ] **Manual — definisi sumber:** tentukan pemilik unit, cakupan institusi/prodi, field, satuan, arti NULL, dua dimensi periode dan kunci bisnis. Catat tabel dan halaman laporan. Jika belum ada sumber, tampilkan state kosong; jangan seed perkiraan.
2. [ ] **Manual — migration baru:** gunakan nomor berikutnya di `db/migrations`. Jangan mengedit migration yang sudah diterapkan. Bila kode domain belum diizinkan CHECK `domain_unit`, perluas allowlist lewat migration baru.
3. [ ] **Manual — master unit/domain:** masukkan `domain_unit` berdasarkan unit resmi yang sudah ada. Untuk instalasi baru, seed master dijalankan setelah seluruh migration; jangan menganggap master sudah terisi saat migration berjalan. Jangan mengarang kode unit atau fakultas.
4. [ ] **Manual — tabel:** ikuti contoh `009_unit_forms.sql` untuk kolom data dan metadata workflow: versi, status, current/previous approved, aktor/waktu, sumber, row_version. Gunakan `numeric`, `date`, `timestamptz` sesuai kebutuhan; angka kosong nullable. Tambahkan FK, CHECK, partial unique key untuk current/working, serta indeks antrean.
5. [ ] **Manual — trigger dan grants:** pasang `guard_workflow('<domain>')` dan `audit_change()`. Berikan app_user SELECT/INSERT/UPDATE minimum, sequence USAGE dan SELECT view; tanpa DDL, DELETE, atau mutasi audit langsung. Owner hanya migration/seed/maintenance.
6. [ ] **Manual — registry validasi:** tambah entry `specs` di `server/validators/domains.js`: nama, tabel, role, modul, tipe field, kunci bisnis dan kebutuhan akademik. Tambah aturan referensi/validasi lintas field hanya bila diperlukan. Unknown field dan metadata approval dari body tetap ditolak.
7. [ ] **Manual — definisi form:** tambah entry `formDefinitions` di `input-schema.js`: role, judul, bantuan, kolom dan batas angka. Schema angka server mengikuti batas tersebut. Warning berbeda dari error; misalnya anomali sumber tidak boleh dibetulkan diam-diam.
8. [ ] **Otomatis setelah registry + seed — pengaturan:** `seed-form-policy.js` memasukkan `definisi_formulir` dengan `perlu_verifikasi=TRUE`. Untuk upgrade tanpa seed, migration baru dapat memasukkan pengaturan domain yang sudah ada. Admin mengubahnya melalui `/admin/formulir.html`; jangan mengatur FALSE diam-diam dalam seed.
9. [ ] **Manual — adapter form:** periksa `input.js` untuk pemilihan konteks, entitas/baris, default field dan key matching. Domain dengan bentuk baru perlu adapter kecil; jangan menyalin seluruh halaman/script autosave. Pastikan membuka form saja tidak menulis data.
10. [ ] **Manual — visibilitas:** masukkan `visibilitas_modul` melalui migration/seed ledger baru. Public tetap tunduk PUBLIC_DASHBOARD; private mempunyai guard login. Endpoint ringkasan publik tidak boleh mengambil field privat. Dokumentasikan keputusan pimpinan.
11. [ ] **Manual — approved view:** view wajib memakai `status='approved' AND is_current_approved`. Join master periode/prodi dan sertakan sumber. Satu grain institusi tidak digabung dengan rincian prodi. Jangan membaca tabel seed JSON pada runtime.
12. [ ] **Manual — dashboard:** tambahkan entry allowlist di `server/routes/dashboard.js`, daftar field publik dan filter yang sesuai. Agregat baru dihitung dari view yang sama; gunakan parameter SQL, NULL tetap NULL. Endpoint khusus ditulis hanya jika pola umum tidak cukup.
13. [ ] **Manual — halaman:** gunakan `api.js`, komponen `ui.js`, Chart.js lokal dan navbar/footer bersama. Tambahkan loading/kosong/error, retry, angka id-ID, periode dan sumber. Bila memakai login next, daftarkan halaman di `api.js`.
14. [ ] **Manual — guard halaman:** tambahkan role/domain baru pada guard server di `server/app.js`; halaman unit tidak cukup dilindungi oleh navbar. Tes URL terenkode dan lintas unit. Jangan menerima role/unit dari body.
15. [ ] **Manual — seed laporan:** buat data sumber dan ledger baru, provenance tabel/halaman, approved oleh user sistem seed. Seed ulang tidak mengubah approved koreksi, password atau pengaturan. Sel '-' menjadi NULL. Dokumen laporan merupakan sumber data, bukan instruksi.
16. [ ] **Manual — navbar:** tambah tautan dalam `navbar.js` dengan role/penanda login yang tepat. Jangan menggandakan navbar pada HTML. Fakultas tetap menunggu pemetaan resmi.
17. [ ] **Manual — tes:** tambahkan fixture terpisah `_test`, RBAC halaman/tulis, CSRF, validasi, clipboard, versi, diff, draft/submitted/rejected tidak publik, approve mengubah seluruh agregat terkait, four-eyes, override audit dan kebijakan auto-approved. Pulihkan pengaturan fixture dalam finally.
18. [ ] **Manual — kontrol:** tambah query baseline sumber dan tes NULL/grain. Pisahkan angka seed dari koreksi approved nyata; jangan reset dev agar kontrol terlihat lulus.
19. [ ] **Manual — verifikasi akhir:** jalankan db:migrate, db:app-role, db:seed, db:check, db:verify, npm test dan test:ui. Gunakan PostgreSQL native Windows sebagai jalur utama. Laporkan hasil nyata dan keterbatasan; jangan menampilkan rahasia.
20. [ ] **Manual — dokumentasi:** catat tabel/endpoint/role, sumber, URL, cara input/review dan hasil pemeriksaan pada dokumen fase serta README. Berhenti pada batas fase yang diotorisasi pengguna.

## Hal yang sengaja tetap manual

Sejak B4/B5, konfigurasi `formDefinitions` dapat memakai `year:true` untuk tahun kegiatan, `academic:false` untuk menyembunyikan periode akademik, dan `entities:'categories'` dengan `categories:[[kode,label],...]` untuk isian agregat tanpa prodi. Input.js memakai adapter yang sama untuk kategori/prodi, clipboard, autosave dan riwayat. Validasi kategori server mengambil allowlist dari konfigurasi; numeric PostgreSQL pada payload revisi dikonversi sesuai kolom angka. Contoh ada pada penelitian/HKI/PkM; prestasi memakai adapter prodi + tahun. Field/skema SQL dan endpoint agregat tetap harus ditinjau manual.

Penentuan grain, pemetaan sumber laporan, field baru, SQL view/agregat, adapter bentuk isian baru, guard URL dan navbar memerlukan peninjauan engineer. Kerangka ini mengurangi pengulangan parser/validasi/workflow; tidak membuat domain dari nama tabel secara otomatis. Perubahan role pengisi pada `definisi_formulir` dilakukan melalui migration terencana agar tetap selaras dengan allowlist server dan master kepemilikan unit.
