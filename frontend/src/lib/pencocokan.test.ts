import { describe, expect, it } from 'vitest';
import kasus from '../../../shared/kasus_pencocokan.json';
import { bagi, rencana } from './pencocokan';

type KasusBagi = {
  nama: string;
  ruang: number;
  permintaan: { id: string; q: number; dibuat: string }[];
  tetap?: Record<string, number>;
  jatah: Record<string, number>;
};

describe('bagi (kasus bersama dengan server)', () => {
  for (const k of kasus.bagi as unknown as KasusBagi[]) {
    it(k.nama, () => {
      const hasil = bagi(k.ruang, k.permintaan, k.tetap);
      expect(hasil).toEqual(k.jatah);
      for (const p of k.permintaan) {
        expect(hasil[p.id]).toBeGreaterThanOrEqual(0);
        expect(hasil[p.id]).toBeLessThanOrEqual(p.q);
      }
    });
  }
});

describe('rencana', () => {
  for (const k of kasus.rencana) {
    it(k.nama, () => {
      const hasil = rencana(k.keberangkatan, k.catatan);
      const ringkas = Object.fromEntries(
        Object.entries(hasil).map(([kb, baris]) => [kb, Object.fromEntries(baris.map((b) => [b.catatan_id, b.jatah]))]),
      );
      expect(ringkas).toEqual(k.jatah);
    });
  }
});

it('500 permintaan selesai di bawah 1 detik', () => {
  const minta = Array.from({ length: 500 }, (_, i) => ({
    id: `p${i}`,
    q: 10 + (i % 37),
    dibuat: `2026-10-15T08:${String(i % 60).padStart(2, '0')}:00`,
  }));
  const mulai = performance.now();
  const hasil = bagi(3000, minta);
  expect(performance.now() - mulai).toBeLessThan(1000);
  expect(Object.values(hasil).reduce((a, b) => a + b, 0)).toBe(3000);
});
