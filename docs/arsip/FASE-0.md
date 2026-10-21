# Fase 0 — audit dan rancangan Satu Data ITPLN

Tanggal audit: 7 Oktober 2026, Asia/Jakarta. Status: Fase 0 difinalisasi dengan keputusan pengguna; implementasi Fase 1 belum dimulai. Skema dan kontrak berikut menjadi acuan fase berikutnya. Catatan lanjutan yang belum diputuskan tidak mengubah keputusan yang sudah disahkan.

## 1. Audit proyek

Root berisi `.vscode/launch.json`, `static-web/`, dua PNG preview dan PDF laporan. Tidak ditemukan root README, AGENTS, package.json, Docker Compose, `.env`, server, database, tests maupun `.git`. Git tidak tersedia di PATH sehingga `git status` gagal; tidak ada klaim working tree bersih. ZIP `../simantuku-clone new.zip` diperiksa daftar entrinya tanpa diekstrak: isinya frontend, preview, konfigurasi editor dan PDF yang sama jenisnya; tidak berisi backend, docs teks atau build-replica.ps1. Ini inventaris, bukan pembuktian hash seluruh file ZIP.

Sebelas halaman HTML tersedia. `index.html` memakai `reference.css`, `shell.css`, ApexCharts dan `vendor/reference-charts.js` dengan snapshot JSON inline. Halaman detail memakai `style.css` dan Chart.js lokal di **`assets/js/vendor/chart.umd.js`**, berbeda dari path singkat dalam permintaan. Ada kartu/snapshot angka 364 dosen tetap dan 6.986 mahasiswa, nama dosen/NIDN, 35 prodi universitas asal, data fakultas, KPI dan akreditasi statis. Pencarian hanya angka contoh 371/4.670 akan melewatkan banyak snapshot yang sebenarnya ada.

Navbar dibangun dari `navbar.js`; footer detail dari `footer.js`, tetapi footer index inline sehingga perlu disatukan Fase 3. Masuk membuka login universitas asal. Logo universitas/LPM/SIMANTUKU dan lambang Unggul tersimpan lokal; penggunaan branding dan klaim akreditasi asal harus dihentikan saat refactor. Tidak ada auth, role, API, import atau workflow. `launch.json` hanya membuka beban-mengajar di Edge.

`build-replica.ps1` tidak ditemukan di repo/ZIP yang diperiksa; jangan membuat ulang tanpa kebutuhan, jangan menghapus bila nanti tersedia. Semua file lama dipertahankan pada fase ini.

Referensi publik dibaca untuk struktur, bukan sumber data ITPLN:

- [Dashboard utama](https://simantuku.univpancasila.ac.id/utama): empat kartu, panel mahasiswa/dosen, navigasi dan footer.
- [Statistik mahasiswa](https://simantuku.univpancasila.ac.id/utama/statistik/mahasiswa), [PMB](https://simantuku.univpancasila.ac.id/utama/statistik/mahasiswa-baru), [lulusan](https://simantuku.univpancasila.ac.id/utama/statistik/lulusan): panel konfigurasi, filter dan pilihan Bar/Donut/Area; state kosong/loading.
- [IAPT](https://simantuku.univpancasila.ac.id/kinerja-pt/iapt), [daftar prodi](https://simantuku.univpancasila.ac.id/daftar-prodi), [capaian IKU](https://simantuku.univpancasila.ac.id/capaian-iku): pola panel, filter prodi dan tabel indikator. KPI ITPLN A–D mengikuti laporan ITPLN, bukan daftar indikator universitas asal.

Hasil web berupa teks terstruktur, bukan pemeriksaan screenshot/pixel desktop/mobile. Referensi dapat berubah dan tidak boleh menyuplai angka, logo atau kontak ITPLN. Kontak ITPLN belum diberikan: placeholder berlabel sampai dikonfirmasi.

## 2. Laporan dan peta sumber

File teks yang diminta semula tidak ada. Ekstraksi dibuat dari PDF lokal: 154 halaman, 564.338 karakter sebelum konversi newline Windows (572.561 karakter pada berkas CRLF). SHA-256 PDF: `E141B6AF50D31F63FF7BBF42E2E93C9BC0442D52E713B70E82ACC44AC625D221`. Penanda PDF PAGE menggunakan nomor fisik; nomor cetak laporan biasanya berbeda delapan halaman. Audit membaca daftar tabel, tabel seed dan bagian terkait; mapping backlog tidak berarti setiap baris backlog sudah divalidasi.

| Data | Sumber laporan (nomor halaman cetak) | Perlakuan |
|---|---|---|
| Master KPI / capaian | Tabel 1.1 (5–6), 4.20 (138–140), ringkasan eksekutif | Target dan capaian dipisah; simpan versi sumber |
| Target RKA | Tabel 1.2 (7–8) | Target tahunan, tidak menggantikan aktual |
| Prodi / mahasiswa aktif | Tabel 1.3 (9) | 19 prodi urutan tetap, periode 20252 |
| Dosen | Tabel 1.4 (14), pembanding dosen tetap Tabel 2.7 (35) | 222; flag jafung |
| Tendik per prodi | Tabel 1.5 (15) | 30 berdasarkan baris, berbeda cakupan tendik institut 109 pada Tabel 2.7 |
| Tracer lulusan 2025 | Tabel 1.6 (16), 2.19 (61) | NULL dipertahankan; cakupan institut terpisah |
| Mahasiswa baru / daftar ulang | Tabel 4.6 (106–107) | 2.030 target, 1.678 realisasi; tahun masuk 2026, akademik 20261, laporan 2026-S1, snapshot 2026-06-30 |
| Beban / rekognisi agregat | Tabel 2.1 (21), 2.8 (35) | Beban rerata 12,83, aktif mengajar 214; bukan daftar SKS per dosen |
| Prestasi (Fase 5) | Tabel 1.7 (18), 1.8 (19), 2.22 (69) | Pisahkan institut/mahasiswa |
| Penelitian / HKI / PkM / publikasi (Fase 5) | Tabel 4.7 (108), 4.8 (110), 4.9 (111), 2.1 (21), 2.8 (35) | Jangan gabungkan capaian 62 publikasi dengan KPI 31 tanpa definisi |
| Kerja sama (Fase 5) | Tabel 2.3 (25), 2.4 (30), 2.23 (73), 2.24 (76), 2.25 (79) | Akademik/usaha/kelembagaan/horizontal berbeda |
| Keuangan (Fase 5) | Tabel 2.12 (50), 2.13 (52), 2.14 (53), 4.19 (136) | Rupiah numeric, pisah rasio dan nilai uang |
| Akreditasi (Fase 5) | Tabel 4.17 (133), 4.18 (134) | S1 Geografi vs Geospasial, Kewirausahaan vs Bisnis Energi perlu mapping resmi; status historis bukan status hari ini |
| AMI (Fase 5) | Tabel 4.12–4.16 (120–132) | Capaian, evaluasi dan standardisasi terpisah |

## 3. Temuan kualitas dan kontrol

| Kontrol atas baris request yang cocok dengan tabel | Hasil |
|---|---:|
| Mahasiswa aktif / perempuan | 5.080 / 1.494 |
| Dosen / perempuan / S3 | 222 / 76 / 77 |
| Jafung: TP, AA, L, LK, GB | 61, 44, 87, 25, 6 = 223 |
| Tendik laki / perempuan / total | 21 / 9 / 30 |
| PMB target / daftar ulang | 2.030 / 1.678 |
| Cakupan tracer | 328 / 1.100 = 29,82% |

Flag seed/validator yang direncanakan:

1. Tabel 1.5 TOTAL tertukar; hasil baris dipakai dengan catatan provenance.
2. Tabel 1.4 jafung 223 vs 222 dan narasi AA 43 vs baris 44: perlu verifikasi BSDM. Beberapa baris juga tidak seimbang (misalnya Informatika jafung 33 vs dosen 29); warning per baris, jangan CHECK jumlah jafung = total karena akan menghalangi pencatatan sumber.
3. Tabel 4.6 daftar ulang 1.678/2.030 vs KPI PMB 61,95% dengan target 2.000: dua metrik terpisah, perlu klarifikasi PPA/PRP; BAA sebagai pembaca. Nilai sekitar 1.239 hanya hasil pembulatan rasio, bukan jumlah aktual yang boleh di-seed.
4. Tracer 328/1.100 sementara; seluruh '-' tetap NULL. Jangan membagi total institut secara proporsional ke prodi.
5. Nilai resmi KPI jafung ditetapkan pengguna **59,60%**, dengan numerator 118 dan denominator input terpisah **198** (dosen tetap ber-NIDN di luar dosen PLN). Perhitungan 118/198 × 100 = 59,5959…%, dibulatkan 59,60%. **58,08% bukan hasil hitung agen**: literal ini ada pada teks ekstraksi baris 7805, Tabel 4.20, indikator C.4 "Peningkatan kualitas Dosen", halaman PDF fisik 147 / cetak 139. Ringkasan eksekutif baris 159 menyebut 59,60%. Karena pengguna menyatakan angka pembanding tidak ada di laporan, keberadaan literal dalam hasil ekstraksi dicatat sebagai bukti ekstraksi yang perlu diverifikasi BSDM terhadap PDF asli; tidak dijadikan capaian resmi dan tidak menghalangi seed 59,60%.
6. Tabel 1.6 TOTAL wirausaha 8; baris Informatika 2, lainnya NULL. UI menampilkan jumlah baris tersedia 2 (bukan total lengkap institut), dengan catatan persis "laporan menulis total 8, rincian per prodi belum tersedia" dan flag BPKA. Selisih 6 tidak dialokasikan.
7. Nomenklatur unit mengikuti keputusan pengguna pada bagian 9: PJM/BKU mengganti asumsi LPM/keuangan. Adanya fakultas di Tabel 2.9 belum memberikan mapping yang cukup; filter fakultas dan menu IKU fakultas disembunyikan.

## 4. Skema final untuk implementasi

### Master dan keamanan

PK `bigint generated ... as identity`; FK `ON DELETE RESTRICT` agar provenance tidak hilang; soft-deactivate master. `numeric` untuk pecahan/uang (bukan float), integer nonnegatif untuk hitungan. Email dinormalisasi lower-case dengan unique index. Master menambah created_at/updated_at.

| Tabel | Kolom dan constraint utama |
|---|---|
| unit | id, kode unique nullable sementara untuk Bagian Pengembangan Kemitraan, nama, aktif, nama_terkonfirmasi; kode BSAR/BPAD dipertahankan, arti nama belum ditebak |
| domain_unit | domain kode allowlist unique, unit_id FK; kepemilikan domain di database, bukan kode unit hardcode; admin mengelola dan diaudit |
| users | id, nama, email unique lower-case, password_hash nullable hanya akun sistem, role CHECK admin/viewer/baa/ppa/bsdm/bpka/bku/bkm/lppm/pjm/prp/kerjasama/system, unit_id FK nullable admin/viewer/system, is_system, aktif, last_login, must_change_password, session_version; system dilarang login |
| prodi | id, kode unique internal `01`–`19`, urutan unique, nama, jenjang CHECK D3/S1/S2/PROFESI, fakultas nullable, aktif; kode_dikti nullable dan tidak diisi rekaan |
| periode_akademik | id, kode unique, tahun_ajaran, semester CHECK Gasal/Genap, aktif, urutan unique, mulai/selesai nullable; maksimum satu aktif; seed 20252 (2025/2026 Genap), 20261 (2026/2027 Gasal) |
| periode_laporan | id, kode unique, tahun, semester CHECK S1/S2, mulai, selesai, aktif, urutan unique; CHECK mulai <= selesai, unique(tahun,semester); seed 2026-S1 (2026-01-01..2026-06-30), 2026-S2 (2026-07-01..2026-12-31); maksimum satu aktif |
| visibilitas_modul | id, kode_modul unique allowlist, akses CHECK public/authenticated, aktif, updated_by FK; perubahan admin diaudit; env PUBLIC_DASHBOARD saklar global |
| kpi_indikator | id, kode, tahun, perspektif CHECK A–D, nama, formula teks sumber, bobot numeric (negatif diperbolehkan D), target_nilai numeric nullable, target_teks nullable, target_tanggal nullable, satuan, jenis CHECK angka/persen/tanggal/indeks, arah CHECK higher_is_better/lower_is_better, unit_pemilik_id FK; unique(tahun,kode) |
| rka_target | id, kode_item, item, angka numeric nonnegatif, satuan, tahun, jenjang nullable, sumber_id FK; unique(tahun,kode_item); hanya admin/PRP, seluruh perubahan diaudit |
| sumber_data | id, dokumen, sha256, nomor_tabel, halaman_pdf, halaman_cetak, rentang_mulai/akhir nullable, catatan; provenance wajib untuk seed |
| session | store session PostgreSQL, masa berlaku dan index expiry; bukan MemoryStore produksi |

KPI tahunan tidak boleh berubah retroaktif saat target tahun baru diubah. Master indikator/target tahunan dikelola admin/PRP; penyesuaian target setelah terbit perlu audit serta pembatalan/penilaian ulang versi capaian terkait. Tidak mengasumsikan target tanggal majemuk bisa dipadatkan menjadi satu tanggal.

### Data dan versi workflow

Setiap tabel input mempunyai `id`, `periode_laporan_id` FK, serta `periode_akademik_id` FK jika domain akademik (nullable hanya untuk data institut tahunan dengan cakupan eksplisit). Kolom umum: `unit_id` FK (pemilik dari domain_unit), `versi`, `is_current_approved`, `previous_approved_id` self FK nullable, `status` CHECK draft/submitted/approved/rejected, `submitted_by/approved_by` FK users, submitted_at/approved_at, review_note, created_by FK, created_at/updated_at, `row_version`, `sumber_id` FK, `sumber` teks provenance, serta reviewed_by/reviewed_at untuk penolakan. CHECK metadata konsisten dengan status; reject wajib catatan. Approved payload immutable. Tidak ada satu periode_id generik yang mencampur dua dimensi.

Satu baris per business key dan versi; partial unique index menjamin maksimum satu `is_current_approved=true` dan satu draft/submitted/rejected aktif per key. CHECK current hanya boleh berstatus approved. Ini menggantikan unique(periode,prodi) absolut agar revisi tidak menghapus publikasi sebelumnya. Indeks (periode_akademik_id,prodi_id), (periode_laporan_id,prodi_id), status/unit/submitted_at dan FK dipakai sesuai domain. UNIQUE NULLS NOT DISTINCT PostgreSQL 16/partial indexes eksplisit melindungi key institut dengan prodi_id NULL; NULL tidak boleh membuka duplikasi.

| Tabel | Payload | Business key (ditambah versi pada UNIQUE) |
|---|---|---|
| mahasiswa_aktif | prodi_id FK wajib, total, perempuan, status_mhs default aktif | laporan, akademik, prodi, status_mhs |
| mahasiswa_baru | prodi_id wajib, tahun_masuk, tanggal_snapshot DATE, target, realisasi_daftar_ulang | laporan, akademik, prodi, tahun_masuk, snapshot |
| lulusan | prodi_id nullable, cakupan CHECK institusi/prodi, tahun_lulus, periode_wisuda nullable kode acara, jumlah, ipk_rata nullable CHECK 0..4; CHECK cakupan institusi iff prodi NULL | laporan, akademik nullable, cakupan, prodi nullable, tahun_lulus, periode_wisuda nullable |
| dosen_prodi | prodi_id wajib, total, perempuan, s3, tenaga_pengajar, asisten_ahli, lektor, lektor_kepala, guru_besar | laporan, akademik, prodi |
| tendik_prodi | prodi_id wajib, laki, perempuan | laporan, akademik, prodi |
| tracer_study | prodi_id wajib, tahun_lulus, jumlah_lulusan/responden nullable, kerja_kurang_3_bulan, kerja_lebih_3_bulan, sesuai_bidang, wirausaha, studi_lanjut nullable; tanpa akademik wajib | laporan, prodi, tahun_lulus |
| tracer_ringkasan | tahun_lulus, responden 328, lulusan_institusi_id FK ke versi lulusan 1.100, total kategori sumber nullable (wirausaha_sumber=8), data_sementara | laporan, tahun_lulus |
| kpi_capaian | indikator_id FK, tanggal_snapshot DATE, nilai_numerik/teks/tanggal nullable, basis_nilai CHECK actual/reported_percent, metrik_tambahan JSONB terbatas schema, catatan; tanpa akademik wajib | laporan, indikator, snapshot |
| kpi_input | indikator_id FK, kode_input, nilai_numerik nullable nonnegatif, satuan, tanggal_snapshot; workflow/versi yang sama | laporan, indikator, kode_input, snapshot |

KPI/tracer_ringkasan berskala institut, tanpa prodi wajib. Semua kolom hitungan nonnegatif, perempuan <= total dan S3 <= total; tracer responden <= lulusan hanya bila tersedia. Tidak menjumlahkan kategori tracer yang bisa saling tumpang tindih. Nilai numerik dan tipe indikator divalidasi backend; NULL denominasi prodi dipertahankan. Seed `lulusan` mencatat 1.100 pada tahun_lulus=2025, laporan 2026-S1, cakupan institusi, prodi_id/akademik/periode_wisuda NULL; tidak berpura-pura menjadi wisuda 20252. Tracer ringkasan mereferensikan baris ini sehingga denominasi tidak diduplikasi. Publikasi revisi lulusan memperbarui referensi ringkasan secara tervalidasi/atomik, tidak diam-diam memakai denominasi versi lama.

Seed `kpi_input` menyimpan denominator 198 dengan kode `dosen_tetap_nidn_non_pln`, numerator 118 dengan kode `dosen_lektor_ke_atas`, pemilik PRP, provenance denominator keputusan pengguna, pembanding Tabel 1.4 untuk numerator. Input terpisah dapat direvisi dan diverifikasi; nilai resmi capaian 59,60% tetap explicit. API tidak menghitung numerator/denominator dari 222 secara otomatis. PMB snapshot 2026-06-30/akademik 20261/laporan 2026-S1; mahasiswa aktif/dosen/tendik akademik 20252/laporan 2026-S1. KPI snapshot 2026-06-30/laporan 2026-S1.

Beban mengajar/rekognisi: tidak ada nama dosen atau SKS individual pada seed. State kosong "Belum ada data. Menunggu input BSDM"; lulusan per prodi "Belum ada data. Menunggu input BAA". Total institut 2025 dapat tampil terpisah berlabel cohort, tanpa digabung dengan periode akademik. Domain backlog lainnya tetap Fase 5.

### Audit dan kualitas

- `audit_log(id,user_id,aksi,tabel,row_id,nilai_lama jsonb,nilai_baru jsonb,waktu,request_id,is_override boolean default false,override_reason nullable)`: CHECK override wajib alasan nonblank; hanya admin dapat menghasilkan aksi `approve_override`. Index waktu/user/tabel-id; append-only untuk akun aplikasi melalui permission database; redaksi password/token, termasuk reset password dan seed/import/workflow/master.
- `data_quality_flag(id,tabel,row_id nullable,sumber_id FK,pesan,severity CHECK info/warning/error,resolved default false,rule_code,detail jsonb,created_at,resolved_by FK,resolved_at,resolution_note)`: FK sumber/aktor nyata, domain dan row_id tervalidasi melalui allowlist service (row_id lintas tabel bukan FK palsu). Resolve wajib alasan dan audit, tidak mengubah nilai sumber.
- `import_batch(id,user_id,unit_id,domain,periode_laporan_id,periode_akademik_id nullable,tanggal_snapshot nullable,status,payload tervalidasi,hasil_preview,created_at,expires_at)`: hanya pemilik/admin, TTL, ukuran/baris dibatasi. Preview tidak mengubah domain; commit draft atomik dan idempotent. Tidak mengeksekusi formula CSV; ekspor template/laporan menetralkan formula spreadsheet.

### Views dan query dashboard

`v_dashboard_mahasiswa`, `v_dashboard_dosen`, `v_dashboard_mahasiswa_baru`, `v_dashboard_lulusan`, `v_dashboard_tendik`, `v_dashboard_tracer`, `v_kpi_capaian`: semuanya filter `status='approved' AND is_current_approved`. Agregasi masing-masing domain dilakukan sebelum join master untuk menghindari perkalian total. View per-prodi dan periode; endpoint institut SUM terpisah.

Delta membandingkan dimensi/grain yang sama: akademik untuk mahasiswa/dosen, tahun masuk dan snapshot setara untuk PMB, cohort/periode wisuda setara untuk lulusan, laporan untuk KPI. Tanpa data pembanding delta null dan UI '—'; previous nol → persentase null. Setiap kartu menyertakan label periode_akademik/periode_laporan/tanggal_snapshot yang relevan. PMB berlabel "Gasal 2026/2027 — per Juni 2026", meski snapshot mendahului awal kuliah. Lulusan institut 2025 (1.100) ditampilkan terpisah dari rincian prodi/wisuda yang kosong; view tidak pernah menjumlah agregat institut + prodi.

Visibilitas diterapkan pada **setiap endpoint dan bagian response**. Akses anonim = PUBLIC_DASHBOARD true AND modul aktif AND akses public. Jika false, semua dashboard membutuhkan session; tidak mengubah modul privat menjadi publik saat true. Default publik: mahasiswa, PMB, dosen, tendik agregat, lulusan, prodi; tracer/KPI/IKU/keuangan/quality flags default authenticated (tracer dipilih internal karena detail alumni tidak secara eksplisit diizinkan publik). Summary publik hanya kartu akademik dan metadata aman: tanpa flags, KPI, input, audit atau detail sumber privat. Kinerja institusi komposit memeriksa izin setiap bagian; tidak menyelundupkan KPI melalui endpoint publik. User login viewer ke atas membaca data approved/flags; audit tetap admin, diff/antrean tetap PRP/admin, data draft tetap terbatas unit. Quality flag endpoint menyajikan catatan kualitas saja, tanpa membocorkan nilai draft atau identitas pengaju ke viewer.

## 5. RBAC dan workflow

| Role | Penulisan yang diizinkan | Verifikasi |
|---|---|---|
| admin | Semua domain dan master, user, password reset, konfigurasi visibilitas | Semua; self-approval hanya override dengan alasan dan audit khusus |
| baa | Mahasiswa aktif, lulusan, master prodi; PMB baca saja | Tidak |
| ppa | Mahasiswa baru/PMB | Tidak |
| bsdm | Dosen, tendik; beban/rekognisi setelah schema disetujui | Tidak |
| bpka | Tracer dan ringkasan tracer | Tidak |
| prp | KPI capaian/input, master KPI/target RKA | Lintas unit; tidak menyetujui submission sendiri |
| bku/lppm/pjm/kerjasama/bkm | Keuangan / penelitian-HKI-PkM / AMI-akreditasi / kemitraan / kemahasiswaan-prestasi, pada Fase 5 | Tidak |
| viewer | Baca approved saja | Tidak |
| system | Akun seed, tanpa login dan tanpa akses API | Hanya metadata persetujuan seed via runner khusus |

Role ID stabil terpisah dari nama/kode unit master. `domain_unit` menentukan unit pemilik; middleware dan query memakai role + unit_id + domain. PMB milik PPA, BAA tidak dapat edit/submit/import PMB. BSAR/BPAD tidak mempunyai role input; role kerjasama belum diberi user demo/input sampai kode resmi dikonfirmasi. BKM ada sebagai role kemahasiswaan tanpa domain input aktif sebelum Fase 5. Admin dapat lintas unit secara eksplisit dan diaudit. Tidak ada query tabel dinamis dari input bebas. Master perubahan oleh BAA dibatasi prodi, bukan role/user/periode/KPI.

Transisi: draft → submitted → approved atau rejected; rejected → draft → submitted. PATCH draft/rejected tidak boleh memuat status/aktor persetujuan. Submit memvalidasi semua field dan warning; error struktural menolak, warning sumber tampil untuk pertimbangan reviewer. Approved direvisi dengan endpoint revision, tanpa mengubah baris published. Approve/reject menggunakan transaksi dan SELECT FOR UPDATE/row_version; diff dibanding previous approved, dan konflik versi membalas 409. Approve menolak aktor yang sama dengan submitted_by. Admin saja dapat meminta override eksplisit (`override=true`, `override_reason` wajib nonblank); audit aksi approve_override, is_override=true dan alasan. PRP tidak dapat override. Data KPI yang diajukan PRP harus disetujui user PRP lain atau admin.

Seed awal langsung approved dan current dengan approved_by user sistem `seed`, `sumber='Laporan Manajemen ITPLN Semester I 2026'`, sumber_id + nomor tabel + hash. Akun seed is_system=true, role system, aktif=false, password_hash=NULL dan tidak dapat diautentikasi; tidak memakai password demo. Seed merupakan bootstrap yang diizinkan pengguna, dicatat aksi seed_approved, bukan self-approval manusia. submitted_by/submitted_at NULL khusus seed approved; CHECK mengizinkan pengecualian hanya untuk provenance seed yang valid. approved_at waktu seed sebenarnya, bukan tanggal snapshot laporan. Koreksi seed selalu revisi/submission baru, tunduk four-eyes. Seed idempotent tidak menimpa koreksi pengguna.

Authentication: GET csrf menghasilkan session anon/token; login memverifikasi CSRF, bcrypt, user aktif, regenerate session dan token, catat last_login. Semua write termasuk logout/change-password/reset/import/review memakai CSRF. Role/unit/status aktif dibaca ulang dari database; reset password/change role/nonaktif menaikkan session_version dan mencabut session. PostgreSQL session store; secure cookie produksi via HTTPS/proxy terpercaya.

## 6. Kontrak API yang direncanakan (prefix /api)

Read dashboard mengikuti visibilitas_modul + PUBLIC_DASHBOARD; semua read sensitif wajib session. JSON `{data,meta}` atau error `{error:{code,message,fields,request_id}}`. Validasi 422; 401 session, 403 role/CSRF, 404 resource tidak tersedia, 409 konflik. Pagination dibatasi; filter periode_akademik_id/periode_laporan_id/prodi_id/jenjang/tahun/tanggal_snapshot divalidasi; tidak menampilkan data input belum approved pada read dashboard.

| Method dan path | Akses / fungsi |
|---|---|
| GET /health | Liveness minimal; tanpa rahasia |
| GET /auth/csrf | Token CSRF session |
| POST /auth/login, /auth/logout | Login / logout + CSRF |
| GET /auth/me | User/role/unit aman, tanpa hash |
| POST /auth/change-password | Session + password lama + CSRF |
| GET /master/prodi, /master/periode-akademik, /master/periode-laporan | Metadata akademik minimal mengikuti visibilitas; tanpa data privat |
| POST /master/prodi; PATCH /master/prodi/:id | admin/baa |
| POST /master/periode-akademik, /master/periode-laporan; PATCH masing-masing /:id | admin |
| GET /dashboard/summary | Empat kartu akademik, delta, dua dimensi periode/snapshot dan coverage; tanpa quality flags privat |
| GET /dashboard/mahasiswa, /dashboard/mahasiswa-baru, /dashboard/lulusan, /dashboard/dosen, /dashboard/tendik, /dashboard/prodi | Approved agregat; modul public default, tunduk saklar global |
| GET /dashboard/tracer, /dashboard/kpi | Login viewer ke atas default; approved saja |
| GET /dashboard/kinerja-pt | Izin per bagian; tidak mengungkap KPI/keuangan ke anonim |
| GET /dashboard/beban-mengajar, /dashboard/rekognisi-dosen | Agregat kosong selama belum ada input BSDM; mengikuti visibilitas modul dosen |
| GET /data/:domain | Session, data/domain unit sendiri; PRP/admin untuk review |
| GET /data/:domain/:id | Detail, status, provenance, riwayat; scope unit |
| POST /data/:domain | Membuat draft; unit dari session |
| PATCH /data/:domain/:id | Mengedit draft/rejected + row_version |
| POST /data/:domain/:id/revision | Membuat revisi draft dari approved |
| POST /data/:domain/:id/submit | Pemilik domain/admin; submitted terkunci |
| POST /data/:domain/bulk-draft, /data/:domain/bulk-submit | Pemilik/admin, transaksi batch, validasi per baris; route literal sebelum /:id |
| GET /verification/submissions | prp/admin; antrean dipaginasi |
| GET /verification/:domain/:id/diff | prp/admin; diff against prior approved + flags |
| POST /verification/:domain/:id/approve, /verification/:domain/:id/reject | prp/admin, CSRF, row_version; four-eyes, admin override eksplisit dengan alasan; reject wajib catatan |
| GET /imports/:domain/template | Session pemilik domain; template 19 prodi master aktual |
| POST /imports/:domain/preview | CSV terbatasi, periode eksplisit, error per baris; belum mutasi domain |
| POST /imports/:batchId/commit | Pemilik preview; simpan semua draft atomik; tidak auto-submit |
| GET /imports/:batchId | Pemilik/admin; preview/hasil/status |
| GET/POST/PATCH /admin/users[/:id] | admin; list/create/update role/unit/status |
| POST /admin/users/:id/reset-password | admin; password sementara tak disimpan audit, wajib ganti, revoke session |
| GET /admin/audit | admin; filter, pagination, nilai teredaksi |
| GET /quality-flags | Login viewer ke atas; daftar flag teredaksi tanpa payload draft/identitas sensitif; filter/pagination |
| POST /quality-flags/:id/resolve | prp/admin; catatan wajib, audit |
| GET/POST/PATCH /kpi/indikator[/:id], /rka-target[/:id] | Read master sesuai kebijakan, tulis admin/prp |
| GET /admin/units; POST /admin/units; PATCH /admin/units/:id | admin, master unit/kode/nama |
| GET /admin/domain-units; PATCH /admin/domain-units/:domain | admin, pemetaan kepemilikan domain, audit dan validasi role/unit |
| GET /admin/visibilitas-modul; PATCH /admin/visibilitas-modul/:kode | admin; konfigurasi akses per modul, audit; env global dikelola deployment |

`:domain` hanya allowlist `mahasiswa-aktif`, `mahasiswa-baru`, `lulusan`, `dosen`, `tendik`, `tracer`, `tracer-ringkasan`, `kpi-capaian`, `kpi-input`. Backlog tidak otomatis aktif. Bulk form/submit atomik dengan hasil status per baris; import CSV template mengikuti grain (19 prodi hanya domain per prodi, bukan KPI/institut). Dalam tabel endpoint, GET collection memakai path tanpa /:id; POST untuk create collection; PATCH selalu /:id. GET /data/:domain/:id menyertakan riwayat versi/audit aman yang diizinkan scope unit.

Endpoint backlog Fase 5 (belum diimplementasikan): GET /dashboard/keuangan wajib login; penulisan keuangan/penelitian/hki/pkm/kerjasama/akreditasi/ami/prestasi melalui pola /data/:domain dan verifikasi/import yang sama setelah schema domain tersedia. Tidak ada endpoint role input BSAR/BPAD. Route halaman /capaian-iku-fakultas.html redirect 302 ke /capaian-iku-universitas.html pada Fase 3; target tetap dilindungi visibilitas KPI.

## 7. Rencana fase dan halaman

1. Fase 1 (menunggu "Lanjut Fase 1"): Compose DB, `.env.example` termasuk PUBLIC_DASHBOARD=true, ignore rahasia, package/runner SQL/seed JSON+SQL dan demo bcrypt password dari env. Demo setiap role manusia dengan unit terkonfirmasi; bukan seed/BSAR/BPAD/kerjasama yang kode unitnya belum ada. Seed idempotent approved oleh akun sistem seed, tidak mereset password/menimpa koreksi existing. Dua master periode, domain_unit, visibilitas_modul, input KPI 198, lulusan institusi 1.100, views dan flags; kontrol SQL nyata.
2. Fase 2: Express, auth/session/CSRF/RBAC, audit, validators, approved reads, write/workflow/CSV. Tes node:test dengan PostgreSQL test terpisah; viewer/lintas unit, submitted terkunci, revisi approved tetap terbaca, rollback, concurrency.
3. Fase 3: api.js, semua halaman data-driven, satu navbar/footer, Chart.js mengganti renderer ApexCharts index (berkas lama tetap dipertahankan). Layout kartu/panel mengikuti referensi; tanpa data asal. Fakultas/menu IKU Fakultas disembunyikan; route redirect ke IKU Universitas karena belum ada data fakultas. Loading/kosong/error, 360px, label dua dimensi periode. Beban/rekognisi/lulusan per prodi kosong sesuai pesan pengguna; akreditasi kosong hingga Fase 5. KPI login, summary akademik aman untuk publik.
4. Fase 4: login/ganti-password/auth-guard; input/baa (19 baris mahasiswa aktif/lulusan, PMB baca), input/ppa (PMB), input/bsdm (dosen/tendik), input/bpka (tracer dan ringkasan), input/prp (KPI/input denominator), input/verifikasi, admin/users dan audit serta konfigurasi unit/visibilitas. Unit backlog halaman penjelasan belum aktif, tanpa dummy. Total otomatis, warning, CSV/template/preview, draft/submit/riwayat, diff dan admin override dengan alasan. Input beban/rekognisi detail menunggu definisi data BSDM.
5. Fase 5: domain backlog dari peta tabel laporan, gunakan pola workflow/provenance/audit yang sama, tidak dibuat lebih awal.
6. Fase 6: rate limit login, helmet, backup/restore teruji, README setup penuh, smoke Playwright desktop/mobile. Keamanan dasar auth/CSRF/RBAC tetap diterapkan mulai Fase 2.

## 8. Verifikasi Fase 0 dan reproduksi

Perintah dijalankan: `rg --files` dan `rg --files --hidden` (inventaris), `Get-Content static-web/README.md` dan HTML/JS/CSS terkait (audit), `[IO.Compression.ZipFile]::OpenRead(...)` (inventaris ZIP tanpa overwrite), `Get-Command node,npm,docker,git,psql`/`where.exe` (tidak terdeteksi), `Get-FileHash -Algorithm SHA256` (hash di atas), `rg -n` nomor tabel/angka pada teks laporan (peta dan konflik). `git status --short` tidak berhasil karena Git tidak tersedia.

Ekstraksi Word COM tidak berhasil (logon session sandbox); unduhan tool dari sandbox awal tidak dapat koneksi. Unduhan Python portable/pypdf di folder TEMP lewat izin jaringan berhasil; Python/pypdf kemudian mengekstrak 154 halaman. Tidak ada perubahan Office/runtime/global PATH. Gunakan ulang teks yang sudah tersedia; dependency PDF tidak diperlukan oleh aplikasi.

Kontrol aritmetika dijalankan di PowerShell dengan penjumlahan seluruh pasangan/baris request, bukan hanya TOTAL PDF. Contoh mahasiswa yang dapat dijalankan ulang dari root:

```powershell
$rows = '418/39,22/14,34/12,23/1,221/39,703/213,345/186,5/2,953/222,497/99,275/122,247/106,111/69,81/37,300/14,345/187,211/103,90/8,199/21'.Split(',')
$total = 0; $perempuan = 0
foreach ($row in $rows) { $cols = $row.Split('/'); $total += [int]$cols[0]; $perempuan += [int]$cols[1] }
"Total=$total; Perempuan=$perempuan"
Get-FileHash -Algorithm SHA256 -LiteralPath 'Laporan Manajemen ITPLN 2026 FINAL.pdf'
rg -n -C 2 '59,60|58,08|Tabel 1\. 6|Tabel 4\. 6' docs/Laporan_Manajemen_ITPLN_2026_FINAL.pdf.txt
```

Hasil: `Total=5080; Perempuan=1494`. Dosen/PMB/tendik dihitung dengan pola serupa dan hasilnya pada tabel kontrol. Pemeriksaan akhir menghitung SHA-256 setiap entry file ZIP dan membandingkannya dengan file lokal: 39 file diperiksa, 0 berubah/hilang. Teks ekstraksi diperiksa memiliki 154 penanda halaman. Ini verifikasi dokumen/aritmetika; migrasi, seed database, tes auth/UI dan SQL belum dijalankan karena tidak termasuk Fase 0. File baru hanya AGENTS.md, README.md, dokumen audit ini, dan ekstraksi PDF.

## 9. Keputusan pengguna yang disahkan

| Unit master | Domain / status |
|---|---|
| BAA | Mahasiswa aktif, lulusan, prodi; PMB baca |
| BSDM | Dosen/tendik; data beban/rekognisi belum tersedia |
| BKU | Keuangan, mengganti role keuangan |
| BKM | Kemahasiswaan; domain prestasi pada Fase 5 |
| BPKA | Tracer |
| LPPM | Penelitian/HKI/PkM |
| PJM | Pusat Jaminan Mutu, AMI/akreditasi; mengganti role LPM |
| PPA | Pusat Pemasaran dan Admisi, PMB |
| PRP | KPI/RKA, verifikator lintas unit bersama admin |
| BSAR, BPAD | Master tanpa role input, nama/kepanjangan belum dikonfirmasi |
| Bagian Pengembangan Kemitraan | Kerja sama; kode NULL sampai resmi, tidak mengarang kode |

Nama lengkap unit yang tidak diberikan tidak dikarang; gunakan kode dengan nama_terkonfirmasi=false sampai master diperbarui. Pengguna menetapkan four-eyes dengan admin override beralasan; seed langsung approved oleh sistem seed; visibilitas per modul + saklar global; dua dimensi periode; KPI resmi 59,60%/denominator 198; tracer wirausaha 2 dari baris dengan catatan total sumber 8; lulusan institusi 1.100 dengan prodi NULL; data belum tersedia kosong; IKU fakultas disembunyikan dan redirect pada fase frontend.

Catatan lanjutan: kode resmi unit kemitraan, nama BSAR/BPAD, mapping fakultas, aset/kontak resmi, field data individual BSDM, dan rumus skor berbobot/arah indikator D menunggu pemilik terkait. Hal ini tidak membuka ulang keputusan Fase 0; data/domain tersebut tidak diisi rekaan. Untuk indikator D yang arahnya belum disahkan, simpan catatan perlu konfirmasi dan jangan menghasilkan penilaian arah/warna/rasio yang belum disetujui. Saklar/modul visibilitas didokumentasikan untuk keputusan pimpinan.

Finalisasi hanya mengubah dokumen AGENTS.md, README.md dan dokumen ini; frontend/PDF/ekstraksi tidak diubah, tidak ada migration/backend yang dibuat. Verifikasi finalisasi: pencarian istilah usulan lama, periode_id generik, role lama dan flag yang masih memblokir nilai resmi; pemeriksaan ulang literal 59,60%/58,08% serta aritmetika 118/198. Perubahan ini berupa dokumentasi, bukan tes aplikasi.

**Fase 0 selesai. Berhenti; Fase 1 hanya dimulai setelah pengguna mengatakan "Lanjut Fase 1".**
