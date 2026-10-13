/**
 * Syarat rilis PRD 14: tidak ada catatan hilang saat aplikasi ditutup paksa.
 * Proses Chrome dimatikan paksa (tanpa penutupan wajar) tepat setelah "Tersimpan" tampil,
 * lalu dibuka lagi dengan profil yang sama. Ini pendekatan terdekat untuk daya padam yang
 * dapat diuji di komputer; uji daya padam di ponsel tetap dilakukan manual (docs/UJI_RILIS.md).
 */
import { chromium, expect, test, type Browser } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEMO, aktifkan, masuk, tungguServiceWorker } from './bantu';

const PORT_CDP = 9334;

function jalankanChrome(profil: string): ChildProcess {
  const jalur = process.env.SANDAR_CHROME ?? defaultChrome();
  return spawn(jalur, [
    '--headless=new',
    `--remote-debugging-port=${PORT_CDP}`,
    `--user-data-dir=${profil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=360,760',
    'about:blank',
  ]);
}

function defaultChrome(): string {
  if (process.platform === 'win32') return 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  if (process.platform === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return 'google-chrome';
}

async function sambung(): Promise<Browser> {
  for (let i = 0; i < 50; i++) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${PORT_CDP}`);
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error('Chrome tidak dapat disambungkan');
}

test('Catatan tetap ada setelah proses peramban dimatikan paksa', async ({ baseURL }) => {
  const profil = mkdtempSync(join(tmpdir(), 'sandar-profil-'));

  // Putaran 1: catat panen tanpa jaringan, lalu matikan paksa.
  let proses = jalankanChrome(profil);
  let browser = await sambung();
  let page = browser.contexts()[0].pages()[0] ?? (await browser.contexts()[0].newPage());
  await aktifkan(page, DEMO.petani.kode, baseURL!);
  await masuk(page, DEMO.petani.hp);
  await expect(page).toHaveURL(/\/panen$/);
  await tungguServiceWorker(page);

  await browser.contexts()[0].setOffline(true);
  await page.getByRole('link', { name: 'Catat panen' }).click();
  await page.getByLabel('Jumlah tandan').fill('77');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText('Tersimpan')).toBeVisible();
  proses.kill('SIGKILL');
  await new Promise((r) => proses.once('exit', r));

  // Putaran 2: buka lagi dengan profil yang sama. Catatan harus masih ada.
  proses = jalankanChrome(profil);
  browser = await sambung();
  const ctx = browser.contexts()[0];
  page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(`${baseURL}/panen`);
  const kartu = page.locator('a.kartu', { hasText: '77 tandan' });
  await expect(kartu).toBeVisible();
  await expect(kartu.getByText(/Menunggu kirim|Terdaftar/)).toBeVisible();

  // Setelah tersambung, catatan terkirim ke server.
  await expect(kartu.getByText(/Terdaftar|Dapat jatah|Daftar tunggu/)).toBeVisible({ timeout: 20_000 });
  await browser.close();
  proses.kill();
});
