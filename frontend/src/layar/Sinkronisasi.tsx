import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react';
import { Layar } from '../komponen/Kerangka';
import { KotakPesan, Memuat } from '../komponen/Umum';
import { bacaMeta, db } from '../lib/db';
import { waktuLokal } from '../lib/format';
import { parameter } from '../lib/sesi';
import { sinkronkan } from '../lib/sinkron';
import { useKeadaan } from '../lib/toko';

const NAMA_JENIS: Record<string, string> = {
  'petani.simpan': 'Data petani',
  'panen.catat': 'Catatan panen',
  'panen.ubah': 'Perubahan panen',
  'panen.batal': 'Pembatalan panen',
  'panen.terangkut': 'Tanda terangkut',
  'keberangkatan.catat': 'Keberangkatan',
  'keberangkatan.ubah': 'Perubahan keberangkatan',
  'hasil.sementara': 'Hasil pencocokan',
  'jatah.manual': 'Penyesuaian jatah',
  'desa.biaya': 'Biaya tebang',
  'pengguna.pin': 'Ganti PIN',
};

/** FR-53: antrean, waktu sinkron terakhir, dan galat dengan satu kalimat penyebab. */
export function Sinkronisasi() {
  const online = useKeadaan((k) => k.online);
  const jaringan = useKeadaan((k) => k.jaringan);
  const mengirim = useKeadaan((k) => k.mengirim);
  const galatTerakhir = useKeadaan((k) => k.galatTerakhir);
  const data = useLiveQuery(async () => {
    const ops = await db.outbox.toArray();
    const hitung = (awal: string) => ops.filter((o) => o.jenis.startsWith(awal)).length;
    const panen = hitung('panen.') + hitung('petani.');
    const ruang = hitung('keberangkatan.');
    return {
      panen,
      ruang,
      lain: ops.length - panen - ruang,
      terakhir: await bacaMeta<string>('terakhirSinkron'),
      hargaBaru: (await bacaMeta<number>('hargaBaruDiterima')) ?? 0,
      selisih: (await bacaMeta<number>('selisihJamMenit')) ?? 0,
      batasSelisih: (await parameter()).selisih_jam_menit,
      galat: await db.galat.orderBy('waktu').reverse().limit(10).toArray(),
    };
  }, []);

  return (
    <Layar
      judul="Sinkronisasi"
      kembali
      tombol={
        <button className="tombol" disabled={!jaringan || mengirim} onClick={() => void sinkronkan()}>
          <RefreshCw size={22} aria-hidden /> {mengirim ? 'Mengirim…' : 'Kirim sekarang'}
        </button>
      }
    >
      {!data ? (
        <Memuat jumlah={2} />
      ) : (
        <>
          <div className="kartu">
            <div className="kartu-kepala">
              <h2>Status</h2>
              {online ? (
                <span className="lencana chip hijau">
                  <Wifi size={16} aria-hidden /> Tersambung
                </span>
              ) : (
                <span className="lencana chip kuning">
                  <WifiOff size={16} aria-hidden /> Luring
                </span>
              )}
            </div>
            <p className="redup">{data.terakhir ? `Terakhir tersinkron ${waktuLokal(data.terakhir)}` : 'Belum pernah tersinkron'}</p>
          </div>
          <div className="rincian">
            <div>
              <span>Panen menunggu kirim</span>
              <span className="nilai">{data.panen}</span>
            </div>
            <div>
              <span>Ruang muat menunggu kirim</span>
              <span className="nilai">{data.ruang}</span>
            </div>
            {data.lain > 0 && (
              <div>
                <span>Catatan lain menunggu kirim</span>
                <span className="nilai">{data.lain}</span>
              </div>
            )}
            <div>
              <span>Harga baru diterima</span>
              <span className="nilai">{data.hargaBaru}</span>
            </div>
          </div>
          <p className="catatan-kaki">
            {online
              ? 'Catatan dikirim otomatis. Tekan Kirim sekarang bila ingin mengirim segera.'
              : jaringan
                ? 'Server belum terjangkau. Catatan aman di perangkat dan dikirim ulang otomatis.'
                : 'Catatan aman di perangkat. Tombol kirim aktif saat ada sinyal.'}
          </p>
          {Math.abs(data.selisih) > data.batasSelisih && (
            <KotakPesan jenis="kuning">
              Jam perangkat berbeda {Math.abs(data.selisih)} menit dari server. Atur jam ponsel agar tanggal catatan tepat.
            </KotakPesan>
          )}
          {galatTerakhir && jaringan && <KotakPesan jenis="merah">{galatTerakhir}</KotakPesan>}
          {data.galat.length > 0 && (
            <>
              <div className="baris-aksi" style={{ justifyContent: 'space-between' }}>
                <p className="bagian-judul">Ditolak server</p>
                <button className="tombol-ikon kanan" aria-label="Hapus daftar galat" onClick={() => db.galat.clear()}>
                  <Trash2 size={20} aria-hidden />
                </button>
              </div>
              <div className="rincian">
                {data.galat.map((g) => (
                  <div key={g.id} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <span className="tebal">
                      {NAMA_JENIS[g.jenis] ?? g.jenis} · <span className="redup kecil">{waktuLokal(g.waktu)}</span>
                    </span>
                    <span className="redup">{g.pesan}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Layar>
  );
}
