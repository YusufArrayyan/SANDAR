import { expect, type Page } from '@playwright/test';

/** Kode aktivasi dan akun dari `python -m app.seed --demo` (data contoh, PIN 1234). */
export const DEMO = {
  simpulMeok: { kode: 'MEOK2026', hp: '081234567890' },
  simpulBanjar: { kode: 'BANJAR26', hp: '081234567891' },
  petani: { kode: 'PETANI01', hp: '081255500001' },
  kapal: { kode: 'KAPAL001', hp: '081300000001' },
  kapalFeri: { kode: 'KAPAL002', hp: '081300000002' },
  mitra: { kode: 'MITRA001', hp: '081400000001' },
  admin: { kode: 'ADMIN001', hp: '0811000000' },
} as const;

export const PIN = '1234';

export async function aktifkan(p: Page, kode: string, alamat = '/'): Promise<void> {
  await p.goto(alamat);
  await p.getByLabel('Kode aktivasi perangkat').fill(kode);
  await p.getByRole('button', { name: 'Aktifkan perangkat' }).click();
  await expect(p.getByLabel('Nomor HP')).toBeVisible();
}

export async function masuk(p: Page, hp: string, pin = PIN): Promise<void> {
  await p.getByLabel('Nomor HP').fill(hp);
  await p.getByLabel('PIN (4 angka)').fill(pin);
}

/** Menunggu service worker aktif agar aplikasi bisa dibuka tanpa jaringan. */
export async function tungguServiceWorker(p: Page): Promise<void> {
  await p.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 15_000 });
}

export function chip(p: Page) {
  return p.locator('header .chip');
}
