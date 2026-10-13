import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, Pencil, Tag, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layar } from '../komponen/Kerangka';
import { CatatanLuring, Kosong, KotakPesan, Memuat, masukanRupiah } from '../komponen/Umum';
import { ubahBiayaTebang } from '../lib/aksi';
import { GalatJaringan, panggil } from '../lib/api';
import { db } from '../lib/db';
import { angka, hariLalu, rupiah, tanggal, waktuBerangkat } from '../lib/format';
import { buatId } from '../lib/id';
import { parameter } from '../lib/sesi';
import { tampilkanPesan, useKeadaan } from '../lib/toko';
import type { Harga as THarga } from '../lib/tipe';
import { hariIniWib, selisihHari } from '../lib/waktu';

const KALIMAT_WAJIB = 'Harga acuan membantu memutuskan menjual atau menunda. Ini bukan jaminan harga beli.';

/** Umur harga (PRD 8): 0-3 hari biasa, 4-7 hari ditebalkan, lebih dari batas: "Harga lama". */
function LabelUmur({ hari, batas }: { hari: number; batas: number }) {
  if (hari > batas)
    return (
      <span className="lencana chip merah">
        <TriangleAlert size={16} aria-hidden /> Harga lama · {hariLalu(hari)}
      </span>
    );
  return (
    <span className="lencana chip abu" style={hari >= 4 ? { fontWeight: 800, color: 'var(--teks)' } : { fontWeight: 500 }}>
      <Clock size={16} aria-hidden /> {hariLalu(hari)}
    </span>
  );
}

export function Harga() {
  const u = useKeadaan((k) => k.pengguna)!;
  const data = useLiveQuery(async () => {
    const harga = await db.harga.orderBy('tanggal').reverse().toArray();
    const kapal = new Map((await db.kapal.toArray()).map((k) => [k.id, k.nama]));
    const kbs = (await db.keberangkatan.orderBy('berangkat').toArray()).filter(
      (k) => (k.status === 'buka' || k.status === 'penuh') && k.berangkat.slice(0, 10) >= hariIniWib(),
    );
    const desa = await db.desa.toArray();
    return { harga, kapal, kbs, desa, p: await parameter() };
  }, []);

  const pasar = useMemo(() => {
    const urut: string[] = [];
    for (const h of data?.harga ?? []) if (!urut.includes(h.pasar)) urut.push(h.pasar);
    return urut;
  }, [data]);

  const [pasarPilih, setPasarPilih] = useState<string | null>(null);
  const [kbPilih, setKbPilih] = useState<string | null>(null);
  const [desaPilih, setDesaPilih] = useState<string | null>(u.desa_id);

  if (!data) return <Layar judul="Harga acuan"><Memuat jumlah={2} /></Layar>;

  const pasarAktif = pasarPilih ?? pasar[0];
  const riwayat = data.harga.filter((h) => h.pasar === pasarAktif).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.waktu.localeCompare(a.waktu));
  const terbaru = riwayat[0];
  const kb = data.kbs.find((k) => k.id === kbPilih) ?? data.kbs[0];
  const desa = data.desa.find((d) => d.id === (desaPilih ?? data.desa[0]?.id));

  if (!terbaru)
    return (
      <Layar judul="Harga acuan">
        <Kosong ikon={<Tag size={48} aria-hidden />} judul="Harga acuan belum tersedia">
          <p>Harga dikirim Mitra pasar di Kota Bengkulu dan diterima perangkat ini saat sinkron berikutnya.</p>
        </Kosong>
        <p className="catatan-kaki">{KALIMAT_WAJIB}</p>
      </Layar>
    );

  const umur = Math.max(0, selisihHari(terbaru.tanggal, hariIniWib()));
  const tarif = kb?.tarif ?? 0;
  const tebang = desa?.biaya_tebang ?? 0;
  const biaya = tarif + tebang;
  const sisa = terbaru.harga - biaya;

  return (
    <Layar judul="Harga acuan">
      {pasar.length > 1 && (
        <div className="pilihan" role="group" aria-label="Pilih pasar">
          {pasar.map((p) => (
            <button key={p} aria-pressed={p === pasarAktif} onClick={() => setPasarPilih(p)}>
              {p}
            </button>
          ))}
        </div>
      )}
      <div className="kartu">
        <p className="redup">Harga acuan di {pasarAktif}</p>
        <p className="angka-besar">
          {rupiah(terbaru.harga)} <small>/tandan</small>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span className="redup">Diperbarui {tanggal(terbaru.tanggal, true)}</span>
          <LabelUmur hari={umur} batas={data.p.batas_harga_lama_hari} />
        </div>
      </div>

      {umur > data.p.batas_harga_lama_hari && (
        <KotakPesan jenis="kuning">
          Harga ini sudah lebih dari {data.p.batas_harga_lama_hari} hari. Harga di pasar mungkin sudah berubah.
        </KotakPesan>
      )}

      <div className="rincian">
        <div>
          <span>Harga acuan</span>
          <span className="nilai">{rupiah(terbaru.harga)}</span>
        </div>
        <div>
          <span>
            Biaya angkut dan tebang
            <br />
            <span className="redup kecil">
              {kb ? `Kapal ${rupiah(tarif)}` : 'Belum ada kapal'} · tebang dan angkut darat {rupiah(tebang)}
            </span>
          </span>
          <span className="nilai">− {rupiah(biaya)}</span>
        </div>
        <div>
          <span>Sisa hasil per tandan</span>
          <span className="nilai aksen" style={sisa <= 0 ? { color: 'var(--merah)' } : undefined}>
            {rupiah(sisa)}
          </span>
        </div>
      </div>
      {sisa <= 0 && (
        <KotakPesan jenis="merah">
          <span className="tebal">Sisa hasil negatif.</span> Biaya angkut dan tebang sama atau lebih besar dari harga acuan.
        </KotakPesan>
      )}

      <p className="catatan-kaki">{KALIMAT_WAJIB}</p>

      {data.kbs.length > 1 && (
        <div className="medan">
          <label htmlFor="kb">Tarif kapal yang dipakai</label>
          <select id="kb" className="masukan" value={kb?.id ?? ''} onChange={(e) => setKbPilih(e.target.value)}>
            {data.kbs.map((k) => (
              <option key={k.id} value={k.id}>
                {data.kapal.get(k.kapal_id) ?? 'Kapal'}, {waktuBerangkat(k.berangkat)} ({rupiah(k.tarif)})
              </option>
            ))}
          </select>
        </div>
      )}
      {!u.desa_id && data.desa.length > 0 && (
        <div className="medan">
          <label htmlFor="desa">Biaya tebang desa</label>
          <select id="desa" className="masukan" value={desa?.id ?? ''} onChange={(e) => setDesaPilih(e.target.value)}>
            {data.desa.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama} ({rupiah(d.biaya_tebang)})
              </option>
            ))}
          </select>
        </div>
      )}
      {u.peran === 'simpul' && (
        <Link to="/harga/biaya" className="tombol kedua">
          <Pencil size={20} aria-hidden /> Ubah biaya tebang
        </Link>
      )}

      {riwayat.length > 1 && (
        <>
          <p className="bagian-judul">Riwayat harga</p>
          <RiwayatHarga daftar={riwayat.slice(0, 5)} />
        </>
      )}
    </Layar>
  );
}

function RiwayatHarga({ daftar }: { daftar: THarga[] }) {
  return (
    <div className="rincian">
      {daftar.map((h) => (
        <div key={h.id}>
          <span>{tanggal(h.tanggal)}</span>
          <span className="nilai">{rupiah(h.harga)}</span>
        </div>
      ))}
    </div>
  );
}

/** FR-44: Pengelola simpul mengisi biaya tebang dan angkut darat per tandan untuk desanya. */
export function BiayaTebang() {
  const u = useKeadaan((k) => k.pengguna)!;
  const pindah = useNavigate();
  const desa = useLiveQuery(() => db.desa.get(u.desa_id ?? '-'), [u.desa_id]);
  const [nilai, setNilai] = useState<string | null>(null);

  useEffect(() => {
    if (desa && nilai === null) setNilai(String(desa.biaya_tebang));
  }, [desa, nilai]);

  if (!desa || nilai === null) return <Layar judul="Biaya tebang" kembali nav={false}><Memuat jumlah={1} /></Layar>;

  async function simpan(e: FormEvent) {
    e.preventDefault();
    await ubahBiayaTebang(desa!.id, masukanRupiah(nilai!) ?? 0);
    tampilkanPesan('Tersimpan');
    pindah('/harga', { replace: true });
  }

  return (
    <Layar judul="Biaya tebang" kembali nav={false} tombol={<button className="tombol" form="form-biaya">Simpan</button>}>
      <form id="form-biaya" onSubmit={simpan} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="medan">
          <label htmlFor="biaya">Biaya tebang dan angkut darat per tandan, Desa {desa.nama} (Rp)</label>
          <input id="biaya" className="masukan besar" inputMode="numeric" value={angka(masukanRupiah(nilai) ?? 0)} onChange={(e) => setNilai(e.target.value)} />
          <p className="petunjuk">Satu nilai untuk seluruh desa. Dipakai menghitung sisa hasil per tandan.</p>
        </div>
        <CatatanLuring />
      </form>
    </Layar>
  );
}

/** FR-40: Mitra pasar memasukkan harga per tandan saat tersambung. */
export function InputHarga() {
  const u = useKeadaan((k) => k.pengguna)!;
  const online = useKeadaan((k) => k.jaringan);
  const harga = useLiveQuery(() => db.harga.orderBy('tanggal').reverse().toArray(), []);
  const daftarPasar = useMemo(() => [...new Set((harga ?? []).map((h) => h.pasar))], [harga]);
  const [pasar, setPasar] = useState('');
  const [pasarBaru, setPasarBaru] = useState('');
  const [tgl, setTgl] = useState(hariIniWib());
  const [nilai, setNilai] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [proses, setProses] = useState(false);

  useEffect(() => {
    if (!pasar && daftarPasar.length) setPasar(daftarPasar[0]);
  }, [daftarPasar, pasar]);

  const namaPasar = pasar === '__baru' ? pasarBaru.trim() : pasar;
  const riwayat = (harga ?? []).filter((h) => h.pasar === namaPasar).slice(0, 5);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    const n = masukanRupiah(nilai);
    if (namaPasar.length < 2) return setGalat('Pilih atau tulis nama pasar.');
    if (!n) return setGalat('Isi harga per tandan.');
    setProses(true);
    try {
      const h = await panggil<THarga>('/harga', {
        method: 'POST',
        pengguna: u.id,
        body: { id: buatId(), pasar: namaPasar, tanggal: tgl, harga: n },
      });
      await db.harga.put(h);
      setNilai('');
      if (pasar === '__baru') setPasar(namaPasar);
      tampilkanPesan('Harga tersimpan dan terkirim');
    } catch (err) {
      setGalat(err instanceof GalatJaringan ? 'Input harga butuh sinyal. Coba lagi saat tersambung.' : err instanceof Error ? err.message : String(err));
    } finally {
      setProses(false);
    }
  }

  return (
    <Layar
      judul="Input harga"
      tombol={
        <button className="tombol" form="form-harga" disabled={proses || !online}>
          {proses ? 'Mengirim…' : 'Simpan harga'}
        </button>
      }
    >
      {!online && <KotakPesan jenis="kuning">Input harga butuh sinyal. Tombol Simpan harga aktif lagi saat tersambung.</KotakPesan>}
      <form id="form-harga" onSubmit={simpan} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>
        <div className="medan">
          <label htmlFor="pasar">Pasar</label>
          <select id="pasar" className="masukan" value={pasar} onChange={(e) => setPasar(e.target.value)}>
            {daftarPasar.map((p) => (
              <option key={p}>{p}</option>
            ))}
            <option value="__baru">Pasar lain…</option>
          </select>
          {(pasar === '__baru' || daftarPasar.length === 0) && (
            <input
              className="masukan"
              aria-label="Nama pasar"
              placeholder="Contoh: Pasar Panorama, Kota Bengkulu"
              value={pasarBaru}
              onChange={(e) => {
                setPasar('__baru');
                setPasarBaru(e.target.value);
              }}
            />
          )}
        </div>
        <div className="medan">
          <label htmlFor="tgl">Tanggal</label>
          <input id="tgl" type="date" className="masukan" value={tgl} max={hariIniWib()} onChange={(e) => setTgl(e.target.value)} />
        </div>
        <div className="medan">
          <label htmlFor="harga">Harga per tandan (Rp)</label>
          <input id="harga" className="masukan besar" inputMode="numeric" value={nilai ? angka(masukanRupiah(nilai) ?? 0) : ''} onChange={(e) => setNilai(e.target.value)} />
        </div>
        {galat && <KotakPesan jenis="merah">{galat}</KotakPesan>}
      </form>
      {riwayat.length > 0 && (
        <>
          <p className="bagian-judul">Harga terakhir</p>
          <RiwayatHarga daftar={riwayat} />
        </>
      )}
    </Layar>
  );
}
