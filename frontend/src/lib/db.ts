import Dexie, { type Table } from 'dexie';
import type {
  Desa,
  Galat,
  Harga,
  Hasil,
  JatahManual,
  Kapal,
  Keberangkatan,
  Op,
  Panen,
  Pengguna,
  Petani,
} from './tipe';

/**
 * Penyimpanan lokal (IndexedDB melalui Dexie). Antrean kirim (outbox) berada di basis
 * data yang sama sehingga perubahan data dan operasinya tersimpan dalam satu transaksi.
 */
export class SandarDB extends Dexie {
  meta!: Table<{ kunci: string; nilai: unknown }, string>;
  pengguna!: Table<Pengguna, string>;
  desa!: Table<Desa, string>;
  petani!: Table<Petani, string>;
  panen!: Table<Panen, string>;
  kapal!: Table<Kapal, string>;
  keberangkatan!: Table<Keberangkatan, string>;
  hasil!: Table<Hasil, string>;
  harga!: Table<Harga, string>;
  jatahManual!: Table<JatahManual, string>;
  outbox!: Table<Op, number>;
  galat!: Table<Galat, number>;

  constructor(nama = 'sandar') {
    super(nama);
    this.version(1).stores({
      meta: 'kunci',
      pengguna: 'id, hp',
      desa: 'id',
      petani: 'id, desa_id, nama',
      panen: 'id, petani_id, desa_id, status, siap_angkut',
      kapal: 'id, pengelola_id',
      keberangkatan: 'id, kapal_id, berangkat, status',
      hasil: 'id, keberangkatan_id, [keberangkatan_id+sifat]',
      harga: 'id, pasar, tanggal',
      jatahManual: 'id, keberangkatan_id, [keberangkatan_id+panen_id]',
      outbox: '++urut, op_id, baris_id, tabel',
      galat: '++id, waktu',
    });
  }
}

export const db = new SandarDB();

export async function bacaMeta<T>(kunci: string): Promise<T | undefined> {
  return (await db.meta.get(kunci))?.nilai as T | undefined;
}

export async function tulisMeta(kunci: string, nilai: unknown): Promise<void> {
  await db.meta.put({ kunci, nilai });
}

/** Meminta peramban agar data lokal tidak dihapus saat ruang penyimpanan menipis. */
export async function mintaPenyimpananTetap(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* tidak didukung */
  }
}
