// Mencetak cara-kerja.html menjadi docs/SANDAR-Cara-Kerja.pdf dengan Google Chrome.
// Jalankan dari folder proyek: node docs/cara-kerja/buat-pdf.mjs
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const di = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(di, '..', '..', 'frontend', 'package.json'));
const { chromium } = require('playwright-core');

const chrome = process.env.SANDAR_CHROME ?? (process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');

const b = await chromium.launch({ executablePath: chrome });
const p = await b.newPage();
await p.goto(pathToFileURL(join(di, 'cara-kerja.html')).href, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const keluar = resolve(di, '..', 'SANDAR-Cara-Kerja.pdf');
await p.pdf({ path: keluar, format: 'A4', printBackground: true, preferCSSPageSize: true });
await b.close();
console.log('PDF:', keluar);
