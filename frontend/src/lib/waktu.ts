/** Waktu lapangan memakai WIB (UTC+7), sama dengan server. */

const WIB_MS = 7 * 3600 * 1000;

export function sekarangWib(): Date {
  // Objek Date yang komponen UTC-nya sama dengan jam dinding WIB.
  return new Date(Date.now() + WIB_MS);
}

export function hariIniWib(): string {
  return sekarangWib().toISOString().slice(0, 10);
}

export function tambahHari(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function selisihHari(dari: string, sampai: string): number {
  return Math.round((Date.parse(`${sampai.slice(0, 10)}T00:00:00Z`) - Date.parse(`${dari.slice(0, 10)}T00:00:00Z`)) / 86400000);
}

/** Batas waktu pencocokan: pukul `jam` WIB pada hari sebelum berangkat (FR-33). */
export function batasWaktuCocok(berangkat: string, jam: number): string {
  return `${tambahHari(berangkat, -1)}T${String(jam).padStart(2, '0')}:00`;
}

export function sudahLewat(waktuWib: string): boolean {
  return sekarangWib().toISOString().slice(0, 16) >= waktuWib.slice(0, 16);
}

export function sekarangIso(): string {
  return new Date().toISOString();
}
