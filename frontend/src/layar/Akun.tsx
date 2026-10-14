import { useLiveQuery } from 'dexie-react-hooks';
import { KeyRound, LogOut, RefreshCw, Smartphone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layar } from '../komponen/Kerangka';
import { CatatanLuring, KotakPesan } from '../komponen/Umum';
import { gantiPin } from '../lib/aksi';
import { db } from '../lib/db';
import { NAMA_PERAN } from '../lib/format';
import { cekPin } from '../lib/pin';
import { keluar, lepasPerangkat } from '../lib/sesi';
import { tampilkanPesan, useKeadaan } from '../lib/toko';

export function Akun() {
  const u = useKeadaan((k) => k.pengguna)!;
  const pindah = useNavigate();
  const desa = useLiveQuery(() => (u.desa_id ? db.desa.get(u.desa_id) : undefined), [u.desa_id]);
  const menunggu = useLiveQuery(() => db.outbox.count(), [], 0);

  return (
    <Layar judul="Akun saya">
      <div className="kartu">
        <h2>{u.nama}</h2>
        <p className="redup">
          {NAMA_PERAN[u.peran]}
          {desa ? ` · Desa ${desa.nama}` : ''}
        </p>
        <p className="redup">{u.hp}</p>
      </div>
      <div className="rincian">
        <Link to="/sinkronisasi">
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <RefreshCw size={20} aria-hidden /> Sinkronisasi
          </span>
          <span className="redup">{menunggu > 0 ? `${menunggu} menunggu` : 'Semua terkirim'}</span>
        </Link>
        <Link to="/akun/pin">
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <KeyRound size={20} aria-hidden /> Ganti PIN
          </span>
        </Link>
      </div>
      <button
        className="tombol kedua"
        onClick={async () => {
          await keluar();
          pindah('/masuk', { replace: true });
        }}
      >
        <LogOut size={20} aria-hidden /> Keluar
      </button>
      {menunggu > 0 && <p className="catatan-kaki">Catatan yang belum terkirim tetap tersimpan di perangkat setelah Anda keluar.</p>}
      <GantiKode menunggu={menunggu} />
      <p className="catatan-kaki" style={{ marginTop: 'auto' }}>
        SANDAR versi 1.0.0-rc.1. Untuk memasang di layar utama, buka menu peramban lalu pilih Tambahkan ke layar utama.
      </p>
    </Layar>
  );
}

/** Mengaktifkan perangkat ini dengan kode lain, misalnya untuk mencoba peran lain. */
function GantiKode({ menunggu }: { menunggu: number }) {
  const [tanya, setTanya] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function lepas() {
    try {
      await lepasPerangkat();
    } catch (e) {
      setGalat((e as Error).message);
    }
  }

  if (!tanya)
    return (
      <button className="tombol kedua" onClick={() => setTanya(true)}>
        <Smartphone size={20} aria-hidden /> Pakai kode aktivasi lain
      </button>
    );
  return (
    <div className="kartu">
      <p className="tebal">Pakai kode aktivasi lain?</p>
      <p className="redup">
        Data di perangkat ini dihapus, lalu Anda memasukkan kode aktivasi baru. Data yang sudah terkirim tetap aman di server.
      </p>
      {menunggu > 0 && <KotakPesan jenis="kuning">Masih ada {menunggu} catatan belum terkirim. Kirim dulu dari layar Sinkronisasi.</KotakPesan>}
      {galat && <KotakPesan jenis="merah">{galat}</KotakPesan>}
      <div className="baris-aksi" style={{ marginTop: 8 }}>
        <button className="tombol bahaya kecil" onClick={lepas} disabled={menunggu > 0}>
          Ya, ganti kode
        </button>
        <button className="tombol kedua kecil" onClick={() => setTanya(false)}>
          Batal
        </button>
      </div>
    </div>
  );
}

export function GantiPin() {
  const u = useKeadaan((k) => k.pengguna)!;
  const pindah = useNavigate();
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [galat, setGalat] = useState<string | null>(null);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    if (!(await cekPin(lama, u.pin_hash))) return setGalat('PIN lama salah. Periksa lagi.');
    if (!/^\d{4}$/.test(baru)) return setGalat('PIN baru harus 4 angka.');
    if (baru !== ulang) return setGalat('Ulangi PIN baru belum sama. Ketik ulang.');
    await gantiPin(baru);
    tampilkanPesan('PIN diganti');
    pindah('/akun', { replace: true });
  }

  const medan = (id: string, label: string, nilai: string, ubah: (s: string) => void) => (
    <div className="medan">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="masukan besar"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete={id === 'lama' ? 'current-password' : 'new-password'}
        value={nilai}
        onChange={(e) => ubah(e.target.value.replace(/\D/g, '').slice(0, 4))}
      />
    </div>
  );

  return (
    <Layar judul="Ganti PIN" kembali nav={false} tombol={<button className="tombol" form="form-pin">Simpan</button>}>
      <form id="form-pin" onSubmit={simpan} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {medan('lama', 'PIN lama', lama, setLama)}
        {medan('baru', 'PIN baru (4 angka)', baru, setBaru)}
        {medan('ulang', 'Ulangi PIN baru', ulang, setUlang)}
        {galat && <KotakPesan jenis="merah">{galat}</KotakPesan>}
        <CatatanLuring />
      </form>
    </Layar>
  );
}
