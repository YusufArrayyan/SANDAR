import { Download, Plus } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Layar } from '../komponen/Kerangka';
import { KotakPesan, Memuat } from '../komponen/Umum';
import { GalatJaringan, panggil } from '../lib/api';
import { NAMA_JENIS_KAPAL, NAMA_PERAN, angka, rupiah, waktuLokal } from '../lib/format';
import { sinkronkan } from '../lib/sinkron';
import { tampilkanPesan, useKeadaan } from '../lib/toko';
import type { Desa, Kapal, Parameter, Pengguna } from '../lib/tipe';

type Tab = 'ringkasan' | 'akun' | 'desa' | 'kapal' | 'perangkat' | 'parameter' | 'log';

const TAB: { id: Tab; label: string }[] = [
  { id: 'ringkasan', label: 'Ringkasan' },
  { id: 'akun', label: 'Akun' },
  { id: 'desa', label: 'Desa' },
  { id: 'kapal', label: 'Kapal' },
  { id: 'perangkat', label: 'Perangkat' },
  { id: 'parameter', label: 'Parameter' },
  { id: 'log', label: 'Log audit' },
];

/** Memanggil API Admin. Panel Kelola butuh sinyal (PRD 12.2: Admin, web). */
function useApi<T>(jalur: string) {
  const u = useKeadaan((k) => k.pengguna)!;
  const [data, setData] = useState<T | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const muat = useCallback(async () => {
    setGalat(null);
    try {
      setData(await panggil<T>(jalur, { pengguna: u.id }));
    } catch (e) {
      setGalat(e instanceof GalatJaringan ? 'Panel Kelola butuh sinyal. Sambungkan perangkat lalu tekan Muat ulang.' : (e as Error).message);
    }
  }, [jalur, u.id]);
  useEffect(() => {
    void muat();
  }, [muat]);
  return { data, galat, muat };
}

async function kirimAdmin<T>(jalur: string, method: string, body: unknown, pengguna: string): Promise<T> {
  return panggil<T>(jalur, { method, body, pengguna });
}

function Galat({ pesan, ulang }: { pesan: string; ulang: () => void }) {
  return (
    <>
      <KotakPesan jenis="merah">{pesan}</KotakPesan>
      <button className="tombol kedua kecil" onClick={ulang} style={{ alignSelf: 'flex-start' }}>
        Muat ulang
      </button>
    </>
  );
}

export function Kelola() {
  const [tab, setTab] = useState<Tab>('ringkasan');
  return (
    <Layar judul="Kelola" lebar>
      <div className="tab-kelola" role="tablist" style={{ margin: '-16px -16px 0' }}>
        {TAB.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'ringkasan' && <Ringkasan />}
      {tab === 'akun' && <KelolaAkun />}
      {tab === 'desa' && <KelolaDesa />}
      {tab === 'kapal' && <KelolaKapal />}
      {tab === 'perangkat' && <KelolaPerangkat />}
      {tab === 'parameter' && <KelolaParameter />}
      {tab === 'log' && <LogAudit />}
    </Layar>
  );
}

// --- Ringkasan indikator (FR-62, FR-63) ---------------------------------------

interface BarisIndikator {
  desa: string;
  catatan: number;
  tandan_terdaftar: number;
  tandan_terangkut: number;
  i1_terangkut_7hari_persen: number | null;
  i2_selisih_harga_rp: number | null;
  i2_tandan_berharga: number;
  i3_waktu_tunggu_hari: number | null;
  i4_sinkron_24jam_persen: number | null;
  i4_operasi: number;
  i4_petani_terdaftar: number;
  i4_petani_terdaftar_persen: number | null;
}

const kosongAtau = (v: number | null, f: (n: number) => string) => (v === null ? '–' : f(v));
const fmtPersen = (n: number) => `${String(n).replace('.', ',')}%`;

function Ringkasan() {
  const u = useKeadaan((k) => k.pengguna)!;
  const [bulan, setBulan] = useState<string>('');
  const { data, galat, muat } = useApi<{ bulan: string; bulan_tersedia: string[]; desa: BarisIndikator[] }>(
    `/ringkasan/indikator${bulan ? `?bulan=${bulan}` : ''}`,
  );

  async function unduh(jenis: string) {
    try {
      const r = await panggil<Response>(`/admin/ekspor/${jenis}${jenis === 'ringkasan.csv' && data ? `?bulan=${data.bulan}` : ''}`, {
        pengguna: u.id,
        mentah: true,
      });
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? jenis;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      tampilkanPesan((e as Error).message, 'galat');
    }
  }

  if (galat) return <Galat pesan={galat} ulang={muat} />;
  if (!data) return <Memuat />;

  const pilihanBulan = [...new Set([data.bulan, ...data.bulan_tersedia])].sort().reverse();

  return (
    <>
      <div className="baris-aksi" style={{ justifyContent: 'space-between' }}>
        <div className="medan" style={{ minWidth: 200 }}>
          <label htmlFor="bulan">Bulan siap angkut</label>
          <select id="bulan" className="masukan" value={data.bulan} onChange={(e) => setBulan(e.target.value)}>
            {pilihanBulan.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="baris-aksi">
          <button className="tombol kedua kecil" onClick={() => unduh('ringkasan.csv')}>
            <Download size={18} aria-hidden /> Ringkasan CSV
          </button>
          <button className="tombol kedua kecil" onClick={() => unduh('panen.csv')}>
            <Download size={18} aria-hidden /> Catatan panen CSV
          </button>
          <button className="tombol kedua kecil" onClick={() => unduh('keberangkatan.csv')}>
            <Download size={18} aria-hidden /> Keberangkatan CSV
          </button>
          <button className="tombol kedua kecil" onClick={() => unduh('harga.csv')}>
            <Download size={18} aria-hidden /> Harga CSV
          </button>
        </div>
      </div>
      {data.desa.length === 0 ? (
        <KotakPesan jenis="abu">Belum ada desa. Tambahkan desa di tab Desa.</KotakPesan>
      ) : (
        <div className="tabel-wadah">
          <table>
            <thead>
              <tr>
                <th>Desa</th>
                <th className="angka">Tandan terdaftar</th>
                <th className="angka">1. Terangkut ≤ 7 hari</th>
                <th className="angka">2. Selisih harga per tandan</th>
                <th className="angka">3. Waktu tunggu</th>
                <th className="angka">4. Sinkron ≤ 24 jam</th>
                <th className="angka">Petani terdaftar</th>
              </tr>
            </thead>
            <tbody>
              {data.desa.map((d) => (
                <tr key={d.desa}>
                  <td className="tebal">{d.desa}</td>
                  <td className="angka">
                    {angka(d.tandan_terdaftar)}
                    <div className="redup kecil">{d.catatan} catatan</div>
                  </td>
                  <td className="angka">{kosongAtau(d.i1_terangkut_7hari_persen, fmtPersen)}</td>
                  <td className="angka">
                    {kosongAtau(d.i2_selisih_harga_rp, rupiah)}
                    <div className="redup kecil">{angka(d.i2_tandan_berharga)} tandan berharga</div>
                  </td>
                  <td className="angka">{kosongAtau(d.i3_waktu_tunggu_hari, (n) => `${String(n).replace('.', ',')} hari`)}</td>
                  <td className="angka">
                    {kosongAtau(d.i4_sinkron_24jam_persen, fmtPersen)}
                    <div className="redup kecil">{angka(d.i4_operasi)} operasi</div>
                  </td>
                  <td className="angka">
                    {d.i4_petani_terdaftar}
                    <div className="redup kecil">{kosongAtau(d.i4_petani_terdaftar_persen, fmtPersen)} dari perkiraan</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="catatan-kaki" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p>1. Persentase tandan terdaftar yang terangkut dalam 7 hari sejak siap angkut.</p>
        <p>2. Rata-rata selisih harga acuan bersih (harga acuan dikurangi tarif kapal dan biaya tebang) dengan harga terima petani.</p>
        <p>3. Rata-rata hari dari siap angkut sampai naik kapal, berbobot tandan.</p>
        <p>4. Persentase catatan yang diterima server dalam 24 jam sejak percobaan kirim pertama, dan petani terdaftar dibanding perkiraan jumlah petani pisang desa.</p>
        <p>Target dinyatakan relatif terhadap nilai awal yang diukur pada tahap persiapan (PRD bagian 3).</p>
      </div>
    </>
  );
}

// --- Akun ----------------------------------------------------------------------

function Formulir({ judul, children, kirim, tutup }: { judul: string; children: ReactNode; kirim: (e: FormEvent) => void; tutup: () => void }) {
  return (
    <form className="kartu" onSubmit={kirim} style={{ gap: 14 }}>
      <h3>{judul}</h3>
      <div className="kisi">{children}</div>
      <div className="baris-aksi">
        <button className="tombol kecil">Simpan</button>
        <button type="button" className="tombol kedua kecil" onClick={tutup}>
          Batal
        </button>
      </div>
    </form>
  );
}

function Medan({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="medan">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function KelolaAkun() {
  const u = useKeadaan((k) => k.pengguna)!;
  const akun = useApi<Omit<Pengguna, 'pin_hash'>[]>('/admin/pengguna');
  const desa = useApi<Desa[]>('/admin/desa');
  const [buka, setBuka] = useState(false);
  const [isi, setIsi] = useState({ nama: '', hp: '', peran: 'petani', desa_id: '', pin: '', kelompok: '' });
  const [resetId, setResetId] = useState<string | null>(null);
  const [pinBaru, setPinBaru] = useState('');

  async function tambah(e: FormEvent) {
    e.preventDefault();
    try {
      await kirimAdmin('/admin/pengguna', 'POST', { ...isi, desa_id: isi.desa_id || null }, u.id);
      tampilkanPesan('Akun ditambahkan');
      setBuka(false);
      setIsi({ nama: '', hp: '', peran: 'petani', desa_id: '', pin: '', kelompok: '' });
      void akun.muat();
      void sinkronkan();
    } catch (err) {
      tampilkanPesan((err as Error).message, 'galat');
    }
  }

  async function ubah(id: string, body: Record<string, unknown>, pesan: string) {
    try {
      await kirimAdmin(`/admin/pengguna/${id}`, 'PATCH', body, u.id);
      tampilkanPesan(pesan);
      void akun.muat();
    } catch (err) {
      tampilkanPesan((err as Error).message, 'galat');
    }
  }

  if (akun.galat) return <Galat pesan={akun.galat} ulang={akun.muat} />;
  if (!akun.data || !desa.data) return <Memuat />;
  const namaDesa = new Map(desa.data.map((d) => [d.id, d.nama]));

  return (
    <>
      {buka ? (
        <Formulir judul="Tambah akun" kirim={tambah} tutup={() => setBuka(false)}>
          <Medan label="Nama">
            <input className="masukan" required value={isi.nama} onChange={(e) => setIsi({ ...isi, nama: e.target.value })} />
          </Medan>
          <Medan label="Nomor HP">
            <input className="masukan" required inputMode="tel" value={isi.hp} onChange={(e) => setIsi({ ...isi, hp: e.target.value.replace(/[^0-9+]/g, '') })} />
          </Medan>
          <Medan label="Peran">
            <select className="masukan" value={isi.peran} onChange={(e) => setIsi({ ...isi, peran: e.target.value })}>
              {Object.entries(NAMA_PERAN).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Medan>
          {(isi.peran === 'petani' || isi.peran === 'simpul') && (
            <Medan label="Desa">
              <select className="masukan" required value={isi.desa_id} onChange={(e) => setIsi({ ...isi, desa_id: e.target.value })}>
                <option value="">Pilih desa</option>
                {desa.data.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama}
                  </option>
                ))}
              </select>
            </Medan>
          )}
          {isi.peran === 'petani' && (
            <Medan label="Kelompok tani">
              <input className="masukan" value={isi.kelompok} onChange={(e) => setIsi({ ...isi, kelompok: e.target.value })} />
            </Medan>
          )}
          <Medan label="PIN awal (4 angka)">
            <input className="masukan" required inputMode="numeric" maxLength={4} value={isi.pin} onChange={(e) => setIsi({ ...isi, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
          </Medan>
        </Formulir>
      ) : (
        <button className="tombol kecil" onClick={() => setBuka(true)} style={{ alignSelf: 'flex-start' }}>
          <Plus size={20} aria-hidden /> Tambah akun
        </button>
      )}
      <div className="tabel-wadah">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Nomor HP</th>
              <th>Peran</th>
              <th>Desa</th>
              <th>Status</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {akun.data.map((a) => (
              <tr key={a.id}>
                <td className="tebal">{a.nama}</td>
                <td>{a.hp}</td>
                <td>{NAMA_PERAN[a.peran]}</td>
                <td>{a.desa_id ? namaDesa.get(a.desa_id) : '–'}</td>
                <td>{a.aktif ? <span className="lencana chip hijau">Aktif</span> : <span className="lencana chip abu">Nonaktif</span>}</td>
                <td>
                  <div className="baris-aksi">
                    {a.id !== u.id && (
                      <button className="tombol kedua kecil" onClick={() => ubah(a.id, { aktif: !a.aktif }, a.aktif ? 'Akun dinonaktifkan' : 'Akun diaktifkan')}>
                        {a.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    )}
                    {resetId === a.id ? (
                      <>
                        <input className="masukan" style={{ width: 110, minHeight: 48 }} aria-label="PIN baru" inputMode="numeric" maxLength={4} value={pinBaru} onChange={(e) => setPinBaru(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                        <button
                          className="tombol kecil"
                          disabled={pinBaru.length !== 4}
                          onClick={() => {
                            void ubah(a.id, { pin: pinBaru }, 'PIN diatur ulang');
                            setResetId(null);
                            setPinBaru('');
                          }}
                        >
                          Simpan PIN
                        </button>
                      </>
                    ) : (
                      <button className="tombol kedua kecil" onClick={() => setResetId(a.id)}>
                        Atur ulang PIN
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="catatan-kaki">Perubahan akun berlaku di perangkat lapangan saat perangkat itu tersinkron berikutnya.</p>
    </>
  );
}

// --- Desa ----------------------------------------------------------------------

function KelolaDesa() {
  const u = useKeadaan((k) => k.pengguna)!;
  const desa = useApi<Desa[]>('/admin/desa');
  const [buka, setBuka] = useState(false);
  const [isi, setIsi] = useState({ nama: '', kode: '', jumlah_petani_pisang: '0', biaya_tebang: '0' });
  const [edit, setEdit] = useState<Record<string, { jumlah: string; biaya: string }>>({});

  async function tambah(e: FormEvent) {
    e.preventDefault();
    try {
      await kirimAdmin(
        '/admin/desa',
        'POST',
        { nama: isi.nama, kode: isi.kode.toUpperCase(), jumlah_petani_pisang: Number(isi.jumlah_petani_pisang) || 0, biaya_tebang: Number(isi.biaya_tebang) || 0 },
        u.id,
      );
      tampilkanPesan('Desa ditambahkan');
      setBuka(false);
      void desa.muat();
    } catch (err) {
      tampilkanPesan((err as Error).message, 'galat');
    }
  }

  async function simpan(d: Desa) {
    const x = edit[d.id];
    try {
      await kirimAdmin(`/admin/desa/${d.id}`, 'PATCH', { jumlah_petani_pisang: Number(x.jumlah) || 0, biaya_tebang: Number(x.biaya) || 0 }, u.id);
      tampilkanPesan('Desa diperbarui');
      setEdit((s) => {
        const n = { ...s };
        delete n[d.id];
        return n;
      });
      void desa.muat();
    } catch (err) {
      tampilkanPesan((err as Error).message, 'galat');
    }
  }

  if (desa.galat) return <Galat pesan={desa.galat} ulang={desa.muat} />;
  if (!desa.data) return <Memuat />;

  return (
    <>
      {buka ? (
        <Formulir judul="Tambah desa" kirim={tambah} tutup={() => setBuka(false)}>
          <Medan label="Nama desa">
            <input className="masukan" required value={isi.nama} onChange={(e) => setIsi({ ...isi, nama: e.target.value })} />
          </Medan>
          <Medan label="Kode desa">
            <input className="masukan" required value={isi.kode} onChange={(e) => setIsi({ ...isi, kode: e.target.value })} />
          </Medan>
          <Medan label="Perkiraan jumlah petani pisang">
            <input className="masukan" inputMode="numeric" value={isi.jumlah_petani_pisang} onChange={(e) => setIsi({ ...isi, jumlah_petani_pisang: e.target.value.replace(/\D/g, '') })} />
          </Medan>
          <Medan label="Biaya tebang dan angkut darat (Rp/tandan)">
            <input className="masukan" inputMode="numeric" value={isi.biaya_tebang} onChange={(e) => setIsi({ ...isi, biaya_tebang: e.target.value.replace(/\D/g, '') })} />
          </Medan>
        </Formulir>
      ) : (
        <button className="tombol kecil" onClick={() => setBuka(true)} style={{ alignSelf: 'flex-start' }}>
          <Plus size={20} aria-hidden /> Tambah desa
        </button>
      )}
      <div className="tabel-wadah">
        <table>
          <thead>
            <tr>
              <th>Desa</th>
              <th>Kode</th>
              <th className="angka">Perkiraan petani pisang</th>
              <th className="angka">Biaya tebang</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {desa.data.map((d) => {
              const x = edit[d.id];
              return (
                <tr key={d.id}>
                  <td className="tebal">{d.nama}</td>
                  <td>{d.kode}</td>
                  <td className="angka">
                    {x ? (
                      <input className="masukan" style={{ width: 100, minHeight: 44 }} aria-label="Perkiraan petani pisang" value={x.jumlah} onChange={(e) => setEdit({ ...edit, [d.id]: { ...x, jumlah: e.target.value.replace(/\D/g, '') } })} />
                    ) : (
                      d.jumlah_petani_pisang
                    )}
                  </td>
                  <td className="angka">
                    {x ? (
                      <input className="masukan" style={{ width: 120, minHeight: 44 }} aria-label="Biaya tebang" value={x.biaya} onChange={(e) => setEdit({ ...edit, [d.id]: { ...x, biaya: e.target.value.replace(/\D/g, '') } })} />
                    ) : (
                      rupiah(d.biaya_tebang)
                    )}
                  </td>
                  <td>
                    {x ? (
                      <button className="tombol kecil" onClick={() => simpan(d)}>
                        Simpan
                      </button>
                    ) : (
                      <button className="tombol kedua kecil" onClick={() => setEdit({ ...edit, [d.id]: { jumlah: String(d.jumlah_petani_pisang), biaya: String(d.biaya_tebang) } })}>
                        Ubah
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="catatan-kaki">Simpul desa dibuat dengan kode aktivasi berjenis desa di tab Perangkat.</p>
    </>
  );
}

// --- Kapal ---------------------------------------------------------------------

function KelolaKapal() {
  const u = useKeadaan((k) => k.pengguna)!;
  const kapal = useApi<Kapal[]>('/admin/kapal');
  const akun = useApi<Omit<Pengguna, 'pin_hash'>[]>('/admin/pengguna');
  const [buka, setBuka] = useState(false);
  const [isi, setIsi] = useState({ nama: '', jenis: 'nelayan', pengelola_id: '' });

  async function tambah(e: FormEvent) {
    e.preventDefault();
    try {
      await kirimAdmin('/admin/kapal', 'POST', { ...isi, pengelola_id: isi.pengelola_id || null }, u.id);
      tampilkanPesan('Kapal ditambahkan');
      setBuka(false);
      void kapal.muat();
      void sinkronkan();
    } catch (err) {
      tampilkanPesan((err as Error).message, 'galat');
    }
  }

  async function ubah(id: string, body: Record<string, unknown>) {
    try {
      await kirimAdmin(`/admin/kapal/${id}`, 'PATCH', body, u.id);
      tampilkanPesan('Kapal diperbarui');
      void kapal.muat();
    } catch (err) {
      tampilkanPesan((err as Error).message, 'galat');
    }
  }

  if (kapal.galat) return <Galat pesan={kapal.galat} ulang={kapal.muat} />;
  if (!kapal.data || !akun.data) return <Memuat />;
  const pengelola = akun.data.filter((a) => a.peran === 'kapal');

  return (
    <>
      {buka ? (
        <Formulir judul="Tambah kapal" kirim={tambah} tutup={() => setBuka(false)}>
          <Medan label="Nama kapal">
            <input className="masukan" required value={isi.nama} onChange={(e) => setIsi({ ...isi, nama: e.target.value })} />
          </Medan>
          <Medan label="Jenis">
            <select className="masukan" value={isi.jenis} onChange={(e) => setIsi({ ...isi, jenis: e.target.value })}>
              {Object.entries(NAMA_JENIS_KAPAL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Medan>
          <Medan label="Pengelola kapal">
            <select className="masukan" value={isi.pengelola_id} onChange={(e) => setIsi({ ...isi, pengelola_id: e.target.value })}>
              <option value="">Belum ada</option>
              {pengelola.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </select>
          </Medan>
        </Formulir>
      ) : (
        <button className="tombol kecil" onClick={() => setBuka(true)} style={{ alignSelf: 'flex-start' }}>
          <Plus size={20} aria-hidden /> Tambah kapal
        </button>
      )}
      <div className="tabel-wadah">
        <table>
          <thead>
            <tr>
              <th>Kapal</th>
              <th>Jenis</th>
              <th>Pengelola</th>
              <th>Status</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {kapal.data.map((k) => (
              <tr key={k.id}>
                <td className="tebal">{k.nama}</td>
                <td>{NAMA_JENIS_KAPAL[k.jenis]}</td>
                <td>
                  <select className="masukan" style={{ minHeight: 44, fontSize: '0.9375rem' }} aria-label={`Pengelola ${k.nama}`} value={k.pengelola_id ?? ''} onChange={(e) => ubah(k.id, { pengelola_id: e.target.value || null })}>
                    <option value="">Belum ada</option>
                    {pengelola.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{k.aktif ? <span className="lencana chip hijau">Aktif</span> : <span className="lencana chip abu">Nonaktif</span>}</td>
                <td>
                  <button className="tombol kedua kecil" onClick={() => ubah(k.id, { aktif: !k.aktif })}>
                    {k.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// --- Perangkat dan kode aktivasi (FR-61, FR-06) ---------------------------------

interface KodeAktivasi {
  kode: string;
  desa_id: string | null;
  pengguna_id: string | null;
  keterangan: string;
  dibuat: string;
  dipakai_pada: string | null;
}

interface PerangkatAdmin {
  id: string;
  nama: string;
  desa_id: string | null;
  pengguna_id: string | null;
  aktif: boolean;
  dibuat: string;
  terakhir_sinkron: string | null;
}

function KelolaPerangkat() {
  const u = useKeadaan((k) => k.pengguna)!;
  const kode = useApi<KodeAktivasi[]>('/admin/kode');
  const perangkat = useApi<PerangkatAdmin[]>('/admin/perangkat');
  const desa = useApi<Desa[]>('/admin/desa');
  const akun = useApi<Omit<Pengguna, 'pin_hash'>[]>('/admin/pengguna');
  const [jenis, setJenis] = useState<'desa' | 'pengguna'>('desa');
  const [target, setTarget] = useState('');
  const [ket, setKet] = useState('');
  const [baru, setBaru] = useState<string | null>(null);

  async function buat(e: FormEvent) {
    e.preventDefault();
    if (!target) return tampilkanPesan('Pilih desa atau akun lebih dulu.', 'galat');
    try {
      const k = await kirimAdmin<KodeAktivasi>('/admin/kode', 'POST', { [jenis === 'desa' ? 'desa_id' : 'pengguna_id']: target, keterangan: ket }, u.id);
      setBaru(k.kode);
      setKet('');
      void kode.muat();
    } catch (err) {
      tampilkanPesan((err as Error).message, 'galat');
    }
  }

  async function ubahPerangkat(id: string, aktif: boolean) {
    try {
      await panggil(`/admin/perangkat/${id}?aktif=${aktif}`, { method: 'PATCH', pengguna: u.id });
      tampilkanPesan(aktif ? 'Perangkat diaktifkan' : 'Perangkat dinonaktifkan');
      void perangkat.muat();
    } catch (err) {
      tampilkanPesan((err as Error).message, 'galat');
    }
  }

  if (kode.galat) return <Galat pesan={kode.galat} ulang={kode.muat} />;
  if (!kode.data || !perangkat.data || !desa.data || !akun.data) return <Memuat />;
  const namaDesa = new Map(desa.data.map((d) => [d.id, d.nama]));
  const namaAkun = new Map(akun.data.map((a) => [a.id, `${a.nama} (${NAMA_PERAN[a.peran]})`]));
  const untuk = (d: string | null, p: string | null) => (d ? `Simpul Desa ${namaDesa.get(d) ?? ''}` : p ? `Pribadi: ${namaAkun.get(p) ?? ''}` : '–');

  return (
    <>
      <form className="kartu" onSubmit={buat} style={{ gap: 14 }}>
        <h3>Buat kode aktivasi</h3>
        <div className="pilihan" role="group" aria-label="Jenis perangkat">
          <button type="button" aria-pressed={jenis === 'desa'} onClick={() => { setJenis('desa'); setTarget(''); }}>
            Perangkat simpul desa
          </button>
          <button type="button" aria-pressed={jenis === 'pengguna'} onClick={() => { setJenis('pengguna'); setTarget(''); }}>
            Ponsel pribadi satu akun
          </button>
        </div>
        <div className="kisi">
          <Medan label={jenis === 'desa' ? 'Desa' : 'Akun'}>
            <select className="masukan" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">{jenis === 'desa' ? 'Pilih desa' : 'Pilih akun'}</option>
              {jenis === 'desa'
                ? desa.data.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nama}
                    </option>
                  ))
                : akun.data.map((a) => (
                    <option key={a.id} value={a.id}>
                      {namaAkun.get(a.id)}
                    </option>
                  ))}
            </select>
          </Medan>
          <Medan label="Keterangan">
            <input className="masukan" value={ket} onChange={(e) => setKet(e.target.value)} placeholder="Contoh: tablet koperasi" />
          </Medan>
        </div>
        <button className="tombol kecil" style={{ alignSelf: 'flex-start' }}>
          Buat kode
        </button>
        {baru && (
          <KotakPesan jenis="hijau">
            Kode baru: <code className="kode">{baru}</code>. Berikan kepada pemegang perangkat. Kode hanya dapat dipakai sekali.
          </KotakPesan>
        )}
        <p className="catatan-kaki">Perangkat simpul dipakai bersama oleh Pengelola simpul dan petani desa itu. Ponsel pribadi hanya untuk satu akun.</p>
      </form>

      <p className="bagian-judul">Perangkat terdaftar</p>
      <div className="tabel-wadah">
        <table>
          <thead>
            <tr>
              <th>Untuk</th>
              <th>Diaktifkan</th>
              <th>Terakhir sinkron</th>
              <th>Status</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {perangkat.data.map((p) => (
              <tr key={p.id}>
                <td>{untuk(p.desa_id, p.pengguna_id)}</td>
                <td>{waktuLokal(p.dibuat)}</td>
                <td>{p.terakhir_sinkron ? waktuLokal(p.terakhir_sinkron) : 'Belum pernah'}</td>
                <td>{p.aktif ? <span className="lencana chip hijau">Aktif</span> : <span className="lencana chip abu">Nonaktif</span>}</td>
                <td>
                  <button className={`tombol kecil ${p.aktif ? 'bahaya' : 'kedua'}`} onClick={() => ubahPerangkat(p.id, !p.aktif)}>
                    {p.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="bagian-judul">Kode aktivasi</p>
      <div className="tabel-wadah">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Untuk</th>
              <th>Keterangan</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {kode.data.map((k) => (
              <tr key={k.kode}>
                <td>
                  <code className="kode">{k.kode}</code>
                </td>
                <td>{untuk(k.desa_id, k.pengguna_id)}</td>
                <td>{k.keterangan || '–'}</td>
                <td>{k.dipakai_pada ? `Dipakai ${waktuLokal(k.dipakai_pada)}` : <span className="lencana chip aksen">Belum dipakai</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// --- Parameter -----------------------------------------------------------------

const LABEL_PARAMETER: Record<keyof Parameter, [string, string]> = {
  batas_harga_lama_hari: ['Batas harga lama', 'hari'],
  jam_batas_cocok: ['Batas waktu pencocokan, hari sebelum berangkat', 'pukul (0 sampai 23)'],
  pin_maks_salah: ['PIN salah sebelum dikunci', 'kali'],
  pin_kunci_menit: ['Lama kunci setelah PIN salah', 'menit'],
  selisih_jam_menit: ['Peringatan selisih jam perangkat', 'menit'],
};

function KelolaParameter() {
  const u = useKeadaan((k) => k.pengguna)!;
  const p = useApi<Parameter>('/admin/parameter');
  const [isi, setIsi] = useState<Record<string, string>>({});

  useEffect(() => {
    if (p.data) setIsi(Object.fromEntries(Object.entries(p.data).map(([k, v]) => [k, String(v)])));
  }, [p.data]);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    try {
      await kirimAdmin('/admin/parameter', 'PUT', Object.fromEntries(Object.entries(isi).map(([k, v]) => [k, Number(v)])), u.id);
      tampilkanPesan('Parameter tersimpan');
      void p.muat();
      void sinkronkan();
    } catch (err) {
      tampilkanPesan((err as Error).message, 'galat');
    }
  }

  if (p.galat) return <Galat pesan={p.galat} ulang={p.muat} />;
  if (!p.data) return <Memuat jumlah={1} />;

  return (
    <form className="kartu" onSubmit={simpan} style={{ gap: 14 }}>
      <h3>Parameter (nilai awal PRD dapat disetel ulang)</h3>
      <div className="kisi">
        {(Object.keys(LABEL_PARAMETER) as (keyof Parameter)[]).map((k) => (
          <Medan key={k} label={`${LABEL_PARAMETER[k][0]} (${LABEL_PARAMETER[k][1]})`}>
            <input className="masukan" inputMode="numeric" value={isi[k] ?? ''} onChange={(e) => setIsi({ ...isi, [k]: e.target.value.replace(/\D/g, '') })} />
          </Medan>
        ))}
      </div>
      <button className="tombol kecil" style={{ alignSelf: 'flex-start' }}>
        Simpan parameter
      </button>
      <p className="catatan-kaki">Jumlah petani pisang dan biaya tebang diatur per desa di tab Desa. Perubahan berlaku di perangkat setelah sinkron.</p>
    </form>
  );
}

// --- Log audit (FR-64) -----------------------------------------------------------

interface BarisLog {
  id: number;
  waktu: string;
  pengguna: string | null;
  tindakan: string;
  objek: string;
  nilai_lama: string | null;
  nilai_baru: string | null;
}

function LogAudit() {
  const log = useApi<BarisLog[]>('/admin/audit');
  if (log.galat) return <Galat pesan={log.galat} ulang={log.muat} />;
  if (!log.data) return <Memuat />;
  if (log.data.length === 0) return <KotakPesan jenis="abu">Belum ada catatan di log audit.</KotakPesan>;
  return (
    <div className="tabel-wadah">
      <table>
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Pengguna</th>
            <th>Tindakan</th>
            <th>Objek</th>
            <th>Nilai lama</th>
            <th>Nilai baru</th>
          </tr>
        </thead>
        <tbody>
          {log.data.map((l) => (
            <tr key={l.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{waktuLokal(l.waktu)}</td>
              <td>{l.pengguna ?? '–'}</td>
              <td>{l.tindakan.replace(/_/g, ' ')}</td>
              <td className="kecil">{l.objek}</td>
              <td className="kecil" style={{ maxWidth: 260, wordBreak: 'break-word' }}>{l.nilai_lama ?? '–'}</td>
              <td className="kecil" style={{ maxWidth: 260, wordBreak: 'break-word' }}>{l.nilai_baru ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
