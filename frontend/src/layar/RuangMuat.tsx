import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Ship } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layar } from '../komponen/Kerangka';
import { CatatanLuring, Kosong, KotakPesan, LencanaKeberangkatan, Memuat, Stepper, masukanRupiah } from '../komponen/Umum';
import { catatKeberangkatan, ubahKeberangkatan } from '../lib/aksi';
import { db } from '../lib/db';
import { angka, rupiah, tandan, waktuBerangkat, NAMA_JENIS_KAPAL } from '../lib/format';
import { tampilkanPesan, useKeadaan } from '../lib/toko';
import type { Kapal, Keberangkatan, Pengguna, StatusKeberangkatan } from '../lib/tipe';
import { hariIniWib, tambahHari } from '../lib/waktu';

export function bolehUbahKapal(u: Pengguna, kapal: Kapal | undefined): boolean {
  if (u.peran === 'admin' || u.peran === 'simpul') return true;
  return u.peran === 'kapal' && !!kapal && kapal.pengelola_id === u.id;
}

/** FR-25: Pengelola simpul dan Petani melihat keberangkatan berstatus Buka (baca saja). */
function terlihat(u: Pengguna, kb: Keberangkatan, kapal?: Kapal): boolean {
  if (u.peran === 'petani' || u.peran === 'simpul') return kb.status === 'buka' || !!kb._tertunda;
  if (u.peran === 'kapal') return kapal?.pengelola_id === u.id || kb.status === 'buka';
  return true;
}

export function RuangMuat() {
  const u = useKeadaan((k) => k.pengguna)!;
  const data = useLiveQuery(async () => {
    const [kbs, kapal] = await Promise.all([db.keberangkatan.orderBy('berangkat').toArray(), db.kapal.toArray()]);
    const peta = new Map(kapal.map((k) => [k.id, k]));
    const batasLama = tambahHari(hariIniWib(), -3);
    return {
      peta,
      kbs: kbs.filter((kb) => kb.berangkat.slice(0, 10) >= batasLama && terlihat(u, kb, peta.get(kb.kapal_id))),
      punyaKapal: kapal.some((k) => bolehUbahKapal(u, k) && k.aktif),
    };
  }, [u.id]);

  const bisaCatat = data?.punyaKapal && u.peran !== 'petani';

  return (
    <Layar
      judul="Ruang Muat"
      tombol={
        bisaCatat ? (
          <Link to="/ruang-muat/catat" className="tombol">
            <Plus size={24} aria-hidden /> Catat keberangkatan
          </Link>
        ) : undefined
      }
    >
      {!data ? (
        <Memuat />
      ) : data.kbs.length === 0 ? (
        <Kosong ikon={<Ship size={48} aria-hidden />} judul="Belum ada kapal yang buka">
          <p>
            {u.peran === 'kapal'
              ? 'Tekan Catat keberangkatan untuk mengisi jadwal, sisa ruang, dan tarif kapal Anda.'
              : 'Keberangkatan muncul di sini setelah pengelola kapal mencatatnya dan perangkat tersinkron.'}
          </p>
        </Kosong>
      ) : (
        data.kbs.map((kb) => {
          const kapal = data.peta.get(kb.kapal_id);
          const bisa = bolehUbahKapal(u, kapal) && !['berangkat', 'batal'].includes(kb.status);
          const isi = (
            <>
              <div className="kartu-kepala">
                <h2>{kapal?.nama ?? 'Kapal'}</h2>
                <LencanaKeberangkatan status={kb.status} tertunda={!!kb._tertunda} />
              </div>
              <p className="redup">Berangkat {waktuBerangkat(kb.berangkat)}</p>
              <p className="redup">
                Sisa ruang {tandan(kb.status === 'penuh' ? 0 : kb.sisa_ruang)} · {rupiah(kb.tarif)}/tandan
              </p>
              <p className="redup kecil">
                {kb.asal} ke {kb.tujuan}
              </p>
            </>
          );
          return bisa ? (
            <Link key={kb.id} to={`/ruang-muat/${kb.id}`} className="kartu">
              {isi}
            </Link>
          ) : (
            <div key={kb.id} className="kartu">
              {isi}
            </div>
          );
        })
      )}
    </Layar>
  );
}

const ASAL_AWAL = 'Pelabuhan Malakoni, Enggano';
const TUJUAN_AWAL = 'Pelabuhan Pulau Baai, Kota Bengkulu';

export function CatatKeberangkatan() {
  const u = useKeadaan((k) => k.pengguna)!;
  const pindah = useNavigate();
  const kapal = useLiveQuery(async () => (await db.kapal.toArray()).filter((k) => k.aktif && bolehUbahKapal(u, k)), [u.id]);
  const [kapalId, setKapalId] = useState('');
  const [asal, setAsal] = useState(ASAL_AWAL);
  const [tujuan, setTujuan] = useState(TUJUAN_AWAL);
  const [tgl, setTgl] = useState(tambahHari(hariIniWib(), 3));
  const [jam, setJam] = useState('06:00');
  const [ruang, setRuang] = useState(300);
  const [tarif, setTarif] = useState('8000');
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (kapal?.length === 1) setKapalId(kapal[0].id);
  }, [kapal]);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    const t = masukanRupiah(tarif);
    if (!kapalId) return setGalat('Pilih kapal lebih dulu.');
    if (!tgl || !jam) return setGalat('Isi tanggal dan jam berangkat.');
    if (t === null) return setGalat('Isi tarif per tandan.');
    await catatKeberangkatan({ kapal_id: kapalId, asal, tujuan, berangkat: `${tgl}T${jam}`, sisa_ruang: ruang, tarif: t });
    tampilkanPesan('Tersimpan');
    pindah('/ruang-muat', { replace: true });
  }

  return (
    <Layar judul="Catat keberangkatan" kembali nav={false} tombol={<button className="tombol" form="form-kb">Simpan</button>}>
      {!kapal ? (
        <Memuat jumlah={2} />
      ) : kapal.length === 0 ? (
        <KotakPesan jenis="kuning">Belum ada kapal atas nama Anda. Minta Admin menambahkan kapal Anda.</KotakPesan>
      ) : (
        <form id="form-kb" onSubmit={simpan} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>
          <div className="medan">
            <label htmlFor="kapal">Kapal</label>
            <select id="kapal" className="masukan" value={kapalId} onChange={(e) => setKapalId(e.target.value)}>
              <option value="">Pilih kapal</option>
              {kapal.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama} ({NAMA_JENIS_KAPAL[k.jenis]})
                </option>
              ))}
            </select>
          </div>
          <div className="kisi" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)' }}>
            <div className="medan">
              <label htmlFor="tgl">Tanggal berangkat</label>
              <input id="tgl" type="date" className="masukan" value={tgl} onChange={(e) => setTgl(e.target.value)} />
            </div>
            <div className="medan">
              <label htmlFor="jam">Jam (WIB)</label>
              <input id="jam" type="time" className="masukan" value={jam} onChange={(e) => setJam(e.target.value)} />
            </div>
          </div>
          <div className="medan">
            <span className="label">Sisa ruang (tandan)</span>
            <Stepper nilai={ruang} ubah={setRuang} min={0} label="Sisa ruang dalam tandan" />
          </div>
          <div className="medan">
            <label htmlFor="tarif">Tarif per tandan (Rp)</label>
            <input
              id="tarif"
              className="masukan besar"
              inputMode="numeric"
              value={tarif ? angka(masukanRupiah(tarif) ?? 0) : ''}
              onChange={(e) => setTarif(e.target.value)}
            />
          </div>
          <div className="medan">
            <label htmlFor="asal">Pelabuhan asal</label>
            <input id="asal" className="masukan" value={asal} onChange={(e) => setAsal(e.target.value)} />
          </div>
          <div className="medan">
            <label htmlFor="tujuan">Tujuan</label>
            <input id="tujuan" className="masukan" value={tujuan} onChange={(e) => setTujuan(e.target.value)} />
          </div>
          {galat && <KotakPesan jenis="merah">{galat}</KotakPesan>}
          <CatatanLuring />
        </form>
      )}
    </Layar>
  );
}

/** FR-21, FR-22: ubah sisa ruang dan tarif sebelum berangkat, atau ubah status. */
export function UbahKeberangkatan() {
  const { id } = useParams();
  const pindah = useNavigate();
  const kb = useLiveQuery(() => db.keberangkatan.get(id!), [id]);
  const kapal = useLiveQuery(() => (kb ? db.kapal.get(kb.kapal_id) : undefined), [kb?.kapal_id]);
  const [ruang, setRuang] = useState(0);
  const [tarif, setTarif] = useState('');
  const [tanya, setTanya] = useState<StatusKeberangkatan | null>(null);

  useEffect(() => {
    if (kb) {
      setRuang(kb.sisa_ruang);
      setTarif(String(kb.tarif));
    }
  }, [kb?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!kb) return <Layar judul="Ubah keberangkatan" kembali nav={false}><Memuat jumlah={2} /></Layar>;

  async function simpan(e: FormEvent) {
    e.preventDefault();
    const t = masukanRupiah(tarif) ?? kb!.tarif;
    const status = ruang === 0 ? 'penuh' : kb!.status === 'penuh' ? 'buka' : undefined;
    await ubahKeberangkatan(kb!.id, { sisa_ruang: ruang, tarif: t, ...(status ? { status } : {}) });
    tampilkanPesan('Perubahan tersimpan');
    pindah('/ruang-muat', { replace: true });
  }

  async function ubahStatus(s: StatusKeberangkatan) {
    await ubahKeberangkatan(kb!.id, { status: s });
    tampilkanPesan(s === 'batal' ? 'Keberangkatan dibatalkan' : 'Status tersimpan');
    pindah('/ruang-muat', { replace: true });
  }

  const PENJELASAN: Partial<Record<StatusKeberangkatan, string>> = {
    berangkat: 'Kapal sudah berangkat. Jatah dikunci dan keberangkatan tidak dapat diubah lagi.',
    batal: 'Semua jatah kapal ini kembali menjadi daftar tunggu dan ikut dibagi pada kapal berikutnya.',
  };

  return (
    <Layar judul="Ubah keberangkatan" kembali nav={false} tombol={<button className="tombol" form="form-ubah-kb">Simpan</button>}>
      <div className="kartu">
        <div className="kartu-kepala">
          <h2>{kapal?.nama ?? 'Kapal'}</h2>
          <LencanaKeberangkatan status={kb.status} tertunda={!!kb._tertunda} />
        </div>
        <p className="redup">Berangkat {waktuBerangkat(kb.berangkat)}</p>
      </div>
      {kb.terkunci && <KotakPesan jenis="abu">Jatah kapal ini sudah Final. Perubahan sisa ruang tidak mengubah jatah lagi.</KotakPesan>}
      <form id="form-ubah-kb" onSubmit={simpan} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="medan">
          <span className="label">Sisa ruang (tandan)</span>
          <Stepper nilai={ruang} ubah={setRuang} min={0} label="Sisa ruang dalam tandan" />
          <p className="petunjuk">Isi 0 bila kapal sudah penuh.</p>
        </div>
        <div className="medan">
          <label htmlFor="tarif">Tarif per tandan (Rp)</label>
          <input id="tarif" className="masukan besar" inputMode="numeric" value={tarif ? angka(masukanRupiah(tarif) ?? 0) : ''} onChange={(e) => setTarif(e.target.value)} />
        </div>
      </form>
      <p className="bagian-judul">Ubah status</p>
      {tanya ? (
        <div className="kartu">
          <p className="tebal">{tanya === 'batal' ? 'Batalkan keberangkatan ini?' : 'Tandai kapal sudah berangkat?'}</p>
          <p className="redup">{PENJELASAN[tanya]}</p>
          <div className="baris-aksi" style={{ marginTop: 8 }}>
            <button className={`tombol kecil ${tanya === 'batal' ? 'bahaya' : ''}`} onClick={() => ubahStatus(tanya)}>
              Ya, lanjutkan
            </button>
            <button className="tombol kedua kecil" onClick={() => setTanya(null)}>
              Tidak
            </button>
          </div>
        </div>
      ) : (
        <div className="baris-aksi">
          <button className="tombol kedua kecil" onClick={() => setTanya('berangkat')}>
            <Ship size={20} aria-hidden /> Sudah berangkat
          </button>
          <button className="tombol bahaya kecil" onClick={() => setTanya('batal')}>
            Batalkan keberangkatan
          </button>
        </div>
      )}
      <CatatanLuring />
    </Layar>
  );
}
