"""Ringkasan empat indikator keberhasilan per desa dan per bulan (PRD bagian 3, FR-62).

Bulan ditentukan oleh tanggal siap angkut catatan panen (indikator 1-3) dan oleh
waktu server menerima operasi (indikator 4). Hitungan memakai bobot tandan agar catatan
yang dipisah saat Terangkut tidak dihitung dua kali.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import CatatanPanen, Desa, OpLog, Petani


def _hari(a: str, b: str) -> int:
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def _iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo is None else (dt - dt.utcoffset()).replace(tzinfo=None)  # type: ignore[operator]


def daftar_bulan(db: Session) -> list[str]:
    bulan = {s[:7] for s in db.scalars(select(CatatanPanen.siap_angkut))}
    return sorted(bulan, reverse=True)


def ringkasan(db: Session, bulan: str) -> list[dict[str, Any]]:
    hasil = []
    awal = datetime.fromisoformat(f"{bulan}-01")
    akhir = (awal + timedelta(days=32)).replace(day=1)
    for d in db.scalars(select(Desa).order_by(Desa.nama)):
        catatan = list(
            db.scalars(
                select(CatatanPanen).where(
                    CatatanPanen.desa_id == d.id,
                    CatatanPanen.siap_angkut.like(f"{bulan}-%"),
                    CatatanPanen.status != "dibatalkan",
                )
            )
        )
        total = sum(c.tandan for c in catatan)
        angkut = [c for c in catatan if c.status == "terangkut" and c.terangkut_tanggal]
        tepat = sum(c.tandan for c in angkut if _hari(c.siap_angkut, c.terangkut_tanggal or c.siap_angkut) <= 7)
        tandan_angkut = sum(c.tandan for c in angkut)
        tunggu = sum(c.tandan * max(0, _hari(c.siap_angkut, c.terangkut_tanggal or c.siap_angkut)) for c in angkut)

        berharga = [c for c in angkut if c.harga_terima is not None and c.acuan_bersih is not None]
        tandan_harga = sum(c.tandan for c in berharga)
        selisih = sum(c.tandan * ((c.acuan_bersih or 0) - (c.harga_terima or 0)) for c in berharga)

        ops = list(
            db.scalars(
                select(OpLog).where(
                    OpLog.desa_id == d.id, OpLog.status == "diterima", OpLog.diterima >= awal, OpLog.diterima < akhir
                )
            )
        )
        tepat_sinkron = 0
        for o in ops:
            dicoba = _iso(o.pertama_dicoba) or _iso(o.waktu_perangkat)
            if dicoba is None or (o.diterima - dicoba) <= timedelta(hours=24):
                tepat_sinkron += 1

        jumlah_petani = db.scalar(select(func.count()).select_from(Petani).where(Petani.desa_id == d.id)) or 0

        hasil.append(
            {
                "desa_id": d.id,
                "desa": d.nama,
                "bulan": bulan,
                "catatan": len(catatan),
                "tandan_terdaftar": total,
                "tandan_terangkut": tandan_angkut,
                "i1_terangkut_7hari_persen": round(100 * tepat / total, 1) if total else None,
                "i2_selisih_harga_rp": round(selisih / tandan_harga) if tandan_harga else None,
                "i2_tandan_berharga": tandan_harga,
                "i3_waktu_tunggu_hari": round(tunggu / tandan_angkut, 1) if tandan_angkut else None,
                "i4_sinkron_24jam_persen": round(100 * tepat_sinkron / len(ops), 1) if ops else None,
                "i4_operasi": len(ops),
                "i4_petani_terdaftar": jumlah_petani,
                "i4_petani_terdaftar_persen": round(100 * jumlah_petani / d.jumlah_petani_pisang, 1)
                if d.jumlah_petani_pisang
                else None,
            }
        )
    return hasil
