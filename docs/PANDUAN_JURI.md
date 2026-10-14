# Panduan mencoba SANDAR untuk juri

**Alamat aplikasi:** https://sandar-6mgj.onrender.com

SANDAR berjalan di server gratis yang tidur bila tidak dipakai. Bila halaman pertama lambat terbuka (sampai sekitar 1 menit), tunggu sebentar; setelah itu aplikasi berjalan normal.

Semua nama, angka, dan harga di dalam aplikasi adalah **data contoh** dari PRD (Desa Meok, Kapal nelayan Bahari 2, Pasar Minggu Kota Bengkulu), bukan data lapangan.

## Kode aktivasi dan akun

Setiap juri menerima satu paket kode. Setiap kode hanya dapat dipakai sekali, untuk satu peramban.

| Peran | Kode | Masuk dengan nomor HP | PIN |
| --- | --- | --- | --- |
| Perangkat simpul Desa Meok, sebagai **Pengelola simpul** | (isi dari paket juri) | 081234567890 | 1234 |
| Perangkat simpul Desa Meok, sebagai **Petani** | kode yang sama | 081255500001 | 1234 |
| **Pengelola kapal** | (isi dari paket juri) | 081300000001 | 1234 |
| **Mitra pasar** | (isi dari paket juri) | 081400000001 | 1234 |
| **Admin** | (isi dari paket juri) | 0811000000 | 1234 |

Perangkat simpul dipakai bersama satu desa: Pengelola simpul dan petani masuk di perangkat yang sama. Untuk berpindah ke peran lain dengan kode lain, buka **Akun → Pakai kode aktivasi lain**.

## Skenario 5 menit

Disarankan membuka aplikasi di ponsel (Chrome Android) atau, di laptop, menekan `F12` lalu `Ctrl+Shift+M` untuk tampilan ponsel. Tampilan laptop juga didukung.

1. **Aktivasi dan masuk.** Masukkan kode Perangkat simpul Desa Meok, lalu masuk sebagai Pengelola simpul (081234567890, PIN 1234).
2. **Jatah angkut.** Buka **Jatah**, pilih **Kapal nelayan Bahari 2**, tekan **Jalankan pencocokan**. Ruang 300 tandan dibagi untuk permintaan 480 tandan: setiap petani mendapat 62,5 persen (contoh PRD 7.2: Rahmat 75, Siti 94, Yanto 131). Hasil di perangkat berlabel Sementara, lalu berubah menjadi Final setelah server menghitung data semua desa. Buka **Cara pembagian jatah** untuk aturannya.
3. **Bekerja tanpa sinyal.** Matikan jaringan: di ponsel aktifkan mode pesawat; di laptop, tekan `F12`, tab **Network**, pilih **Offline**. Buka **Panen → Catat panen**, simpan satu catatan. Chip di kanan atas berubah menjadi **Luring · 1 menunggu**, dan catatan berstatus **Menunggu kirim**. Muat ulang halaman: aplikasi tetap terbuka dan catatan masih ada.
4. **Sinyal kembali.** Nyalakan lagi jaringan. Dalam beberapa detik catatan terkirim dan chip kembali **Tersambung**. Buka chip itu untuk melihat layar Sinkronisasi.
5. **Harga acuan.** Buka **Harga**: harga Kota Bengkulu, biaya angkut dan tebang, dan sisa hasil per tandan. Aplikasi tidak menyarankan menjual atau menunda; petani yang memutuskan.

Tambahan bila ada waktu:

- Masuk sebagai **Petani** (081255500001) di perangkat yang sama: petani hanya melihat catatan panennya sendiri.
- Dengan kode **Pengelola kapal**, catat keberangkatan baru atau ubah sisa ruang.
- Dengan kode **Mitra pasar**, masukkan harga baru; harga itu tampil di perangkat lain setelah sinkron.
- Dengan kode **Admin**, buka **Kelola**: ringkasan empat indikator keberhasilan per desa, akun, desa, kapal, kode aktivasi, parameter, log audit, dan ekspor CSV.

## Bila ada kendala

| Kendala | Penyebab dan solusi |
| --- | --- |
| "Kode aktivasi ini sudah dipakai" | Kode sudah dipakai di peramban lain. Pakai kode lain dari paket, atau minta kode baru. |
| Layar Masuk menyebut daftar akun belum diterima | Server sedang bangun. Tunggu sekitar 1 menit, pastikan tersambung, lalu coba lagi. |
| Ingin mengulang dari awal | **Akun → Pakai kode aktivasi lain**, lalu masukkan kode berikutnya. |
