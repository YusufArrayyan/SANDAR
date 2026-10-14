import { GalatApi, panggil } from './api';
import { bacaMeta, db, mintaPenyimpananTetap, tulisMeta } from './db';
import { cekPin } from './pin';
import { mulaiSinkronOtomatis, sinkronkan } from './sinkron';
import { ambilKeadaan, ubahKeadaan } from './toko';
import { PARAMETER_AWAL, type Parameter, type Perangkat, type Peran } from './tipe';

export async function muatAwal(): Promise<void> {
  const perangkat = (await bacaMeta<Perangkat>('perangkat')) ?? null;
  const sesi = await bacaMeta<{ pengguna_id: string } | null>('sesi');
  const pengguna = sesi ? ((await db.pengguna.get(sesi.pengguna_id)) ?? null) : null;
  ubahKeadaan({ siap: true, perangkat, pengguna: pengguna?.aktif ? pengguna : null });
  void mintaPenyimpananTetap();
  if (perangkat) mulaiSinkronOtomatis();
}

/** FR-01: aktivasi satu kali. Butuh sinyal; setelah ini aplikasi dapat dibuka tanpa sinyal. */
export async function aktifkanPerangkat(kode: string): Promise<void> {
  const r = await panggil<{ token: string; perangkat: Omit<Perangkat, 'token'> }>('/auth/aktivasi', {
    method: 'POST',
    body: { kode: kode.trim().toUpperCase(), nama_perangkat: navigator.userAgent.slice(0, 80) },
  });
  const perangkat: Perangkat = { token: r.token, ...r.perangkat };
  // Perangkat baru: buang sisa data dari aktivasi sebelumnya, kecuali antrean yang belum terkirim.
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      if (t.name !== 'outbox' && t.name !== 'galat') await t.clear();
    }
    await tulisMeta('perangkat', perangkat);
  });
  // Ambil daftar akun lebih dulu; layar Masuk baru tampil setelah data akun ada di perangkat.
  await sinkronkan();
  ubahKeadaan({ perangkat, diblokir: null });
  mulaiSinkronOtomatis();
  const galat = ambilKeadaan().galatTerakhir;
  if (galat) throw new Error(galat);
}

export async function parameter(): Promise<Parameter> {
  return { ...PARAMETER_AWAL, ...((await bacaMeta<Partial<Parameter>>('parameter')) ?? {}) };
}

export type HasilMasuk = { ok: true } | { ok: false; pesan: string };

function normalHp(hp: string): string {
  return hp.replace(/[^0-9+]/g, '');
}

/** FR-02 dan FR-05: PIN diperiksa di perangkat; salah berulang mengunci sementara. */
export async function masuk(hp: string, pin: string): Promise<HasilMasuk> {
  const p = await parameter();
  const kunci = (await bacaMeta<{ gagal: number; sampai: number }>('pinGagal')) ?? { gagal: 0, sampai: 0 };
  if (kunci.sampai > Date.now()) {
    const menit = Math.ceil((kunci.sampai - Date.now()) / 60000);
    return { ok: false, pesan: `PIN salah terlalu sering. Coba lagi dalam ${menit} menit.` };
  }
  if ((await db.pengguna.count()) === 0) {
    return { ok: false, pesan: 'Daftar akun belum diterima perangkat ini. Sambungkan ke sinyal sebentar lalu coba lagi.' };
  }
  const u = await db.pengguna.where('hp').equals(normalHp(hp)).first();
  if (!u || !(await cekPin(pin, u.pin_hash))) {
    const gagal = kunci.gagal + 1;
    if (gagal >= p.pin_maks_salah) {
      await tulisMeta('pinGagal', { gagal: 0, sampai: Date.now() + p.pin_kunci_menit * 60000 });
      return { ok: false, pesan: `PIN salah ${gagal} kali. Masuk dikunci ${p.pin_kunci_menit} menit.` };
    }
    await tulisMeta('pinGagal', { gagal, sampai: 0 });
    const sisa = p.pin_maks_salah - gagal;
    return { ok: false, pesan: `Nomor HP atau PIN salah. Sisa ${sisa} kali percobaan.` };
  }
  if (!u.aktif) return { ok: false, pesan: 'Akun ini dinonaktifkan Admin. Hubungi Admin.' };
  await tulisMeta('pinGagal', { gagal: 0, sampai: 0 });
  await tulisMeta('sesi', { pengguna_id: u.id, masuk_pada: new Date().toISOString() });
  ubahKeadaan({ pengguna: u });
  return { ok: true };
}

/**
 * Melepas aktivasi perangkat ini agar dapat diaktifkan dengan kode lain (misalnya berganti
 * peran saat demo, atau ponsel berpindah tangan). Hanya boleh bila tidak ada catatan yang
 * belum terkirim, supaya tidak ada data yang hilang.
 */
export async function lepasPerangkat(): Promise<void> {
  if ((await db.outbox.count()) > 0) {
    throw new Error('Masih ada catatan yang belum terkirim. Kirim dulu dari layar Sinkronisasi.');
  }
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
  ubahKeadaan({ perangkat: null, pengguna: null, diblokir: null });
}

export async function keluar(): Promise<void> {
  await tulisMeta('sesi', null);
  ubahKeadaan({ pengguna: null });
}

/** FR-04: layar awal sesuai peran. */
export function layarAwal(peran: Peran): string {
  switch (peran) {
    case 'petani':
    case 'simpul':
      return '/panen';
    case 'kapal':
      return '/ruang-muat';
    case 'mitra':
      return '/harga/input';
    case 'admin':
      return '/kelola';
  }
}

export function apakahGalatPerangkat(e: unknown): boolean {
  return e instanceof GalatApi && (e.status === 401 || e.status === 403);
}
