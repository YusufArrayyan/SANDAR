/**
 * Syarat siap rilis versi 1.0 (PRD 14) yang dapat diuji otomatis di peramban.
 * Tes berjalan berurutan pada satu server dengan data contoh baru; setiap tes memakai
 * kode aktivasi sendiri karena kode hanya dapat dipakai sekali.
 */
import { expect, test } from '@playwright/test';
import { DEMO, aktifkan, chip, masuk, tungguServiceWorker } from './bantu';

test.describe.configure({ mode: 'serial' });

test('FR-01, FR-02, FR-04: aktivasi, masuk dengan PIN, layar awal sesuai peran', async ({ page }) => {
  await aktifkan(page, DEMO.kapal.kode);
  await masuk(page, DEMO.kapal.hp);
  await expect(page).toHaveURL(/\/ruang-muat$/);
  await expect(page.getByRole('heading', { name: 'Ruang Muat' })).toBeVisible();
  await expect(page.getByText('Kapal nelayan Bahari 2').first()).toBeVisible();
});

test('FR-05: PIN salah lima kali mengunci masuk', async ({ page }) => {
  await aktifkan(page, DEMO.kapalFeri.kode);
  for (let i = 1; i <= 4; i++) {
    await masuk(page, DEMO.kapalFeri.hp, '9999');
    await expect(page.getByText(`Sisa ${5 - i} kali percobaan`)).toBeVisible();
  }
  await masuk(page, DEMO.kapalFeri.hp, '9999');
  await expect(page.getByText('Masuk dikunci 5 menit')).toBeVisible();
  // PIN benar pun ditolak selama terkunci.
  await masuk(page, DEMO.kapalFeri.hp);
  await expect(page.getByText(/PIN salah terlalu sering/)).toBeVisible();
  await expect(page).toHaveURL(/\/masuk$/);
});

test('PRD 7.2: pencocokan di perangkat dan di server menghasilkan 75, 94, 131', async ({ page }) => {
  await aktifkan(page, DEMO.simpulMeok.kode);
  await masuk(page, DEMO.simpulMeok.hp);
  await expect(page).toHaveURL(/\/panen$/);
  await page.getByRole('link', { name: 'Jatah' }).click();
  await page.getByRole('button', { name: /Kapal nelayan Bahari 2/ }).click();
  await page.getByRole('button', { name: 'Jalankan pencocokan' }).click();

  const daftar = page.locator('.rincian');
  await expect(page.getByText('Dibagi 62,5% per petani')).toBeVisible();
  for (const [nama, diminta, jatah] of [
    ['Rahmat', 120, 75],
    ['Siti', 150, 94],
    ['Yanto', 210, 131],
  ] as const) {
    await expect(daftar.getByText(nama)).toBeVisible();
    await expect(daftar.getByText(`diminta ${diminta} · jatah ${jatah}`)).toBeVisible();
  }
  // Setelah terkirim, hasil Final dari server tampil dengan angka yang sama.
  await expect(page.locator('.kartu .lencana', { hasText: 'Final' })).toBeVisible({ timeout: 15_000 });
  await expect(daftar.getByText('diminta 150 · jatah 94')).toBeVisible();
  await expect(page.getByText('Jatah berubah')).toHaveCount(0);
});

test('Mode pesawat penuh: catat, muat ulang, lalu terkirim saat jaringan kembali', async ({ page, context }) => {
  await aktifkan(page, DEMO.simpulBanjar.kode);
  await masuk(page, DEMO.simpulBanjar.hp);
  await expect(page).toHaveURL(/\/panen$/);
  await tungguServiceWorker(page);

  await context.setOffline(true);
  await page.getByRole('link', { name: 'Catat panen' }).click();
  await page.getByLabel('Petani').selectOption({ label: 'Dewi (Pisang Jaya)' });
  await page.getByLabel('Jumlah tandan').fill('44');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText('Tersimpan')).toBeVisible();

  const kartu = page.locator('a.kartu', { hasText: '44 tandan' });
  await expect(kartu.getByText('Menunggu kirim')).toBeVisible();
  await expect(chip(page)).toContainText('Luring');

  // Aplikasi dibuka ulang tanpa jaringan: dilayani service worker, data tetap ada.
  await page.reload();
  await expect(kartu.getByText('Menunggu kirim')).toBeVisible();
  await page.getByRole('link', { name: 'Ruang Muat' }).click();
  await expect(page.getByText('Feri perintis').first()).toBeVisible();
  await page.getByRole('link', { name: 'Harga' }).click();
  await expect(page.getByText('Rp60.000').first()).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByRole('link', { name: 'Panen' }).click();
  // Terkirim: status berasal dari server (bisa langsung dapat jatah bila kapal sudah dicocokkan).
  await expect(kartu.getByText(/Terdaftar|Dapat jatah|Daftar tunggu/)).toBeVisible({ timeout: 15_000 });
  await expect(kartu.getByText('Menunggu kirim')).toHaveCount(0);
  await expect(chip(page)).toContainText('Tersambung');
  await expect(chip(page)).not.toContainText('menunggu');
});

test('FR-40 dan FR-41: harga dari Mitra pasar diterima perangkat', async ({ page }) => {
  await aktifkan(page, DEMO.mitra.kode);
  await masuk(page, DEMO.mitra.hp);
  await expect(page).toHaveURL(/\/harga\/input$/);
  await page.getByLabel('Harga per tandan (Rp)').fill('63500');
  await page.getByRole('button', { name: 'Simpan harga' }).click();
  await expect(page.getByText('Harga tersimpan dan terkirim')).toBeVisible();
  await page.getByRole('link', { name: 'Harga', exact: true }).click();
  await expect(page.locator('.angka-besar')).toContainText('Rp63.500');
  await expect(page.getByText('Ini bukan jaminan harga beli.')).toBeVisible();

  // Berganti peran: lepas aktivasi lalu kembali ke layar kode aktivasi.
  await page.getByRole('link', { name: 'Akun' }).click();
  await page.getByRole('button', { name: 'Pakai kode aktivasi lain' }).click();
  await page.getByRole('button', { name: 'Ya, ganti kode' }).click();
  await expect(page.getByLabel('Kode aktivasi perangkat')).toBeVisible();
});

test('FR-62: Admin membuka ringkasan indikator dan membuat kode aktivasi', async ({ page }) => {
  await aktifkan(page, DEMO.admin.kode);
  await masuk(page, DEMO.admin.hp);
  await expect(page).toHaveURL(/\/kelola$/);
  await expect(page.getByRole('cell', { name: 'Meok' })).toBeVisible();
  await page.getByRole('tab', { name: 'Perangkat' }).click();
  await page.getByRole('combobox').first().selectOption({ label: 'Meok' });
  await page.getByRole('button', { name: 'Buat kode' }).click();
  await expect(page.getByText(/Kode baru:/)).toBeVisible();
});
