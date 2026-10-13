import { useSyncExternalStore } from 'react';
import type { Pengguna, Perangkat } from './tipe';

/** Keadaan aplikasi yang bukan data catatan (data catatan dibaca langsung dari Dexie). */
export interface Keadaan {
  siap: boolean;
  perangkat: Perangkat | null;
  pengguna: Pengguna | null;
  /** Server terakhir kali terjangkau. */
  online: boolean;
  /** Perangkat punya jaringan menurut peramban (navigator.onLine). */
  jaringan: boolean;
  mengirim: boolean;
  /** Pesan bila perangkat dinonaktifkan Admin atau tokennya tidak berlaku lagi. */
  diblokir: string | null;
  galatTerakhir: string | null;
  pesan: { teks: string; jenis: 'berhasil' | 'galat' } | null;
}

let keadaan: Keadaan = {
  siap: false,
  perangkat: null,
  pengguna: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  jaringan: typeof navigator === 'undefined' ? true : navigator.onLine,
  mengirim: false,
  diblokir: null,
  galatTerakhir: null,
  pesan: null,
};

const pendengar = new Set<() => void>();

export function ambilKeadaan(): Keadaan {
  return keadaan;
}

export function ubahKeadaan(sebagian: Partial<Keadaan>): void {
  keadaan = { ...keadaan, ...sebagian };
  pendengar.forEach((f) => f());
}

export function useKeadaan<T>(pilih: (k: Keadaan) => T): T {
  return useSyncExternalStore(
    (f) => {
      pendengar.add(f);
      return () => pendengar.delete(f);
    },
    () => pilih(keadaan),
  );
}

let timerPesan: ReturnType<typeof setTimeout> | undefined;

export function tampilkanPesan(teks: string, jenis: 'berhasil' | 'galat' = 'berhasil'): void {
  ubahKeadaan({ pesan: { teks, jenis } });
  clearTimeout(timerPesan);
  timerPesan = setTimeout(() => ubahKeadaan({ pesan: null }), jenis === 'galat' ? 6000 : 3000);
}
