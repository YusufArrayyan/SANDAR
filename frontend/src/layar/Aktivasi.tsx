import { ListChecks, Ship, Tag, WifiOff } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { KotakPesan } from '../komponen/Umum';
import { GalatJaringan } from '../lib/api';
import { tulisMeta } from '../lib/db';
import { aktifkanPerangkat } from '../lib/sesi';
import { ubahKeadaan } from '../lib/toko';

export function Merek() {
  return (
    <div className="merek">
      <Ship size={44} strokeWidth={2} aria-hidden />
      <strong>SANDAR</strong>
    </div>
  );
}

/** Layar Masuk dan Aktivasi. Di layar lebar, panel merek tampil di sebelah kiri. */
export function BingkaiMasuk({ children }: { children: ReactNode }) {
  return (
    <div className="layar-masuk">
      <section className="panel-merek" aria-label="Tentang SANDAR">
        <Merek />
        <h2>Koordinasi muatan kapal dan harga untuk petani pulau terluar.</h2>
        <ul>
          <li>
            <WifiOff size={22} aria-hidden /> Catat panen dan ruang muat tanpa sinyal. Data terkirim sendiri saat sinyal ada.
          </li>
          <li>
            <ListChecks size={22} aria-hidden /> Ruang kapal yang terbatas dibagi adil dan dapat dihitung ulang dengan tangan.
          </li>
          <li>
            <Tag size={22} aria-hidden /> Harga acuan Kota Bengkulu dan sisa hasil per tandan setelah biaya angkut.
          </li>
        </ul>
        <p className="catatan-panel">Untuk petani pisang Pulau Enggano, Bengkulu Utara.</p>
      </section>
      {children}
    </div>
  );
}

/** FR-01: aktivasi perangkat satu kali dengan kode dari Admin. */
export function Aktivasi() {
  const [kode, setKode] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [proses, setProses] = useState(false);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    if (kode.trim().length < 4) {
      setGalat('Kode aktivasi belum lengkap. Masukkan kode dari Admin.');
      return;
    }
    setProses(true);
    try {
      await aktifkanPerangkat(kode);
    } catch (err) {
      setGalat(
        err instanceof GalatJaringan
          ? 'Aktivasi butuh sinyal sekali saja. Cari tempat dengan sinyal lalu coba lagi.'
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setProses(false);
    }
  }

  return (
    <BingkaiMasuk>
    <div className="layar tanpa-nav">
      <form className="masuk-isi" onSubmit={kirim} noValidate>
        <Merek />
        <p className="redup" style={{ fontSize: '1.125rem' }}>
          Catat panen dan ruang muat, tanpa sinyal.
        </p>
        <div className="medan">
          <label htmlFor="kode">Kode aktivasi perangkat</label>
          <input
            id="kode"
            className="masukan besar"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={kode}
            onChange={(e) => setKode(e.target.value.toUpperCase())}
            placeholder="Contoh: MEOK2026"
          />
          <p className="petunjuk">Kode diberikan Admin dan hanya dipakai sekali untuk perangkat ini.</p>
        </div>
        {galat && <KotakPesan jenis="merah">{galat}</KotakPesan>}
        <button className="tombol" disabled={proses}>
          {proses ? 'Mengaktifkan…' : 'Aktifkan perangkat'}
        </button>
        <p className="catatan-kaki" style={{ textAlign: 'center' }}>
          Aktivasi butuh sinyal sekali. Setelah itu aplikasi bisa dibuka tanpa sinyal.
        </p>
      </form>
    </div>
    </BingkaiMasuk>
  );
}

/** FR-06: perangkat dinonaktifkan Admin. Data yang belum terkirim tetap disimpan. */
export function Diblokir({ pesan }: { pesan: string }) {
  async function aktivasiUlang() {
    await tulisMeta('perangkat', null);
    await tulisMeta('sesi', null);
    await tulisMeta('kursor', 0);
    ubahKeadaan({ perangkat: null, pengguna: null, diblokir: null });
  }
  return (
    <BingkaiMasuk>
    <div className="layar tanpa-nav">
      <div className="masuk-isi">
        <Merek />
        <KotakPesan jenis="merah">{pesan}</KotakPesan>
        <p className="catatan-kaki">
          Catatan yang belum terkirim tetap tersimpan di perangkat ini dan akan dikirim setelah perangkat diaktifkan lagi.
        </p>
        <button className="tombol" onClick={aktivasiUlang}>
          Masukkan kode aktivasi baru
        </button>
        <button className="tombol kedua" onClick={() => location.reload()}>
          Coba lagi
        </button>
      </div>
    </div>
    </BingkaiMasuk>
  );
}
