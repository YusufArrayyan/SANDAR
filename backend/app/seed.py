"""Data awal.

    python -m app.seed            # akun Admin pertama dan satu kode aktivasi
    python -m app.seed --demo     # ditambah data contoh dari PRD (Desa Meok, Bahari 2, dst.)
    python -m app.seed --demo --reset   # hapus basis data lalu isi ulang

Seluruh nama, angka, dan harga data contoh BUKAN data lapangan (lihat catatan PRD).
"""

from __future__ import annotations

import argparse
import os
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from .db import Base, SessionLocal, engine
from .layanan import buat_kode_aktivasi, hari_ini_wib, hash_pin, siapkan_penghitung, tandai
from .models import CatatanPanen, Desa, HargaAcuan, Kapal, Keberangkatan, KodeAktivasi, Pengguna, Petani


def _id() -> str:
    return uuid.uuid4().hex


PIN_DEMO = os.getenv("SANDAR_PIN_DEMO", "1234")

KODE_DEMO = {
    "MEOK2026": "Perangkat simpul Desa Meok",
    "BANJAR26": "Perangkat simpul Desa Banjarsari",
    "ADMIN001": "Perangkat Admin",
    "KAPAL001": "Ponsel pengelola Bahari 2",
    "KAPAL002": "Ponsel pengelola feri",
    "MITRA001": "Ponsel mitra pasar",
    "PETANI01": "Ponsel Rahmat",
}


def isi(demo: bool) -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        siapkan_penghitung(db)
        if db.scalar(select(Pengguna).where(Pengguna.peran == "admin")):
            print("Basis data sudah berisi akun Admin. Pakai --reset untuk mengisi ulang.")
            return

        admin = Pengguna(id=_id(), nama="Admin SANDAR", hp="0811000000", peran="admin", pin_hash=hash_pin(PIN_DEMO))
        db.add(admin)
        db.flush()
        tandai(db, admin)

        if not demo:
            kode = KodeAktivasi(kode=buat_kode_aktivasi(), pengguna_id=admin.id, keterangan="Perangkat Admin pertama")
            db.add(kode)
            db.commit()
            print(f"Akun Admin: HP {admin.hp}, PIN {PIN_DEMO}. Kode aktivasi perangkat Admin: {kode.kode}")
            print("Segera ganti PIN Admin setelah masuk.")
            return

        hari = hari_ini_wib()

        def tgl(n: int) -> str:
            return (hari + timedelta(days=n)).isoformat()

        meok = Desa(id=_id(), nama="Meok", kode="MEOK", jumlah_petani_pisang=40, biaya_tebang=7000)
        banjar = Desa(id=_id(), nama="Banjarsari", kode="BANJAR", jumlah_petani_pisang=35, biaya_tebang=6000)
        db.add_all([meok, banjar])
        db.flush()
        tandai(db, meok, banjar)

        simpul = Pengguna(id=_id(), nama="Andi", hp="081234567890", peran="simpul", desa_id=meok.id, pin_hash=hash_pin(PIN_DEMO))
        simpul_b = Pengguna(id=_id(), nama="Wati", hp="081234567891", peran="simpul", desa_id=banjar.id, pin_hash=hash_pin(PIN_DEMO))
        kapal1 = Pengguna(id=_id(), nama="Darman", hp="081300000001", peran="kapal", pin_hash=hash_pin(PIN_DEMO))
        kapal2 = Pengguna(id=_id(), nama="Nahkoda feri", hp="081300000002", peran="kapal", pin_hash=hash_pin(PIN_DEMO))
        mitra = Pengguna(id=_id(), nama="Mitra Pasar Minggu", hp="081400000001", peran="mitra", pin_hash=hash_pin(PIN_DEMO))
        db.add_all([simpul, simpul_b, kapal1, kapal2, mitra])

        petani = {}
        for nama, desa, kelompok in [
            ("Rahmat", meok, "Tani Makmur"),
            ("Siti", meok, "Tani Makmur"),
            ("Yanto", meok, "Sumber Rezeki"),
            ("Dewi", banjar, "Pisang Jaya"),
        ]:
            p = Petani(id=_id(), nama=nama, desa_id=desa.id, kelompok=kelompok)
            db.add(p)
            petani[nama] = p
        db.flush()
        tandai(db, *petani.values())

        rahmat = Pengguna(
            id=_id(), nama="Rahmat", hp="081255500001", peran="petani", desa_id=meok.id,
            petani_id=petani["Rahmat"].id, pin_hash=hash_pin(PIN_DEMO),
        )
        db.add(rahmat)
        db.flush()
        tandai(db, simpul, simpul_b, kapal1, kapal2, mitra, rahmat)

        bahari = Kapal(id=_id(), nama="Kapal nelayan Bahari 2", jenis="nelayan", pengelola_id=kapal1.id)
        feri = Kapal(id=_id(), nama="Feri perintis", jenis="feri", pengelola_id=kapal2.id)
        db.add_all([bahari, feri])
        db.flush()
        tandai(db, bahari, feri)

        kb1 = Keberangkatan(
            id=_id(), kapal_id=bahari.id, asal="Pelabuhan Malakoni, Enggano", tujuan="Pelabuhan Pulau Baai, Kota Bengkulu",
            berangkat=f"{tgl(6)}T06:00", sisa_ruang=300, tarif=8000, dibuat_oleh=kapal1.id,
        )
        kb2 = Keberangkatan(
            id=_id(), kapal_id=feri.id, asal="Pelabuhan Malakoni, Enggano", tujuan="Pelabuhan Pulau Baai, Kota Bengkulu",
            berangkat=f"{tgl(11)}T18:00", sisa_ruang=800, tarif=5000, dibuat_oleh=kapal2.id,
        )
        db.add_all([kb1, kb2])
        db.flush()
        tandai(db, kb1, kb2)

        for hari_lalu, harga in [(17, 62000), (10, 58000), (3, 60000)]:
            h = HargaAcuan(id=_id(), pasar="Pasar Minggu, Kota Bengkulu", tanggal=tgl(-hari_lalu), harga=harga, oleh=mitra.id)
            db.add(h)
            db.flush()
            tandai(db, h)

        dibuat = datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None)
        for i, (nama, tandan, siap) in enumerate([("Rahmat", 120, 5), ("Siti", 150, 5), ("Yanto", 210, 6), ("Dewi", 90, 7)]):
            p = petani[nama]
            c = CatatanPanen(
                id=_id(), petani_id=p.id, desa_id=p.desa_id, komoditas="Pisang kepok", tandan=tandan,
                siap_angkut=tgl(siap), dibuat_oleh=simpul.id, dibuat_perangkat="seed",
                dibuat=(dibuat + timedelta(minutes=5 * i)).isoformat() + ".000Z",  # format sama dengan perangkat
                diterima=dibuat + timedelta(minutes=5 * i),
            )
            db.add(c)
            db.flush()
            tandai(db, c)

        target = {
            "MEOK2026": {"desa_id": meok.id},
            "BANJAR26": {"desa_id": banjar.id},
            "ADMIN001": {"pengguna_id": admin.id},
            "KAPAL001": {"pengguna_id": kapal1.id},
            "KAPAL002": {"pengguna_id": kapal2.id},
            "MITRA001": {"pengguna_id": mitra.id},
            "PETANI01": {"pengguna_id": rahmat.id},
        }
        for kode, ket in KODE_DEMO.items():
            db.add(KodeAktivasi(kode=kode, keterangan=ket, **target[kode]))
        db.commit()

        print("Data contoh terisi. Semua akun memakai PIN", PIN_DEMO)
        print("Kode aktivasi (sekali pakai):")
        for kode, ket in KODE_DEMO.items():
            print(f"  {kode}  {ket}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--reset", action="store_true")
    a = ap.parse_args()
    if a.reset:
        Base.metadata.drop_all(engine)
    isi(a.demo)


if __name__ == "__main__":
    main()
