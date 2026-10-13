# Deploy gratis: Render + Neon

SANDAR dijalankan di layanan web gratis Render (dari Dockerfile, HTTPS otomatis) dengan basis data PostgreSQL gratis dari Neon. Keduanya tidak butuh kartu kredit.

| Bagian | Layanan | Batas paket gratis |
| --- | --- | --- |
| Aplikasi dan API | Render, layanan web Free | 512 MB RAM. Tidur setelah 15 menit tanpa akses dan butuh sekitar 1 menit untuk bangun. 750 jam per bulan. |
| Basis data | Neon, paket Free | 1 GB penyimpanan per proyek, tidak kedaluwarsa. |

Basis data gratis milik Render tidak dipakai karena dihapus 30 hari setelah dibuat.

Server yang tidur tidak mengganggu SANDAR di lapangan. Semua catatan tetap tersimpan di ponsel. Sinkron pertama setelah server tidur hanya butuh sekitar 1 menit lebih lama, dan bila gagal aplikasi mencoba ulang sendiri. Batas waktu pencocokan tetap berlaku: hasil dikunci saat server bangun pada akses berikutnya.

## Langkah 1: buat basis data di Neon

1. Buka [neon.com](https://neon.com) dan daftar (bisa memakai akun GitHub).
2. Buat proyek baru. Nama: `sandar`. Region: pilih **AWS Asia Pacific (Singapore)** agar dekat dengan server Render.
3. Di halaman proyek, tekan **Connect** dan salin **connection string**. Bentuknya seperti `postgresql://neondb_owner:…@ep-….ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.

Simpan connection string itu. Isinya mengandung sandi basis data, jadi jangan dibagikan atau ditempel di tempat umum.

## Langkah 2: deploy di Render

1. Buka [render.com](https://render.com) dan daftar dengan akun GitHub yang memegang repo `YusufArrayyan/SANDAR`.
2. Pilih **New**, lalu **Blueprint**. Hubungkan repo `SANDAR`. Render membaca berkas `render.yaml`.
3. Render meminta tiga nilai:

   | Variabel | Isi |
   | --- | --- |
   | `SANDAR_DATABASE_URL` | Connection string dari Neon |
   | `SANDAR_ADMIN_HP` | Nomor HP Admin, misalnya `081234500000` |
   | `SANDAR_ADMIN_PIN` | PIN Admin awal, 4 angka |

4. Tekan **Apply**. Build pertama butuh sekitar 5 sampai 10 menit.
5. Setelah status **Live**, buka tab **Logs** dan cari baris `Kode aktivasi perangkat Admin: XXXXXXXX`. Catat kodenya.
6. Alamat aplikasi tampil di bagian atas, misalnya `https://sandar.onrender.com`.

## Langkah 3: mulai memakai

1. Buka alamat aplikasi di ponsel atau komputer Admin. Masukkan kode aktivasi dari log, lalu masuk dengan nomor HP dan PIN Admin.
2. Ganti PIN Admin di menu Akun.
3. Di Kelola, isi berurutan:
   1. Tab **Desa**: tambah desa.
   2. Tab **Akun**: tambah Pengelola simpul, petani, Pengelola kapal, dan Mitra pasar.
   3. Tab **Kapal**: tambah kapal dan pilih pengelolanya.
   4. Tab **Perangkat**: buat kode aktivasi untuk setiap perangkat simpul dan ponsel.
4. Di setiap ponsel: buka alamat aplikasi di Chrome, masukkan kode aktivasi, lalu pilih menu Chrome **Tambahkan ke layar utama**.

## Mencoba dengan data contoh

Untuk demo atau uji coba sebelum data sungguhan dimasukkan, tambahkan variabel `SANDAR_DATA_CONTOH` bernilai `1` di Render (tab **Environment**) **sebelum** server pertama kali menyala. Data contoh PRD akan terisi dengan kode aktivasi seperti `MEOK2026` dan PIN `1234` (daftar lengkap di README).

Kode dan PIN contoh mudah ditebak. Jangan pakai data contoh untuk data petani sungguhan. Untuk berpindah ke data sungguhan, buat proyek Neon baru, ganti `SANDAR_DATABASE_URL`, hapus `SANDAR_DATA_CONTOH`, lalu isi `SANDAR_ADMIN_HP` dan `SANDAR_ADMIN_PIN`.

## Pembaruan aplikasi

Setiap push ke cabang `main` di GitHub otomatis dibuild ulang dan dipasang oleh Render. Ponsel menerima versi baru saat aplikasi dibuka berikutnya dan memasangnya ketika aplikasi ditinggalkan.

## Cadangan data

Paket gratis Neon menyimpan riwayat perubahan selama beberapa jam dan bisa dipulihkan dari dasbor. Untuk cadangan harian, unduh CSV dari Kelola, tab Ringkasan, atau jalankan `pg_dump` dengan connection string Neon dari komputer yang terpasang PostgreSQL.

## Bila sudah melewati batas gratis

Pindah ke paket berbayar cukup lewat dasbor masing-masing layanan; kode tidak perlu diubah. Untuk server sendiri, pakai `docker-compose.yml` (ada di README, bagian Produksi).
