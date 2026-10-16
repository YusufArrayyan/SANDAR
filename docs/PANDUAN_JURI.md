# Panduan mencoba SANDAR untuk juri

**Alamat aplikasi:** https://sandar-6mgj.onrender.com
**Video demo (1 menit 12 detik):** `docs/video/demo-sandar.mp4`

Tidak perlu kode aktivasi. Di layar pertama, pilih peran di kartu **Mencoba SANDAR?**, lalu ketuk salah satu **akun contoh** di layar Masuk. Nomor HP dan PIN terisi sendiri.

SANDAR berjalan di server gratis yang tidur bila tidak dipakai. Bila halaman pertama lambat terbuka (sampai sekitar 1 menit), tunggu sebentar; setelah itu aplikasi berjalan normal.

Semua nama, angka, dan harga di dalam aplikasi adalah **data contoh** dari PRD (Desa Meok, Kapal nelayan Bahari 2, Pasar Minggu Kota Bengkulu), bukan data lapangan.

## Peran yang dapat dicoba

| Pilihan di layar pertama | Akun contoh | Yang dapat dicoba |
| --- | --- | --- |
| Pengelola simpul atau petani | Andi (Pengelola simpul), Rahmat (Petani) | Catat panen, jatah angkut, harga, kerja tanpa sinyal |
| Pengelola kapal | Darman | Catat keberangkatan, sisa ruang, tarif |
| Mitra pasar | Mitra Pasar Minggu | Input harga acuan |

PIN semua akun contoh: **1234**. Untuk berganti peran, buka **Akun → Pakai kode aktivasi lain**, lalu pilih peran lain.

## Skenario 5 menit

Disarankan membuka aplikasi di ponsel (Chrome Android). Di laptop, tampilan layar lebar juga tersedia; untuk tampilan ponsel tekan `F12` lalu `Ctrl+Shift+M`.

1. **Masuk.** Pilih **Pengelola simpul atau petani**, lalu ketuk **Andi · Pengelola simpul**.
2. **Jatah angkut.** Buka **Jatah**, pilih **Kapal nelayan Bahari 2**, tekan **Jalankan pencocokan**.
   - Ruang 300 tandan dibagi untuk permintaan 480 tandan, jadi setiap petani mendapat 62,5 persen (contoh PRD 7.2: Rahmat 75, Siti 94, Yanto 131).
   - Hasil di perangkat berlabel Sementara, lalu menjadi Final setelah server menghitung data semua desa.
   - Buka **Cara pembagian jatah** untuk aturannya.
3. **Bekerja tanpa sinyal.**
   - Matikan jaringan. Di ponsel aktifkan mode pesawat; di laptop tekan `F12`, buka tab **Network**, lalu pilih **Offline**.
   - Buka **Panen → Catat panen** dan simpan satu catatan.
   - Tanda di kanan atas berubah menjadi **Luring · 1 menunggu**, dan catatan berstatus **Menunggu kirim**.
   - Muat ulang halaman: aplikasi tetap terbuka dan catatan masih ada.
4. **Sinyal kembali.** Nyalakan lagi jaringan. Dalam beberapa detik catatan terkirim dan tanda kembali **Tersambung**.
5. **Harga acuan.** Buka **Harga**. Di sana tampil harga Kota Bengkulu, biaya angkut dan tebang, dan sisa hasil per tandan. Aplikasi tidak menyarankan menjual atau menunda; petani yang memutuskan.

Tambahan bila ada waktu:
- Keluar, lalu masuk sebagai **Rahmat · Petani** di perangkat yang sama. Petani hanya melihat catatan panennya sendiri.
- Coba peran **Pengelola kapal** dan **Mitra pasar** lewat **Akun → Pakai kode aktivasi lain**.

## Panel Admin

Panel **Kelola** tidak dibuka lewat mode demo, karena Admin dapat mengubah seluruh isi server. Bila juri ingin melihatnya, panitia dapat diberi kode aktivasi Admin. Kode ini tercetak di log server bila `SANDAR_JURI` diaktifkan (lihat `docs/DEPLOY_GRATIS.md`).

## Bila ada kendala

| Kendala | Penyebab dan solusi |
| --- | --- |
| Kartu "Mencoba SANDAR?" tidak muncul | Server sedang bangun. Tunggu sekitar 1 menit lalu muat ulang. |
| Layar Masuk menyebut daftar akun belum diterima | Sambungan terputus saat aktivasi. Pastikan tersambung, tunggu sebentar, lalu coba lagi. |
| Ingin mengulang dari awal | **Akun → Pakai kode aktivasi lain**, lalu pilih peran lagi. |
