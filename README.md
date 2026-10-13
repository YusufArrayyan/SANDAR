# SANDAR

Aplikasi web progresif (PWA) luring untuk koordinasi muatan kapal dan informasi harga bagi petani pisang pulau terluar. Dibangun dari PRD SANDAR versi 1.0 (lingkup final).

**Status: kandidat rilis 1.0 (`v1.0.0-rc.1`).** Semua kebutuhan wajib sudah dibuat dan lulus uji otomatis. Versi 1.0 final setelah uji perangkat dan uji kegunaan di [docs/UJI_RILIS.md](docs/UJI_RILIS.md) lulus.

Seluruh nama, angka, dan harga pada data contoh bukan data lapangan.

## Isi folder

| Folder | Isi |
| --- | --- |
| `frontend/` | PWA: React, Vite, TypeScript, service worker (Workbox), IndexedDB melalui Dexie |
| `backend/` | API FastAPI, SQLAlchemy (PostgreSQL di produksi, SQLite untuk pengembangan) |
| `shared/kasus_pencocokan.json` | Kasus uji pencocokan yang dipakai bersama oleh perangkat dan server |
| `docs/UJI_RILIS.md` | Protokol uji rilis: uji otomatis, uji perangkat Android, uji kegunaan dan SUS |
| `docs/PERUBAHAN_PRD.md` | Perubahan terhadap PRD yang sudah disetujui |
| `Dockerfile`, `docker-compose.yml` | Satu kontainer aplikasi, PostgreSQL, dan cadangan harian |

## Menjalankan untuk pengembangan

Kebutuhan: Python 3.12 atau lebih baru, Node 20 atau lebih baru.

```bash
cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements-dev.txt
```

```bash
cd backend && .venv/Scripts/python -m app.seed --demo --reset
```

```bash
cd frontend && npm install && npm run build
```

```bash
backend/.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --port 8765
```

Buka `http://localhost:8765`. Server melayani PWA dari `frontend/dist` sekaligus API di `/api`. Untuk mengubah antarmuka dengan muat ulang otomatis, jalankan `npm run dev` di `frontend/` (port 5173, permintaan `/api` diteruskan ke port 8765).

Di Linux atau macOS, ganti `.venv/Scripts/python` dengan `.venv/bin/python`.

### Data contoh

`python -m app.seed --demo` membuat Desa Meok dan Banjarsari, tiga petani contoh PRD 7.2 (Rahmat, Siti, Yanto), Kapal nelayan Bahari 2, Feri perintis, harga Pasar Minggu, dan kode aktivasi berikut. Semua akun contoh memakai PIN `1234` (atur dengan variabel `SANDAR_PIN_DEMO`). Kode aktivasi hanya dapat dipakai sekali; jalankan ulang dengan `--reset` untuk mengisi ulang.

| Kode | Perangkat | Nomor HP untuk masuk |
| --- | --- | --- |
| `MEOK2026` | Simpul Desa Meok | 081234567890 (Andi, Pengelola simpul) |
| `BANJAR26` | Simpul Desa Banjarsari | 081234567891 (Wati, Pengelola simpul) |
| `PETANI01` | Ponsel Rahmat | 081255500001 (Petani) |
| `KAPAL001` | Ponsel pengelola Bahari 2 | 081300000001 |
| `KAPAL002` | Ponsel pengelola feri | 081300000002 |
| `MITRA001` | Ponsel mitra pasar | 081400000001 |
| `ADMIN001` | Perangkat Admin | 0811000000 |

Tanpa `--demo`, seed hanya membuat akun Admin dan mencetak satu kode aktivasi acak.

Satu peramban menyimpan satu perangkat. Untuk mencoba beberapa peran sekaligus di satu komputer, buka origin yang berbeda (misalnya `localhost:8765` dan `127.0.0.1:8765`) atau jendela penyamaran.

## Tes

```bash
cd backend && .venv/Scripts/python -m pytest -q
```

```bash
cd frontend && npm test && npm run build && npm run test:e2e
```

- **Backend (27 tes):** pencocokan, pengiriman idempoten, batas 50 operasi, operasi keliru yang tidak memacetkan antrean, konflik ubah, kunci pada batas waktu, keberangkatan Batal, pemisahan sisa saat Terangkut, urutan berdasarkan waktu terima server, lingkup data per peran, batas percobaan kode aktivasi, dan perangkat yang dinonaktifkan.
- **Frontend (10 tes):** kasus pencocokan bersama, termasuk contoh PRD 7.2 (300 tandan, jatah 75, 94, 131).
- **End-to-end (7 tes, Google Chrome):** aktivasi dan layar awal per peran, kunci PIN, pencocokan 7.2 lewat antarmuka, mode pesawat penuh, tutup paksa proses peramban, input harga, dan panel Admin.

Semua tes lulus di SQLite dan PostgreSQL 18. Untuk menjalankannya terhadap PostgreSQL, isi `SANDAR_UJI_DATABASE_URL` (pytest) dan `SANDAR_E2E_DATABASE_URL` (end-to-end) dengan basis data kosong khusus uji.

## Produksi

```bash
SANDAR_DB_PASSWORD=sandi-kuat docker compose up -d --build
```

```bash
docker compose exec app python -m app.seed
```

Perintah kedua membuat akun Admin pertama dan mencetak kode aktivasi perangkat Admin. Ganti PIN Admin segera setelah masuk. Cadangan harian tersimpan di folder `cadangan/` (disimpan 30 hari). Pasang HTTPS di depan kontainer (misalnya Caddy atau Nginx), karena service worker dan WebCrypto butuh HTTPS di luar `localhost`.

## Cara kerja singkat

**Tulis lebih dulu.** Setiap aksi menyimpan baris data dan operasinya ke IndexedDB dalam satu transaksi, lalu menampilkan "Tersimpan". Tidak ada layar yang menunggu jaringan.

**Sinkronisasi tertunda.** Antrean dikirim mulai dari yang terlama, 50 operasi per kiriman, saat jaringan terdeteksi, setiap 15 menit, atau dari tombol Kirim sekarang. Kegagalan jaringan dicoba ulang dengan jeda bertahap. Operasi baru dihapus dari antrean setelah server mengonfirmasi. Server menyimpan setiap `op_id` sehingga kiriman ulang tidak menggandakan data. Perubahan dari server diambil dengan kursor `seq`.

**Konflik.** Catatan membawa nomor versi. Perubahan yang lebih dulu diterima server menang; perubahan yang menyusul ditolak dengan pesan satu kalimat, dan perangkat mengambil ulang nilai server.

**Pencocokan.** Perangkat menghitung hasil Sementara dari data desanya. Server menghitung hasil Final dari data semua simpul, berurutan menurut waktu berangkat, dan menyimpan versi baru setiap kali hasil berubah. Pada batas waktu (pukul 18.00 WIB hari sebelum berangkat, dapat diubah Admin) atau saat kapal ditandai Berangkat, hasil dikunci. Penyesuaian manual oleh Pengelola simpul wajib beralasan dan masuk log audit.

**Akses.** PIN 4 angka diperiksa di perangkat dengan PBKDF2-SHA256; server hanya menyimpan hash. Kode aktivasi menghasilkan token perangkat. Perangkat simpul terikat ke satu desa dan memuat akun petani serta Pengelola simpul desa itu; ponsel pribadi terikat ke satu akun. Server memeriksa lingkup perangkat dan peran pada setiap permintaan. Petani hanya menerima catatannya sendiri, dan baris jatah desa lain tidak pernah dikirim ke perangkat.

## Keputusan rancangan yang perlu diketahui

PRD tidak mengatur hal-hal berikut secara rinci, jadi implementasi memilih cara yang paling sederhana dan dapat ditinjau ulang:

1. **Jatah sebagian.** Bila petani hanya mendapat sebagian jatah, catatannya tetap satu dengan status Dapat jatah dan jumlah daftar tunggu. Saat ditandai Terangkut, sisa tandan dipisah menjadi catatan baru (urutan dibuat aslinya tetap dipakai) yang ikut kapal berikutnya.
2. **Hasil Final berjalan sebelum dikunci.** Setelah pencocokan diminta untuk satu keberangkatan, server memperbarui hasil Final setiap kali data berubah, sampai batas waktu. Perangkat menampilkan "Jatah berubah" bila Final berbeda dari Sementara terakhir.
3. **Edit catatan panen** diizinkan sampai catatan punya jatah pada keberangkatan yang sudah dikunci.
4. **Pengelola simpul boleh mencatat keberangkatan** untuk kapal mana pun (mitigasi risiko PRD 15), sedangkan Pengelola kapal hanya untuk kapalnya sendiri.
5. **Indikator 4 (sinkron dalam 24 jam)** diukur dari waktu percobaan kirim pertama di perangkat sampai server menerima.

## Keamanan perangkat

Data lokal dilindungi enkripsi penyimpanan bawaan Android, bukan enkripsi oleh aplikasi. Setiap perangkat yang memakai SANDAR wajib memakai kunci layar. Alasannya ada di [docs/PERUBAHAN_PRD.md](docs/PERUBAHAN_PRD.md) (P-01). Bila perangkat hilang, nonaktifkan di Kelola, tab Perangkat.

## Sebelum menjadi versi 1.0 final

Uji berikut harus dijalankan tim di lapangan dengan protokol dan lembar hasil di [docs/UJI_RILIS.md](docs/UJI_RILIS.md):

- Uji perangkat di ponsel Android RAM 2 GB: mode pesawat, tutup paksa, daya padam, konflik dua perangkat, penyimpanan 14 hari.
- Uji kegunaan dengan 3 sampai 5 pengguna dan skor SUS di atas 80.
