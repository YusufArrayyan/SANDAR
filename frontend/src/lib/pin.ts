/**
 * Hash PIN dengan PBKDF2-SHA256, format sama dengan server:
 * pbkdf2$<iterasi>$<garam hex>$<hash hex>. PIN diperiksa di perangkat (FR-02).
 */

const ITERASI = 60000;

const keHex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');

const dariHex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

async function turunkan(pin: string, garam: Uint8Array, iterasi: number): Promise<string> {
  const kunci = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: garam as BufferSource, iterations: iterasi },
    kunci,
    256,
  );
  return keHex(bits);
}

export async function hashPin(pin: string): Promise<string> {
  const garam = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERASI}$${keHex(garam)}$${await turunkan(pin, garam, ITERASI)}`;
}

export async function cekPin(pin: string, tersimpan: string): Promise<boolean> {
  const [jenis, iterasi, garam, hash] = tersimpan.split('$');
  if (jenis !== 'pbkdf2' || !garam || !hash) return false;
  const hasil = await turunkan(pin, dariHex(garam), Number(iterasi));
  let beda = hasil.length ^ hash.length;
  for (let i = 0; i < Math.min(hasil.length, hash.length); i++) beda |= hasil.charCodeAt(i) ^ hash.charCodeAt(i);
  return beda === 0;
}
