/**
 * Aturan pencocokan SANDAR (PRD bagian 7), versi perangkat untuk hasil Sementara.
 * Harus menghasilkan angka yang sama dengan backend/app/pencocokan.py; keduanya diuji
 * dengan shared/kasus_pencocokan.json. Semua hitungan memakai bilangan bulat.
 */

export interface Permintaan {
  id: string;
  q: number;
  dibuat: string;
}

const urutDibuat = (a: { dibuat: string; id: string }, b: { dibuat: string; id: string }) =>
  a.dibuat < b.dibuat ? -1 : a.dibuat > b.dibuat ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function bagi(ruang: number, permintaan: Permintaan[], tetap: Record<string, number> = {}): Record<string, number> {
  const jatah: Record<string, number> = {};
  for (const p of permintaan) jatah[p.id] = 0;
  let sisaRuang = Math.max(0, Math.trunc(ruang));

  for (const p of [...permintaan].sort(urutDibuat)) {
    if (p.id in tetap) {
      const a = Math.max(0, Math.min(Math.trunc(tetap[p.id]), p.q, sisaRuang));
      jatah[p.id] = a;
      sisaRuang -= a;
    }
  }

  const lain = permintaan.filter((p) => !(p.id in tetap) && p.q > 0);
  const total = lain.reduce((s, p) => s + p.q, 0);
  if (total === 0) return jatah;

  if (total <= sisaRuang) {
    for (const p of lain) jatah[p.id] = p.q;
    return jatah;
  }

  const pecahan: { sisa: number; dibuat: string; id: string }[] = [];
  let terbagi = 0;
  for (const p of lain) {
    const kali = sisaRuang * p.q;
    const bawah = Math.floor(kali / total);
    jatah[p.id] = bawah;
    terbagi += bawah;
    pecahan.push({ sisa: kali - bawah * total, dibuat: p.dibuat, id: p.id });
  }
  // Pecahan terbesar dulu; bila sama, catatan yang dibuat lebih awal.
  pecahan.sort((a, b) => b.sisa - a.sisa || urutDibuat(a, b));
  for (const x of pecahan.slice(0, sisaRuang - terbagi)) jatah[x.id] += 1;
  return jatah;
}

export interface KeberangkatanRencana {
  id: string;
  ruang: number;
  tanggal: string;
  berangkat: string;
  tetap?: Record<string, number>;
}

export interface CatatanRencana {
  id: string;
  q: number;
  siap: string;
  dibuat: string;
}

export interface BarisHasil {
  catatan_id: string;
  diminta: number;
  jatah: number;
  tunggu: number;
}

/** Pencocokan beberapa keberangkatan berurutan; sisa permintaan ikut ke kapal berikutnya. */
export function rencana(keberangkatan: KeberangkatanRencana[], catatan: CatatanRencana[]): Record<string, BarisHasil[]> {
  const sisa: Record<string, number> = {};
  for (const c of catatan) sisa[c.id] = c.q;
  const hasil: Record<string, BarisHasil[]> = {};
  const urut = [...keberangkatan].sort((a, b) =>
    a.berangkat < b.berangkat ? -1 : a.berangkat > b.berangkat ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  for (const kb of urut) {
    const minta = catatan
      .filter((c) => sisa[c.id] > 0 && c.siap <= kb.tanggal)
      .map((c) => ({ id: c.id, q: sisa[c.id], dibuat: c.dibuat }));
    const tetap = Object.fromEntries(Object.entries(kb.tetap ?? {}).filter(([k]) => k in sisa));
    const jatah = bagi(kb.ruang, minta, tetap);
    hasil[kb.id] = minta.map((p) => {
      sisa[p.id] -= jatah[p.id];
      return { catatan_id: p.id, diminta: p.q, jatah: jatah[p.id], tunggu: p.q - jatah[p.id] };
    });
  }
  return hasil;
}
