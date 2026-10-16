import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KotakPesan } from '../komponen/Umum';
import { layarAwal, masuk } from '../lib/sesi';
import { ambilKeadaan } from '../lib/toko';
import { BingkaiMasuk, Merek } from './Aktivasi';
import { useLiveQuery } from 'dexie-react-hooks';
import { bacaMeta, db } from '../lib/db';
import { NAMA_PERAN } from '../lib/format';
import type { AkunContoh } from '../lib/sesi';

/** Layar Masuk (Gambar 2): nomor HP dan PIN 4 angka, diperiksa di perangkat. */
export function Masuk() {
  const [hp, setHp] = useState('');
  const [pin, setPin] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [proses, setProses] = useState(false);
  const pindah = useNavigate();
  const lokasi = useLocation() as { state?: { dari?: string } };
  const refPin = useRef<HTMLInputElement>(null);
  const jumlahAkun = useLiveQuery(() => db.pengguna.count(), []);
  const akunContoh = useLiveQuery(() => bacaMeta<AkunContoh[] | null>('akunContoh'), []);

  async function kirim(e?: FormEvent) {
    e?.preventDefault();
    if (proses) return;
    setGalat(null);
    if (hp.replace(/\D/g, '').length < 8) {
      setGalat('Nomor HP belum lengkap. Periksa lagi nomornya.');
      return;
    }
    if (pin.length !== 4) {
      setGalat('PIN harus 4 angka.');
      return;
    }
    setProses(true);
    const h = await masuk(hp, pin);
    setProses(false);
    if (!h.ok) {
      setGalat(h.pesan);
      setPin('');
      return;
    }
    const u = ambilKeadaan().pengguna!;
    pindah(lokasi.state?.dari ?? layarAwal(u.peran), { replace: true });
  }

  useEffect(() => {
    if (pin.length === 4 && hp.replace(/\D/g, '').length >= 8) void kirim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <BingkaiMasuk>
    <div className="layar tanpa-nav">
      <form className="masuk-isi" onSubmit={kirim} noValidate>
        <Merek />
        <p className="redup" style={{ fontSize: '1.125rem' }}>
          Catat panen dan ruang muat, tanpa sinyal.
        </p>
        {jumlahAkun === 0 && (
          <KotakPesan jenis="kuning">Daftar akun belum diterima. Sambungkan perangkat ke sinyal sebentar agar data terkirim.</KotakPesan>
        )}
        <div className="medan">
          <label htmlFor="hp">Nomor HP</label>
          <input
            id="hp"
            className="masukan"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            placeholder="0812 3456 7890"
          />
        </div>
        <div className="medan">
          <span className="label" id="label-pin">
            PIN (4 angka)
          </span>
          <div className="pin" onClick={() => refPin.current?.focus()}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={i < pin.length ? 'isi-pin' : ''} />
            ))}
            <input
              ref={refPin}
              aria-labelledby="label-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="current-password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
        </div>
        {galat && <KotakPesan jenis="merah">{galat}</KotakPesan>}
        <button className="tombol" disabled={proses}>
          {proses ? 'Memeriksa…' : 'Masuk'}
        </button>
        <p className="catatan-kaki" style={{ textAlign: 'center' }}>
          Setelah masuk pertama, aplikasi tetap bisa dibuka saat tidak ada sinyal.
        </p>
        {akunContoh && akunContoh.length > 0 && (
          <div className="kartu demo">
            <h2>Akun contoh</h2>
            <p className="redup">Ketuk untuk mengisi nomor HP dan PIN.</p>
            <div className="pilihan-demo">
              {akunContoh.map((a) => (
                <button
                  type="button"
                  key={a.hp}
                  className="tombol kedua"
                  onClick={() => {
                    setHp(a.hp);
                    setPin(a.pin);
                  }}
                >
                  {a.nama} · {NAMA_PERAN[a.peran]}
                </button>
              ))}
            </div>
            <p className="redup kecil">PIN semua akun contoh: {akunContoh[0].pin}</p>
          </div>
        )}
      </form>
    </div>
    </BingkaiMasuk>
  );
}
