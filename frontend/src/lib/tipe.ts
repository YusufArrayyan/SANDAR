export type Peran = 'petani' | 'simpul' | 'kapal' | 'mitra' | 'admin';
export type StatusPanen = 'terdaftar' | 'dapat_jatah' | 'daftar_tunggu' | 'terangkut' | 'dibatalkan';
export type StatusKeberangkatan = 'buka' | 'penuh' | 'berangkat' | 'batal';
export type JenisKapal = 'feri' | 'perintis' | 'nelayan';

/** Penanda baris lokal yang masih punya operasi di antrean kirim. */
export interface Lokal {
  _tertunda?: 0 | 1;
  _ditolak?: string;
}

export interface Pengguna {
  id: string;
  nama: string;
  hp: string;
  peran: Peran;
  desa_id: string | null;
  petani_id: string | null;
  aktif: boolean;
  pin_hash: string;
}

export interface Desa {
  id: string;
  nama: string;
  kode: string;
  jumlah_petani_pisang: number;
  biaya_tebang: number;
}

export interface Petani extends Lokal {
  id: string;
  nama: string;
  desa_id: string;
  kelompok: string;
  hp: string;
}

export interface Panen extends Lokal {
  id: string;
  petani_id: string;
  desa_id: string;
  komoditas: string;
  tandan: number;
  siap_angkut: string;
  status: StatusPanen;
  jatah: number;
  tunggu: number;
  harga_terima: number | null;
  terangkut_kb_id: string | null;
  terangkut_tanggal: string | null;
  induk_id: string | null;
  dibuat_oleh: string;
  dibuat: string;
  /** Waktu terima server; kosong selama catatan belum terkirim. */
  diterima?: string | null;
  versi: number;
}

export interface Kapal {
  id: string;
  nama: string;
  jenis: JenisKapal;
  pengelola_id: string | null;
  aktif: boolean;
}

export interface Keberangkatan extends Lokal {
  id: string;
  kapal_id: string;
  asal: string;
  tujuan: string;
  berangkat: string;
  sisa_ruang: number;
  tarif: number;
  status: StatusKeberangkatan;
  aktif_cocok: boolean;
  terkunci: boolean;
  dibuat_oleh: string;
  versi: number;
}

export interface BarisJatah {
  panen_id: string;
  diminta: number;
  jatah: number;
  tunggu: number;
  alasan_manual?: string | null;
}

export interface Hasil {
  id: string;
  keberangkatan_id: string;
  versi: number;
  sifat: 'sementara' | 'final';
  dibuat_di: 'perangkat' | 'server';
  ruang: number;
  diminta: number;
  terkunci: boolean;
  waktu: string;
  baris: BarisJatah[];
}

export interface Harga {
  id: string;
  pasar: string;
  tanggal: string;
  harga: number;
  waktu: string;
}

export interface JatahManual extends Lokal {
  id: string;
  keberangkatan_id: string;
  panen_id: string;
  jumlah: number | null;
  alasan: string;
  oleh: string;
  waktu: string;
}

export type JenisOp =
  | 'petani.simpan'
  | 'panen.catat'
  | 'panen.ubah'
  | 'panen.batal'
  | 'panen.terangkut'
  | 'keberangkatan.catat'
  | 'keberangkatan.ubah'
  | 'hasil.sementara'
  | 'jatah.manual'
  | 'desa.biaya'
  | 'pengguna.pin';

export interface Op {
  urut?: number;
  op_id: string;
  jenis: JenisOp;
  oleh: string;
  data: Record<string, unknown>;
  waktu_perangkat: string;
  pertama_dicoba?: string;
  percobaan: number;
  /** Tabel dan id baris lokal yang diubah operasi ini. */
  tabel: string;
  baris_id: string;
}

export interface Galat {
  id?: number;
  waktu: string;
  jenis: JenisOp;
  pesan: string;
  baris_id: string;
}

export interface Perangkat {
  token: string;
  id: string;
  desa_id: string | null;
  pengguna_id: string | null;
}

export interface Parameter {
  batas_harga_lama_hari: number;
  jam_batas_cocok: number;
  pin_maks_salah: number;
  pin_kunci_menit: number;
  selisih_jam_menit: number;
}

export const PARAMETER_AWAL: Parameter = {
  batas_harga_lama_hari: 7,
  jam_batas_cocok: 18,
  pin_maks_salah: 5,
  pin_kunci_menit: 5,
  selisih_jam_menit: 10,
};
