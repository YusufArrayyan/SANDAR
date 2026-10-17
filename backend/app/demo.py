"""Data contoh PRD dan paket kode aktivasi untuk juri.

Dipakai dua cara:
- `python -m app.seed --demo` untuk pengembangan (kode tetap seperti MEOK2026).
- Variabel lingkungan `SANDAR_JURI=<jumlah juri>` di server: setiap server menyala, data
  contoh dipastikan ada dan tetap segar (ada kapal yang akan berangkat, harga terbaru, dan
  panen yang menunggu), lalu daftar kode aktivasi juri dicetak ke log.

Semua fungsi di sini idempoten: aman dijalankan berulang tanpa menggandakan data.
Seluruh nama, angka, dan harga adalah data contoh, bukan data lapangan.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .layanan import buat_kode_aktivasi, hari_ini_wib, hash_pin, tandai
from .models import CatatanPanen, Desa, HargaAcuan, Kapal, Keberangkatan, KodeAktivasi, Pengguna, Petani

PIN_DEMO = os.getenv("SANDAR_PIN_DEMO", "1234")
PASAR = "Pasar Minggu, Kota Bengkulu"
ASAL = "Pelabuhan Malakoni, Enggano"
TUJUAN = "Pelabuhan Pulau Baai, Kota Bengkulu"

# (hp, nama, peran, kode desa)
AKUN_DEMO = [
    ("081234567890", "Andi", "simpul", "MEOK"),
    ("081234567891", "Wati", "simpul", "BANJAR"),
    ("081255500001", "Rahmat", "petani", "MEOK"),
    ("081300000001", "Darman", "kapal", None),
    ("081300000002", "Nahkoda feri", "kapal", None),
    ("081400000001", "Mitra Pasar Minggu", "mitra", None),
    ("0811000000", "Admin Demo", "admin", None),
]
PETANI_DEMO = [("Rahmat", "MEOK", "Tani Makmur"), ("Siti", "MEOK", "Tani Makmur"), ("Yanto", "MEOK", "Sumber Rezeki"), ("Dewi", "BANJAR", "Pisang Jaya")]
# (nama petani, tandan, hari sampai siap angkut) sesuai contoh PRD 7.2
PANEN_DEMO = [("Rahmat", 120, 5), ("Siti", 150, 5), ("Yanto", 210, 6), ("Dewi", 90, 7)]


def _id() -> str:
    return uuid.uuid4().hex


def _tgl(n: int) -> str:
    return (hari_ini_wib() + timedelta(days=n)).isoformat()


def _desa(db: Session, kode: str) -> Desa:
    d = db.scalar(select(Desa).where(Desa.kode == kode))
    if d is None:
        nama, petani, biaya = {"MEOK": ("Meok", 40, 7000), "BANJAR": ("Banjarsari", 35, 6000)}[kode]
        d = Desa(id=_id(), nama=nama, kode=kode, jumlah_petani_pisang=petani, biaya_tebang=biaya)
        db.add(d)
        db.flush()
        tandai(db, d)
    return d


def _petani(db: Session, nama: str, desa: Desa, kelompok: str) -> Petani:
    p = db.scalar(select(Petani).where(Petani.nama == nama, Petani.desa_id == desa.id))
    if p is None:
        p = Petani(id=_id(), nama=nama, desa_id=desa.id, kelompok=kelompok)
        db.add(p)
        db.flush()
        tandai(db, p)
    return p


def _akun(db: Session, hp: str, nama: str, peran: str, desa: Desa | None, petani: Petani | None = None) -> Pengguna | None:
    u = db.scalar(select(Pengguna).where(Pengguna.hp == hp))
    if u is not None:
        # Nomor ini sudah dipakai akun lain (misalnya Admin sungguhan): jangan diubah.
        return u if u.peran == peran else None
    u = Pengguna(
        id=_id(), nama=nama, hp=hp, peran=peran, desa_id=desa.id if desa else None,
        petani_id=petani.id if petani else None, pin_hash=hash_pin(PIN_DEMO),
    )
    db.add(u)
    db.flush()
    tandai(db, u)
    return u


def _kapal(db: Session, nama: str, jenis: str, pengelola: Pengguna | None) -> Kapal:
    k = db.scalar(select(Kapal).where(Kapal.nama == nama))
    if k is None:
        k = Kapal(id=_id(), nama=nama, jenis=jenis, pengelola_id=pengelola.id if pengelola else None)
        db.add(k)
        db.flush()
        tandai(db, k)
    return k


def siapkan_data(db: Session) -> dict[str, Pengguna | Desa | None]:
    """Memastikan data contoh PRD ada dan segar. Mengembalikan akun dan desa contoh."""
    meok, banjar = _desa(db, "MEOK"), _desa(db, "BANJAR")
    desa = {"MEOK": meok, "BANJAR": banjar}
    petani = {nama: _petani(db, nama, desa[kode], kel) for nama, kode, kel in PETANI_DEMO}

    akun: dict[str, Pengguna | Desa | None] = {"meok": meok, "banjar": banjar}
    for hp, nama, peran, kode in AKUN_DEMO:
        akun[nama] = _akun(db, hp, nama, peran, desa[kode] if kode else None, petani["Rahmat"] if peran == "petani" else None)

    darman = akun["Darman"]
    nahkoda = akun["Nahkoda feri"]
    bahari = _kapal(db, "Kapal nelayan Bahari 2", "nelayan", darman if isinstance(darman, Pengguna) else None)
    feri = _kapal(db, "Feri perintis", "feri", nahkoda if isinstance(nahkoda, Pengguna) else None)
    pembuat = darman.id if isinstance(darman, Pengguna) else "demo"

    # Selalu ada kapal yang akan berangkat, lewat dari batas waktu pencocokan besok.
    batas = f"{_tgl(2)}T00:00"
    for kapal, hari, jam, ruang, tarif in [(bahari, 6, "06:00", 300, 8000), (feri, 11, "18:00", 800, 5000)]:
        ada = db.scalar(
            select(func.count()).select_from(Keberangkatan).where(
                Keberangkatan.kapal_id == kapal.id, Keberangkatan.status == "buka", Keberangkatan.berangkat >= batas
            )
        )
        if not ada:
            kb = Keberangkatan(
                id=_id(), kapal_id=kapal.id, asal=ASAL, tujuan=TUJUAN, berangkat=f"{_tgl(hari)}T{jam}",
                sisa_ruang=ruang, tarif=tarif, dibuat_oleh=pembuat,
            )
            db.add(kb)
            db.flush()
            tandai(db, kb)

    # Harga acuan: riwayat 3 harga dan harga terbaru tidak lebih tua dari 3 hari.
    mitra = akun["Mitra Pasar Minggu"]
    oleh = mitra.id if isinstance(mitra, Pengguna) else "demo"
    terakhir = db.scalar(select(func.max(HargaAcuan.tanggal)).where(HargaAcuan.pasar == PASAR))
    if terakhir is None:
        rencana_harga = [(17, 62000), (10, 58000), (3, 60000)]
    elif terakhir < _tgl(-3):
        rencana_harga = [(1, 60000)]
    else:
        rencana_harga = []
    for hari_lalu, nilai in rencana_harga:
        h = HargaAcuan(id=_id(), pasar=PASAR, tanggal=_tgl(-hari_lalu), harga=nilai, oleh=oleh)
        db.add(h)
        db.flush()
        tandai(db, h)

    # Panen contoh PRD 7.2: ditambah lagi hanya bila catatan yang masih aktif (belum terangkut
    # atau dibatalkan) tinggal sedikit. Catatan yang sudah dapat jatah tetap dihitung aktif.
    aktif = db.scalar(
        select(func.count()).select_from(CatatanPanen).where(
            CatatanPanen.desa_id == meok.id, CatatanPanen.status.in_(("terdaftar", "daftar_tunggu", "dapat_jatah"))
        )
    )
    if (aktif or 0) < 3:
        simpul = akun["Andi"]
        dibuat = datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None)
        for i, (nama, tandan, siap) in enumerate(PANEN_DEMO):
            p = petani[nama]
            c = CatatanPanen(
                id=_id(), petani_id=p.id, desa_id=p.desa_id, komoditas="Pisang kepok", tandan=tandan,
                siap_angkut=_tgl(siap), dibuat_oleh=simpul.id if isinstance(simpul, Pengguna) else "demo",
                dibuat_perangkat="demo", dibuat=(dibuat + timedelta(minutes=5 * i)).isoformat() + ".000Z",
                diterima=dibuat + timedelta(minutes=5 * i),
            )
            db.add(c)
            db.flush()
            tandai(db, c)
    return akun


# --- Paket kode juri ---------------------------------------------------------------

PAKET_JURI = [
    ("Simpul Desa Meok", "desa", "meok"),
    ("Pengelola kapal", "pengguna", "Darman"),
    ("Mitra pasar", "pengguna", "Mitra Pasar Minggu"),
    ("Admin", "pengguna", "Admin Demo"),
]


def siapkan_kode_juri(db: Session, jumlah: int, akun: dict[str, Pengguna | Desa | None]) -> list[KodeAktivasi]:
    """Membuat paket kode untuk juri 1..jumlah yang belum punya. Kode lama tidak diubah."""
    for n in range(1, jumlah + 1):
        for label, jenis, kunci in PAKET_JURI:
            ket = f"Juri {n} · {label}"
            if db.scalar(select(KodeAktivasi).where(KodeAktivasi.keterangan == ket)):
                continue
            target = akun.get(kunci)
            if target is None:
                continue
            k = KodeAktivasi(kode=buat_kode_aktivasi(), keterangan=ket)
            if jenis == "desa":
                k.desa_id = target.id
            else:
                k.pengguna_id = target.id
            db.add(k)
    db.flush()
    return list(db.scalars(select(KodeAktivasi).where(KodeAktivasi.keterangan.like("Juri %"))))


def cetak_kode_juri(kode: list[KodeAktivasi]) -> None:
    def urut(k: KodeAktivasi) -> tuple[int, str]:
        nomor = k.keterangan.split(" ")[1]
        return (int(nomor) if nomor.isdigit() else 0, k.keterangan)

    print("=" * 64)
    print("KODE AKTIVASI JURI SANDAR (setiap kode sekali pakai, untuk satu peramban)")
    for k in sorted(kode, key=urut):
        status = "SUDAH DIPAKAI" if k.dipakai_oleh else "siap"
        print(f"  {k.keterangan:<34} {k.kode}   {status}")
    print(f"Akun contoh (PIN {PIN_DEMO}):")
    for hp, nama, peran, _ in AKUN_DEMO:
        if peran in ("simpul", "petani", "kapal", "mitra", "admin") and nama not in ("Wati", "Nahkoda feri"):
            print(f"  {nama:<20} {hp}")
    print("=" * 64)


def siapkan_untuk_juri(db: Session, jumlah: int) -> None:
    akun = siapkan_data(db)
    kode = siapkan_kode_juri(db, jumlah, akun)
    db.commit()
    cetak_kode_juri(kode)
