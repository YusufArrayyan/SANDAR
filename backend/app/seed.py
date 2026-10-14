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

from sqlalchemy import select

from .db import Base, SessionLocal, engine
from .demo import PIN_DEMO, siapkan_data, siapkan_untuk_juri
from .layanan import buat_kode_aktivasi, hash_pin, siapkan_penghitung, tandai
from .models import KodeAktivasi, Pengguna


def _id() -> str:
    return uuid.uuid4().hex


KODE_DEMO = {
    "MEOK2026": "Perangkat simpul Desa Meok",
    "BANJAR26": "Perangkat simpul Desa Banjarsari",
    "ADMIN001": "Perangkat Admin",
    "KAPAL001": "Ponsel pengelola Bahari 2",
    "KAPAL002": "Ponsel pengelola feri",
    "MITRA001": "Ponsel mitra pasar",
    "PETANI01": "Ponsel Rahmat",
}


def isi(demo: bool, admin_hp: str = "0811000000", admin_pin: str = PIN_DEMO) -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        siapkan_penghitung(db)
        if db.scalar(select(Pengguna).where(Pengguna.peran == "admin")):
            print("Basis data sudah berisi akun Admin. Pakai --reset untuk mengisi ulang.")
            return

        if not demo:
            admin = Pengguna(id=_id(), nama="Admin SANDAR", hp=admin_hp, peran="admin", pin_hash=hash_pin(admin_pin))
            db.add(admin)
            db.flush()
            tandai(db, admin)
            kode = KodeAktivasi(kode=buat_kode_aktivasi(), pengguna_id=admin.id, keterangan="Perangkat Admin pertama")
            db.add(kode)
            db.commit()
            print(f"Akun Admin: HP {admin.hp}. Kode aktivasi perangkat Admin: {kode.kode}")
            print("Segera ganti PIN Admin setelah masuk.")
            return

        akun = siapkan_data(db)
        meok, banjar = akun["meok"], akun["banjar"]
        kapal1, kapal2, mitra, rahmat = akun["Darman"], akun["Nahkoda feri"], akun["Mitra Pasar Minggu"], akun["Rahmat"]
        admin = akun["Admin Demo"]

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


def isi_awal_dari_lingkungan() -> None:
    """Untuk hosting tanpa terminal (misalnya Render gratis). Dijalankan setiap server menyala.

    - SANDAR_ADMIN_HP dan SANDAR_ADMIN_PIN: membuat akun Admin pertama bila belum ada;
      kode aktivasinya tampil di log.
    - SANDAR_DATA_CONTOH=1: mengisi data contoh PRD (PIN 1234, kode tetap) pada basis data kosong.
    - SANDAR_JURI=<jumlah>: memastikan data contoh ada dan segar, lalu mencetak paket kode juri ke log.
    """
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        siapkan_penghitung(db)
        ada_admin = db.scalar(select(Pengguna).where(Pengguna.peran == "admin")) is not None

    if not ada_admin:
        hp, pin = os.getenv("SANDAR_ADMIN_HP", "").strip(), os.getenv("SANDAR_ADMIN_PIN", "").strip()
        if os.getenv("SANDAR_DATA_CONTOH") == "1":
            isi(demo=True)
        elif hp and pin:
            if pin.isdigit() and len(pin) == 4:
                isi(demo=False, admin_hp=hp, admin_pin=pin)
            else:
                print("SANDAR_ADMIN_PIN harus 4 angka. Akun Admin tidak dibuat.")

    jumlah_juri = os.getenv("SANDAR_JURI", "").strip()
    if jumlah_juri.isdigit() and int(jumlah_juri) > 0:
        with SessionLocal() as db:
            siapkan_untuk_juri(db, min(int(jumlah_juri), 30))


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
