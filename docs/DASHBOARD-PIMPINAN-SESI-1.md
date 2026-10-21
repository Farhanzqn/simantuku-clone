# Dashboard Pimpinan sesi 1 — 12 Oktober 2026

## Langkah 0: audit sebelum implementasi

Halaman lama bernama IKU sebenarnya monitoring 28 KPI unit kerja dalam empat perspektif A–D. Tidak ada model IKU Kemdiktisaintek pada runtime sebelum sesi ini.

| Lapisan | Lokasi / keputusan |
|---|---|
| HTML | `static-web/capaian-iku-universitas.html` memakai `data-page="kpi"`; buat `monitoring-kpi.html` dengan judul Monitoring Capaian Kinerja Unit Kerja (KPI). Berkas lama dipertahankan sebagai fallback redirect. |
| Redirect | `capaian-iku-fakultas.html`, `assets/js/redirect-iku.js`, route di `server/app.js`: arahkan kedua URL lama ke KPI, bukan IKU baru. Tidak membuat fakultas. |
| JS | Renderer KPI di `pages.js` tetap; `navbar.js`, `navigation.js`, daftar next di `api.js` diperbarui. `iku-menu`/`kinerja-menu` adalah ID kompatibilitas menu, bukan data; dipertahankan. |
| API | `/api/dashboard/kpi` di `routes/dashboard.js` tetap; lepaskan ketergantungan modul `iku`, tetap requireLogin + modul kpi. IKU baru `/api/dashboard/iku`, requireLogin + modul iku. |
| DB | `kpi_indikator`, `kpi_capaian`, `kpi_input`, `rka_target`, `rka_revisi`, `v_kpi_capaian`, `v_kpi_input`, view dashboard domain lain tetap. Tidak ada tabel/view IKU lama yang perlu rename. Modul `iku` existing adalah kebijakan akses, dipakai domain baru. |
| Workflow/form | Registry `domains.js`, form PRP Capaian KPI/Input Pembilang-Penyebut KPI/Target RKA sudah benar, dipertahankan. Tambah domain IKU tersendiri melalui workflow bersama. |
| Menu/CSS | Topik Kinerja menjadi Dashboard Pimpinan: Akreditasi Institusi (halaman existing, publik), Monitoring IKU, Monitoring Capaian Kinerja Unit Kerja (KPI). Keuangan/Catatan Kualitas dipindah ke Administrasi; Kinerja PT/Prodi ke Akademik & Mutu agar tautan existing tetap tersedia. Selector `#iku-menu` CSS tetap berlaku. |
| Tes | `server/tests/{api,ui}.test.js`, `db/tests/database.test.js`: perbarui ekspektasi URL/menu dan tambah regresi domain IKU. |
| Dokumen | STATUS, DESAIN, MATRIKS-INPUT, SETUP-WINDOWS memuat istilah/URL lama. Dokumen aktif diperbarui; arsip FASE-0/1/2/3/4/5D merupakan bukti historis, tidak ditulis ulang. |
| Artefak immutable | `db/seed/master.sql`, script seed kebijakan/visibilitas, migration 009/019 menyebut modul iku; dipertahankan beserta seluruh migration/seed lama. |

Keputusan: pemisahan presentasi dan domain baru, tanpa rename DB KPI. Cadangan global dan hash/fingerprint sebelum perubahan disimpan lokal di `.runtime/pimpinan-s1/`. Tidak mengubah .env, approved lama, dependency atau kanvas grafik existing.

## Kontrak IKU baru

- Sumber angka adalah 19 baris yang diberikan pengguna, `iku.kemdiktisaintek.go.id T2 2026`; tidak mengambil/mengoreksi angka dari situs. Tahun 2026, periode T2, terkait laporan 2026-S1.
- Status sumber `Sudah Diajukan` tidak sama dengan status workflow internal `submitted`. Seed awal mengikuti pengecualian akun sistem seed owner-only yang sudah digunakan domain lain: draft → submitted → approved, v1, ledger/checksum; input manusia tetap four-eyes.
- Master indikator memuat kode, induk, uraian, satuan, arah tinggi, urutan, grup. Capaian berversi memuat tahun/periode, baseline/target/realisasi numeric, status sumber, provenance dan penanda verifikasi; persen hanya dihitung view approved/current.
- Rata-rata adalah rata-rata aritmetika persentase semua baris terisi pada filter, termasuk sub-indikator, bukan skor resmi berbobot. Target nol/null menghasilkan persen NULL dan tidak masuk rata-rata/jumlah mencapai target.
- Ambang konfigurasi UI: hijau >=100; kuning >=70 dan <100; merah <70. Label/ringkasan memakai nilai presisi sebelum pembulatan; persen tampil 1 desimal, angka sumber hingga 3 desimal id-ID.
- Tanggal pembaruan berasal waktu publikasi internal, bukan tanggal pengambilan sumber yang tidak diberikan. Bintang D3*/S2** dipertahankan; arti catatan kaki tidak dikarang.
- Form PRP tanpa template Excel. Beban Kerja Dosen, Proyeksi Kinerja, SKP dan Fase 6 di luar lingkup.

## Implementasi dan verifikasi

Selesai. Migration 029 membuat master/capaian/view serta registrasi PRP, policy dan grants. Grain unik `(tahun,periode,indikator_id)` berlaku lintas periode laporan; versi/current/working memakai grain sama. Tidak membuat semester/triwulan laporan fiktif; T2 2026 terkait laporan 2026-S1. Saat instalasi kosong, trigger registrasi PRP mengisi domain baru sesudah master unit tersedia; upgrade memasukkan domain/policy insert-only.

Migration 030 memperbaiki penanda kualitas: nilai generated belum tersedia pada BEFORE trigger workflow, menyebabkan percobaan seed pertama rollback dengan `Payload submitted terkunci`. Kolom flag kemudian diturunkan oleh trigger `iku_capaian_00_quality` sebelum guard bersama. Karena 029 sudah ber-ledger, koreksi memakai migration baru, tidak mengganti checksum. Tidak ada baris seed parsial dari percobaan gagal.

Workflow guard bersama hanya mendapat pengecualian seed IKU yang sempit: owner selain app_user, akun system seed nonaktif, aksi seed_approved, transisi submitted → approved v1, sumber tepat, metadata seed. Seed insert approved langsung untuk IKU ditolak. Alur manusia dan aturan domain lama tetap. Persen tidak disimpan; `catatan_verifikasi` memicu flag, termasuk saat revisi.

Runner `db/scripts/seed-pimpinan.js` memanggil runner existing tanpa mengeditnya kemudian memasang `db/seed/iku-2026-t2.json`. Ledger `iku-2026-t2-v1` memverifikasi checksum, mengunci transaksi dan melewati grain yang sudah berisi data; tidak mengganti data manusia. Desimal string diikat langsung ke numeric PostgreSQL. Sumber/provenance tidak mengarang halaman PDF maupun tanggal pembaruan situs.

API IKU memakai requireLogin dan visibility iku; query tahun/periode tervalidasi zod/parameterized. KPI tetap requireLogin + visibility kpi, independen dari aktif/tidaknya modul iku. Halaman kedua domain masuk guard path normalisasi dan allowlist safeNext/BFCache. API membaca hanya view approved/current. Master/form PRP menggunakan registry dan layanan workflow existing; admin/reviewer mengikuti four-eyes/override audit.

### Bukti pemeriksaan

| Pemeriksaan | Hasil akhir |
|---|---|
| `npm test` | **80/80**. Seed 19, hierarki, numeric 0,905, nol, 4 flag, ledger idempotent; privasi API/HTML/encoded URL, redirect, CSRF/RBAC, draft/submitted/rejected tersembunyi, four-eyes/override audit, revisi current dan target nol; regresi domain lama/E1/E2 tetap lulus. |
| `npm run test:ui` | **39/39**. IKU/dashboard/form PRP pada 1440/360px; 19 baris, 4 badge, S1 195,6%, IKU 3 0,905, filter tahun/periode, kosong, error/retry, keyboard/scroll lokal, tanpa input file, membuka form tidak menulis. Regresi beranda 1280/1440/1920/2560/360px dan tinggi kanvas existing lulus. |
| `npm run db:verify` | **20/20**, sesudah suite mutasi selesai; kontrol IKU 19/4/AEE 94,1 dan kontrol existing. |
| `npm run db:check` | **18 kontrol existing lulus**. Tidak mengubah nilai dev agar kontrol hijau. |
| `npm audit` | **0 kerentanan**, tidak menambah dependency. |
| Migration/seed dev | `db:migrate`, `db:seed`, `db:app-role` berhasil. 029/030 juga diterapkan oleh harness _test; seed ulang di tes tidak mengubah baris. |
| Fingerprint lama | **23/23 domain dev identik**, hash seluruh row terurut ID, termasuk approved. File `dev-before.json` dibanding `dev-after.json`. |
| Berkas terlindungi | **62/62 identik**: .env, seluruh migration/seed dan script seed lama. Package.json hanya mengubah entry runner db:seed; dependency tetap. |

Ringkasan seed: 19 indikator; rata-rata aritmetika **69,1%**; **1 mencapai**, **18 di bawah target**; AEE **94,1%**, S1 **195,6%**, IKU 12 **66,7%**. Bukan skor resmi berbobot. Angka sumber tidak dikoreksi.

Percobaan awal API gagal pada ekspektasi 401 sebelum fixture mendapat CSRF (server benar menolak 403); fixture diperbaiki untuk membawa token anonim, tanpa melonggarkan middleware. Edge sandbox gagal membuka DevTools; suite berjalan dengan izin proses lokal. UI pertama menemukan overflow navbar 1280px (juga berdampak pada dua tes unggah existing); diperbaiki lewat padding/wrapping navigasi, seluruh suite kemudian lulus. Inspeksi screenshot menemukan uraian panjang tidak membungkus dan warna progress native; CSS halaman diperbaiki, hasil akhir diperiksa kembali.

Log `.runtime/pimpinan-s1/{test,ui,verify,check}.log`, audit.json; inventaris literal IKU sebelum kode `iku-inventory.txt`; cadangan global `backup/`. Screenshot fixture tanpa rahasia `.runtime/phase3/pimpinan-{iku,input-iku}-{1440,360}.png`. Berkas runtime tidak untuk commit.

Batas bukti: Node v24.19.0 dan Edge headless; Node 22 LTS/browser lain belum diuji. Instalasi kosong baru tidak dibuat/reset; tes memakai database _test existing terpisah. Tidak menjalankan deployment atau sesi 2/Fase 6. Tidak ada penghapusan file lama, reset DB, perubahan .env, penimpaan approved domain lama atau perubahan migration/seed lama.
