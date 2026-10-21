# Satu Data ITPLN — frontend

Jalankan `npm run dev` dari root proyek, lalu buka http://127.0.0.1:3000/.
Halaman HTML multipage menggunakan `assets/js/api.js` dan API Express pada origin yang sama; jangan membuka melalui file:// atau Live Server.

Grafik memakai Chart.js lokal. Navbar/footer memakai satu sumber. Angka berasal dari data approved PostgreSQL, bukan snapshot di HTML. Kondisi loading/kosong/error, akses login dan format id-ID ditangani bersama.

Aset vendor dan pemberitahuan lisensi dipertahankan. Renderer/aset lama yang tidak digunakan masih tersimpan untuk riwayat; aplikasi tidak memuatnya. Checkpoint sebelum refactor tersedia di Git, commit "Fase 2 selesai".
