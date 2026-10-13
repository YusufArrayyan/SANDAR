"""Aktivasi, harga acuan, keberangkatan, ringkasan indikator, dan panel Kelola (Admin)."""

from __future__ import annotations

import csv
import io
import time
import uuid
from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import serial
from .akses import wajib_peran
from .db import get_db
from .indikator import daftar_bulan, ringkasan
from .layanan import audit, buat_kode_aktivasi, buat_token, hari_ini_wib, hash_pin, hash_token, iso_utc, parameter, tandai
from .models import (
    CatatanPanen,
    Desa,
    HargaAcuan,
    Kapal,
    Keberangkatan,
    KodeAktivasi,
    LogAudit,
    Parameter,
    Pengguna,
    Perangkat,
    Petani,
    sekarang,
)
from .rencana import hitung_ulang
from .skema import (
    AktivasiMasuk,
    DesaMasuk,
    DesaUbah,
    HargaMasuk,
    KapalMasuk,
    KapalUbah,
    KodeMasuk,
    ParameterMasuk,
    PenggunaMasuk,
    PenggunaUbah,
)

router = APIRouter()
admin = wajib_peran("admin")


# --- Aktivasi perangkat (FR-01) ---------------------------------------------


# Batas percobaan kode aktivasi per alamat IP, agar kode tidak bisa ditebak berulang.
_GAGAL_AKTIVASI: dict[str, list[float]] = defaultdict(list)
MAKS_GAGAL_AKTIVASI = 10
JENDELA_GAGAL_DETIK = 15 * 60


@router.post("/auth/aktivasi", tags=["auth"])
def aktivasi(masuk: AktivasiMasuk, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    ip = request.client.host if request.client else "?"
    kini = time.monotonic()
    gagal = [t for t in _GAGAL_AKTIVASI[ip] if kini - t < JENDELA_GAGAL_DETIK]
    _GAGAL_AKTIVASI[ip] = gagal
    if len(gagal) >= MAKS_GAGAL_AKTIVASI:
        raise HTTPException(429, "Terlalu banyak kode salah. Coba lagi 15 menit lagi.")
    kode = db.get(KodeAktivasi, masuk.kode.strip().upper())
    if kode is None:
        gagal.append(kini)
        raise HTTPException(404, "Kode aktivasi tidak dikenal. Periksa lagi huruf dan angkanya.")
    if kode.dipakai_oleh:
        raise HTTPException(409, "Kode aktivasi ini sudah dipakai. Minta kode baru kepada Admin.")
    token = buat_token()
    p = Perangkat(
        id=uuid.uuid4().hex,
        nama=masuk.nama_perangkat[:80],
        token_hash=hash_token(token),
        desa_id=kode.desa_id,
        pengguna_id=kode.pengguna_id,
    )
    db.add(p)
    kode.dipakai_oleh, kode.dipakai_pada = p.id, sekarang()
    db.commit()
    return {"token": token, "perangkat": {"id": p.id, "desa_id": p.desa_id, "pengguna_id": p.pengguna_id}}


# --- Harga acuan (FR-40, FR-45) ---------------------------------------------


@router.post("/harga", tags=["harga"])
def simpan_harga(
    masuk: HargaMasuk, u: Pengguna = Depends(wajib_peran("mitra", "admin")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    if date.fromisoformat(masuk.tanggal) > hari_ini_wib() + timedelta(days=1):
        raise HTTPException(422, "Tanggal harga tidak boleh di masa depan. Periksa tanggalnya.")
    hid = masuk.id or uuid.uuid4().hex
    h = db.get(HargaAcuan, hid)
    if h is None:
        h = HargaAcuan(id=hid, pasar=masuk.pasar, tanggal=masuk.tanggal, harga=masuk.harga, oleh=u.id)
        db.add(h)
        db.flush()
        tandai(db, h)
        audit(db, u.id, "harga", f"harga:{hid}", None, {"pasar": h.pasar, "tanggal": h.tanggal, "harga": h.harga})
        db.commit()
    return serial.harga(h)


@router.get("/harga", tags=["harga"])
def riwayat_harga(
    pasar: str | None = None,
    batas: int = Query(5, ge=1, le=100),
    _: Pengguna = Depends(wajib_peran("mitra", "admin", "simpul", "petani", "kapal")),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    q = select(HargaAcuan).order_by(HargaAcuan.tanggal.desc(), HargaAcuan.waktu.desc()).limit(batas)
    if pasar:
        q = q.where(HargaAcuan.pasar == pasar)
    return [serial.harga(h) for h in db.scalars(q)]


@router.get("/keberangkatan", tags=["keberangkatan"])
def daftar_keberangkatan(
    _: Pengguna = Depends(wajib_peran("mitra", "admin", "simpul", "petani", "kapal")), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    return [serial.keberangkatan(k) for k in db.scalars(select(Keberangkatan).order_by(Keberangkatan.berangkat))]


# --- Ringkasan indikator (FR-62) --------------------------------------------


@router.get("/ringkasan/indikator", tags=["ringkasan"])
def indikator(bulan: str | None = None, _: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> dict[str, Any]:
    hitung_ulang(db)
    db.commit()
    bulan_ada = daftar_bulan(db)
    bulan = bulan or (bulan_ada[0] if bulan_ada else sekarang().strftime("%Y-%m"))
    return {"bulan": bulan, "bulan_tersedia": bulan_ada, "desa": ringkasan(db, bulan)}


# --- Kelola: pengguna --------------------------------------------------------


def _admin_pengguna(u: Pengguna) -> dict[str, Any]:
    d = serial.pengguna(u)
    d.pop("pin_hash")
    return d


@router.get("/admin/pengguna", tags=["admin"])
def daftar_pengguna(_: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return [_admin_pengguna(u) for u in db.scalars(select(Pengguna).order_by(Pengguna.peran, Pengguna.nama))]


@router.post("/admin/pengguna", tags=["admin"])
def tambah_pengguna(masuk: PenggunaMasuk, a: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> dict[str, Any]:
    if masuk.peran in ("petani", "simpul") and not masuk.desa_id:
        raise HTTPException(422, "Petani dan Pengelola simpul wajib memilih desa.")
    if masuk.desa_id and db.get(Desa, masuk.desa_id) is None:
        raise HTTPException(422, "Desa tidak ditemukan.")
    if db.scalar(select(Pengguna).where(Pengguna.hp == masuk.hp)):
        raise HTTPException(409, "Nomor HP ini sudah dipakai akun lain.")
    u = Pengguna(
        id=uuid.uuid4().hex,
        nama=masuk.nama,
        hp=masuk.hp,
        peran=masuk.peran,
        desa_id=masuk.desa_id if masuk.peran in ("petani", "simpul") else None,
        pin_hash=hash_pin(masuk.pin),
    )
    if masuk.peran == "petani":
        p = Petani(id=uuid.uuid4().hex, nama=masuk.nama, desa_id=masuk.desa_id or "", kelompok=masuk.kelompok, hp=masuk.hp)
        db.add(p)
        db.flush()
        tandai(db, p)
        u.petani_id = p.id
    db.add(u)
    db.flush()
    tandai(db, u)
    audit(db, a.id, "tambah_akun", f"pengguna:{u.id}", None, _admin_pengguna(u))
    db.commit()
    return _admin_pengguna(u)


@router.patch("/admin/pengguna/{pid}", tags=["admin"])
def ubah_pengguna(pid: str, masuk: PenggunaUbah, a: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> dict[str, Any]:
    u = db.get(Pengguna, pid)
    if u is None:
        raise HTTPException(404, "Akun tidak ditemukan.")
    lama = _admin_pengguna(u)
    if masuk.nama is not None:
        u.nama = masuk.nama
    if masuk.aktif is not None:
        if u.id == a.id and not masuk.aktif:
            raise HTTPException(422, "Anda tidak dapat menonaktifkan akun sendiri.")
        u.aktif = masuk.aktif
    if masuk.desa_id is not None and u.peran in ("petani", "simpul"):
        u.desa_id = masuk.desa_id
    if masuk.pin is not None:
        u.pin_hash = hash_pin(masuk.pin)
    tandai(db, u)
    audit(db, a.id, "ubah_akun", f"pengguna:{u.id}", lama, {**_admin_pengguna(u), "pin_diubah": masuk.pin is not None})
    db.commit()
    return _admin_pengguna(u)


# --- Kelola: desa dan simpul -----------------------------------------------


@router.get("/admin/desa", tags=["admin"])
def daftar_desa(_: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return [serial.desa(d) for d in db.scalars(select(Desa).order_by(Desa.nama))]


@router.post("/admin/desa", tags=["admin"])
def tambah_desa(masuk: DesaMasuk, a: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> dict[str, Any]:
    d = Desa(id=uuid.uuid4().hex, **masuk.model_dump())
    db.add(d)
    try:
        db.flush()
    except IntegrityError as e:
        raise HTTPException(409, "Kode desa sudah dipakai.") from e
    tandai(db, d)
    audit(db, a.id, "tambah_desa", f"desa:{d.id}", None, serial.desa(d))
    db.commit()
    return serial.desa(d)


@router.patch("/admin/desa/{did}", tags=["admin"])
def ubah_desa(did: str, masuk: DesaUbah, a: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> dict[str, Any]:
    d = db.get(Desa, did)
    if d is None:
        raise HTTPException(404, "Desa tidak ditemukan.")
    lama = serial.desa(d)
    for k, v in masuk.model_dump(exclude_none=True).items():
        setattr(d, k, v)
    tandai(db, d)
    audit(db, a.id, "ubah_desa", f"desa:{d.id}", lama, serial.desa(d))
    db.commit()
    return serial.desa(d)


# --- Kelola: kapal -----------------------------------------------------------


@router.get("/admin/kapal", tags=["admin"])
def daftar_kapal(_: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return [serial.kapal(k) for k in db.scalars(select(Kapal).order_by(Kapal.nama))]


def _cek_pengelola(db: Session, pid: str | None) -> None:
    if pid:
        u = db.get(Pengguna, pid)
        if u is None or u.peran != "kapal":
            raise HTTPException(422, "Pengelola harus akun berperan Pengelola kapal.")


@router.post("/admin/kapal", tags=["admin"])
def tambah_kapal(masuk: KapalMasuk, a: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> dict[str, Any]:
    _cek_pengelola(db, masuk.pengelola_id)
    k = Kapal(id=uuid.uuid4().hex, **masuk.model_dump())
    db.add(k)
    db.flush()
    tandai(db, k)
    audit(db, a.id, "tambah_kapal", f"kapal:{k.id}", None, serial.kapal(k))
    db.commit()
    return serial.kapal(k)


@router.patch("/admin/kapal/{kid}", tags=["admin"])
def ubah_kapal(kid: str, masuk: KapalUbah, a: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> dict[str, Any]:
    k = db.get(Kapal, kid)
    if k is None:
        raise HTTPException(404, "Kapal tidak ditemukan.")
    data = masuk.model_dump(exclude_unset=True)
    if "pengelola_id" in data:
        _cek_pengelola(db, data["pengelola_id"])
    lama = serial.kapal(k)
    for kunci, v in data.items():
        setattr(k, kunci, v)
    tandai(db, k)
    audit(db, a.id, "ubah_kapal", f"kapal:{k.id}", lama, serial.kapal(k))
    db.commit()
    return serial.kapal(k)


# --- Kelola: perangkat dan kode aktivasi (FR-61, FR-06) ---------------------


@router.get("/admin/kode", tags=["admin"])
def daftar_kode(_: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return [
        {
            "kode": k.kode,
            "desa_id": k.desa_id,
            "pengguna_id": k.pengguna_id,
            "keterangan": k.keterangan,
            "dibuat": iso_utc(k.dibuat),
            "dipakai_pada": iso_utc(k.dipakai_pada),
        }
        for k in db.scalars(select(KodeAktivasi).order_by(KodeAktivasi.dibuat.desc()).limit(100))
    ]


@router.post("/admin/kode", tags=["admin"])
def buat_kode(masuk: KodeMasuk, a: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> dict[str, Any]:
    if bool(masuk.desa_id) == bool(masuk.pengguna_id):
        raise HTTPException(422, "Pilih salah satu: desa (perangkat simpul) atau akun (perangkat pribadi).")
    if masuk.desa_id and db.get(Desa, masuk.desa_id) is None:
        raise HTTPException(422, "Desa tidak ditemukan.")
    if masuk.pengguna_id and db.get(Pengguna, masuk.pengguna_id) is None:
        raise HTTPException(422, "Akun tidak ditemukan.")
    k = KodeAktivasi(kode=buat_kode_aktivasi(), desa_id=masuk.desa_id, pengguna_id=masuk.pengguna_id, keterangan=masuk.keterangan)
    db.add(k)
    audit(db, a.id, "buat_kode", f"kode:{k.kode}", None, masuk.model_dump())
    db.commit()
    return {"kode": k.kode, "desa_id": k.desa_id, "pengguna_id": k.pengguna_id, "keterangan": k.keterangan}


@router.get("/admin/perangkat", tags=["admin"])
def daftar_perangkat(_: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return [
        {
            "id": p.id,
            "nama": p.nama,
            "desa_id": p.desa_id,
            "pengguna_id": p.pengguna_id,
            "aktif": p.aktif,
            "dibuat": iso_utc(p.dibuat),
            "terakhir_sinkron": iso_utc(p.terakhir_sinkron),
        }
        for p in db.scalars(select(Perangkat).order_by(Perangkat.dibuat.desc()))
    ]


@router.patch("/admin/perangkat/{pid}", tags=["admin"])
def ubah_perangkat(pid: str, aktif: bool, a: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> dict[str, Any]:
    p = db.get(Perangkat, pid)
    if p is None:
        raise HTTPException(404, "Perangkat tidak ditemukan.")
    audit(db, a.id, "ubah_perangkat", f"perangkat:{p.id}", p.aktif, aktif)
    p.aktif = aktif
    db.commit()
    return {"id": p.id, "aktif": p.aktif}


# --- Kelola: parameter -------------------------------------------------------


@router.get("/admin/parameter", tags=["admin"])
def baca_parameter(_: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> dict[str, int]:
    return parameter(db)


@router.put("/admin/parameter", tags=["admin"])
def ubah_parameter(masuk: ParameterMasuk, a: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> dict[str, int]:
    lama = parameter(db)
    for kunci, nilai in masuk.model_dump(exclude_none=True).items():
        p = db.get(Parameter, kunci)
        if p is None:
            p = Parameter(kunci=kunci, nilai=nilai)
            db.add(p)
        p.nilai = nilai
        db.flush()
        tandai(db, p)
    audit(db, a.id, "ubah_parameter", "parameter", lama, masuk.model_dump(exclude_none=True))
    hitung_ulang(db)
    db.commit()
    return parameter(db)


@router.get("/admin/audit", tags=["admin"])
def log_audit(_: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    nama = {u.id: u.nama for u in db.scalars(select(Pengguna))}
    return [
        {
            "id": l.id,
            "waktu": iso_utc(l.waktu),
            "pengguna": nama.get(l.pengguna_id or "", l.pengguna_id),
            "tindakan": l.tindakan,
            "objek": l.objek,
            "nilai_lama": l.nilai_lama,
            "nilai_baru": l.nilai_baru,
        }
        for l in db.scalars(select(LogAudit).order_by(LogAudit.waktu.desc(), LogAudit.id.desc()).limit(200))
    ]


# --- Ekspor CSV (FR-63) ------------------------------------------------------


def _csv(nama: str, kolom: list[str], baris: list[list[Any]]) -> StreamingResponse:
    buf = io.StringIO()
    buf.write("﻿")  # agar huruf terbaca benar di Excel
    w = csv.writer(buf, delimiter=";")
    w.writerow(kolom)
    w.writerows(baris)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nama}"'},
    )


@router.get("/admin/ekspor/{jenis}", tags=["admin"])
def ekspor(jenis: str, bulan: str | None = None, _: Pengguna = Depends(admin), db: Session = Depends(get_db)) -> StreamingResponse:
    if jenis == "panen.csv":
        desa = {d.id: d.nama for d in db.scalars(select(Desa))}
        rows = db.execute(select(CatatanPanen, Petani).join(Petani, CatatanPanen.petani_id == Petani.id).order_by(CatatanPanen.siap_angkut))
        return _csv(
            "sandar_panen.csv",
            ["id", "desa", "petani", "komoditas", "tandan", "siap_angkut", "status", "jatah", "tunggu",
             "terangkut_tanggal", "harga_terima", "acuan_bersih", "dibuat"],
            [
                [c.id, desa.get(c.desa_id, ""), p.nama, c.komoditas, c.tandan, c.siap_angkut, c.status, c.jatah, c.tunggu,
                 c.terangkut_tanggal or "", c.harga_terima if c.harga_terima is not None else "",
                 c.acuan_bersih if c.acuan_bersih is not None else "", c.dibuat]
                for c, p in rows
            ],
        )
    if jenis == "ringkasan.csv":
        bulan = bulan or sekarang().strftime("%Y-%m")
        data = ringkasan(db, bulan)
        kolom = list(data[0].keys()) if data else ["bulan"]
        return _csv(f"sandar_ringkasan_{bulan}.csv", kolom, [list(r.values()) for r in data])
    if jenis == "keberangkatan.csv":
        kapal = {k.id: k.nama for k in db.scalars(select(Kapal))}
        return _csv(
            "sandar_keberangkatan.csv",
            ["id", "kapal", "asal", "tujuan", "berangkat", "sisa_ruang", "tarif", "status", "terkunci"],
            [[k.id, kapal.get(k.kapal_id, ""), k.asal, k.tujuan, k.berangkat, k.sisa_ruang, k.tarif, k.status, k.terkunci]
             for k in db.scalars(select(Keberangkatan).order_by(Keberangkatan.berangkat))],
        )
    if jenis == "harga.csv":
        return _csv(
            "sandar_harga.csv",
            ["id", "pasar", "tanggal", "harga"],
            [[h.id, h.pasar, h.tanggal, h.harga] for h in db.scalars(select(HargaAcuan).order_by(HargaAcuan.tanggal))],
        )
    raise HTTPException(404, "Jenis ekspor tidak dikenal.")
