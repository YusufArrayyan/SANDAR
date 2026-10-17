# Panduan penggunaan SANDAR

SANDAR membantu petani pisang pulau terluar mencatat panen, mendapat jatah ruang kapal yang adil, dan melihat harga acuan di daratan. Semua fungsi utama tetap berjalan tanpa sinyal.

Video demo: [`demo-sandar-suara.mp4`](video/demo-sandar-suara.mp4) dengan narasi (takarir: [`demo-sandar-suara.srt`](video/demo-sandar-suara.srt)), serta versi tanpa suara [`demo-sandar.mp4`](video/demo-sandar.mp4) dan [`demo-sandar-ponsel.mp4`](video/demo-sandar-ponsel.mp4) (tegak).

## Mulai memakai

1. **Buka alamat SANDAR di Chrome** pada ponsel Android.
2. **Aktifkan perangkat.** Masukkan kode aktivasi dari Admin. Langkah ini butuh sinyal sekali saja.
3. **Pasang di layar utama.** Buka menu Chrome (titik tiga), pilih **Tambahkan ke layar utama**. Sejak itu SANDAR dibuka dari ikon seperti aplikasi biasa, juga tanpa sinyal.
4. **Masuk** dengan nomor HP dan PIN 4 angka.

### Arti tanda di kanan atas

| Tanda | Arti |
| --- | --- |
| **Tersambung** | Ada sinyal. Catatan terkirim otomatis. |
| **Luring · 3 menunggu** | Tidak ada sinyal. Tiga catatan aman di ponsel dan terkirim sendiri saat sinyal kembali. |

Ketuk tanda itu untuk membuka layar **Sinkronisasi**: jumlah catatan yang menunggu, waktu sinkron terakhir, tombol **Kirim sekarang**, dan pesan bila ada catatan yang ditolak server.

### Arti status catatan panen

| Status | Arti |
| --- | --- |
| Menunggu kirim | Tersimpan di ponsel, belum sampai ke server. |
| Terdaftar | Sudah diterima server, menunggu pembagian kapal. |
| Dapat jatah | Mendapat ruang kapal. Bila hanya sebagian, sisanya tercatat di daftar tunggu. |
| Daftar tunggu | Belum mendapat ruang. Ikut dibagi pada kapal berikutnya. |
| Terangkut | Sudah naik kapal. |
| Dibatalkan | Dibatalkan; tidak ikut pembagian. |

## Petani

1. **Catat panen:** di layar **Panen**, tekan **Catat panen**. Isi komoditas, jumlah tandan, dan tanggal siap angkut, lalu tekan **Simpan**.
2. **Lihat jatah:** buka **Jatah** dan pilih kapal. Petani hanya melihat catatannya sendiri.
3. **Lihat harga:** buka **Harga**. Layar ini menampilkan harga acuan Kota Bengkulu, biaya angkut dan tebang, serta sisa hasil per tandan. Angka ini membantu memutuskan menjual atau menunda; aplikasi tidak memberi saran.

Petani yang tidak punya ponsel dibantu Pengelola simpul di desa.

## Pengelola simpul (koperasi desa atau kelompok tani)

1. **Catat panen untuk petani:** **Panen → Catat panen**, pilih nama petani. Petani baru ditambah lewat **Tambah petani baru** (nama, kelompok tani, nomor HP boleh kosong).
2. **Ubah atau batalkan catatan:** ketuk catatan di daftar Panen. Catatan dapat diubah selama jatahnya belum Final.
3. **Bagi ruang kapal:** **Jatah**, pilih kapal, tekan **Jalankan pencocokan**.
   - Bila ruang cukup, semua permintaan dapat ruang penuh.
   - Bila tidak cukup, setiap petani mendapat bagian yang sama besar dari permintaannya. Sisanya masuk daftar tunggu kapal berikutnya.
   - Hasil di ponsel berlabel **Sementara**. Server menggabungkan data semua desa menjadi hasil **Final**, lalu menguncinya pukul 18.00 sehari sebelum kapal berangkat.
   - Bila hasil Final berbeda, muncul pesan **Jatah berubah** beserta angka barunya.
4. **Sesuaikan jatah secara manual** bila perlu: ketuk nama petani di layar Jatah, isi jatah dan alasannya. Alasan tercatat di log dan dapat dilihat Admin.
5. **Tandai terangkut:** setelah muatan naik kapal, buka catatan panen lalu tekan **Tandai terangkut**. Harga terima per tandan boleh diisi.
6. **Biaya tebang dan angkut darat:** **Harga → Ubah biaya tebang**. Satu nilai berlaku untuk seluruh desa.
7. **Kirim data** setiap kali ada sinyal. Biasanya otomatis; bila ragu, buka layar Sinkronisasi dan tekan **Kirim sekarang**.

Satu perangkat simpul dipakai bersama. Setelah selesai, tekan **Akun → Keluar** agar orang berikutnya masuk dengan nomor HP dan PIN-nya sendiri.

## Pengelola kapal

1. **Catat keberangkatan:** **Ruang Muat → Catat keberangkatan**. Isi kapal, tanggal dan jam berangkat, sisa ruang (tandan), tarif per tandan, pelabuhan asal, dan tujuan.
2. **Ubah sisa ruang atau tarif:** ketuk keberangkatan di daftar. Isi 0 bila kapal penuh.
3. **Ubah status:**
   - **Sudah berangkat:** jatah dikunci.
   - **Batalkan keberangkatan:** semua jatah kapal itu kembali ke daftar tunggu dan ikut dibagi pada kapal berikutnya.

## Mitra pasar

1. Buka **Input harga**. Pilih pasar, tanggal, dan isi harga per tandan.
2. Tekan **Simpan harga**. Input harga butuh sinyal.
3. Harga baru diterima semua perangkat desa pada sinkron berikutnya. Harga yang lebih lama dari 7 hari ditandai **Harga lama**.

## Admin

Panel **Kelola** butuh sinyal dan paling nyaman dibuka di laptop.

| Tab | Isi |
| --- | --- |
| Ringkasan | Empat indikator keberhasilan per desa dan per bulan, ekspor CSV |
| Akun | Tambah akun, atur ulang PIN, aktifkan atau nonaktifkan akun |
| Desa | Tambah desa, perkiraan jumlah petani pisang, biaya tebang |
| Kapal | Tambah kapal dan pilih pengelolanya |
| Perangkat | Buat kode aktivasi (perangkat simpul desa atau ponsel pribadi); nonaktifkan perangkat yang hilang |
| Parameter | Batas harga lama, jam batas pencocokan, kunci PIN, peringatan selisih jam |
| Log audit | Penyesuaian jatah, perubahan harga, dan perubahan akun |

Urutan menyiapkan desa baru: tambah **Desa**, lalu **Akun** Pengelola simpul dan petani, lalu **Kapal**, lalu buat **kode aktivasi** untuk perangkat simpul desa itu.

## Bila ada masalah

| Masalah | Yang dilakukan |
| --- | --- |
| Lupa PIN | Minta Admin mengatur ulang PIN di Kelola, tab Akun. PIN baru berlaku setelah perangkat tersinkron. |
| PIN salah 5 kali | Masuk dikunci 5 menit. Tunggu, lalu coba lagi. |
| Catatan "Gagal dikirim" | Buka layar Sinkronisasi untuk membaca penyebabnya, lalu perbaiki catatannya. |
| Peringatan jam perangkat berbeda | Atur tanggal dan jam ponsel agar sesuai. |
| Perangkat hilang | Admin menonaktifkan perangkat itu di Kelola, tab Perangkat. |
| Berpindah ke ponsel lain | Pastikan semua catatan terkirim, lalu aktifkan ponsel baru dengan kode baru dari Admin. |
