import { useLiveQuery } from 'dexie-react-hooks';
import { Box, Plus, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layar } from '../komponen/Kerangka';
import { CatatanLuring, Kosong, KotakPesan, LencanaPanen, Memuat, Stepper, masukanRupiah } from '../komponen/Umum';
import { batalkanPanen, catatPanen, tambahPetani, tandaiTerangkut, ubahPanen } from '../lib/aksi';
import { db } from '../lib/db';
import { angka, rupiah, tanggal, tandan, waktuBerangkat } from '../lib/format';
import { hasilTerbaru } from '../lib/jatahLokal';
import { tampilkanPesan, useKeadaan } from '../lib/toko';
import type { Panen } from '../lib/tipe';
import { hariIniWib, tambahHari } from '../lib/waktu';

export const KOMODITAS = ['Pisang kepok', 'Pisang raja', 'Pisang ambon', 'Pisang tanduk', 'Pisang lainnya'];

const URUT_STATUS: Record<string, number> = { daftar_tunggu: 0, terdaftar: 1, dapat_jatah: 2, terangkut: 3, dibatalkan: 4 };

/** FR-16: petani hanya melihat catatannya sendiri; Pengelola simpul melihat seluruh desa. */
function usePanenTerlihat(): Panen[] | undefined {
  const u = useKeadaan((k) => k.pengguna)!;
  return useLiveQuery(async () => {
    const semua =
      u.peran === 'petani' ? await db.panen.where('petani_id').equals(u.petani_id ?? '-').toArray() : await db.panen.where('desa_id').equals(u.desa_id ?? '-').toArray();
    return semua.sort(
      (a, b) =>
        (b._tertunda ?? 0) - (a._tertunda ?? 0) ||
        URUT_STATUS[a.status] - URUT_STATUS[b.status] ||
        a.siap_angkut.localeCompare(b.siap_angkut) ||
        a.dibuat.localeCompare(b.dibuat),
    );
  }, [u.id]);
}

export function DaftarPanen() {
  const u = useKeadaan((k) => k.pengguna)!;
  const panen = usePanenTerlihat();
  const petani = useLiveQuery(() => db.petani.toArray(), []);
  const nama = useMemo(() => new Map(petani?.map((p) => [p.id, p.nama])), [petani]);
  const [semua, setSemua] = useState(false);

  const tampil = panen?.filter((c) => semua || (c.status !== 'terangkut' && c.status !== 'dibatalkan'));
  const tersembunyi = (panen?.length ?? 0) - (tampil?.length ?? 0);

  return (
    <Layar
      judul="Panen"
      tombol={
        <Link to="/panen/catat" className="tombol">
          <Plus size={24} aria-hidden /> Catat panen
        </Link>
      }
    >
      {!panen || !petani ? (
        <Memuat />
      ) : panen.length === 0 ? (
        <Kosong ikon={<Box size={48} aria-hidden />} judul="Belum ada catatan panen">
          <p>Tekan Catat panen di bawah, lalu isi {u.peran === 'simpul' ? 'nama petani, ' : ''}jumlah tandan dan tanggal siap angkut.</p>
          <p>Catatan tersimpan di perangkat ini walau tidak ada sinyal.</p>
        </Kosong>
      ) : (
        <>
          {tampil!.map((c) => (
            <Link key={c.id} to={`/panen/${c.id}`} className="kartu">
              <div className="kartu-kepala">
                <h2>{u.peran === 'petani' ? c.komoditas : (nama.get(c.petani_id) ?? 'Petani')}</h2>
                <LencanaPanen c={c} />
              </div>
              <p className="redup">
                {tandan(c.tandan)} · {c.komoditas}
              </p>
              <p className="redup">Siap angkut {tanggal(c.siap_angkut)}</p>
              {c.status === 'dapat_jatah' && !c._tertunda && c.tunggu > 0 && (
                <p className="kecil tebal">
                  Jatah {angka(c.jatah)} · daftar tunggu {angka(c.tunggu)} tandan
                </p>
              )}
            </Link>
          ))}
          {tersembunyi > 0 && !semua && (
            <button className="tombol kedua kecil" onClick={() => setSemua(true)} style={{ alignSelf: 'center' }}>
              Tampilkan {tersembunyi} catatan terangkut atau dibatalkan
            </button>
          )}
        </>
      )}
    </Layar>
  );
}

export function CatatPanen() {
  const { id } = useParams();
  const u = useKeadaan((k) => k.pengguna)!;
  const pindah = useNavigate();
  const lokasi = useLocation() as { state?: { petaniBaru?: string } };
  const lama = useLiveQuery(() => (id ? db.panen.get(id) : undefined), [id]);
  const petaniDesa = useLiveQuery(
    () => (u.peran === 'simpul' ? db.petani.where('desa_id').equals(u.desa_id ?? '-').sortBy('nama') : db.petani.where('id').equals(u.petani_id ?? '-').toArray()),
    [u.id],
  );

  const [petaniId, setPetaniId] = useState('');
  const [komoditas, setKomoditas] = useState(KOMODITAS[0]);
  const [jumlah, setJumlah] = useState(50);
  const [siap, setSiap] = useState(tambahHari(hariIniWib(), 1));
  const [galat, setGalat] = useState<string | null>(null);
  const [proses, setProses] = useState(false);

  useEffect(() => {
    if (lama) {
      setPetaniId(lama.petani_id);
      setKomoditas(lama.komoditas);
      setJumlah(lama.tandan);
      setSiap(lama.siap_angkut);
    }
  }, [lama]);

  useEffect(() => {
    if (id || !petaniDesa) return;
    if (lokasi.state?.petaniBaru) setPetaniId(lokasi.state.petaniBaru);
    else if (u.peran === 'petani' && petaniDesa[0]) setPetaniId(petaniDesa[0].id);
  }, [id, petaniDesa, lokasi.state, u.peran]);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    if (!petaniId) return setGalat('Pilih petani lebih dulu.');
    if (!jumlah || jumlah < 1) return setGalat('Jumlah tandan minimal 1.');
    if (!siap) return setGalat('Isi tanggal siap angkut.');
    setProses(true);
    try {
      if (id) {
        await ubahPanen(id, { petani_id: petaniId, komoditas, tandan: jumlah, siap_angkut: siap });
        tampilkanPesan('Perubahan tersimpan');
        pindah(`/panen/${id}`, { replace: true });
      } else {
        await catatPanen({ petani_id: petaniId, komoditas, tandan: jumlah, siap_angkut: siap });
        tampilkanPesan('Tersimpan');
        pindah('/panen', { replace: true });
      }
    } catch (err) {
      setGalat(err instanceof Error ? err.message : String(err));
    } finally {
      setProses(false);
    }
  }

  if (id && lama === undefined) return <Layar judul="Ubah panen" kembali nav={false}><Memuat /></Layar>;

  return (
    <Layar
      judul={id ? 'Ubah panen' : 'Catat panen'}
      kembali
      nav={false}
      tombol={
        <button className="tombol" form="form-panen" disabled={proses}>
          Simpan
        </button>
      }
    >
      <form id="form-panen" onSubmit={simpan} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>
        <div className="medan">
          <label htmlFor="petani">Petani</label>
          {u.peran === 'petani' ? (
            <input id="petani" className="masukan" value={petaniDesa?.[0]?.nama ?? u.nama} readOnly />
          ) : (
            <>
              <select id="petani" className="masukan" value={petaniId} onChange={(e) => setPetaniId(e.target.value)}>
                <option value="">Pilih petani</option>
                {petaniDesa?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                    {p.kelompok ? ` (${p.kelompok})` : ''}
                  </option>
                ))}
              </select>
              <Link to="/petani/baru" className="tombol kedua kecil" style={{ alignSelf: 'flex-start' }}>
                <UserPlus size={20} aria-hidden /> Tambah petani baru
              </Link>
            </>
          )}
        </div>
        <div className="medan">
          <label htmlFor="komoditas">Komoditas</label>
          <select id="komoditas" className="masukan" value={komoditas} onChange={(e) => setKomoditas(e.target.value)}>
            {KOMODITAS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <div className="medan">
          <span className="label">Jumlah tandan</span>
          <Stepper nilai={jumlah} ubah={setJumlah} label="Jumlah tandan" />
        </div>
        <div className="medan">
          <label htmlFor="siap">Siap angkut</label>
          <input id="siap" type="date" className="masukan" value={siap} onChange={(e) => setSiap(e.target.value)} />
        </div>
        {galat && <KotakPesan jenis="merah">{galat}</KotakPesan>}
        <CatatanLuring />
      </form>
    </Layar>
  );
}

export function TambahPetani() {
  const pindah = useNavigate();
  const [nama, setNama] = useState('');
  const [kelompok, setKelompok] = useState('');
  const [hp, setHp] = useState('');
  const [galat, setGalat] = useState<string | null>(null);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (nama.trim().length < 2) return setGalat('Isi nama petani.');
    try {
      const p = await tambahPetani({ nama: nama.trim(), kelompok: kelompok.trim(), hp: hp.replace(/[^0-9+]/g, '') });
      tampilkanPesan('Petani tersimpan');
      pindah('/panen/catat', { replace: true, state: { petaniBaru: p.id } });
    } catch (err) {
      setGalat(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Layar judul="Tambah petani" kembali nav={false} tombol={<button className="tombol" form="form-petani">Simpan</button>}>
      <form id="form-petani" onSubmit={simpan} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>
        <div className="medan">
          <label htmlFor="nama">Nama petani</label>
          <input id="nama" className="masukan" value={nama} onChange={(e) => setNama(e.target.value)} autoComplete="off" />
        </div>
        <div className="medan">
          <label htmlFor="kelompok">Kelompok tani</label>
          <input id="kelompok" className="masukan" value={kelompok} onChange={(e) => setKelompok(e.target.value)} />
        </div>
        <div className="medan">
          <label htmlFor="hp">Nomor HP (boleh kosong)</label>
          <input id="hp" className="masukan" type="tel" inputMode="tel" value={hp} onChange={(e) => setHp(e.target.value)} />
        </div>
        {galat && <KotakPesan jenis="merah">{galat}</KotakPesan>}
        <CatatanLuring />
      </form>
    </Layar>
  );
}

/** Jatah per keberangkatan untuk satu catatan, dari hasil Final terbaru di perangkat. */
function useJatahCatatan(panenId: string | undefined) {
  return useLiveQuery(async () => {
    if (!panenId) return [];
    const kbs = await db.keberangkatan.toArray();
    const daftar = [];
    for (const kb of kbs.filter((k) => k.status !== 'batal')) {
      const { final } = await hasilTerbaru(kb.id);
      const b = final?.baris.find((x) => x.panen_id === panenId);
      if (b && b.jatah > 0) {
        const kapal = await db.kapal.get(kb.kapal_id);
        daftar.push({ kb, kapal, jatah: b.jatah, terkunci: final!.terkunci });
      }
    }
    return daftar.sort((a, b) => a.kb.berangkat.localeCompare(b.kb.berangkat));
  }, [panenId]);
}

export function DetailPanen() {
  const { id } = useParams();
  const u = useKeadaan((k) => k.pengguna)!;
  const pindah = useNavigate();
  const c = useLiveQuery(() => db.panen.get(id!), [id]);
  const petani = useLiveQuery(() => (c ? db.petani.get(c.petani_id) : undefined), [c?.petani_id]);
  const jatah = useJatahCatatan(id);
  const [konfirmasi, setKonfirmasi] = useState(false);

  if (c === undefined || jatah === undefined) return <Layar judul="Catatan panen" kembali><Memuat jumlah={2} /></Layar>;
  if (!c)
    return (
      <Layar judul="Catatan panen" kembali>
        <KotakPesan jenis="abu">Catatan ini tidak ada lagi di perangkat. Kembali ke daftar panen.</KotakPesan>
      </Layar>
    );

  const terkunci = jatah.some((j) => j.terkunci);
  const bisaUbah = !['terangkut', 'dibatalkan'].includes(c.status) && !terkunci;
  const bisaAngkut = u.peran === 'simpul' && !['terangkut', 'dibatalkan'].includes(c.status) && !c._tertunda;

  async function batal() {
    await batalkanPanen(c!.id);
    tampilkanPesan('Catatan dibatalkan');
    pindah('/panen', { replace: true });
  }

  return (
    <Layar
      judul="Catatan panen"
      kembali="/panen"
      tombol={
        bisaAngkut && c.status === 'dapat_jatah' ? (
          <Link to={`/panen/${c.id}/terangkut`} className="tombol">
            Tandai terangkut
          </Link>
        ) : bisaUbah ? (
          <Link to={`/panen/${c.id}/ubah`} className="tombol">
            Ubah catatan
          </Link>
        ) : undefined
      }
    >
      <div className="kartu">
        <div className="kartu-kepala">
          <h2>{petani?.nama ?? 'Petani'}</h2>
          <LencanaPanen c={c} />
        </div>
        <p className="redup">
          {tandan(c.tandan)} · {c.komoditas}
        </p>
        <p className="redup">Siap angkut {tanggal(c.siap_angkut, true)}</p>
      </div>

      {c._ditolak && (
        <KotakPesan jenis="merah">
          Server menolak catatan ini: {c._ditolak}
        </KotakPesan>
      )}

      {c.status === 'terangkut' ? (
        <div className="rincian">
          <div>
            <span>Terangkut</span>
            <span className="nilai">{c.terangkut_tanggal ? tanggal(c.terangkut_tanggal, true) : '-'}</span>
          </div>
          <div>
            <span>Harga terima</span>
            <span className="nilai">{c.harga_terima != null ? `${rupiah(c.harga_terima)}/tandan` : 'Tidak diisi'}</span>
          </div>
        </div>
      ) : (
        <>
          <p className="bagian-judul">Jatah angkut</p>
          {jatah.length === 0 ? (
            <p className="catatan-kaki">
              {c.status === 'daftar_tunggu'
                ? `Belum ada ruang. ${tandan(c.tunggu || c.tandan)} masuk daftar tunggu kapal berikutnya.`
                : 'Belum ada jatah. Jatah dibagi saat Pengelola simpul menjalankan pencocokan.'}
            </p>
          ) : (
            <div className="rincian">
              {jatah.map((j) => (
                <div key={j.kb.id}>
                  <span>
                    {j.kapal?.nama ?? 'Kapal'}
                    <br />
                    <span className="redup kecil">
                      {waktuBerangkat(j.kb.berangkat)}
                      {j.terkunci ? ' · Final' : ' · dapat berubah'}
                    </span>
                  </span>
                  <span className="nilai">{tandan(j.jatah)}</span>
                </div>
              ))}
              {c.tunggu > 0 && (
                <div>
                  <span>Daftar tunggu</span>
                  <span className="nilai">{tandan(c.tunggu)}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {terkunci && c.status !== 'terangkut' && (
        <p className="catatan-kaki">Jatah sudah Final, jadi catatan ini tidak dapat diubah lagi.</p>
      )}

      {bisaUbah && c.status === 'dapat_jatah' && (
        <Link to={`/panen/${c.id}/ubah`} className="tombol kedua">
          Ubah catatan
        </Link>
      )}

      {bisaUbah &&
        (konfirmasi ? (
          <div className="kartu">
            <p className="tebal">Batalkan catatan ini?</p>
            <p className="redup">Catatan tidak dihapus, statusnya menjadi Dibatalkan dan tidak ikut pencocokan.</p>
            <div className="baris-aksi" style={{ marginTop: 8 }}>
              <button className="tombol bahaya kecil" onClick={batal}>
                Ya, batalkan
              </button>
              <button className="tombol kedua kecil" onClick={() => setKonfirmasi(false)}>
                Tidak
              </button>
            </div>
          </div>
        ) : (
          <button className="tombol bahaya" onClick={() => setKonfirmasi(true)}>
            Batalkan catatan
          </button>
        ))}
    </Layar>
  );
}

/** FR-15: Pengelola simpul menandai Terangkut dan dapat mengisi harga terima. */
export function Terangkut() {
  const { id } = useParams();
  const pindah = useNavigate();
  const c = useLiveQuery(() => db.panen.get(id!), [id]);
  const jatah = useJatahCatatan(id);
  const [kbId, setKbId] = useState('');
  const [harga, setHarga] = useState('');

  useEffect(() => {
    if (jatah && jatah.length && !kbId) setKbId(jatah[0].kb.id);
  }, [jatah, kbId]);

  if (!c || !jatah) return <Layar judul="Tandai terangkut" kembali nav={false}><Memuat jumlah={2} /></Layar>;
  const pilih = jatah.find((j) => j.kb.id === kbId);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!pilih) return;
    await tandaiTerangkut(c!.id, pilih.kb.id, pilih.jatah, masukanRupiah(harga));
    tampilkanPesan('Ditandai terangkut');
    pindah(`/panen/${c!.id}`, { replace: true });
  }

  return (
    <Layar judul="Tandai terangkut" kembali nav={false} tombol={<button className="tombol" form="form-angkut" disabled={!pilih}>Simpan</button>}>
      <form id="form-angkut" onSubmit={simpan} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {jatah.length === 0 ? (
          <KotakPesan jenis="kuning">Catatan ini belum punya jatah kapal. Jalankan pencocokan dan tunggu hasil Final.</KotakPesan>
        ) : (
          <div className="medan">
            <span className="label">Kapal yang mengangkut</span>
            <div className="pilihan">
              {jatah.map((j) => (
                <button type="button" key={j.kb.id} aria-pressed={kbId === j.kb.id} onClick={() => setKbId(j.kb.id)}>
                  {j.kapal?.nama ?? 'Kapal'}, {tanggal(j.kb.berangkat)} ({tandan(j.jatah)})
                </button>
              ))}
            </div>
          </div>
        )}
        {pilih && pilih.jatah < c.tandan && (
          <KotakPesan jenis="abu">
            {tandan(pilih.jatah)} ditandai terangkut. Sisa {tandan(c.tandan - pilih.jatah)} tetap di daftar tunggu kapal berikutnya.
          </KotakPesan>
        )}
        <div className="medan">
          <label htmlFor="harga">Harga terima per tandan (boleh kosong)</label>
          <input
            id="harga"
            className="masukan besar"
            inputMode="numeric"
            placeholder="Rp"
            value={harga ? angka(masukanRupiah(harga) ?? 0) : ''}
            onChange={(e) => setHarga(e.target.value)}
          />
          <p className="petunjuk">Dipakai untuk menghitung selisih harga terima dengan harga acuan.</p>
        </div>
        <CatatanLuring />
      </form>
    </Layar>
  );
}
