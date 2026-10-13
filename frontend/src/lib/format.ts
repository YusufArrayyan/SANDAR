/** Aturan teks PRD 12.6: Rp60.000 tanpa spasi, desimal memakai koma, satuan selalu ada. */

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function angka(n: number): string {
  return Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function rupiah(n: number): string {
  return (n < 0 ? '−Rp' : 'Rp') + angka(Math.abs(n));
}

export function persen(n: number, digit = 1): string {
  const s = n.toFixed(digit).replace('.', ',');
  return (s.endsWith(',0') ? s.slice(0, -2) : s) + '%';
}

export function tandan(n: number): string {
  return `${angka(n)} tandan`;
}

function bagianTanggal(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return [y, m, d];
}

/** "18 Okt" atau "18 Okt 2026" */
export function tanggal(iso: string, denganTahun = false): string {
  const [y, m, d] = bagianTanggal(iso);
  return `${d} ${BULAN[m - 1]}${denganTahun ? ` ${y}` : ''}`;
}

function hariDalamPekan(iso: string): string {
  const [y, m, d] = bagianTanggal(iso);
  return HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "Sab 19 Okt, 06.00" dari "2026-10-19T06:00" (WIB) */
export function waktuBerangkat(iso: string): string {
  return `${hariDalamPekan(iso)} ${tanggal(iso)}, ${iso.slice(11, 16).replace(':', '.')}`;
}

/** Waktu lokal perangkat, misal "17 Okt, 14.05" */
export function waktuLokal(isoUtc: string): string {
  const d = new Date(isoUtc);
  const jam = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()} ${BULAN[d.getMonth()]}, ${jam}`;
}

export function hariLalu(n: number): string {
  if (n <= 0) return 'hari ini';
  if (n === 1) return 'kemarin';
  return `${n} hari lalu`;
}

export const NAMA_PERAN: Record<string, string> = {
  petani: 'Petani',
  simpul: 'Pengelola simpul',
  kapal: 'Pengelola kapal',
  mitra: 'Mitra pasar',
  admin: 'Admin',
};

export const NAMA_JENIS_KAPAL: Record<string, string> = {
  feri: 'Feri',
  perintis: 'Kapal perintis',
  nelayan: 'Kapal nelayan',
};
