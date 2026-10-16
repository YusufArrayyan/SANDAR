import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Memuat, Toast } from './komponen/Umum';
import { layarAwal } from './lib/sesi';
import { useKeadaan } from './lib/toko';
import type { Peran } from './lib/tipe';
import { Akun, GantiPin } from './layar/Akun';
import { Aktivasi, Diblokir } from './layar/Aktivasi';
import { BiayaTebang, Harga, InputHarga } from './layar/Harga';
import { Jatah, SesuaikanJatah } from './layar/Jatah';
import { Kelola } from './layar/Kelola';
import { Masuk } from './layar/Masuk';
import { CatatPanen, DetailPanen, DaftarPanen, TambahPetani, Terangkut } from './layar/Panen';
import { CatatKeberangkatan, RuangMuat, UbahKeberangkatan } from './layar/RuangMuat';
import { Sinkronisasi } from './layar/Sinkronisasi';

function Wajib({ peran, children }: { peran?: Peran[]; children: ReactNode }) {
  const pengguna = useKeadaan((k) => k.pengguna);
  const lokasi = useLocation();
  if (!pengguna) return <Navigate to="/masuk" replace state={{ dari: lokasi.pathname }} />;
  if (peran && !peran.includes(pengguna.peran)) return <Navigate to={layarAwal(pengguna.peran)} replace />;
  return <>{children}</>;
}

/** Setiap pindah layar, mulai dari atas (satu tugas per layar). */
function GulirKeAtas() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  const siap = useKeadaan((k) => k.siap);
  const perangkat = useKeadaan((k) => k.perangkat);
  const diblokir = useKeadaan((k) => k.diblokir);
  const pengguna = useKeadaan((k) => k.pengguna);

  if (!siap)
    return (
      <div className="layar">
        <div className="isi">
          <Memuat />
        </div>
      </div>
    );
  if (!perangkat) return <Aktivasi />;
  if (diblokir) return <Diblokir pesan={diblokir} />;

  const semua: Peran[] = ['petani', 'simpul', 'kapal', 'mitra', 'admin'];
  return (
    <>
      <GulirKeAtas />
      <Routes>
        <Route path="/masuk" element={pengguna ? <Navigate to={layarAwal(pengguna.peran)} replace /> : <Masuk />} />
        <Route path="/panen" element={<Wajib peran={['petani', 'simpul']}><DaftarPanen /></Wajib>} />
        <Route path="/panen/catat" element={<Wajib peran={['petani', 'simpul']}><CatatPanen /></Wajib>} />
        <Route path="/panen/:id" element={<Wajib peran={['petani', 'simpul']}><DetailPanen /></Wajib>} />
        <Route path="/panen/:id/ubah" element={<Wajib peran={['petani', 'simpul']}><CatatPanen /></Wajib>} />
        <Route path="/panen/:id/terangkut" element={<Wajib peran={['simpul']}><Terangkut /></Wajib>} />
        <Route path="/petani/baru" element={<Wajib peran={['simpul']}><TambahPetani /></Wajib>} />
        <Route path="/ruang-muat" element={<Wajib peran={semua}><RuangMuat /></Wajib>} />
        <Route path="/ruang-muat/catat" element={<Wajib peran={['kapal', 'simpul', 'admin']}><CatatKeberangkatan /></Wajib>} />
        <Route path="/ruang-muat/:id" element={<Wajib peran={['kapal', 'simpul', 'admin']}><UbahKeberangkatan /></Wajib>} />
        <Route path="/jatah" element={<Wajib peran={semua}><Jatah /></Wajib>} />
        <Route path="/jatah/:kbId/sesuaikan/:panenId" element={<Wajib peran={['simpul']}><SesuaikanJatah /></Wajib>} />
        <Route path="/harga" element={<Wajib peran={semua}><Harga /></Wajib>} />
        <Route path="/harga/biaya" element={<Wajib peran={['simpul']}><BiayaTebang /></Wajib>} />
        <Route path="/harga/input" element={<Wajib peran={['mitra', 'admin']}><InputHarga /></Wajib>} />
        <Route path="/sinkronisasi" element={<Wajib><Sinkronisasi /></Wajib>} />
        <Route path="/akun" element={<Wajib><Akun /></Wajib>} />
        <Route path="/akun/pin" element={<Wajib><GantiPin /></Wajib>} />
        <Route path="/kelola" element={<Wajib peran={['admin']}><Kelola /></Wajib>} />
        <Route path="*" element={<Navigate to={pengguna ? layarAwal(pengguna.peran) : '/masuk'} replace />} />
      </Routes>
      <Toast />
    </>
  );
}
