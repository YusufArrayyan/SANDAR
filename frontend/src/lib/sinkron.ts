/**
 * Sinkronisasi tertunda (PRD bagian 9).
 *
 * - Kirim antrean mulai dari yang terlama, paling banyak 50 operasi per kiriman.
 * - Operasi baru dihapus dari antrean setelah server mengonfirmasi (FR-54).
 * - Lalu ambil perubahan dari server sejak kursor terakhir.
 * - Pemicu: jaringan terdeteksi, setiap 15 menit saat aplikasi terbuka, tombol Kirim sekarang.
 * - Gagal karena jaringan: coba lagi dengan jeda bertahap.
 */

import { GalatApi, GalatJaringan, panggil } from './api';
import { bacaMeta, db, tulisMeta } from './db';
import { ambilKeadaan, ubahKeadaan } from './toko';
import type { Hasil, Op, Parameter, Perangkat } from './tipe';
import { sekarangIso } from './waktu';

const MAKS_PER_KIRIMAN = 50;
const SELANG_RUTIN_MS = 15 * 60 * 1000;
const JEDA_AWAL_MS = 30 * 1000;

const TABEL_SINKRON = ['pengguna', 'desa', 'petani', 'panen', 'kapal', 'keberangkatan', 'harga', 'jatahManual'] as const;

interface HasilKirim {
  hasil: { op_id: string; status: 'diterima' | 'ditolak'; pesan: string }[];
  waktu_server: string;
}

interface HasilAmbil {
  kursor: number;
  waktu_server: string;
  parameter: Parameter;
  data: {
    pengguna: unknown[];
    desa: unknown[];
    petani: unknown[];
    panen: unknown[];
    kapal: unknown[];
    keberangkatan: unknown[];
    hasil: Hasil[];
    harga: unknown[];
    jatah_manual: unknown[];
  };
}

let berjalan: Promise<void> | null = null;
let percobaanGagal = 0;
let timerUlang: ReturnType<typeof setTimeout> | undefined;

/** Menandai baris lokal yang tidak lagi punya operasi tertunda. */
async function bersihkanTanda(tabel: string, id: string): Promise<void> {
  const sisa = await db.outbox.where('baris_id').equals(id).count();
  if (sisa > 0) return;
  const t = db.table(tabel);
  const baris = await t.get(id);
  if (baris && baris._tertunda) await t.update(id, { _tertunda: 0 });
}

async function kirimAntrean(): Promise<number> {
  let terkirim = 0;
  for (;;) {
    const kelompok = await db.outbox.orderBy('urut').limit(MAKS_PER_KIRIMAN).toArray();
    if (kelompok.length === 0) return terkirim;

    // Catat waktu percobaan pertama: dipakai indikator "tersinkron dalam 24 jam".
    const kini = sekarangIso();
    await db.transaction('rw', db.outbox, async () => {
      for (const op of kelompok) {
        if (!op.pertama_dicoba) {
          op.pertama_dicoba = kini;
          await db.outbox.update(op.urut!, { pertama_dicoba: kini });
        }
        await db.outbox.update(op.urut!, { percobaan: op.percobaan + 1 });
      }
    });

    const jawab = await panggil<HasilKirim>('/sinkron/kirim', {
      method: 'POST',
      body: {
        ops: kelompok.map((o: Op) => ({
          op_id: o.op_id,
          jenis: o.jenis,
          oleh: o.oleh,
          data: o.data,
          waktu_perangkat: o.waktu_perangkat,
          pertama_dicoba: o.pertama_dicoba,
        })),
      },
    });

    let adaDitolak = false;
    const perOp = new Map(jawab.hasil.map((h) => [h.op_id, h]));
    await db.transaction('rw', [db.outbox, db.galat, ...TABEL_SINKRON.map((t) => db.table(t)), db.hasil], async () => {
      for (const op of kelompok) {
        const h = perOp.get(op.op_id);
        if (!h) continue;
        await db.outbox.delete(op.urut!);
        if (h.status === 'ditolak') {
          adaDitolak = true;
          await db.galat.add({ waktu: sekarangIso(), jenis: op.jenis, pesan: h.pesan, baris_id: op.baris_id });
          const t = db.table(op.tabel);
          if (await t.get(op.baris_id)) await t.update(op.baris_id, { _ditolak: h.pesan });
        }
        await bersihkanTanda(op.tabel, op.baris_id);
      }
    });
    // Ada operasi ditolak: ambil ulang semua data agar nilai lokal kembali sama dengan server.
    if (adaDitolak) await tulisMeta('kursor', 0);
    terkirim += kelompok.length;
    if (kelompok.length < MAKS_PER_KIRIMAN) return terkirim;
  }
}

async function ambilPerubahan(): Promise<number> {
  const sejak = (await bacaMeta<number>('kursor')) ?? 0;
  const mulai = Date.now();
  const r = await panggil<HasilAmbil>(`/sinkron/ambil?sejak=${sejak}`);
  const selesai = Date.now();

  // Selisih jam perangkat dengan server (PRD 9: jam perangkat).
  const tengah = (mulai + selesai) / 2;
  const selisihMenit = Math.round((tengah - Date.parse(r.waktu_server)) / 60000);

  const peta: Record<(typeof TABEL_SINKRON)[number], unknown[]> = {
    pengguna: r.data.pengguna,
    desa: r.data.desa,
    petani: r.data.petani,
    panen: r.data.panen,
    kapal: r.data.kapal,
    keberangkatan: r.data.keberangkatan,
    harga: r.data.harga,
    jatahManual: r.data.jatah_manual,
  };

  const jatahBerubah: string[] = (await bacaMeta<string[]>('jatahBerubah')) ?? [];
  await db.transaction('rw', [db.meta, db.outbox, db.hasil, ...TABEL_SINKRON.map((t) => db.table(t))], async () => {
    for (const nama of TABEL_SINKRON) {
      const t = db.table(nama);
      for (const baris of peta[nama] as { id: string }[]) {
        // Baris yang masih punya operasi tertunda tidak ditimpa; server akan memutuskan.
        const tertunda = await db.outbox.where('baris_id').equals(baris.id).count();
        if (tertunda > 0) continue;
        await t.put({ ...baris, _tertunda: 0 });
      }
    }
    for (const h of r.data.hasil) {
      const sementara = await db.hasil
        .where('[keberangkatan_id+sifat]')
        .equals([h.keberangkatan_id, 'sementara'])
        .sortBy('waktu');
      const akhir = sementara[sementara.length - 1];
      if (akhir) {
        const jatahSementara = new Map(akhir.baris.map((b) => [b.panen_id, b.jatah]));
        const beda = h.baris.some((b) => jatahSementara.has(b.panen_id) && jatahSementara.get(b.panen_id) !== b.jatah);
        if (beda && !jatahBerubah.includes(h.keberangkatan_id)) jatahBerubah.push(h.keberangkatan_id);
      }
      await db.hasil.put(h);
    }
    await tulisMeta('jatahBerubah', jatahBerubah);
    await tulisMeta('kursor', r.kursor);
    await tulisMeta('parameter', r.parameter);
    await tulisMeta('selisihJamMenit', selisihMenit);
    await tulisMeta('hargaBaruDiterima', r.data.harga.length);
  });

  // Akun dinonaktifkan Admin: keluar pada sinkron berikutnya (FR-06).
  const k = ambilKeadaan();
  if (k.pengguna) {
    const terbaru = await db.pengguna.get(k.pengguna.id);
    if (!terbaru || !terbaru.aktif) {
      await tulisMeta('sesi', null);
      ubahKeadaan({ pengguna: null });
    } else {
      ubahKeadaan({ pengguna: terbaru });
    }
  }
  return r.data.harga.length;
}

async function jalankan(): Promise<void> {
  const perangkat = await bacaMeta<Perangkat>('perangkat');
  if (!perangkat) return;
  ubahKeadaan({ mengirim: true });
  try {
    await kirimAntrean();
    await ambilPerubahan();
    await tulisMeta('terakhirSinkron', sekarangIso());
    percobaanGagal = 0;
    ubahKeadaan({ online: true, galatTerakhir: null });
  } catch (e) {
    if (e instanceof GalatApi && (e.status === 401 || e.status === 403)) {
      ubahKeadaan({ diblokir: e.message, galatTerakhir: e.message });
    } else if (e instanceof GalatJaringan) {
      percobaanGagal += 1;
      ubahKeadaan({ online: false, galatTerakhir: e.message });
      jadwalkanUlang();
    } else {
      percobaanGagal += 1;
      ubahKeadaan({ galatTerakhir: e instanceof Error ? e.message : String(e) });
      jadwalkanUlang();
    }
  } finally {
    ubahKeadaan({ mengirim: false });
  }
}

function jadwalkanUlang(): void {
  clearTimeout(timerUlang);
  const jeda = Math.min(SELANG_RUTIN_MS, JEDA_AWAL_MS * 2 ** Math.max(0, percobaanGagal - 1));
  timerUlang = setTimeout(() => void sinkronkan(), jeda);
}

/** Menjalankan satu putaran sinkron. Panggilan bersamaan digabung menjadi satu. */
export function sinkronkan(): Promise<void> {
  if (!berjalan) {
    berjalan = jalankan().finally(() => {
      berjalan = null;
    });
  }
  return berjalan;
}

let timerTulis: ReturnType<typeof setTimeout> | undefined;

/** Dipanggil setelah data baru disimpan: kirim segera bila sedang ada sinyal. */
export function picuSetelahSimpan(): void {
  if (!navigator.onLine) return;
  clearTimeout(timerTulis);
  timerTulis = setTimeout(() => void sinkronkan(), 1500);
}

let sudahMulai = false;

export function mulaiSinkronOtomatis(): void {
  if (sudahMulai) return;
  sudahMulai = true;
  window.addEventListener('online', () => {
    ubahKeadaan({ online: true, jaringan: true });
    percobaanGagal = 0;
    void sinkronkan();
  });
  window.addEventListener('offline', () => ubahKeadaan({ online: false, jaringan: false }));
  setInterval(() => void sinkronkan(), SELANG_RUTIN_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) void sinkronkan();
  });
  if (navigator.onLine) void sinkronkan();
}
