import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ListChecks, Lock } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layar } from '../komponen/Kerangka';
import { CatatanLuring, Kosong, KotakPesan, Memuat, Stepper } from '../komponen/Umum';
import { sesuaikanJatah, simpanHasilSementara } from '../lib/aksi';
import { bacaMeta, db, tulisMeta } from '../lib/db';
import { angka, persen, tandan, waktuBerangkat } from '../lib/format';
import { hasilTerbaru, hitungSementara } from '../lib/jatahLokal';
import { parameter } from '../lib/sesi';
import { tampilkanPesan, useKeadaan } from '../lib/toko';
import type { Hasil } from '../lib/tipe';
import { batasWaktuCocok, hariIniWib, sudahLewat, tambahHari } from '../lib/waktu';

function daftarAngka(n: number[]): string {
  const s = n.map((x) => angka(x));
  if (s.length <= 1) return s.join('');
  return `${s.slice(0, -1).join(', ')}, dan ${s[s.length - 1]}`;
}

export function Jatah() {
  const u = useKeadaan((k) => k.pengguna)!;
  const [pilihan, setPilihan] = useState<string | null>(null);
  const [proses, setProses] = useState(false);

  const kbs = useLiveQuery(async () => {
    const batas = tambahHari(hariIniWib(), -3);
    const semua = await db.keberangkatan.orderBy('berangkat').toArray();
    const kapal = new Map((await db.kapal.toArray()).map((k) => [k.id, k]));
    return semua
      .filter((k) => k.status !== 'batal' && k.berangkat.slice(0, 10) >= batas)
      .map((kb) => ({ kb, kapal: kapal.get(kb.kapal_id) }));
  }, []);

  useEffect(() => {
    if (!kbs?.length) return;
    if (!pilihan || !kbs.some((x) => x.kb.id === pilihan)) {
      const berikut = kbs.find((x) => x.kb.status === 'buka' && !x.kb.terkunci) ?? kbs[0];
      setPilihan(berikut.kb.id);
    }
  }, [kbs, pilihan]);

  const terpilih = kbs?.find((x) => x.kb.id === pilihan);

  const data = useLiveQuery(async () => {
    if (!terpilih) return null;
    const { final, sementara } = await hasilTerbaru(terpilih.kb.id);
    // Hasil Sementara dipakai selama belum terkirim; setelah terkirim, server sudah
    // memperhitungkannya dalam hasil Final. Tidak bergantung pada jam perangkat.
    const sementaraTertunda = sementara && (await db.outbox.where('baris_id').equals(sementara.id).count()) > 0;
    const tampil: Hasil | undefined = !terpilih.kb.terkunci && sementaraTertunda ? sementara : (final ?? sementara);
    const panen = new Map((await db.panen.toArray()).map((c) => [c.id, c]));
    const petani = new Map((await db.petani.toArray()).map((p) => [p.id, p.nama]));
    const berubah = ((await bacaMeta<string[]>('jatahBerubah')) ?? []).includes(terpilih.kb.id);
    const p = await parameter();
    return { tampil, panen, petani, berubah, jamBatas: p.jam_batas_cocok };
  }, [terpilih?.kb.id, terpilih?.kb.terkunci]);

  async function jalankan() {
    if (!terpilih) return;
    setProses(true);
    try {
      const h = await hitungSementara(terpilih.kb);
      await simpanHasilSementara({ keberangkatan_id: terpilih.kb.id, ruang: h.ruang, diminta: h.baris.reduce((s, b) => s + b.diminta, 0), baris: h.baris });
      tampilkanPesan('Pencocokan selesai, hasil Sementara tersimpan');
    } finally {
      setProses(false);
    }
  }

  async function tutupBerubah() {
    const daftar = ((await bacaMeta<string[]>('jatahBerubah')) ?? []).filter((x) => x !== terpilih?.kb.id);
    await tulisMeta('jatahBerubah', daftar);
  }

  const kb = terpilih?.kb;
  const bisaJalankan = u.peran === 'simpul' && kb && !kb.terkunci && (kb.status === 'buka' || kb.status === 'penuh');

  return (
    <Layar
      judul="Jatah angkut"
      tombol={
        u.peran === 'simpul' && kb ? (
          <button className="tombol" onClick={jalankan} disabled={!bisaJalankan || proses}>
            {kb.terkunci ? (
              <>
                <Lock size={20} aria-hidden /> Jatah sudah Final
              </>
            ) : proses ? (
              'Menghitung…'
            ) : (
              'Jalankan pencocokan'
            )}
          </button>
        ) : undefined
      }
    >
      {!kbs ? (
        <Memuat />
      ) : kbs.length === 0 ? (
        <Kosong ikon={<ListChecks size={48} aria-hidden />} judul="Belum ada kapal untuk dibagi">
          <p>Jatah dibagi setelah ada keberangkatan kapal di layar Ruang Muat.</p>
        </Kosong>
      ) : (
        <>
          {kbs.length > 1 && (
            <div className="pilihan" role="group" aria-label="Pilih kapal">
              {kbs.map(({ kb: k, kapal }) => (
                <button key={k.id} aria-pressed={k.id === pilihan} onClick={() => setPilihan(k.id)}>
                  {kapal?.nama ?? 'Kapal'}, {waktuBerangkat(k.berangkat).split(',')[0]}
                </button>
              ))}
            </div>
          )}
          {!data || !kb ? (
            <Memuat jumlah={2} />
          ) : (
            <IsiJatah
              kbId={kb.id}
              namaKapal={terpilih!.kapal?.nama ?? 'Kapal'}
              berangkat={kb.berangkat}
              terkunci={kb.terkunci}
              penuh={kb.status === 'penuh'}
              ruangKapal={kb.sisa_ruang}
              data={data}
              bisaSesuaikan={u.peran === 'simpul' && !kb.terkunci}
              peran={u.peran}
              tutupBerubah={tutupBerubah}
            />
          )}
        </>
      )}
    </Layar>
  );
}

interface DataJatah {
  tampil?: Hasil;
  panen: Map<string, { petani_id: string; tandan: number; dibuat: string }>;
  petani: Map<string, string>;
  berubah: boolean;
  jamBatas: number;
}

function IsiJatah(p: {
  kbId: string;
  namaKapal: string;
  berangkat: string;
  terkunci: boolean;
  penuh: boolean;
  ruangKapal: number;
  data: DataJatah;
  bisaSesuaikan: boolean;
  peran: string;
  tutupBerubah: () => void;
}) {
  const { tampil, panen, petani, berubah, jamBatas } = p.data;
  const batas = batasWaktuCocok(p.berangkat, jamBatas);
  const lewat = sudahLewat(batas);

  if (!tampil) {
    return (
      <>
        <div className="kartu">
          <h2>{p.namaKapal}</h2>
          <p className="redup">
            Berangkat {waktuBerangkat(p.berangkat)} · ruang {tandan(p.penuh ? 0 : p.ruangKapal)}
          </p>
        </div>
        <Kosong ikon={<ListChecks size={48} aria-hidden />} judul="Pencocokan belum dijalankan">
          <p>
            {p.peran === 'simpul'
              ? 'Tekan Jalankan pencocokan untuk membagi ruang kapal kepada petani yang panennya siap angkut.'
              : 'Jatah muncul setelah Pengelola simpul menjalankan pencocokan dan perangkat tersinkron.'}
          </p>
        </Kosong>
        <CaraPembagian />
      </>
    );
  }

  const Q = tampil.diminta;
  const R = tampil.ruang;
  const baris = tampil.baris
    .filter((b) => panen.has(b.panen_id))
    .sort((a, b) => panen.get(a.panen_id)!.dibuat.localeCompare(panen.get(b.panen_id)!.dibuat));
  const tunggu = baris.filter((b) => b.tunggu > 0).map((b) => b.tunggu);

  return (
    <>
      {berubah && tampil.sifat === 'final' && (
        <div className="kotak-pesan kuning" role="status">
          <div style={{ flex: 1 }}>
            <p className="tebal">Jatah berubah</p>
            <p>Hasil Final dari server berbeda dari hitungan di perangkat ini, karena ada data baru dari desa atau kapal. Angka di bawah adalah jatah terbaru.</p>
          </div>
          <button className="tombol kedua kecil" onClick={p.tutupBerubah}>
            Mengerti
          </button>
        </div>
      )}
      <div className="kartu">
        <div className="kartu-kepala">
          <h2>{p.namaKapal}</h2>
          <span className={`lencana chip ${tampil.sifat === 'final' ? 'hijau' : 'kuning'}`}>
            {p.terkunci ? <Lock size={16} aria-hidden /> : null}
            {p.terkunci ? 'Final, dikunci' : tampil.sifat === 'final' ? 'Final' : 'Sementara'}
          </span>
        </div>
        <p className="redup">
          Ruang {angka(R)} tandan · permintaan {angka(Q)} tandan
        </p>
        <p className="tebal" style={{ color: 'var(--abu)' }}>
          {Q === 0 ? 'Belum ada permintaan' : Q <= R ? 'Semua permintaan dapat ruang' : `Dibagi ${persen((100 * R) / Q)} per petani`}
        </p>
        <p className="redup kecil">
          {p.terkunci ? 'Dikunci' : lewat ? 'Menunggu dikunci server' : 'Dikunci'} pukul {batas.slice(11, 16).replace(':', '.')},{' '}
          {waktuBerangkat(batas).split(',')[0]}
          {tampil.sifat === 'sementara' ? ' · angka dapat berubah setelah sinkron' : ''}
        </p>
      </div>

      {baris.length === 0 ? (
        Q === 0 ? (
          <KotakPesan jenis="abu">
            Belum ada panen siap angkut untuk kapal ini. Catat panen di layar Panen dengan tanggal siap angkut paling lambat hari berangkat.
          </KotakPesan>
        ) : (
          <p className="catatan-kaki">Rincian jatah per petani hanya terlihat oleh Pengelola simpul desa masing-masing.</p>
        )
      ) : (
        <div className="rincian">
          {baris.map((b) => {
            const c = panen.get(b.panen_id)!;
            const isi = (
              <>
                <span>
                  {petani.get(c.petani_id) ?? 'Petani'}
                  {b.alasan_manual && (
                    <>
                      <br />
                      <span className="redup kecil">Disesuaikan: {b.alasan_manual}</span>
                    </>
                  )}
                </span>
                <span style={{ textAlign: 'right' }}>
                  diminta {angka(b.diminta)} · <span className="tebal">jatah {angka(b.jatah)}</span>
                </span>
              </>
            );
            return p.bisaSesuaikan ? (
              <Link key={b.panen_id} to={`/jatah/${p.kbId}/sesuaikan/${b.panen_id}`} aria-label={`Sesuaikan jatah ${petani.get(c.petani_id) ?? ''}`}>
                {isi}
              </Link>
            ) : (
              <div key={b.panen_id}>{isi}</div>
            );
          })}
        </div>
      )}
      {tunggu.length > 0 && (
        <p className="catatan-kaki">Sisa permintaan ({daftarAngka(tunggu)} tandan) masuk daftar tunggu kapal berikutnya.</p>
      )}
      {p.bisaSesuaikan && baris.length > 0 && <p className="catatan-kaki">Ketuk nama petani untuk menyesuaikan jatah secara manual.</p>}
      <CaraPembagian />
    </>
  );
}

/** Aturan dijelaskan di layar agar dapat diperiksa warga (PRD 15, risiko kuota dianggap tidak adil). */
function CaraPembagian() {
  return (
    <details className="kartu">
      <summary className="tebal" style={{ cursor: 'pointer', minHeight: 32 }}>
        Cara pembagian jatah
      </summary>
      <div className="redup" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        <p>1. Bila ruang kapal cukup, semua permintaan dapat ruang penuh.</p>
        <p>2. Bila tidak cukup, setiap petani mendapat bagian yang sama besar dari permintaannya, dibulatkan ke bawah.</p>
        <p>3. Tandan yang tersisa dari pembulatan diberikan satu per satu kepada pecahan terbesar. Bila sama, panen yang dicatat lebih dulu didahulukan.</p>
        <p>4. Sisa permintaan masuk daftar tunggu dan ikut dibagi pada kapal berikutnya.</p>
        <p>Hasil di perangkat berstatus Sementara. Server menggabungkan data semua desa menjadi hasil Final, lalu menguncinya pada batas waktu.</p>
      </div>
    </details>
  );
}

/** FR-35: penyesuaian manual jatah wajib beralasan dan tercatat di log. */
export function SesuaikanJatah() {
  const { kbId, panenId } = useParams();
  const pindah = useNavigate();
  const data = useLiveQuery(async () => {
    const c = await db.panen.get(panenId!);
    const p = c ? await db.petani.get(c.petani_id) : undefined;
    const m = await db.jatahManual.where('[keberangkatan_id+panen_id]').equals([kbId!, panenId!]).first();
    const { final, sementara } = await hasilTerbaru(kbId!);
    const b = (sementara ?? final)?.baris.find((x) => x.panen_id === panenId);
    return { c, p, m, b };
  }, [kbId, panenId]);
  const [jumlah, setJumlah] = useState<number | null>(null);
  const [alasan, setAlasan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (data && jumlah === null) {
      setJumlah(data.m?.jumlah ?? data.b?.jatah ?? 0);
      setAlasan(data.m?.alasan ?? '');
    }
  }, [data, jumlah]);

  if (!data || jumlah === null) return <Layar judul="Sesuaikan jatah" kembali nav={false}><Memuat jumlah={2} /></Layar>;
  const maks = data.b?.diminta ?? data.c?.tandan ?? 0;

  async function simpan(e: FormEvent, hapus = false) {
    e.preventDefault();
    setGalat(null);
    if (alasan.trim().length < 3) return setGalat('Tulis alasan penyesuaian. Alasan dicatat di log dan dapat dilihat Admin.');
    if (!hapus && jumlah! > maks) return setGalat(`Jatah tidak boleh melebihi permintaan (${tandan(maks)}).`);
    await sesuaikanJatah(kbId!, panenId!, hapus ? null : jumlah, alasan.trim());
    tampilkanPesan(hapus ? 'Penyesuaian dihapus' : 'Penyesuaian tersimpan');
    pindah('/jatah', { replace: true });
  }

  return (
    <Layar judul="Sesuaikan jatah" kembali nav={false} tombol={<button className="tombol" form="form-sesuai">Simpan</button>}>
      <div className="kartu">
        <h2>{data.p?.nama ?? 'Petani'}</h2>
        <p className="redup">
          Diminta {tandan(maks)} · jatah sekarang {tandan(data.b?.jatah ?? 0)}
        </p>
      </div>
      <form id="form-sesuai" onSubmit={(e) => simpan(e)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="medan">
          <span className="label">Jatah tetap (tandan)</span>
          <Stepper nilai={jumlah} ubah={setJumlah} min={0} label="Jatah tetap dalam tandan" />
          <p className="petunjuk">Ruang sisanya dibagi proporsional kepada petani lain. Jalankan pencocokan lagi setelah menyimpan.</p>
        </div>
        <div className="medan">
          <label htmlFor="alasan">Alasan penyesuaian</label>
          <textarea id="alasan" className="masukan" value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Contoh: panen rusak sebagian, petani minta dikurangi" />
        </div>
        {galat && <KotakPesan jenis="merah">{galat}</KotakPesan>}
        {data.m && data.m.jumlah !== null && (
          <button type="button" className="tombol bahaya" onClick={(e) => simpan(e as unknown as FormEvent, true)}>
            <ChevronLeft size={20} aria-hidden /> Kembalikan ke pembagian biasa
          </button>
        )}
        <CatatanLuring />
      </form>
    </Layar>
  );
}
