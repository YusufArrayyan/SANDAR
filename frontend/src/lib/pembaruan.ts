import { registerSW } from 'virtual:pwa-register';

/**
 * Memasang versi baru aplikasi tanpa mengganggu pengguna: pembaruan diterapkan saat
 * aplikasi tidak sedang dilihat (pindah aplikasi atau layar mati), sehingga isian
 * formulir yang belum disimpan tidak hilang karena halaman dimuat ulang.
 */
export function daftarkanPembaruan(): void {
  if (!('serviceWorker' in navigator)) return;
  let siap = false;
  const perbarui = registerSW({
    immediate: true,
    onNeedRefresh() {
      siap = true;
      if (document.visibilityState === 'hidden') void perbarui(true);
    },
  });
  document.addEventListener('visibilitychange', () => {
    if (siap && document.visibilityState === 'hidden') void perbarui(true);
  });
}
