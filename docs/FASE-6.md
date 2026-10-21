# Fase 6 — penyempurnaan dan siap pakai

Tanggal rencana: **13 Oktober 2026**. Status: **rencana, implementasi belum dimulai**. Sistem telah disetujui atasan; sasaran berikutnya adalah pemakaian percontohan BAA dan BSDM, deployment bersama IT kampus, dan serah terima dalam sisa kontrak sekitar dua bulan.

## Sasaran, lingkup dan batas kerja

Hasil wajib: dashboard publik melalui HTTPS di internet; input/verifikasi/admin hanya melalui jaringan kampus/VPN; akun personal unit dan verifikator; backup yang terbukti dapat dipulihkan; petugas IT yang mampu menjalankan, memantau dan memulihkan sistem tanpa pengembang. Monitoring KPI/IKU, keuangan, AMI, pegawai/formasi/tendik dan quality flags tetap minimal login, dengan keputusan jaringan dirinci bersama IT.

**Sesi penyusunan ini hanya mengubah FASE-6.md dan STATUS.md.** Semua tugas teknis, pengujian, provisioning akun, backup/restore dan konfigurasi di bawah adalah pekerjaan mendatang. Tidak ada perubahan kode, DB, `.env`, migrasi/seed, maupun eksekusi pengujian aplikasi dalam sesi ini. Rencana tidak menjadi izin otomatis menjalankan implementasi atau deployment.

- Pertahankan Node 22 LTS sebagai baseline yang harus dibuktikan, PostgreSQL 16 native Windows sebagai referensi, Express, vanilla JS multipage, Chart.js/aset lokal. OS produksi ditetapkan IT; bila berbeda, buktikan ulang di OS sasaran. Docker 5433 hanya alternatif.
- Tidak reset DB, menimpa approved, menghapus audit, mengubah checksum migration/seed lama, membuka runtime sebagai owner, atau melonggarkan limiter/CSRF/Helmet. Perubahan SQL nanti melalui migration baru; seed tetap insert-only. Dependency baru hanya bila ada kebutuhan dan justifikasi tertulis.
- Semua mutasi pengujian pada `PGTEST_DATABASE` terpisah berakhiran `_test`; restore latihan juga pada DB/mesin terisolasi. Data approved berubah hanya lewat workflow revisi yang sah. Data sumber tidak dikoreksi diam-diam.
- Pilot memprioritaskan alur BAA/BSDM existing, bukan penambahan semua domain. E2 sesi 2 dan fitur bersumber belum jelas tidak boleh menggeser keamanan, pemulihan, pilot atau serah terima.
- Penanggung jawab: pengembang menyiapkan perubahan/bukti; IT mengelola host, jaringan, sertifikat, backup dan operasi; BAA/BSDM menerima alur unit; PRP/verifikator menjalankan review; atasan menetapkan publikasi dan keputusan siap pakai. Nama PIC dan penggantinya harus diisi minggu 1.

## Dasar repo dan batas bukti

Dokumen yang dibaca: [STATUS](STATUS.md), [E2-RENCANA](E2-RENCANA.md), [REVIEW-KEAMANAN-E1](REVIEW-KEAMANAN-E1.md), [Dashboard Pimpinan sesi 1](DASHBOARD-PIMPINAN-SESI-1.md), [sesi 2](DASHBOARD-PIMPINAN-SESI-2.md), [SETUP-WINDOWS](SETUP-WINDOWS.md). [MATRIKS-INPUT](MATRIKS-INPUT.md) dipakai untuk kekosongan data/pemilik. Pemeriksaan kode berikut adalah pembacaan, bukan verifikasi runtime/DB/deployment baru.

| Kondisi nyata saat rencana ditulis | Bukti repo | Implikasi Fase 6 |
|---|---|---|
| `start` menjalankan `node server/app.js`; `dev` memakai `node --watch`. Baseline pengujian terdokumentasi memakai Node v24.19.0, belum Node 22. | [package.json](../package.json), STATUS, E2-RENCANA | Uji Node 22 dan kedua entry; produksi memakai start melalui pengelola proses. |
| Cookie sudah httpOnly, sameSite=lax, Secure ketika production; session PostgreSQL; `TRUST_PROXY` hanya dipasang jika bernilai `loopback`. | [server/app.js](../server/app.js), [session-store.js](../server/services/session-store.js) | Verifikasi konfigurasi nyata HTTPS/proxy. Proxy remote belum didukung oleh konfigurasi existing. |
| `/api/health` mengembalikan status ok tanpa query DB khusus. Startup memeriksa role app_user. Penutupan SIGINT/SIGTERM ada, tetapi belum ada pengelola proses dalam berkas deploy yang diperiksa. | server/app.js | Bedakan proses hidup dan siap melayani DB; uji restart/reboot/DB mati. Health anonim tidak membuktikan DB sehat. |
| Pool runtime maksimum 10; timeout koneksi/statement 10 detik, lock 3 detik, idle transaction 15 detik. | [db.js](../server/services/db.js) | Ukur antrean/koneksi dan kegagalan sebelum mengubah nilai. |
| Request ID dan error terkontrol sudah ada; log kegagalan worker aman. Maintenance sesi/preview tiap 5 menit menelan error timer tanpa pelaporan. | server/app.js, [excel-worker.js](../server/services/excel-worker.js), session-store.js | Lengkapi log/rotasi/alert dasar dan kegagalan maintenance; hindari rahasia/isi Excel. |
| Login dibatasi; gate Excel per pengguna/global, dua pekerjaan aktif dan antrean terbatas berlaku per proses. Slot aktif bertahan sampai finally/rollback; worker berdeadline. | [auth.js](../server/routes/auth.js), [excel-resources.js](../server/services/excel-resources.js), [form-excel.js](../server/routes/form-excel.js), review E1 | Mulai satu proses; multi-instance perlu rancangan pembatas bersama dan uji ulang, bukan sekadar menambah worker. |
| Admin sudah dapat membuat/menonaktifkan akun dan reset password; reset mewajibkan ganti password serta menaikkan session_version. Password validator minimum 12 karakter, maksimum 72 byte. | [admin.js](../server/routes/admin.js), auth.js, [password-policy.js](../server/services/password-policy.js) | Gunakan alur existing, lengkapi prosedur identifikasi pemohon/pemulihan admin. Belum ada alur reset mandiri via email. |
| Setup/runner seed mencakup akun demo; perubahan DEMO_PASSWORD_* tidak mereset akun existing. Owner hanya untuk maintenance. | SETUP-WINDOWS, [seed-pimpinan.js](../db/scripts/seed-pimpinan.js), [seed.js](../db/scripts/seed.js) | Jangan menjalankan resep seed demo sebagai provisioning produksi tanpa pemisahan yang ditinjau. |
| Auth/RBAC/query sesi, safeNext/path normalisasi, no-store, CSRF, four-eyes, revisi dan dashboard approved/current sudah ada. IKU memiliki pengecualian seed sempit pada guard bersama. | server/app.js, [security.js](../server/middleware/security.js), [data.js](../server/services/data.js), [029](../db/migrations/029_iku_pimpinan.sql), [030](../db/migrations/030_iku_quality_guard.sql) | Review seluruh jalur setelah perubahan; jangan menganggap jaringan/VPN menggantikan otorisasi aplikasi. |
| Sepuluh form memiliki jalur Excel (dua E1 + delapan E2, lulusan dua cakupan); 13 form kompleks ditunda. Unduhan watch-mode telah diperbaiki dan dibuktikan pada start/dev Edge/Brave. | E2-RENCANA, [excel-schema.js](../static-web/assets/js/excel-schema.js), [excel-entry-cases.js](../server/tests/excel-entry-cases.js) | Jangan membuka ulang diagnosis historis sebagai bug aktif. Pertahankan smoke klik sampai berkas disk, baca Excel dan apply DRAFT. |
| Parser kini menerima direktori ZIP kosong allowlist, deklarasi VML pasif dan baris kosong berformat secara terbatas. E1-06 adalah risiko kompromi kredensial app_user/SQL arbitrer, tanpa RLS. | E2-RENCANA, REVIEW-KEAMANAN-E1 | Review pengecualian parser dan batas kepercayaan DB secara eksplisit. |
| Inventaris ukuran disk: `apexcharts.js` 964.904 byte, `chart.umd.js` 205.889 byte, font WOFF terbesar 339.600 byte. Ini belum ukuran transfer atau bukti semuanya dimuat. | [assets](../static-web/assets/) | 6A memeriksa Network/Coverage per halaman; tidak menghapus vendor/font berdasarkan ukuran saja. |
| Belum ditemukan paket deployment, jadwal backup atau runbook restore dalam inventaris berkas relevan. Git tidak tersedia pada PATH sesi ini. | Inventaris repo; SETUP-WINDOWS berfokus setup lokal | 6C/6D/6G menghasilkan prosedur nyata; jangan mengklaim repo sudah memiliki commit/remote/cadangan teruji. |

Angka tes di STATUS adalah bukti historis per sesi, bukan hasil pengukuran 6A atau kelulusan produksi. Hasil UI kosmetik terakhir mencatat suite penuh tidak diulang setelah assertion Rasio diperbaiki; rilis perlu gerbang lengkap baru. Smoke login admin dev setelah recovery masih belum dibuktikan; konfigurasi development yang melewati ganti password tidak boleh menjadi acuan produksi.

## Urutan, estimasi dan pemilihan model

S = sekitar 1–2 hari kerja pengembang, M = 3–5 hari, L = 6–10 hari; ukuran relatif, bukan janji tanggal. Waktu tunggu IT/unit dihitung terpisah. Total kapasitas delapan minggu harus menyisakan minggu 8 untuk latihan, koreksi dokumen dan dukungan, bukan fitur baru.

Rekomendasi model adalah pembagian pekerjaan untuk sesi mendatang, bukan klaim model telah dijalankan. Astra Light untuk inventaris/dokumentasi sederhana, Astra Medium untuk pengukuran/implementasi terbatas, Astra High untuk transaksi, konfigurasi keamanan dan pemulihan. **Sol hanya read-only untuk review**; khusus 6E gunakan **Sol High**. Perbaikan dilakukan Astra, lalu ditinjau kembali oleh Sol.

| Sub-fase | Estimasi | Model/level yang disarankan | Urutan dan ketergantungan |
|---|---|---|---|
| 6A Pengukuran | M | Astra Medium; Sol Medium read-only menilai metode/bukti | Pertama, minggu 1–2; keputusan infrastruktur 6D dimulai bersama IT. |
| 6B Optimasi | M, dapat S bila tidak ada hambatan | Astra Medium; Astra High bila SQL/cache rumit; Sol High read-only | Setelah temuan 6A, minggu 3; ukur ulang pada lingkungan sama. |
| 6C Ketahanan | L | Astra High untuk restore/error/lifecycle; Sol High read-only | Mulai minggu 2 setelah lingkungan disepakati; wajib sebelum pilot. |
| 6D Operasional dan deploy | L | Astra High untuk proxy/akun/produksi; Astra Light untuk panduan; Sol High read-only | Desain minggu 1; penerapan staging minggu 2–4; produksi setelah 6E. |
| 6E Review keamanan akhir | M review + M cadangan perbaikan | **Sol High read-only**, Astra High memperbaiki, Sol High read-only memeriksa ulang | Cek awal sebelum pilot; review akhir setelah kandidat rilis dibekukan minggu 6–7. |
| 6F Penyempurnaan produk | M inti; L tambahan bersyarat | Astra Medium UX; Astra High domain Proyeksi/BKD bila disepakati; Sol Medium/High read-only | Audit minggu 1, koreksi inti minggu 4–6 dari pilot; fitur opsional tidak berada di jalur wajib. |
| 6G Serah terima | M | Astra Light dokumentasi, Astra Medium latihan; Sol High read-only memeriksa kelengkapan | Mulai catatan minggu 1; paket dan latihan minggu 7–8. |

6C/6D berjalan bertahap bersama pengukuran; 6B tidak mendahului 6A. Pilot memerlukan akun/jaringan/backup siap dan cek keamanan awal. Perubahan setelah review akhir harus diuji dan ditinjau lagi sesuai dampaknya. Keputusan siap produksi dilakukan atasan dan IT berdasarkan bukti, bukan tanggal kalender semata.

## 6A — Pengukuran

**Tujuan:** memperoleh baseline yang dapat diulang pada perangkat/jaringan sasaran sebelum memilih optimasi. **Estimasi/model:** M, Astra Medium; Sol Medium read-only. **Urutan:** minggu 1–2.

Tugas konkret:

1. Catat CPU/RAM/disk, OS, versi Node/PostgreSQL/browser, volume data, topologi proxy, bandwidth/latensi, perintah startup dan jumlah proses. Pakai staging/test terpisah dengan data representatif yang disanitasi; jangan menganggap 19 prodi seed mewakili pertumbuhan beberapa periode.
2. Ukur halaman beranda, statistik mahasiswa/dosen, lulusan, akreditasi, KPI/IKU login, input BAA/BSDM dan verifikasi: muatan dingin/hangat, 1440px/360px, waktu konten/data tampil, LCP/INP/CLS, jumlah request, byte disk vs byte transfer dan main-thread/heap browser. Minimal lima pengulangan per profil; laporkan median dan variasi.
3. Ukur API `/api/dashboard/summary`, `/mahasiswa`, `/dosen`, `/prodi`, `/akreditasi`, `/kpi`, `/iku`, forms BAA/BSDM serta template/upload/apply: p50/p95/maksimum, status, timeout, CPU/RSS/event-loop, pool menunggu/koneksi dan durasi SQL. Redaksi cookie/token/isi data pada HAR/log. Bedakan 429/503 yang memang akibat gate dari error tak terduga.
4. Petakan query berbiaya tinggi ke route/view/tabel/index existing, termasuk subquery per prodi dalam dashboard dan filter approved/current/periode. `EXPLAIN (ANALYZE, BUFFERS)` hanya SELECT pada staging; kueri mutasi tidak dianalisis dengan eksekusi terhadap dev/produksi. Catat plan, actual rows, buffer dan ukuran tabel/index sebelum menyarankan indeks.
5. Jalankan beban ringan bertahap 1 → 5 → 10 pengguna bersamaan, masing-masing 5 menit setelah pemanasan, dengan jeda manusia 2–5 detik; lalu uji alur campuran pilot sesuai jumlah operator yang dikonfirmasi. Tulis/Excel hanya `_test` dengan fixture unik dan approved acuan tetap. Probe kelebihan kuota dilakukan terpisah dan terukur tanpa menaikkan limiter produksi.
6. Hentikan beban bila muncul timeout berulang, antrean tak pulih, RSS terus naik atau error tak terduga >1% selama satu menit. Catat kondisi penghentian dan pemulihan; tidak menguji banjir/serangan di internet kampus.

**Kriteria selesai:** laporan baseline berisi profil mesin/jaringan/data, cara reproduksi, hasil halaman/API/SQL/aset dan daftar temuan berprioritas beserta dampaknya. Usulan anggaran awal untuk disepakati IT: API baca p95 ≤1 detik di LAN staging pada 10 pengguna; halaman utama LCP ≤2,5 detik, INP ≤200 ms, CLS ≤0,1 pada profil browser yang ditetapkan; nol error tak terduga pada beban normal. Angka tersebut target rencana, belum hasil atau jaminan. SLA Excel ditetapkan dari pengukuran dan deadline existing, tidak memperpanjang timeout agar lulus. Tiap penyimpangan memiliki keputusan perbaiki/terima beserta PIC.

**Risiko:** ukuran data kecil menyamarkan query lambat; hasil laptop berbeda dari server; sesi/login/audit menambah biaya; beban Excel salah ditafsirkan sebagai kebutuhan melonggarkan limiter. Mitigasi: profil transparan, data beberapa periode, normal vs overload terpisah dan ukur host sasaran.

## 6B — Optimasi berdasarkan 6A saja

**Tujuan:** mengatasi hambatan terbukti tanpa mengubah hasil bisnis dan batas akses. **Estimasi/model:** M (S bila temuan sedikit), Astra Medium/High untuk SQL atau cache; Sol High read-only. **Urutan:** minggu 3, sesudah baseline 6A diterima.

Tugas konkret:

1. Buat daftar temuan 6A → hipotesis → perubahan minimum → cara rollback → metrik sebelum/sesudah. Jika anggaran sudah terpenuhi dan tidak ada hambatan berarti, catat keputusan tanpa optimasi tambahan.
2. Periksa indeks filter/periode/grain/current yang sudah ada sebelum menambah indeks. Tinjau plan query dashboard/akreditasi/IKU dan bentuk query opsional; perbaiki hanya query yang terbukti mahal. SQL melalui migration baru, dengan pertimbangan biaya tulis/ruang/waktu lock dan jendela penerapan oleh IT. Jangan mengubah view approved/current atau aritmetika sumber demi kecepatan.
3. Audit cache secara terpisah: middleware existing memasang no-store secara luas, ETag dinonaktifkan. Dahulukan evaluasi cache/compression aset statis publik dan versi aset untuk invalidasi; jangan memberi cache panjang pada URL tanpa strategi pembaruan. Cache API publik hanya bila temuan menuntut, dengan kunci periode/filter dan invalidasi setelah publikasi/revisi/perubahan visibility. Login/CSRF/session, respons privat dan error akses tetap no-store; proxy tidak menyimpan data privat atau respons bersesi.
4. Dari Network/Coverage, tentukan apakah ApexCharts/font/skrip lama benar dipakai, dimuat ganda atau menghambat render. Optimasi pemuatan per halaman, format aset atau compression di proxy hanya dengan bukti. Pertahankan lisensi/vendor dan file lama; penghapusan membutuhkan laporan. Tanpa CDN/framework/build frontend baru; grafik existing dan ukuran kanvas dipertahankan.

**Kriteria selesai:** tiap perubahan terkait ID temuan 6A dan memiliki perbandingan pada profil sama; target disepakati tercapai atau pengecualian tercatat. Hasil API/NULL/angka/dashboard approved tetap, revisi approved tampil setelah publikasi tanpa cache usang, perubahan visibility segera menutup akses, respons privat no-store. Regresi relevan serta tampilan 360px/kanvas lulus. Tidak cukup hanya menyatakan query lebih cepat dari pembacaan kode.

**Risiko:** indeks menambah lock/biaya tulis, cache membocorkan data atau menunda revisi, compression/pemuatan mengubah transfer Excel. Mitigasi: staging, rollout kecil, pengecualian XLSX sesuai pengujian Content-Length/checksum, rollback teruji dan review Sol.

## 6C — Ketahanan

**Tujuan:** kegagalan host/DB tidak menyebabkan kehilangan tak terlacak atau pemulihan yang hanya dipahami pengembang. **Estimasi/model:** L, Astra High; Sol High read-only. **Urutan:** minggu 2–4; latihan diulang saat 6G.

Tugas konkret:

1. Sepakati RPO/RTO dan retensi dengan IT. Usulan awal pilot: RPO ≤24 jam, RTO ≤4 jam, dump harian di luar jam kerja, 14 harian + 8 mingguan; revisi sesuai kapasitas/kebijakan. Jika kehilangan satu hari tidak dapat diterima, putuskan frekuensi lebih tinggi/PITR sebagai pekerjaan tersendiri, bukan klaim dump harian mencukupi.
2. Siapkan `pg_dump` PostgreSQL 16 format custom terjadwal melalui Windows Task Scheduler atau scheduler OS sasaran: akun backup minimum yang terbukti mencakup seluruh data/schema/audit/ledger/sequence, kredensial melalui penyimpanan ber-ACL, exit code/log aman, checksum/ukuran, alarm kegagalan/backup basi. Salin terenkripsi ke penyimpanan terpisah dari host; retensi tidak berlaku pada audit aplikasi. Dump memuat data sensitif, bukan lampiran repo/chat.
3. Paket pemulihan juga memuat versi source/lockfile, manifest checksum, konfigurasi nonrahasia, prosedur provisioning role/grant serta lokasi secret terpisah. `pg_dump` tidak menggantikan backup role cluster/sertifikat/konfigurasi. Role produksi dan haknya dipulihkan melalui prosedur maintenance, bukan memberikan superuser ke runtime.
4. Uji `pg_restore` ke DB baru pada host/cluster terisolasi, bukan menimpa dev/prod atau menjalankan reset. Gunakan dump nyata yang disetujui IT, tanpa seed ulang yang mencampur data. Bandingkan approved/current, jumlah versi, audit append-only, master, sequence, ledger/checksum dan grants; uji login dengan akun latihan yang dikelola serta baca dashboard. Sesi hasil restore dibatalkan melalui prosedur terbatas agar sesi lama tidak hidup kembali; audit dipertahankan. Catat durasi total sampai layanan dapat digunakan dan titik data terakhir.
5. Uji DB mati sebelum startup, DB putus saat baca/login, saat upload/apply/transaksi serta kembali hidup di lingkungan terisolasi. Pastikan error UI jelas dengan retry terkendali, status 5xx terkontrol, tanpa 200 kosong/berkas kosong/stack/driver detail, tanpa draft/audit parsial, dan retry tidak menggandakan apply. Query in-flight boleh menunggu timeout existing; jangan menjanjikan cancel SQL seketika.
6. Pisahkan pemeriksaan proses hidup dari kesiapan DB melalui probe internal terjadwal/endpoint terbatas bila perlu. Jangan menaruh credential/detail DB pada health publik. Lengkapi log request_id/status/durasi/kejadian aman, startup/shutdown, kegagalan worker dan maintenance preview. Rotasi/retensi log, pantau ruang disk, umur backup, service/DB, error 5xx, koneksi/pool dan RSS. Tetapkan PIC serta jalur eskalasi/alarm; lindungi log dari pengguna publik.
7. Konfigurasi restart otomatis dengan jeda/backoff dan batas percobaan bersama 6D; lakukan kill proses dan reboot staging. Hindari restart tanpa henti saat DB mati dan jangan membuat liveness mematikan proses hanya karena gangguan DB singkat. Tetapkan halaman/pesan gangguan yang tidak menampilkan angka fallback.

**Kriteria selesai:** minimal satu backup terjadwal berhasil dan satu latihan kegagalan backup memicu alarm; satu restore penuh terukur memenuhi RPO/RTO disepakati, IT dapat mengulanginya. Matriks DB mati/pulih, kill/reboot dan transaksi terputus memiliki bukti hasil, proses/pool/slot pulih, tanpa perubahan approved acuan. Alarm uji sampai ke PIC, retensi/ACL/log aman diperiksa. File dump yang ada saja belum membuktikan backup siap.

**Risiko:** dump rusak/tidak lengkap, backup satu disk, kredensial bocor, restore melampaui RTO, log memenuhi disk, maintenance gagal diam-diam. Mitigasi: salinan terpisah, checksum dan restore berkala, hak minimum, rotasi serta PIC cadangan.

## 6D — Operasional dan deploy

**Tujuan:** lingkungan produksi dapat dikelola IT dengan akun asli dan batas internet/kampus yang terbukti. **Estimasi/model:** L, Astra High konfigurasi/akun, Astra Light panduan; Sol High read-only. **Urutan:** keputusan minggu 1, staging minggu 2–4, rilis minggu 7 sesudah gerbang akhir.

Tugas konkret:

1. Tetapkan host/OS, domain publik dan internal (bila terpisah), subnet/VPN, terminasi TLS, PIC DNS/sertifikat/renewal, firewall, penyimpanan backup, jam layanan dan jendela pemeliharaan. Gunakan staging menyerupai produksi. Backend dan PostgreSQL tidak terbuka langsung ke internet; proxy melayani origin yang dirancang dan Express tetap hanya `static-web`.
2. Bentuk matriks route HTML/API/metode: dashboard/aset publik yang disetujui; login dan layanan internal; input/forms/data/imports/verifikasi/admin/master tulis/quality flags serta dashboard privat. Gunakan allowlist publik di pintu internet dan jalur internal kampus/VPN; jangan hanya menyembunyikan menu atau memblokir `/admin/`. Jika master GET diperlukan dashboard publik, buka hanya endpoint baca minimum setelah review field. Alih URL lama, encoded path, trailing slash dan metode HEAD ikut diuji; path tak dikenal tidak otomatis diizinkan publik.
3. Untuk pilot, usulkan seluruh login dan dashboard privat berada di kampus/VPN; atasan menetapkan bila ada pembaca privat jarak jauh melalui VPN. Permintaan eksternal ke jalur internal ditolak proxy, termasuk membawa cookie login sah atau header IP palsu. Di dalam jaringan, API privat anonim tetap 401, HTML privat redirect login dengan safeNext, akun salah unit 403. HTTPS/VPN tidak menggantikan RBAC/CSRF/query unit.
4. Set produksi nantinya: `NODE_ENV=production`, `HOST` terbatas, port internal, `APP_DB_USER=app_user`, credential runtime berbeda dari owner, `SESSION_SECRET` kuat/stabil, DB produksi terpisah dari dev/test, `PUBLIC_DASHBOARD=true` dengan allowlist visibilitas yang disahkan. `DEV_SKIP_PASSWORD_CHANGE` tidak dipakai; kode existing mengabaikannya saat production. Runtime tidak membawa password owner maupun DEMO_PASSWORD_*; maintenance memakai konteks terpisah. Tidak menyalin `.env` dev sebagai konfigurasi produksi.
5. HTTPS di reverse proxy, HTTP dialihkan HTTPS, batas body/timeout sesuai kontrak Excel existing. Proxy menimpa header Forwarded/X-Forwarded-* dari klien; IP kampus diambil dari koneksi/chain terpercaya, bukan header bebas. Existing `TRUST_PROXY=loopback` cocok hanya jika proxy benar lokal dan backend dibatasi. Jika proxy remote, putuskan topologi lokal atau dukungan CIDR proxy spesifik lewat perubahan terpisah yang diuji; jangan set trust proxy global. Buktikan cookie Secure/httpOnly/sameSite, login/CSRF/logout dan IP limiter di belakang proxy, tanpa bypass melalui port backend.
6. Gunakan satu proses aplikasi saat awal karena limiter/semaphore per proses. IT memilih pengelola proses/service OS (Windows Service atau padanannya bila host berbeda), akun service terbatas, autostart/restart/backoff, working directory dan pemuatan secret ber-ACL. Jalankan entry `npm.cmd start`/Node start setara, bukan watcher; catat versi runtime dan log rotasi. Multi-worker/multi-instance menunggu solusi kuota bersama, kapasitas DB dan review.
7. Provisioning akun personal BAA/BSDM, PRP/verifikator, admin IT dan admin cadangan; unit/role dari master dan matriks kewenangan. Password awal unik acak kuat (usulan ≥16 karakter, tetap dalam batas bcrypt 72 byte), saluran penyerahan privat, wajib ganti pertama, penonaktifan saat mutasi pegawai. Uji akun baru memang must_change_password; pembuat akun tidak menjadi approver sendiri. Gunakan reset admin existing dengan identifikasi pemohon, audit, password sementara, invalidasi sesi dan ganti wajib; pemulihan admin terkunci melalui maintenance terotorisasi yang beralasan/audit tanpa mencetak password/hash.
8. Produksi ditargetkan diprovision tanpa akun uji/demo; uji penerimaan memakai akun personal yang sah dan data latihan di staging. Tinjau runner seed existing dan siapkan bootstrap produksi terpisah bila diperlukan, tanpa mengedit seed lama. Jangan menjalankan seed demo penuh secara otomatis pada deploy. Inventaris akun aktif harus nol demo/test, nol akun sistem yang bisa login. Bila opsi pemindahan DB membawa akun demo sebagai aktor audit historis, jangan DELETE referensinya: putuskan metode pemindahan bersama IT/atasan; aktor arsip non-login harus tercatat sebagai pengecualian retensi, bukan akun operasional. Keputusan ini wajib selesai sebelum rilis.
9. Tulis panduan singkat BAA, BSDM, PRP dan admin: login/ganti/reset, periode, NULL vs nol, simpan draft, submit/reject/approve/revisi, Excel/preview/apply DRAFT, buang hanya draft milik sendiri, konflik versi, error/request_id dan kontak bantuan. BAA menekankan lulusan institusi terpisah; BSDM menekankan cakupan tendik/jafung.

**Daftar periksa IT (bukti wajib, bukan tanda centang asumsi):**

- [ ] PIC utama/pengganti, host/domain, subnet/VPN dan matriks route/metode disahkan.
- [ ] TLS dan pembaruan sertifikat diuji; backend/5432 tertutup dari internet; header proxy palsu tidak diterima.
- [ ] Uji dari internet, LAN kampus dan VPN mencakup akun anonim, sah, salah role/unit serta path terenkode; akses internal eksternal selalu tertutup.
- [ ] Runtime production/app_user dan secret terpisah; Secure cookie, ganti wajib, CSRF, logout/session invalidation dan limiter berfungsi lewat proxy.
- [ ] Nol akun demo/test aktif; akun personal, admin cadangan, reset dan matriks kewenangan diterima.
- [ ] Service autostart/restart/backoff, log rotasi, alarm, backup terjadwal dan restore 6C terbukti.
- [ ] Versi source/lockfile/checksum, prosedur penerapan migration baru dan rollback teruji di staging; ada backup sebelum perubahan. Rollback aplikasi hanya pada skema kompatibel, bukan reset/restore menimpa transaksi baru tanpa keputusan insiden.
- [ ] Owner memutuskan sumber data produksi: tidak mempublikasikan seed sebagai data terbaru tanpa validasi; approved/provenance/audit dan ledger pemindahan terdokumentasi.

**Kriteria selesai:** checklist ditandatangani IT dengan bukti uji tiga jaringan, operator unit menyelesaikan panduan tanpa bantuan langsung pengembang, pemulihan password/admin berhasil di staging, daftar akun/kewenangan sesuai persetujuan. Deployment produksi hanya setelah 6E final dan keputusan atasan/IT.

**Risiko:** salah whitelist route/header/proxy membuka internal, cookie hilang di TLS termination, seed membuat demo baru, akun bersama menghilangkan akuntabilitas, IT belum menyediakan server. Mitigasi: pengujian eksternal dengan sesi sah, bootstrap terpisah, akun personal dan staging sejak awal.

## 6E — Review keamanan akhir dan perbaikan

**Tujuan:** menilai seluruh jalur pada kandidat rilis akhir dan membuktikan perbaikannya. **Estimasi/model:** M review + M cadangan perbaikan; **Sol High read-only** untuk review awal/akhir, Astra High untuk perbaikan, Sol High read-only untuk pemeriksaan ulang. **Urutan:** cek awal minggu 4 sebelum pilot; review menyeluruh minggu 6–7 sesudah perubahan inti.

Tugas konkret:

1. Bekukan snapshot kandidat, inventaris route/registry, role/grant, migration/seed checksum, topologi/proxy dan konfigurasi nonrahasia. Review Sol benar-benar read-only: tidak migration/seed/reset, tidak `npm test`, `db:verify` atau `test:ui` yang membuat fixture; hanya pembacaan, SELECT terotorisasi dan tes fungsi murni yang telah diperiksa. Pengujian mutasi pendukung dilakukan pada sesi terpisah oleh pelaksana di `_test`.
2. Audit auth/session/bcrypt/ganti/reset/invalidation/CSRF, rate limit/IP proxy, Zod/parameter query/identifier allowlist, XSS/ekspor, path traversal/static scope, safeNext, canonical/encoded path, no-store/BFCache/Back serta logout lintas tab. UI menyembunyikan data bukan bukti server menutup akses. Uji seluruh login-only HTML/API termasuk KPI/IKU, keuangan, AMI, tendik/formasi/pegawai dan quality flags, dengan PUBLIC_DASHBOARD true/false dan visibility berubah.
3. Audit workflow draft/rejected/submitted/approved/discarded, revision/current/grain/row_version, kepemilikan sesi, four-eyes/override beralasan, transaksi audit/flag atomik dan grants. Khusus pengecualian seed IKU pada guard bersama: owner selain app_user, aktor seed sistem nonaktif, aksi seed_approved, submitted → approved v1, sumber/metadata tepat; INSERT approved langsung IKU dan usaha HTTP/app_user untuk memakai pengecualian harus ditolak. Periksa trigger kualitas 030 berjalan sebelum guard tanpa membuka perubahan payload submitted.
4. Audit template/upload/preview/apply/cancel/expiry/prune/discard, kuota pemilik, race, abort/disconnect, slot sampai finally/rollback, worker typed `excel:result`, deadline/heap vs RSS, gate sebelum body dan timeout DB. Unduhan gagal harus error tanpa file, bukan 200 kosong. Pengecualian parser terbaru wajib positif/negatif: hanya direktori ZIP kosong allowlist, VML deklarasi pasif tanpa part/relationship aktif, baris kosong berformat dengan batas fisik 502; traversal, direktori berisi, VML aktif, ZIP64, makro, external link, XML/entity/namespace invalid dan ukuran/rasio tetap ditolak.
5. Evaluasi pembatas per proses terhadap rencana deploy satu proses; bila ada cluster/multi-instance, tahan rilis konfigurasi itu sampai pembatas agregat terbukti. Catat kembali E1-06: app_user/SQL arbitrer dapat memanipulasi GUC dan preview lintas pemilik tanpa RLS. IT/atasan menerima ulang risiko sesuai threat model; proteksi credential/jaringan/maintenance penting. Jangan mengklaim SQL audit mengautentikasi pengguna akhir atau menambahkan RLS besar tanpa kebutuhan terpisah.
6. Jalankan bukti pendukung Node 22 LTS pada OS sasaran, termasuk start/dev nyata, worker/regresi watch, seluruh form Excel + dua cakupan lulusan sampai disk → Excel desktop buka/simpan → unggah/apply DRAFT. Edge/Brave memiliki bukti historis; tambah Chrome dan Firefox versi unit, serta Safari/mobile bila memang digunakan. Harness existing berorientasi Chromium/Edge, sehingga manual/alat tambahan untuk Firefox harus direncanakan dan hasilnya dicatat, bukan dianggap didukung otomatis. Openpyxl skip dan ExcelJS scratch tidak boleh disamakan dengan verifikasi yang berjalan; dokumentasikan cara menyiapkan pembaca independen terkelola tanpa dependency runtime baru.
7. Buat daftar temuan severity, `file:baris`, skenario, bukti, dampak, status **Tertutup / Tertutup sebagian / Belum**, PIC dan retest. Astra memperbaiki secara minimum di lingkup disepakati; Sol meninjau snapshot baru. Audit dependency saat rilis dengan hasil registry nyata; endpoint gagal berarti jumlah belum terverifikasi, bukan memakai angka nol historis.

**Kriteria selesai:** nol temuan Kritis/Tinggi yang terbuka; risiko Sedang memiliki perbaikan atau penerimaan tertulis IT/atasan dengan PIC/batas waktu. Tidak ada kebocoran lintas unit/jaringan, bypass workflow/seed atau file unduhan kosong pada matriks uji. Paket bukti Node 22, browser sasaran, parser/worker, proxy dan DB tersedia. Gerbang rilis dijalankan berurutan di `_test`: `npm.cmd test` → `npm.cmd run test:ui` → `npm.cmd run db:verify`, lalu `db:check` pada lingkungan yang disetujui dan `npm.cmd audit`; simpan hasil nyata dan alasan skip. Baseline angka kontrol ada di STATUS/SETUP; approved terbaru boleh berbeda secara sah, jangan mengubah dev agar kontrol hijau. Semua perubahan setelah gerbang memerlukan verifikasi sesuai dampaknya.

**Risiko:** review dianggap sudah lulus karena audit lama, tes mutasi dijalankan dalam sesi read-only, pengujian hanya harness melewatkan runtime asli, risiko jaringan/per-proses diabaikan. Mitigasi: batas metode eksplisit, bukti baru pada kandidat akhir dan pemeriksaan ulang perbaikan.

## 6F — Penyempurnaan produk dan keputusan data

**Tujuan:** unit dapat memakai alur existing dengan jelas, dan kekosongan data memiliki pemilik/keputusan. **Estimasi/model:** M inti; L tambahan bersyarat, Astra Medium UX, Astra High domain baru, Sol Medium/High read-only. **Urutan:** daftar kebutuhan minggu 1, perbaikan inti minggu 4–6; tambahan hanya sesudah gerbang wajib aman.

Tugas konkret:

1. Tinjau seluruh halaman/navigasi dan formulir terhadap MATRIKS-INPUT: link hidup, label unit BKK dengan kode teknis BKM tetap, filter/periode, loading/kosong/error/retry, status simpan/submit, konflik versi, batas hak dan bantuan. Empty state menunjukkan belum tersedia beserta konteks/pemilik, tanpa data dummy/angka nol pengganti NULL. Periksa halaman Beban Mengajar, Rekognisi Dosen, Kinerja PT gabungan dan panel tren/fakultas yang memang belum bersumber.
2. Skenario penerimaan BAA/BSDM pada desktop/360px: keyboard/fokus/error terkait field, pembaca layar dasar, kontras, scroll tabel lokal, reduced motion, zoom 200%, angka id-ID/tanggal Asia/Jakarta; logout/expired/network/DB error tidak menghilangkan pekerjaan tanpa pesan jelas. Perubahan global wajib cadangan/uji dampak; jangan mengubah ukuran kanvas grafik untuk kosmetik.
3. Pilot BAA mencakup mahasiswa aktif dan lulusan institusi/prodi; BSDM mencakup formasi, tendik/ringkasan/pergerakan/produktivitas serta input dosen manual. Tiap unit melakukan template → buka/simpan Excel → preview → DRAFT → submit → review oleh pihak lain → reject/perbaiki/revisi → approved/current dan buang draft percobaan di staging. Uji policy review FALSE tetap hanya auto-approved saat Submit, bukan Apply. Data live pertama hanya data unit tervalidasi, periode sah dan alur persetujuan normal.
4. Kelola daftar data berikut sebagai keputusan; bila sumber belum datang sampai akhir minggu 3, bekukan sebagai backlog/empty state untuk rilis pilot. Kolom/skema baru hanya sesudah kontrak sumber dan lingkup disepakati; koreksi approved melalui revisi dengan flag/provenance.

| Data/fitur tertunda | Pemilik/keputusan yang dibutuhkan | Perlakuan sampai konfirmasi |
|---|---|---|
| Pemetaan prodi → fakultas, pengelola nomenklatur/kode Dikti | BAA/pengelola master, PJM, atasan: daftar resmi, tanggal berlaku, PIC | Fakultas NULL; jangan membentuk fakultas atau menganggap kode 01–19 sebagai kode Dikti. |
| Akreditasi institusi/internasional, nilai/skala, tanggal mulai dan URL sertifikat | PJM: SK/sumber resmi dan izin publikasi; nilai/URL belum ada kolom form/DB | Institusi kosong, nilai/sertifikat `-`; skema tambahan menunggu kontrak sumber. |
| S1 Geografi/Kewirausahaan dan nomor SK sama | PJM/pengelola master: identitas terhadap Geospasial 14/Bisnis Energi 17, bukti SK | Tetap dua sumber belum terpetakan dan dua master kosong; 17 berdata dari 19 master tidak dikoreksi otomatis. |
| BKD | BSDM: BKD penuh atau mengajar saja, prodi-semester, denominator/ketentuan, pemilik dan izin akses | Usulan minimal sesi 2 belum implementasi; 12,83 SKS institusi bukan persentase memenuhi BKD dan tidak dibagi ke prodi. |
| Tendik 30 vs institusi 109, PKWT 68, formasi/jafung | BSDM: cakupan/snapshot/rincian; jafung resmi 59,60%, input 118/198 dan pembanding 58,08% | Tampilkan cakupan terpisah; jangan menghitung selisih 79 sebagai kelompok baru atau menjumlahkan cakupan. |
| Lulusan per prodi/wisuda dan tracer | BAA/BPKA: rincian, denominator periode, responden/kelengkapan wirausaha | Institusi 1.100 tetap prodi_id NULL; wirausaha 2 tidak diganti total laporan 8 yang belum lengkap. |
| Tahun/cakupan penelitian-PkM, AMI, KPI/keuangan | LPPM/PJM/PRP/BKU: sumber, periode, satuan nominal dan pengesahan | NULL/flag dan data sumber dipertahankan; tidak membuat angka pembanding atau denominasi rekaan. |
| Kode Bagian Pengembangan Kemitraan; rincian rekognisi/beban mengajar/PKWT; Kinerja PT gabungan/tren | Unit pemilik dan atasan menetapkan kode, data, metrik/pemilik serta periode | Kode kemitraan NULL; empty state terjelaskan, tanpa domain/dummy spekulatif. |
| Catatan IKU 1 S1, IKU 3, Sub IKU 9.1/9.2; arti D3*/S2** | PRP: definisi angka/rasio/catatan kaki dari sumber | Empat catatan verifikasi tetap; KPI terpisah dari IKU, rata-rata IKU bukan skor resmi berbobot. |

5. **Proyeksi Kinerja:** buat keputusan produk minimum bersama atasan/PRP sebelum implementasi: tujuan keputusan, indikator KPI atau IKU yang dipakai, horizon, periode historis minimum, metode/skenario, asumsi dan pemilik, satuan, pembulatan, hak akses serta cara menilai hasil. Usulan bila disetujui: simulasi sederhana berbasis approved/current dan asumsi eksplisit, login-only; hasil diberi label proyeksi, dipisah dari realisasi/target resmi dan tidak menulis ulang approved. Tanpa model prediktif/AI atau tren rekaan ketika seri historis belum ada. Uji deterministik input sama → hasil sama, NULL/denominator nol, perubahan skenario tidak memutasi sumber, asal data/asumsi terlihat. Jika definisi/data tidak siap minggu 3, hasil wajib berupa spesifikasi dan keputusan penundaan yang diserahterimakan, bukan halaman angka semu.
6. **E2 sesi 2 opsional:** 13 form kompleks tetap backlog sesuai E2-RENCANA. Hanya pilih satu batch kecil setelah pilot/backup/keamanan/serah terima terjamin, kapasitas nyata ada dan pengguna menetapkan lingkup. Audit kontrak kompleks/rekonsiliasi dulu; gunakan jalur registry/validator/worker existing. Tidak otomatis mengerjakan seluruh 13 form. Bila ada perubahan Excel, ulang smoke start/dev, disk/Excel dan draft-only serta review 6E; pilihan aman jadwal adalah menunda ke penerus.

**Kriteria selesai:** BAA dan BSDM menyelesaikan skenario pilot dengan verifikator berbeda dan menandatangani daftar penerimaan/masalah; nol masalah yang menghalangi alur inti. Seluruh halaman memiliki keadaan kosong/error yang jujur dan tautan valid. Daftar data berstatus terkonfirmasi/menunggu/ditunda dengan PIC; Proyeksi memiliki kontrak yang diterima dan hasil uji bila dibuat, atau keputusan penundaan. Fitur opsional tidak menjadi syarat tersembunyi untuk pilot.

**Risiko:** persetujuan sumber terlambat, istilah BKD/proyeksi salah dimengerti, scope melebar, kosmetik merusak grafik. Mitigasi: batas minggu 3, keputusan tertulis, backlog penerus dan uji dampak terarah.

## 6G — Serah terima

**Tujuan:** operasional dan pengembangan lanjutan tetap berjalan setelah kontrak berakhir. **Estimasi/model:** M, Astra Light/Medium; Sol High read-only memeriksa paket. **Urutan:** pencatatan sejak minggu 1, latihan minggu 7–8.

Tugas konkret dan paket yang harus diterima:

1. Dokumentasi arsitektur: diagram browser → proxy publik/kampus → Express → PostgreSQL, batas jaringan/role, peta route/registry/form/view, workflow/versi/audit/flag, worker/preview/maintenance/limiter per proses, serta perbedaan KPI/IKU dan pengecualian seed IKU. Nyatakan batas E1-06 dan kapasitas yang benar-benar diuji.
2. Runbook operasi/pemulihan: install dari source/lockfile pada Node 22, konfigurasi nonrahasia, provisioning produksi tanpa demo, start/stop/restart/reboot, update/migration baru/checksum, backup/restore/validasi/sesi, rollback kompatibel, DB mati, sertifikat, disk penuh, log/alert dan pemulihan admin. Sertakan jadwal dan PIC/pengganti, RPO/RTO/retensi yang disepakati serta hasil latihan.
3. Panduan pengguna per unit dan verifikator/admin (BAA/BSDM didemokan dahulu, unit lain mendapat pemetaan form/kontak); kamus periode/cakupan/NULL/sumber. Daftar akun berupa nama/email institusi/unit/role/status dan pemberi persetujuan, **tanpa password/hash/token**; hak pembuatan/reset/approve/override dan offboarding jelas.
4. Source dengan versi rilis/checksum, manifest/lockfile, migration/seed immutable beserta ledger, lisensi vendor, instruksi tes termasuk pembaca Excel independen/scratch yang perlu disiapkan, hasil gerbang terakhir dan backlog berprioritas/PIC. Git privat milik kampus disarankan: pastikan Git tersedia, inventaris status repository, tinjau secret sebelum commit/push dan atur minimal dua pengelola. Alternatif jika Git belum siap: arsip source berversi, checksum dan salinan terkelola di penyimpanan kampus dengan kontrol akses/pemulihan. Jangan mengklaim arsip lokal sebagai remote backup.
5. Rahasia diserahkan terpisah melalui vault/penyimpanan IT ber-ACL: inventaris **nama variabel, tujuan, pemilik, lokasi dan prosedur rotasi**, bukan nilainya di dokumen. Pisahkan runtime app_user/SESSION_SECRET, maintenance owner, backup dan sertifikat. `.env`, laporan mentah, dump, node_modules, `.runtime` dan `docs/cadangan-tata-letak.patch` tidak masuk repo/paket source. Rotasi secret/akun pengembang saat pengalihan; perkirakan dampak rotasi SESSION_SECRET pada sesi dan lakukan pada jendela yang disetujui.
6. Latihan tanpa pengembang mengoperasikan keyboard: IT memasang/jalankan rilis, menemukan request_id error, memeriksa alarm, melakukan backup dan restore terisolasi; admin memulihkan akun; BAA/BSDM menjalankan satu siklus dengan reviewer. Pengembang hanya mengamati/mencatat hambatan lalu memperbaiki runbook. Berita acara memuat versi, tanggal, PIC/pengganti, bukti, pengecualian, masa dukungan dan pemilik backlog setelah kontrak.

**Kriteria selesai:** minimal dua petugas IT memiliki akses yang sesuai dan satu berhasil melakukan latihan mandiri; BAA/BSDM/verifikator menerima panduan; source/cadangan dapat diambil dan checksum cocok; secret dapat diakses PIC melalui saluran aman; backup/restore, akun dan kontak eskalasi terbukti. Atasan/IT menerima berita acara serta backlog, tidak menyisakan akses pengembang sebagai satu-satunya jalur pemulihan.

**Risiko:** dokumentasi tertinggal versi, rahasia tercampur source, Git belum tersedia, hanya satu orang memahami operasi. Mitigasi: dokumen mengikuti setiap perubahan, review paket akhir, dua pengelola dan latihan mandiri.

## Jadwal delapan minggu dan titik keputusan

Minggu dihitung dari kickoff bersama IT/unit, **bukan tanggal otomatis**; tanggal aktual diisi setelah PIC dan akses staging tersedia. Rencana mengasumsikan satu pengembang dengan dukungan IT dan slot uji unit terjadwal. Jika kapasitas kurang, kurangi 6B yang tidak penting dan fitur tambahan 6F/E2, pertahankan pemulihan/keamanan/serah terima.

Anggaran kapasitas awal: sekitar 30 hari pengembang untuk inti minggu 1–6, 5 hari untuk review/perbaikan dan keputusan rilis minggu 7, serta 5 hari khusus stabilisasi/latihan/serah terima minggu 8. Estimasi per sub-fase memiliki rentang yang dapat melampaui 40 hari bila semuanya mencapai batas atas; pengaturan host/proxy/scheduler/storage pada 6C/6D harus dibagi dengan IT. Jika IT tidak dapat mengambil bagiannya atau temuan keamanan menghabiskan cadangan, potong tambahan produk/E2 dan sesuaikan cakupan rilis, bukan memadatkan latihan pemulihan ke hari terakhir.

| Minggu | Fokus dan keluaran | Titik uji coba/presentasi dan keputusan |
|---|---|---|
| 1 | Kickoff IT/BAA/BSDM/PRP; matriks akses/publikasi, host/PIC, rancangan 6D, inventaris 6A, daftar data 6F, kerangka 6G | **Presentasi 1:** sasaran pilot, batas lingkup, jadwal dan pertanyaan sumber; atasan menyetujui prioritas, IT memberi tanggal staging. |
| 2 | Baseline 6A halaman/API/SQL/aset dan beban ringan; staging produksi; backup terjadwal awal, rancangan restore/akun | Demo alur ke wakil BAA/BSDM di staging; IT menyepakati anggaran performa dan RPO/RTO. Belum memakai data latihan pada produksi. |
| 3 | 6B hanya temuan penting; 6C restore pertama/DB mati; 6D proxy/VPN/akun asli siap diuji; draf panduan | Batas keputusan data, BKD/Proyeksi dan sumber akun/data produksi. Tanpa jawaban, tambahan dibekukan sebagai backlog; cek kesiapan pilot. |
| 4 | Cek keamanan awal 6E dan perbaikan penghalang; uji tiga jaringan/HTTPS/backup; 6F UX inti | **Uji coba unit 1:** BAA dan BSDM di staging, seluruh siklus dengan PRP. **Presentasi 2:** hasil baseline, restore dan pilot; daftar masalah/PIC. |
| 5 | Perbaiki temuan pilot; uji ulang terbatas dan reukur; finalisasi SOP reset/operasi; pendampingan terbatas | **Uji coba unit 2:** pengguna unit menjalankan tanpa panduan lisan. Data live pertama hanya bila seluruh gerbang pilot dan izin IT/atasan terpenuhi; selain itu staging. |
| 6 | Bekukan fitur inti; review akhir Sol High read-only seluruh jalur; Astra memperbaiki; bukti Node 22/browser; draf paket 6G | Keputusan fitur tambahan/E2 hanya jika tidak mengganggu finalisasi. Tidak memasukkan fitur baru setelah freeze tanpa review/tes ulang. |
| 7 | Sol retest; gerbang rilis lengkap, smoke proxy/Node/browser dan restore kandidat akhir; IT melakukan rehearsal deploy/rollback | **Presentasi 3 dan keputusan rilis:** atasan + IT menerima bukti/risiko. Rilis terbatas/publik setelah lulus; bila gagal, tetap staging dan serahkan rencana penutupan. |
| 8 | Masa stabilisasi, pemantauan pilot, latihan pemulihan mandiri, verifikasi source/secret/akun, final dokumen/backlog | **Presentasi akhir/serah terima:** IT + unit menjalankan demo sendiri, berita acara ditandatangani dan PIC pascakontrak aktif. Tidak memulai fitur besar. |

Gerbang pilot minggu 4: staging terisolasi, akun unit/reviewer, draft-only/approved terbukti, backup/restore awal lulus, jaringan/HTTPS lolos dan tidak ada temuan keamanan Tinggi/Kritis yang diketahui terbuka. Gerbang produksi minggu 7: 6C/6D/6E selesai dengan bukti, penerimaan BAA/BSDM, sumber data/publikasi disahkan, paket operasi tersedia dan keputusan atasan/IT tercatat. Bila gerbang gagal, kalender tidak menggantikannya.

## Risiko teratas

| Risiko | Peluang / dampak | Pencegahan, sinyal dan respons | Pemilik |
|---|---|---|---|
| Host/proxy/VPN/PIC terlambat | Tinggi / Tinggi | Tenggat staging minggu 2; eskalasi minggu 1; lanjut dokumentasi/ukur lokal dengan batas bukti, jangan klaim deploy siap | IT + atasan |
| Internal terbuka karena route/metode/encoded path/header proxy | Sedang / Kritis | Allowlist publik, port backend tertutup, tes eksternal dengan cookie sah; blokir rilis bila bocor | IT + pengembang |
| Backup ada tetapi gagal restore/kehilangan data | Sedang / Kritis | RPO/RTO disepakati, salinan terpisah, alarm umur backup, restore penuh minggu 3 dan 7/8 | IT |
| Produksi memakai demo/owner/secret dev | Sedang / Tinggi | Bootstrap produksi ditinjau, daftar akun/grant, secret terpisah, uji wajib ganti/reset dan penonaktifan sesi | IT + admin |
| Multi-proses melipatgandakan kuota Excel/login | Sedang / Tinggi | Satu proses awal; pantau CPU/RSS/antrean, tahan cluster sampai kuota bersama diuji | IT + pengembang |
| Node 22/browser unit berbeda atau worker watch regresi | Sedang / Tinggi | Uji Node/OS sasaran start/dev, klik ke disk dan roundtrip Excel, Firefox/Chrome sesuai unit; skip dinyatakan | Pengembang + BAA/BSDM |
| Cache/index/optimasi merusak privasi atau hasil approved | Sedang / Tinggi | Hanya temuan 6A, no-store privat, invalidasi publish/visibility, regression dan rollback staging | Pengembang + reviewer |
| Sumber data/definisi BKD/proyeksi terlambat | Tinggi / Sedang | PIC/tenggat minggu 3, NULL/flag/empty state, backlog tanpa pemetaan/angka rekaan | PJM/BSDM/BAA/PRP + atasan |
| Lingkup E2/fitur baru menghabiskan sisa kontrak | Tinggi / Tinggi | Freeze minggu 6, fitur opsional dipotong pertama; cadangan perbaikan keamanan/serah terima dipertahankan | Atasan + pengembang |
| Pemulihan hanya diketahui pengembang; kompromi app_user | Sedang / Tinggi | Dua PIC, latihan mandiri, vault/rotasi/offboarding; penerimaan E1-06 tertulis dan DB tertutup | IT + atasan |

## Keputusan/informasi yang masih diperlukan

Keputusan yang belum dijawab dicatat berikut; rencana dapat ditulis tanpa jawabannya, tetapi pelaksanaan yang bergantung padanya menunggu keputusan. Tidak ada angka/pemetaan sumber baru yang diasumsikan.

| Dari siapa | Keputusan/informasi konkret | Dibutuhkan paling lambat |
|---|---|---|
| Pengguna + atasan | Tanggal kontrak berakhir/kickoff, waktu pengembang, prioritas wajib vs opsional, pemberi persetujuan pilot/rilis/serah terima dan jadwal presentasi | Minggu 1 |
| IT kampus | PIC/pengganti; host/OS/spesifikasi/kuota; domain/DNS/TLS/renewal; staging; proxy lokal/remote, subnet kampus/VPN, origin publik/internal dan akses maintenance | Minggu 1; staging minggu 2 |
| IT + atasan | Modul/data yang boleh internet; apakah semua login/privat via VPN; matriks route/metode; akses privat oleh pimpinan di luar kampus | Minggu 1–2, sebelum uji jaringan |
| IT | Pengelola proses/service satu instance; backup storage/enkripsi/retensi; RPO/RTO, jam layanan, kontak/alarm dan jendela deploy/rollback | Minggu 2 |
| Pengguna + IT + atasan | DB produksi baru atau pemindahan DB; sumber approved sah yang boleh dipublikasikan; perlakuan akun demo sebagai aktor audit historis bila ada; bootstrap/provenance/ledger pemindahan | Minggu 3, wajib sebelum rilis |
| BAA + BSDM + PRP/atasan | Nama/email personal, unit/role dari master, pengisi dan reviewer berbeda, admin IT/pengganti, pemilik reset; jumlah pengguna bersamaan, versi browser/Excel, slot pilot serta penandatangan penerimaan | Minggu 1–2 |
| PJM + pengelola master/BAA | Pemetaan fakultas/nomenklatur; S1 Geografi/Kewirausahaan dan SK; akreditasi institusi/internasional, nilai/skala/tanggal/sertifikat serta izin publikasi | Minggu 3 untuk fitur; jika belum, backlog |
| BSDM | Definisi/cakupan BKD dan denominator/semester, sumber data agregat; cakupan tendik 30/109 dan PKWT/formasi/jafung; pemilik rincian rekognisi/beban mengajar | Minggu 3 untuk fitur; jika belum, backlog |
| PRP + atasan | Kontrak Proyeksi Kinerja: tujuan, indikator, metode/horizon, histori, asumsi/pemilik, akses dan apakah wajib rilis ini; klarifikasi empat catatan IKU | Minggu 3 |
| BPKA/LPPM/BKU/PRP/unit kemitraan | Kelengkapan tracer/lulusan, tahun/cakupan penelitian-PkM, satuan keuangan/KPI dan kode unit kemitraan | Minggu 3 bila masuk penerimaan data; sisanya backlog |
| IT + atasan | Penerimaan risiko residual termasuk E1-06, pemilik git privat/arsip source/vault, petugas operasi pascakontrak, masa dukungan dan pemilik backlog E2/BKD/Proyeksi | Risiko sebelum rilis; pengelola sejak minggu 1, final minggu 8 |

## Verifikasi penyusunan dokumen

Sesi ini melakukan pembacaan dokumen/kode, inventaris aset dan pemeriksaan tautan relatif serta batas perubahan berkas. Tidak mengakses DB, menjalankan aplikasi/beban/restore, menguji browser, mengaudit dependency atau menjalankan migration/seed/tes mutasi. Hasil dan target rencana tidak boleh dikutip sebagai kelulusan Fase 6. Bukti eksekusi sub-fase nanti dicatat terpisah dengan tanggal, versi, lingkungan dan batas verifikasi, lalu diringkas di STATUS.

Pemeriksaan dokumen: 61 tautan relatif pada FASE-6/STATUS memiliki target berkas/direktori, tujuh sub-fase 6A–6G dan delapan minggu lengkap. Perbandingan SHA-256 inventaris 292 berkas awal terdaftar oleh `rg` (termasuk kode, 30 migration dan 15 berkas seed; tanpa berkas diabaikan seperti `.env`, node_modules, `.runtime` dan metadata alat): hanya STATUS berubah, FASE-6 baru, 291 berkas awal lainnya identik, tidak ada berkas dihapus. `.env` tidak dibaca/ditulis pada sesi ini dan tidak termasuk pembandingan hash. Resolusi anchor Markdown tidak diuji; pemeriksaan ini bukan pengujian aplikasi. Git tidak tersedia, sehingga batas perubahan inventaris dibuktikan dengan hash, bukan klaim git diff.
