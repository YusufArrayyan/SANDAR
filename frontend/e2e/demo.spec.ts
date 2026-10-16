/** Mode demo terbuka: juri mencoba SANDAR tanpa kode aktivasi. */
import { expect, test } from '@playwright/test';

test('Juri mencoba sebagai Pengelola simpul tanpa kode aktivasi', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pengelola simpul atau petani' }).click();
  await expect(page.getByRole('heading', { name: 'Akun contoh' })).toBeVisible();
  await page.getByRole('button', { name: /Andi · Pengelola simpul/ }).click();
  await expect(page).toHaveURL(/\/panen$/);
  await expect(page.getByText('Rahmat').first()).toBeVisible();

  // Berganti peran ke petani di perangkat simpul yang sama.
  await page.getByRole('link', { name: 'Akun' }).click();
  await page.getByRole('button', { name: 'Keluar' }).click();
  await page.getByRole('button', { name: /Rahmat · Petani/ }).click();
  await expect(page).toHaveURL(/\/panen$/);
  await expect(page.getByText('Siti')).toHaveCount(0);
});
