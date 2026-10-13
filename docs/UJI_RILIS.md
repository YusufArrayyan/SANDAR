# Protokol uji rilis SANDAR 1.0

Dokumen ini memetakan syarat siap rilis PRD bagian 14 ke cara pengujiannya. Uji otomatis sudah dijalankan di komputer pengembang. Uji perangkat dan uji kegunaan harus dijalankan tim di lapangan, lalu hasilnya diisi di lembar pada bagian 6.

## 1. Status syarat rilis

| Syarat rilis (PRD 14) | Cara uji | Status |
| --- | --- | --- |
| Seluruh kebutuhan W lulus uji, termasuk mode pesawat penuh | Uji otomatis (bagian 2) dan uji perangkat (bagian 3) | Otomatis lulus; uji perangkat belum |
| Tidak ada catatan hilang pada uji tutup paksa dan daya padam | Tes `tutup-paksa.spec.ts` dan uji perangkat 3.3 sampai 3.4 | Tutup paksa di peramban lulus; ponsel belum |
| Contoh 7.2 menghasilkan angka sama di perangkat dan di server | `shared/kasus_pencocokan.json` di kedua sisi dan tes end-to-end | Lulus |
| Skor SUS di atas 80 pada uji kegunaan | Bagian 4 | Belum |

Versi 1.0 dinyatakan final setelah keempat baris berstatus lulus.

## 2. Uji otomatis

Jalankan dari folder proyek. Uji end-to-end butuh Google Chrome dan hasil `npm run build`.

```bash
cd backend && .venv/Scripts/python -m pytest -q
```

```bash
cd frontend && npm test && npm run build && npm run test:e2e
```

Untuk menjalankan uji backend dan end-to-end terhadap PostgreSQL, isi `SANDAR_UJI_DATABASE_URL` (pytest) dan `SANDAR_E2E_DATABASE_URL` (end-to-end) dengan alamat basis data kosong khusus uji. Isinya dihapus setiap kali uji berjalan.

Hasil terakhir: 27 tes backend, 10 tes pencocokan frontend, dan 7 tes end-to-end lulus di SQLite dan PostgreSQL 18.

### Peta kebutuhan W ke tes

| Kebutuhan | Tes |
| --- | --- |
| FR-01, FR-02, FR-04 | e2e: aktivasi, masuk dengan PIN, layar awal sesuai peran; pytest `test_aktivasi_sekali_pakai` |
| FR-03, FR-16, FR-24, FR-25 | pytest `test_ambil_berisi_lingkup_desa`, `test_petani_hanya_melihat_catatannya`, `test_pengelola_kapal_hanya_kapal_sendiri`, `test_simpul_tidak_bisa_mengubah_petani_desa_lain` |
| FR-10, FR-11, FR-12, FR-14 | e2e: mode pesawat penuh |
| FR-13 | pytest `test_konflik_ubah_yang_lebih_dulu_menang`, `test_kunci_pada_batas_waktu_dan_terangkut_memisah_sisa` |
| FR-15 | pytest `test_kunci_pada_batas_waktu_dan_terangkut_memisah_sisa` |
| FR-20 sampai FR-23 | pytest `test_keberangkatan_batal_mengembalikan_daftar_tunggu`, `test_pengelola_kapal_hanya_kapal_sendiri` |
| FR-30 sampai FR-34, FR-36 | e2e: pencocokan PRD 7.2; pytest `test_pencocokan_final_sesuai_contoh_prd`, `test_kunci_pada_batas_waktu...`, `test_urutan_memakai_waktu_terima_server`; kasus bersama |
| FR-40, FR-41 | e2e: harga dari Mitra pasar; pytest `test_harga_hanya_mitra` |
| FR-42 sampai FR-44 | Uji manual 3.6 (layar Harga) |
| FR-50 sampai FR-54 | e2e: mode pesawat penuh, tutup paksa; pytest `test_kirim_idempoten`, `test_batas_50_operasi`, `test_operasi_keliru_tidak_memacetkan_kiriman` |
| FR-60 sampai FR-62 | e2e: Admin; pytest `test_ringkasan_indikator`, `test_perangkat_dinonaktifkan` |

### Kontras warna (PRD 11 dan 12.4)

Diukur dengan rumus WCAG 2.x pada nilai warna di `frontend/src/styles.css`. Semua pasangan di atas 4,5:1.

| Pasangan | Rasio |
| --- | --- |
| Teks utama #1B2733 di putih | 15,17 |
| Teks sekunder #5B6B78 di putih | 5,50 |
| Teks sekunder di latar #F3F6F8 | 5,07 |
| Teks putih di tombol #0E6E7E | 5,91 |
| Chip aksen #0E6E7E di #E3F1F3 | 5,11 |
| Hijau #1C6B3A di #E3F3E8 | 5,68 |
| Kuning tua #7A4B00 di #FDF0CF | 6,54 |
| Abu #4A5A67 di #E8EDF0 | 6,04 |
| Merah #A3261B di #FBE6E3 | 6,15 |

## 3. Uji perangkat (manual)

**Perangkat:** ponsel Android murah dengan RAM 2 GB, Chrome terbaru, kunci layar aktif (wajib, lihat P-01). Bila ada, ulangi di perangkat simpul yang akan dipakai di desa.

**Persiapan:**
- Server uji terpasang dengan HTTPS. Service worker dan pemeriksaan PIN butuh HTTPS di luar `localhost`.
- Data contoh terisi (`python -m app.seed --demo --reset`).

Catat hasil setiap langkah di lembar bagian 6.

### 3.1 Pemasangan

1. Buka alamat server di Chrome, masukkan kode `MEOK2026`.
2. Menu Chrome, pilih Tambahkan ke layar utama. Buka SANDAR dari ikon layar utama.
3. Masuk dengan HP 081234567890 dan PIN 1234.

**Lulus bila:** aplikasi terbuka layar penuh tanpa bilah alamat, dan layar awal adalah Panen.

### 3.2 Mode pesawat penuh

1. Aktifkan mode pesawat. Tutup SANDAR dari daftar aplikasi terbaru, lalu buka lagi dari ikon.
2. Ukur waktu dari ketukan ikon sampai daftar panen tampil.
3. Catat 3 panen baru. Ukur waktu dari ketukan Simpan sampai "Tersimpan" tampil.
4. Buka Ruang Muat, Jatah, Harga, Sinkronisasi. Jalankan pencocokan di Jatah.
5. Matikan mode pesawat. Tunggu paling lama 1 menit, atau tekan Kirim sekarang.

**Lulus bila:**
- Aplikasi terbuka di bawah 3 detik.
- Simpan di bawah 1 detik.
- Chip menampilkan "Luring · 3 menunggu".
- Semua layar terbuka tanpa galat.
- Setelah tersambung, chip menjadi "Tersambung" dan ketiga catatan tidak lagi berstatus Menunggu kirim.

### 3.3 Tutup paksa

1. Mode pesawat aktif. Catat panen, dan tepat saat "Tersimpan" tampil, tutup SANDAR dari daftar aplikasi terbaru.
2. Ulangi 10 kali dengan jumlah tandan berbeda (misalnya 11 sampai 20).
3. Buka lagi SANDAR.

**Lulus bila:** kesepuluh catatan ada, tidak ada yang hilang atau ganda.

### 3.4 Daya padam

1. Mode pesawat aktif. Catat panen, dan tepat saat "Tersimpan" tampil, matikan paksa ponsel: tahan tombol daya sampai mati, atau cabut baterai bila bisa dilepas.
2. Ulangi 5 kali.
3. Nyalakan ponsel, buka SANDAR.

**Lulus bila:** kelima catatan ada. Lalu matikan mode pesawat; semua catatan terkirim tanpa ganda.

### 3.5 Konflik sinkron dua perangkat

1. Aktifkan perangkat kedua dengan kode simpul desa yang sama (buat kode baru di Kelola, tab Perangkat).
2. Kedua perangkat mode pesawat. Ubah jumlah tandan catatan yang sama di keduanya dengan angka berbeda.
3. Sambungkan perangkat A, tunggu terkirim. Lalu sambungkan perangkat B.

**Lulus bila:**
- Nilai dari A yang tersimpan di server.
- Layar Sinkronisasi di B menampilkan "Catatan ini sudah diubah di perangkat lain. Data terbaru sudah diambil, silakan periksa lagi."
- Catatan di B kembali ke nilai A.

### 3.6 Harga dan sisa hasil

1. Masuk sebagai Mitra pasar di perangkat lain. Masukkan harga Rp60.000.
2. Di perangkat simpul, tunggu sinkron lalu buka Harga.

**Lulus bila:**
- Harga, tanggal, biaya angkut dan tebang, serta sisa hasil tampil benar.
- Kalimat "Ini bukan jaminan harga beli." ada.
- Ubah tanggal ponsel 8 hari ke depan: peringatan "Harga lama" tampil. Kembalikan tanggal ponsel.
- Isi biaya tebang Rp60.000 lewat Ubah biaya tebang: tampil "Sisa hasil negatif".

### 3.7 Penyimpanan 14 hari

1. Mode pesawat aktif. Catat sedikitnya 300 panen (perkiraan 14 hari kerja satu desa).
2. Buka ulang aplikasi.

**Lulus bila:**
- Aplikasi terbuka di bawah 3 detik.
- Daftar panen dapat digulir lancar.
- Semua catatan terkirim setelah tersambung, dalam kelompok berisi 50.

## 4. Uji kegunaan dan SUS

**Peserta:** 3 sampai 5 petani pisang atau calon Pengelola simpul yang belum pernah memakai SANDAR.

**Pelatihan:** 30 menit memakai ponsel uji, dengan data contoh.

### 4.1 Tugas

Berikan satu per satu dan ukur waktunya. Pemandu tidak membantu kecuali peserta buntu lebih dari 2 menit (catat sebagai bantuan).

| No | Tugas | Target |
| --- | --- | --- |
| T1 | Masuk dengan nomor HP dan PIN yang diberikan | Tanpa bantuan |
| T2 | Catat panen: Yanto, 120 tandan, siap angkut besok | Kurang dari 3 menit (indikator PRD 3) |
| T3 | Lihat berapa jatah Rahmat di kapal Bahari 2 | Tanpa bantuan |
| T4 | Lihat sisa hasil per tandan bila menjual sekarang | Tanpa bantuan |
| T5 | Sebutkan berapa catatan yang belum terkirim | Tanpa bantuan |

### 4.2 Kuesioner SUS

Setelah semua tugas, peserta mengisi 10 pernyataan berikut dengan skala 1 (sangat tidak setuju) sampai 5 (sangat setuju). Pernyataan diterjemahkan dari System Usability Scale (Brooke, 1996). Untuk peserta yang kesulitan membaca, pemandu membacakan tanpa memberi contoh jawaban.

1. Saya rasa saya akan sering memakai aplikasi ini.
2. Aplikasi ini terlalu rumit.
3. Aplikasi ini mudah dipakai.
4. Saya butuh bantuan orang yang paham teknologi untuk memakai aplikasi ini.
5. Fitur-fitur di aplikasi ini saling terhubung dengan baik.
6. Ada terlalu banyak hal yang tidak konsisten di aplikasi ini.
7. Saya rasa kebanyakan orang bisa cepat belajar memakai aplikasi ini.
8. Aplikasi ini merepotkan untuk dipakai.
9. Saya merasa yakin saat memakai aplikasi ini.
10. Saya harus belajar banyak hal dulu sebelum bisa memakai aplikasi ini.

**Cara menghitung skor:**
- Pernyataan bernomor ganjil: nilai dikurangi 1.
- Pernyataan bernomor genap: 5 dikurangi nilai.
- Jumlahkan kesepuluh hasil, lalu kalikan 2,5. Skor berada di antara 0 dan 100.
- Skor uji adalah rata-rata semua peserta.

**Syarat rilis:** rata-rata di atas 80.

Bila skor 80 atau kurang, catat layar dan tugas yang paling menyulitkan. Perbaikan teks dan tampilan boleh dilakukan dalam versi 1 (PRD 5.3), lalu uji diulang dengan peserta baru.

## 5. Pemeriksaan sebelum produksi

- [ ] Server memakai HTTPS dengan sertifikat sah.
- [ ] Setiap perangkat simpul dan ponsel pengguna memakai kunci layar Android (pengganti enkripsi lokal, `docs/PERUBAHAN_PRD.md` P-01).
- [ ] `SANDAR_DB_PASSWORD` diganti dari nilai bawaan.
- [ ] Basis data produksi diisi dengan `python -m app.seed` tanpa `--demo`. Kode demo seperti `ADMIN001` mudah ditebak dan tidak boleh ada di produksi.
- [ ] PIN Admin pertama sudah diganti.
- [ ] Cadangan harian muncul di folder `cadangan/` dan sudah dicoba dipulihkan sekali ke basis data uji.
- [ ] Nilai awal indikator sudah diukur (PRD 14, tahap persiapan).

## 6. Lembar hasil

| Uji | Tanggal | Perangkat | Penguji | Hasil (lulus/gagal) | Catatan |
| --- | --- | --- | --- | --- | --- |
| 3.1 Pemasangan | | | | | |
| 3.2 Mode pesawat penuh | | | | | waktu buka: … detik; simpan: … detik |
| 3.3 Tutup paksa (10 kali) | | | | | catatan hilang: … |
| 3.4 Daya padam (5 kali) | | | | | catatan hilang: … |
| 3.5 Konflik sinkron | | | | | |
| 3.6 Harga dan sisa hasil | | | | | |
| 3.7 Penyimpanan 14 hari | | | | | |
| 4 Uji kegunaan | | | | | rata-rata SUS: …; waktu T2 rata-rata: … |
