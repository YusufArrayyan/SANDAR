/**
 * Semua perubahan data oleh pengguna. Tulis lebih dulu (PRD 9): baris lokal dan operasinya
 * disimpan dalam satu transaksi IndexedDB. "Tersimpan" baru ditampilkan setelah transaksi
 * selesai, sehingga data tidak hilang walau aplikasi ditutup paksa atau daya padam.
 */

import { db } from './db';
import { buatId } from './id';
import { hashPin } from './pin';
import { picuSetelahSimpan } from './sinkron';
import { ambilKeadaan, ubahKeadaan } from './toko';
import type { Hasil, JenisOp, Keberangkatan, Panen, Pengguna, Petani, StatusKeberangkatan } from './tipe';
import { sekarangIso } from './waktu';

function penggunaAktif(): Pengguna {
  const u = ambilKeadaan().pengguna;
  if (!u) throw new Error('Sesi berakhir. Silakan masuk lagi.');
  return u;
}

async function antre(jenis: JenisOp, tabel: string, baris_id: string, data: Record<string, unknown>): Promise<void> {
  await db.outbox.add({
    op_id: buatId(),
    jenis,
    oleh: penggunaAktif().id,
    data,
    waktu_perangkat: sekarangIso(),
    percobaan: 0,
    tabel,
    baris_id,
  });
}

async function selesai(): Promise<void> {
  picuSetelahSimpan();
}

// --- Petani ------------------------------------------------------------------

export async function tambahPetani(isi: { nama: string; kelompok: string; hp: string }): Promise<Petani> {
  const u = penggunaAktif();
  if (!u.desa_id) throw new Error('Akun Anda tidak terhubung ke desa.');
  const p: Petani = { id: buatId(), desa_id: u.desa_id, ...isi, _tertunda: 1 };
  await db.transaction('rw', db.petani, db.outbox, async () => {
    await db.petani.add(p);
    await antre('petani.simpan', 'petani', p.id, { id: p.id, nama: p.nama, desa_id: p.desa_id, kelompok: p.kelompok, hp: p.hp });
  });
  await selesai();
  return p;
}

// --- Panen -------------------------------------------------------------------

export interface IsiPanen {
  petani_id: string;
  komoditas: string;
  tandan: number;
  siap_angkut: string;
}

export async function catatPanen(isi: IsiPanen): Promise<Panen> {
  const u = penggunaAktif();
  const petani = await db.petani.get(isi.petani_id);
  if (!petani) throw new Error('Petani tidak ditemukan.');
  const c: Panen = {
    id: buatId(),
    desa_id: petani.desa_id,
    ...isi,
    status: 'terdaftar',
    jatah: 0,
    tunggu: 0,
    harga_terima: null,
    terangkut_kb_id: null,
    terangkut_tanggal: null,
    induk_id: null,
    dibuat_oleh: u.id,
    dibuat: sekarangIso(),
    diterima: null,
    versi: 1,
    _tertunda: 1,
  };
  await db.transaction('rw', db.panen, db.outbox, async () => {
    await db.panen.add(c);
    await antre('panen.catat', 'panen', c.id, { id: c.id, ...isi, dibuat: c.dibuat });
  });
  await selesai();
  return c;
}

export async function ubahPanen(id: string, isi: Partial<IsiPanen>): Promise<void> {
  await db.transaction('rw', db.panen, db.outbox, async () => {
    const c = await db.panen.get(id);
    if (!c) throw new Error('Catatan tidak ditemukan.');
    await db.panen.update(id, { ...isi, versi: c.versi + 1, _tertunda: 1 });
    await antre('panen.ubah', 'panen', id, { id, versi_dasar: c.versi, ...isi });
  });
  await selesai();
}

export async function batalkanPanen(id: string): Promise<void> {
  await db.transaction('rw', db.panen, db.outbox, async () => {
    const c = await db.panen.get(id);
    if (!c) throw new Error('Catatan tidak ditemukan.');
    await db.panen.update(id, { status: 'dibatalkan', versi: c.versi + 1, _tertunda: 1 });
    await antre('panen.batal', 'panen', id, { id, versi_dasar: c.versi });
  });
  await selesai();
}

/** FR-15. Bila jatah kurang dari tandan, sisa menjadi catatan baru yang tetap menunggu. */
export async function tandaiTerangkut(id: string, keberangkatanId: string, jumlahJatah: number, hargaTerima: number | null): Promise<void> {
  const sisaId = buatId();
  const kb = await db.keberangkatan.get(keberangkatanId);
  await db.transaction('rw', db.panen, db.outbox, async () => {
    const c = await db.panen.get(id);
    if (!c) throw new Error('Catatan tidak ditemukan.');
    const jumlah = jumlahJatah > 0 && jumlahJatah < c.tandan ? jumlahJatah : c.tandan;
    if (jumlah < c.tandan) {
      await db.panen.add({
        ...c,
        id: sisaId,
        tandan: c.tandan - jumlah,
        status: 'daftar_tunggu',
        jatah: 0,
        tunggu: c.tandan - jumlah,
        induk_id: c.id,
        versi: 1,
        _tertunda: 1,
      });
    }
    await db.panen.update(id, {
      tandan: jumlah,
      status: 'terangkut',
      jatah: jumlah,
      tunggu: 0,
      harga_terima: hargaTerima,
      terangkut_kb_id: keberangkatanId,
      terangkut_tanggal: kb?.berangkat.slice(0, 10) ?? null,
      versi: c.versi + 1,
      _tertunda: 1,
    });
    await antre('panen.terangkut', 'panen', id, {
      id,
      versi_dasar: c.versi,
      keberangkatan_id: keberangkatanId,
      harga_terima: hargaTerima,
      sisa_id: sisaId,
    });
  });
  await selesai();
}

// --- Keberangkatan ----------------------------------------------------------

export interface IsiKeberangkatan {
  kapal_id: string;
  asal: string;
  tujuan: string;
  berangkat: string;
  sisa_ruang: number;
  tarif: number;
}

export async function catatKeberangkatan(isi: IsiKeberangkatan): Promise<void> {
  const u = penggunaAktif();
  const kb: Keberangkatan = {
    id: buatId(),
    ...isi,
    status: isi.sisa_ruang === 0 ? 'penuh' : 'buka',
    aktif_cocok: false,
    terkunci: false,
    dibuat_oleh: u.id,
    versi: 1,
    _tertunda: 1,
  };
  await db.transaction('rw', db.keberangkatan, db.outbox, async () => {
    await db.keberangkatan.add(kb);
    await antre('keberangkatan.catat', 'keberangkatan', kb.id, { id: kb.id, ...isi });
  });
  await selesai();
}

export async function ubahKeberangkatan(
  id: string,
  isi: Partial<{ sisa_ruang: number; tarif: number; berangkat: string; status: StatusKeberangkatan }>,
): Promise<void> {
  await db.transaction('rw', db.keberangkatan, db.outbox, async () => {
    const kb = await db.keberangkatan.get(id);
    if (!kb) throw new Error('Keberangkatan tidak ditemukan.');
    await db.keberangkatan.update(id, { ...isi, versi: kb.versi + 1, _tertunda: 1 });
    await antre('keberangkatan.ubah', 'keberangkatan', id, { id, versi_dasar: kb.versi, ...isi });
  });
  await selesai();
}

// --- Pencocokan --------------------------------------------------------------

export async function simpanHasilSementara(h: Omit<Hasil, 'id' | 'versi' | 'waktu' | 'sifat' | 'dibuat_di' | 'terkunci'>): Promise<Hasil> {
  const versi = (await db.hasil.where('keberangkatan_id').equals(h.keberangkatan_id).count()) + 1;
  const hasil: Hasil = {
    ...h,
    id: buatId(),
    versi,
    sifat: 'sementara',
    dibuat_di: 'perangkat',
    terkunci: false,
    waktu: sekarangIso(),
  };
  await db.transaction('rw', db.hasil, db.outbox, db.meta, async () => {
    await db.hasil.add(hasil);
    await antre('hasil.sementara', 'hasil', hasil.id, {
      id: hasil.id,
      keberangkatan_id: h.keberangkatan_id,
      versi,
      ruang: h.ruang,
      baris: h.baris.map((b) => ({ panen_id: b.panen_id, diminta: b.diminta, jatah: b.jatah })),
    });
    const berubah = ((await db.meta.get('jatahBerubah'))?.nilai as string[] | undefined) ?? [];
    await db.meta.put({ kunci: 'jatahBerubah', nilai: berubah.filter((x) => x !== h.keberangkatan_id) });
  });
  await selesai();
  return hasil;
}

export async function sesuaikanJatah(keberangkatanId: string, panenId: string, jumlah: number | null, alasan: string): Promise<void> {
  const u = penggunaAktif();
  await db.transaction('rw', db.jatahManual, db.outbox, async () => {
    const lama = await db.jatahManual.where('[keberangkatan_id+panen_id]').equals([keberangkatanId, panenId]).first();
    const id = lama?.id ?? buatId();
    await db.jatahManual.put({
      id,
      keberangkatan_id: keberangkatanId,
      panen_id: panenId,
      jumlah,
      alasan,
      oleh: u.id,
      waktu: sekarangIso(),
      _tertunda: 1,
    });
    await antre('jatah.manual', 'jatahManual', id, { id, keberangkatan_id: keberangkatanId, panen_id: panenId, jumlah, alasan });
  });
  await selesai();
}

// --- Desa dan akun -----------------------------------------------------------

export async function ubahBiayaTebang(desaId: string, biaya: number): Promise<void> {
  await db.transaction('rw', db.desa, db.outbox, async () => {
    await db.desa.update(desaId, { biaya_tebang: biaya });
    await antre('desa.biaya', 'desa', desaId, { desa_id: desaId, biaya_tebang: biaya });
  });
  await selesai();
}

export async function gantiPin(pinBaru: string): Promise<void> {
  const u = penggunaAktif();
  const pin_hash = await hashPin(pinBaru);
  await db.transaction('rw', db.pengguna, db.outbox, async () => {
    await db.pengguna.update(u.id, { pin_hash });
    await antre('pengguna.pin', 'pengguna', u.id, { pin_hash });
  });
  ubahKeadaan({ pengguna: { ...u, pin_hash } });
  await selesai();
}
