import { Ban, Check, CircleAlert, CircleCheck, Clock, Hourglass, Minus, Plus, Ship, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Panen, StatusKeberangkatan } from '../lib/tipe';
import { useKeadaan } from '../lib/toko';

/** FR-14: status memakai ikon dan kata, tidak hanya warna. */
export function LencanaPanen({ c }: { c: Panen }) {
  if (c._ditolak && c._tertunda !== 1)
    return (
      <span className="lencana chip merah">
        <CircleAlert size={16} aria-hidden /> Gagal dikirim
      </span>
    );
  if (c._tertunda && c.status !== 'dibatalkan')
    return (
      <span className="lencana chip kuning">
        <Clock size={16} aria-hidden /> Menunggu kirim
      </span>
    );
  switch (c.status) {
    case 'terdaftar':
      return (
        <span className="lencana chip aksen">
          <Check size={16} aria-hidden /> Terdaftar
        </span>
      );
    case 'dapat_jatah':
      return (
        <span className="lencana chip hijau">
          <Check size={16} aria-hidden /> Dapat jatah
        </span>
      );
    case 'daftar_tunggu':
      return (
        <span className="lencana chip abu">
          <Hourglass size={16} aria-hidden /> Daftar tunggu
        </span>
      );
    case 'terangkut':
      return (
        <span className="lencana chip hijau">
          <Ship size={16} aria-hidden /> Terangkut
        </span>
      );
    case 'dibatalkan':
      return (
        <span className="lencana chip abu">
          <Ban size={16} aria-hidden /> Dibatalkan
        </span>
      );
  }
}

const KB: Record<StatusKeberangkatan, { kata: string; warna: string; Ikon: typeof Check }> = {
  buka: { kata: 'Buka', warna: 'hijau', Ikon: Check },
  penuh: { kata: 'Penuh', warna: 'abu', Ikon: CircleAlert },
  berangkat: { kata: 'Berangkat', warna: 'aksen', Ikon: Ship },
  batal: { kata: 'Batal', warna: 'merah', Ikon: Ban },
};

export function LencanaKeberangkatan({ status, tertunda }: { status: StatusKeberangkatan; tertunda?: boolean }) {
  if (tertunda)
    return (
      <span className="lencana chip kuning">
        <Clock size={16} aria-hidden /> Menunggu kirim
      </span>
    );
  const { kata, warna, Ikon } = KB[status];
  return (
    <span className={`lencana chip ${warna}`}>
      <Ikon size={16} aria-hidden /> {kata}
    </span>
  );
}

export function Kosong({ ikon, judul, children }: { ikon: ReactNode; judul: string; children?: ReactNode }) {
  return (
    <div className="kosong">
      {ikon}
      <h2>{judul}</h2>
      {children}
    </div>
  );
}

/** Keadaan memuat: kerangka berbentuk akhir (PRD 12.7). */
export function Memuat({ jumlah = 3 }: { jumlah?: number }) {
  return (
    <div aria-busy="true" aria-label="Memuat" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: jumlah }, (_, i) => (
        <div key={i} className="kerangka" />
      ))}
    </div>
  );
}

export function KotakPesan({ jenis, children }: { jenis: 'kuning' | 'merah' | 'hijau' | 'abu'; children: ReactNode }) {
  const Ikon = jenis === 'merah' ? CircleAlert : jenis === 'hijau' ? CircleCheck : TriangleAlert;
  return (
    <div className={`kotak-pesan ${jenis}`} role={jenis === 'merah' ? 'alert' : 'status'}>
      <Ikon size={20} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Stepper({ nilai, ubah, min = 1, label }: { nilai: number; ubah: (n: number) => void; min?: number; label: string }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => ubah(Math.max(min, nilai - 1))} aria-label="Kurangi satu">
        <Minus size={26} aria-hidden />
      </button>
      <input
        className="masukan"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={label}
        value={Number.isNaN(nilai) ? '' : String(nilai)}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          ubah(Number.isNaN(n) ? 0 : Math.min(n, 100000));
        }}
      />
      <button type="button" onClick={() => ubah(nilai + 1)} aria-label="Tambah satu">
        <Plus size={26} aria-hidden />
      </button>
    </div>
  );
}

export function Toast() {
  const pesan = useKeadaan((k) => k.pesan);
  if (!pesan) return null;
  return (
    <div className={`toast ${pesan.jenis}`} role="status" aria-live="polite">
      {pesan.jenis === 'berhasil' ? <CircleCheck size={20} aria-hidden /> : <CircleAlert size={20} aria-hidden />}
      {pesan.teks}
    </div>
  );
}

/** Teks keadaan luring di bawah formulir (PRD 12.7). */
export function CatatanLuring() {
  const online = useKeadaan((k) => k.online);
  return (
    <p className="catatan-kaki">
      {online ? 'Disimpan di perangkat ini lalu dikirim otomatis.' : 'Disimpan di perangkat ini dan dikirim otomatis saat ada sinyal.'}
    </p>
  );
}

export function masukanRupiah(teks: string): number | null {
  const n = parseInt(teks.replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}
