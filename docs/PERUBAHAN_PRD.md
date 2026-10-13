# Perubahan terhadap PRD versi 1.0

PRD 5.3 mensyaratkan perubahan di luar perbaikan kesalahan, teks, data awal, dan parameter disetujui tertulis oleh penulis PRD dan Admin, beserta alasan dan dampaknya pada jadwal.

## P-01: Enkripsi data lokal diganti kunci layar perangkat

| | |
| --- | --- |
| Bagian PRD | 11, baris Keamanan: "enkripsi data lokal dengan kunci dari PIN (penting)" |
| Tanggal | 14 Oktober 2026 |
| Disetujui | Penulis PRD |
| Dampak jadwal | Tidak ada |

**Perubahan.** Data lokal tidak dienkripsi oleh aplikasi dengan kunci dari PIN. Sebagai gantinya, setiap perangkat simpul dan ponsel yang dipakai SANDAR wajib memakai kunci layar (PIN, pola, atau sandi Android), sehingga enkripsi penyimpanan bawaan Android aktif.

**Alasan.**

1. PIN SANDAR hanya 4 angka (10.000 kemungkinan). Siapa pun yang memegang salinan data perangkat dapat mencoba semua PIN dalam hitungan menit, sehingga enkripsi dengan kunci dari PIN memberi perlindungan yang lemah.
2. Satu perangkat simpul dipakai beberapa akun dengan PIN berbeda, sementara data desa dan antrean kirim dipakai bersama. Kunci dari satu PIN tidak dapat membuka data untuk akun lain tanpa rancangan kunci tambahan yang menambah risiko data tidak bisa dibuka setelah Admin mengatur ulang PIN.
3. Android 10 ke atas mengenkripsi seluruh penyimpanan aplikasi bila kunci layar aktif, dengan kunci yang dilindungi perangkat keras. Perlindungan ini lebih kuat untuk risiko utama di PRD 15 ("Perangkat simpul mati atau hilang", "Data pribadi petani bocor").

**Mitigasi yang tetap berlaku.** PIN SANDAR disimpan sebagai hash, akses dibatasi per peran di server, data individu petani hanya dikirim ke perangkat desanya, dan Admin dapat menonaktifkan perangkat yang hilang (FR-06).

**Tindak lanjut operasional.**
- Pemeriksaan "kunci layar aktif" masuk daftar sebelum produksi di `docs/UJI_RILIS.md`.
- Pelatihan operator simpul mencakup cara mengatur kunci layar.
- Bila perangkat hilang, Admin segera menonaktifkannya di Kelola, tab Perangkat.
