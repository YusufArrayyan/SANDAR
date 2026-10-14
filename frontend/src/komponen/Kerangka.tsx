import { useLiveQuery } from 'dexie-react-hooks';
import { Box, ChevronLeft, CircleUserRound, ListChecks, RefreshCw, Ship, Tag, Wifi, WifiOff, ChartColumn, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { useKeadaan } from '../lib/toko';
import type { Peran } from '../lib/tipe';

/** FR-50: chip status selalu terlihat di bilah atas. */
export function ChipStatus() {
  const online = useKeadaan((k) => k.online);
  const mengirim = useKeadaan((k) => k.mengirim);
  const menunggu = useLiveQuery(() => db.outbox.count(), [], 0);

  let isi: ReactNode;
  let warna = 'kuning';
  if (!online) {
    isi = (
      <>
        <WifiOff size={18} aria-hidden /> Luring
        {menunggu > 0 && (
          <>
            {' '}· {menunggu}<span className="chip-kata"> menunggu</span>
          </>
        )}
      </>
    );
  } else if (mengirim && menunggu > 0) {
    isi = (
      <>
        <RefreshCw size={18} aria-hidden /> Mengirim · {menunggu}
      </>
    );
    warna = 'aksen';
  } else {
    warna = menunggu > 0 ? 'kuning' : 'hijau';
    isi = (
      <>
        <Wifi size={18} aria-hidden /> Tersambung
        {menunggu > 0 && (
          <>
            {' '}· {menunggu}<span className="chip-kata"> menunggu</span>
          </>
        )}
      </>
    );
  }
  return (
    <Link to="/sinkronisasi" className={`chip ${warna}`} title={`${menunggu} catatan menunggu kirim. Buka layar sinkronisasi.`}>
      {isi}
    </Link>
  );
}

const AKUN = { ke: '/akun', label: 'Akun', ikon: CircleUserRound };

const MENU: Record<Peran, { ke: string; label: string; ikon: typeof Box }[]> = {
  petani: [
    { ke: '/panen', label: 'Panen', ikon: Box },
    { ke: '/ruang-muat', label: 'Ruang Muat', ikon: Ship },
    { ke: '/jatah', label: 'Jatah', ikon: ListChecks },
    { ke: '/harga', label: 'Harga', ikon: Tag },
    AKUN,
  ],
  simpul: [
    { ke: '/panen', label: 'Panen', ikon: Box },
    { ke: '/ruang-muat', label: 'Ruang Muat', ikon: Ship },
    { ke: '/jatah', label: 'Jatah', ikon: ListChecks },
    { ke: '/harga', label: 'Harga', ikon: Tag },
    AKUN,
  ],
  kapal: [
    { ke: '/ruang-muat', label: 'Ruang Muat', ikon: Ship },
    { ke: '/jatah', label: 'Jatah', ikon: ListChecks },
    { ke: '/harga', label: 'Harga', ikon: Tag },
    AKUN,
  ],
  mitra: [
    { ke: '/harga/input', label: 'Input harga', ikon: Pencil },
    { ke: '/harga', label: 'Harga', ikon: Tag },
    AKUN,
  ],
  admin: [
    { ke: '/kelola', label: 'Kelola', ikon: ChartColumn },
    { ke: '/ruang-muat', label: 'Ruang Muat', ikon: Ship },
    { ke: '/jatah', label: 'Jatah', ikon: ListChecks },
    { ke: '/harga', label: 'Harga', ikon: Tag },
    AKUN,
  ],
};

export function NavBawah() {
  const peran = useKeadaan((k) => k.pengguna?.peran);
  if (!peran) return null;
  return (
    <nav className="nav-bawah" aria-label="Navigasi utama">
      {MENU[peran].map(({ ke, label, ikon: Ikon }) => (
        <NavLink key={ke} to={ke} end className={({ isActive }) => (isActive ? 'aktif' : '')}>
          <Ikon size={26} strokeWidth={2} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

const NAMA_PERAN_SINGKAT: Record<Peran, string> = {
  petani: 'Petani',
  simpul: 'Pengelola simpul',
  kapal: 'Pengelola kapal',
  mitra: 'Mitra pasar',
  admin: 'Admin',
};

/** Menu samping untuk layar lebar (laptop, tablet mendatar); di ponsel tersembunyi. */
function NavSamping() {
  const u = useKeadaan((k) => k.pengguna);
  if (!u) return null;
  return (
    <aside className="nav-samping" aria-label="Navigasi utama">
      <div className="merek-samping">
        <Ship size={30} strokeWidth={2} aria-hidden />
        <strong>SANDAR</strong>
      </div>
      <div className="profil-samping">
        <span className="tebal">{u.nama}</span>
        <span className="redup kecil">{NAMA_PERAN_SINGKAT[u.peran]}</span>
      </div>
      <nav>
        {MENU[u.peran].map(({ ke, label, ikon: Ikon }) => (
          <NavLink key={ke} to={ke} end className={({ isActive }) => (isActive ? 'aktif' : '')}>
            <Ikon size={22} strokeWidth={2} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <p className="redup kecil kaki-samping">Catat panen dan ruang muat, tanpa sinyal.</p>
    </aside>
  );
}

interface Props {
  judul: string;
  kembali?: boolean | string;
  children: ReactNode;
  tombol?: ReactNode;
  nav?: boolean;
  lebar?: boolean;
}

/**
 * Satu tugas per layar (PRD 12.1): bilah atas dengan judul dan chip status, isi,
 * satu tombol utama yang menempel di bawah, lalu bilah navigasi bawah.
 */
export function Layar({ judul, kembali, children, tombol, nav = true, lebar }: Props) {
  const pindah = useNavigate();
  return (
    <div className="bingkai">
      <NavSamping />
    <div className={`layar${lebar ? ' lebar' : ''}${nav ? '' : ' tanpa-nav'}`}>
      <header className="bilah-atas">
        {kembali && (
          <button
            className="tombol-ikon"
            onClick={() => (typeof kembali === 'string' ? pindah(kembali) : pindah(-1))}
            aria-label="Kembali"
          >
            <ChevronLeft size={28} aria-hidden />
          </button>
        )}
        <h1>{judul}</h1>
        <ChipStatus />
      </header>
      <main className={`isi${tombol ? ' ada-tombol' : ''}`}>{children}</main>
      {tombol && <div className="kaki-tombol">{tombol}</div>}
      {nav && <NavBawah />}
    </div>
    </div>
  );
}
