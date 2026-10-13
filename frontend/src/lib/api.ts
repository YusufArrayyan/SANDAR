import { bacaMeta } from './db';
import type { Perangkat } from './tipe';

export class GalatApi extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Galat jaringan: tidak ada sinyal atau server tidak terjangkau. */
export class GalatJaringan extends Error {
  constructor() {
    super('Tidak ada sambungan ke server. Data tetap aman di perangkat ini.');
  }
}

export async function panggil<T>(
  jalur: string,
  opsi: { method?: string; body?: unknown; pengguna?: string | null; mentah?: boolean } = {},
): Promise<T> {
  const perangkat = await bacaMeta<Perangkat>('perangkat');
  const headers: Record<string, string> = {};
  if (perangkat) headers['X-Perangkat'] = perangkat.token;
  if (opsi.pengguna) headers['X-Pengguna'] = opsi.pengguna;
  if (opsi.body !== undefined) headers['Content-Type'] = 'application/json';
  let r: Response;
  try {
    r = await fetch(`/api${jalur}`, {
      method: opsi.method ?? 'GET',
      headers,
      body: opsi.body === undefined ? undefined : JSON.stringify(opsi.body),
    });
  } catch {
    throw new GalatJaringan();
  }
  if (!r.ok) {
    let pesan = 'Server sedang bermasalah. Coba lagi beberapa saat lagi.';
    try {
      const j = await r.json();
      if (typeof j.detail === 'string') pesan = j.detail;
      else if (Array.isArray(j.detail)) pesan = 'Isian belum lengkap atau keliru. Periksa lagi isian Anda.';
    } catch {
      /* bukan JSON */
    }
    if (r.status >= 502 && r.status <= 504) throw new GalatJaringan();
    throw new GalatApi(pesan, r.status);
  }
  return (opsi.mentah ? r : await r.json()) as T;
}
