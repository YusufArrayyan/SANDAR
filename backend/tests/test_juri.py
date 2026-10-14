"""Paket kode juri dan data contoh yang tetap segar (SANDAR_JURI)."""

from datetime import timedelta

from sqlalchemy import func, select

from app.db import Base, SessionLocal, engine
from app.demo import siapkan_untuk_juri
from app.layanan import hari_ini_wib
from app.models import CatatanPanen, HargaAcuan, Keberangkatan, KodeAktivasi, Pengguna
from app.seed import isi


def _hitung(db, model, *syarat):
    return db.scalar(select(func.count()).select_from(model).where(*syarat))


def test_paket_juri_idempoten_dan_admin_asli_tetap(capsys):
    Base.metadata.drop_all(engine)
    isi(demo=False, admin_hp="081299990000", admin_pin="4321")
    with SessionLocal() as db:
        siapkan_untuk_juri(db, 3)
    with SessionLocal() as db:
        siapkan_untuk_juri(db, 3)
        assert _hitung(db, KodeAktivasi, KodeAktivasi.keterangan.like("Juri %")) == 12
        assert _hitung(db, Keberangkatan) == 2
        assert _hitung(db, HargaAcuan) == 3
        assert _hitung(db, CatatanPanen) == 4
        admin = db.scalar(select(Pengguna).where(Pengguna.hp == "081299990000"))
        assert admin is not None and admin.nama == "Admin SANDAR"
    keluaran = capsys.readouterr().out
    assert "Juri 3 · Admin" in keluaran and "KODE AKTIVASI JURI" in keluaran


def test_data_contoh_disegarkan_saat_jadwal_lewat():
    Base.metadata.drop_all(engine)
    isi(demo=False, admin_hp="081299990000", admin_pin="4321")
    with SessionLocal() as db:
        siapkan_untuk_juri(db, 1)
        lalu = hari_ini_wib().replace(year=hari_ini_wib().year - 1).isoformat()
        for kb in db.scalars(select(Keberangkatan)):
            kb.berangkat = f"{lalu}T06:00"
            kb.status = "berangkat"
        for h in db.scalars(select(HargaAcuan)):
            h.tanggal = lalu
        for c in db.scalars(select(CatatanPanen)):
            c.status = "terangkut"
        db.commit()
    with SessionLocal() as db:
        siapkan_untuk_juri(db, 1)
        besok = hari_ini_wib().isoformat()
        assert _hitung(db, Keberangkatan, Keberangkatan.status == "buka", Keberangkatan.berangkat > besok) == 2
        assert db.scalar(select(func.max(HargaAcuan.tanggal))) >= (hari_ini_wib() - timedelta(days=3)).isoformat()
        assert _hitung(db, CatatanPanen, CatatanPanen.status == "terdaftar") == 4
