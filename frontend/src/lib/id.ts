/** ID unik dibuat di perangkat agar pengiriman ulang tidak menggandakan data (PRD 9). */
export function buatId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
