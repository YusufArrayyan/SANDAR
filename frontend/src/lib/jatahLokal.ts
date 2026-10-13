/**
 * Pencocokan Sementara di perangkat (FR-30, FR-32). Memakai data yang ada di perangkat:
 * keberangkatan yang sudah diminta pencocokannya dihitung berurutan agar sisa permintaan
 * ikut ke kapal berikutnya, sama seperti di server.
 */

import { db } from './db';
import { rencana } from './pencocokan';
import type { BarisJatah, Hasil, Keberangkatan, Panen } from './tipe';

const STATUS_JALAN = ['buka', 'penuh', 'berangkat'];

/**
 * Urutan "dibuat lebih awal" memakai waktu terima server (PRD 9), sama seperti server.
 * Catatan yang belum terkirim pasti diterima belakangan, jadi diurutkan sesudahnya.
 */
function kunciUrut(c: Panen): string {
  return c.diterima ?? `~${c.dibuat}`;
}

export async function hasilTerbaru(kbId: string): Promise<{ final?: Hasil; sementara?: Hasil }> {
  const semua = await db.hasil.where('keberangkatan_id').equals(kbId).toArray();
  const pilih = (sifat: Hasil['sifat']) =>
    semua.filter((h) => h.sifat === sifat).sort((a, b) => b.waktu.localeCompare(a.waktu) || b.versi - a.versi)[0];
  return { final: pilih('final'), sementara: pilih('sementara') };
}

export async function hitungSementara(kb: Keberangkatan): Promise<{ ruang: number; baris: BarisJatah[] }> {
  const semuaKb = await db.keberangkatan.toArray();

  // Jatah yang sudah terkunci di keberangkatan lain mengurangi permintaan.
  const terkunci = new Map<string, number>();
  for (const k of semuaKb.filter((k) => k.terkunci && k.status !== 'batal' && k.id !== kb.id)) {
    const { final } = await hasilTerbaru(k.id);
    for (const b of final?.baris ?? []) terkunci.set(b.panen_id, (terkunci.get(b.panen_id) ?? 0) + b.jatah);
  }

  const ikut = semuaKb.filter(
    (k) => STATUS_JALAN.includes(k.status) && !k.terkunci && (k.aktif_cocok || k.id === kb.id),
  );
  const manual = await db.jatahManual.toArray();
  const tetapPer = (kbId: string) =>
    Object.fromEntries(
      manual.filter((m) => m.keberangkatan_id === kbId && m.jumlah !== null).map((m) => [m.panen_id, m.jumlah as number]),
    );

  const panen = (await db.panen.toArray()).filter((c) => c.status !== 'dibatalkan' && c.status !== 'terangkut');
  const hasil = rencana(
    ikut.map((k) => ({
      id: k.id,
      ruang: k.status === 'penuh' ? 0 : k.sisa_ruang,
      tanggal: k.berangkat.slice(0, 10),
      berangkat: k.berangkat,
      tetap: tetapPer(k.id),
    })),
    panen
      .map((c) => ({ id: c.id, q: c.tandan - (terkunci.get(c.id) ?? 0), siap: c.siap_angkut, dibuat: kunciUrut(c) }))
      .filter((c) => c.q > 0),
  );

  const alasan = new Map(manual.filter((m) => m.keberangkatan_id === kb.id).map((m) => [m.panen_id, m.alasan]));
  return {
    ruang: kb.status === 'penuh' ? 0 : kb.sisa_ruang,
    baris: (hasil[kb.id] ?? []).map((b) => ({
      panen_id: b.catatan_id,
      diminta: b.diminta,
      jatah: b.jatah,
      tunggu: b.tunggu,
      alasan_manual: alasan.get(b.catatan_id) ?? null,
    })),
  };
}
