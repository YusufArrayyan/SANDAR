"""Sinkronisasi tertunda (PRD bagian 9, FR-50 sampai FR-54).

POST /sinkron/kirim menerima paling banyak 50 operasi dari antrean kirim perangkat.
Setiap operasi punya op_id unik buatan perangkat; op_id yang sudah pernah diproses
dijawab dengan hasil yang sama tanpa diproses ulang (idempoten).
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Any

import logging

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import serial
from .akses import dalam_lingkup, perangkat_saat_ini
from .db import get_db
from .layanan import audit, iso_utc, parameter, sekarang_wib, tandai
from .models import (
    CatatanPanen,
    Desa,
    HargaAcuan,
    HasilPencocokan,
    Jatah,
    JatahManual,
    Kapal,
    Keberangkatan,
    OpLog,
    Pengguna,
    Perangkat,
    Petani,
    sekarang,
)
from .rencana import hasil_final_terbaru, hitung_ulang, versi_berikut
from .skema import (
    DataDesaBiaya,
    DataHasilSementara,
    DataJatahManual,
    DataKeberangkatanCatat,
    DataKeberangkatanUbah,
    DataPanenBatal,
    DataPanenCatat,
    DataPanenTerangkut,
    DataPanenUbah,
    DataPetani,
    DataPin,
    HasilOp,
    KirimKeluar,
    KirimMasuk,
    Op,
)

router = APIRouter(prefix="/sinkron", tags=["sinkron"])
log = logging.getLogger("sandar.sinkron")


class Tolak(Exception):
    """Operasi ditolak. Pesan berisi satu kalimat penyebab dan satu kalimat solusi."""


KONFLIK = "Catatan ini sudah diubah di perangkat lain. Data terbaru sudah diambil, silakan periksa lagi."


def _panen_boleh(u: Pengguna, c: CatatanPanen | None = None, petani: Petani | None = None) -> None:
    desa_id = c.desa_id if c else (petani.desa_id if petani else None)
    petani_id = c.petani_id if c else (petani.id if petani else None)
    if u.peran == "simpul" and u.desa_id == desa_id:
        return
    if u.peran == "petani" and u.petani_id == petani_id:
        return
    if u.peran == "admin":
        return
    raise Tolak("Anda tidak berhak mengubah catatan petani ini.")


def _jatah_terkunci_panen(db: Session, panen_id: str) -> int:
    total = 0
    for kb in db.scalars(select(Keberangkatan).where(Keberangkatan.terkunci.is_(True), Keberangkatan.status != "batal")):
        h = hasil_final_terbaru(db, kb.id)
        if h:
            total += sum(b.jatah for b in h.baris if b.panen_id == panen_id)
    return total


def _bisa_diubah(db: Session, c: CatatanPanen) -> None:
    if c.status in ("terangkut", "dibatalkan"):
        raise Tolak("Catatan yang sudah terangkut atau dibatalkan tidak dapat diubah.")
    if _jatah_terkunci_panen(db, c.id) > 0:
        raise Tolak("Jatah catatan ini sudah Final sehingga tidak dapat diubah. Hubungi Pengelola simpul.")


def _data(model: type[BaseModel], data: dict[str, Any]) -> Any:
    try:
        return model.model_validate(data)
    except ValidationError as e:
        pertama = e.errors()[0]
        raise Tolak(f"Data tidak lengkap atau keliru ({pertama['loc'][-1] if pertama['loc'] else 'data'}).") from e


# --- Penangan per jenis operasi ---------------------------------------------


def op_petani_simpan(db: Session, u: Pengguna, data: dict[str, Any]) -> None:
    d = _data(DataPetani, data)
    if u.peran not in ("simpul", "admin") or (u.peran == "simpul" and u.desa_id != d.desa_id):
        raise Tolak("Hanya Pengelola simpul desa ini yang dapat menambah petani.")
    p = db.get(Petani, d.id)
    if p is not None and p.desa_id != d.desa_id:
        raise Tolak("Petani ini terdaftar di desa lain.")
    if p is None:
        p = Petani(id=d.id, desa_id=d.desa_id, nama=d.nama)
        db.add(p)
    p.nama, p.kelompok, p.hp = d.nama, d.kelompok, d.hp
    db.flush()
    tandai(db, p)


def op_panen_catat(db: Session, u: Pengguna, data: dict[str, Any], perangkat: Perangkat) -> None:
    d = _data(DataPanenCatat, data)
    if db.get(CatatanPanen, d.id) is not None:
        return  # sudah ada: kiriman ulang dengan op_id berbeda tetap aman
    petani = db.get(Petani, d.petani_id)
    if petani is None:
        raise Tolak("Petani untuk catatan ini belum terdaftar di server. Kirim ulang setelah data petani terkirim.")
    _panen_boleh(u, petani=petani)
    c = CatatanPanen(
        id=d.id,
        petani_id=d.petani_id,
        desa_id=petani.desa_id,
        komoditas=d.komoditas,
        tandan=d.tandan,
        siap_angkut=d.siap_angkut,
        status="terdaftar",
        dibuat_oleh=u.id,
        dibuat_perangkat=perangkat.id,
        dibuat=d.dibuat,
    )
    db.add(c)
    db.flush()
    tandai(db, c)


def _ambil_panen(db: Session, pid: str) -> CatatanPanen:
    c = db.get(CatatanPanen, pid)
    if c is None:
        raise Tolak("Catatan panen tidak ditemukan di server. Periksa daftar panen setelah sinkron.")
    return c


def op_panen_ubah(db: Session, u: Pengguna, data: dict[str, Any]) -> None:
    d = _data(DataPanenUbah, data)
    c = _ambil_panen(db, d.id)
    _panen_boleh(u, c)
    if d.versi_dasar < c.versi:
        raise Tolak(KONFLIK)
    _bisa_diubah(db, c)
    if d.petani_id and d.petani_id != c.petani_id:
        p = db.get(Petani, d.petani_id)
        if p is None or p.desa_id != c.desa_id:
            raise Tolak("Petani pengganti tidak ditemukan di desa ini.")
        _panen_boleh(u, petani=p)
        c.petani_id = d.petani_id
    for bidang in ("komoditas", "tandan", "siap_angkut"):
        nilai = getattr(d, bidang)
        if nilai is not None:
            setattr(c, bidang, nilai)
    c.versi += 1
    c.diubah = sekarang()
    tandai(db, c)


def op_panen_batal(db: Session, u: Pengguna, data: dict[str, Any]) -> None:
    d = _data(DataPanenBatal, data)
    c = _ambil_panen(db, d.id)
    _panen_boleh(u, c)
    if c.status == "dibatalkan":
        return
    if d.versi_dasar < c.versi:
        raise Tolak(KONFLIK)
    _bisa_diubah(db, c)
    c.status = "dibatalkan"
    c.jatah = c.tunggu = 0
    c.versi += 1
    c.diubah = sekarang()
    tandai(db, c)


def op_panen_terangkut(db: Session, u: Pengguna, data: dict[str, Any]) -> None:
    """FR-15. Bila jatah pada keberangkatan ini kurang dari jumlah tandan, sisa tandan
    dipisah menjadi catatan baru (`sisa_id`) yang tetap menunggu kapal berikutnya."""
    d = _data(DataPanenTerangkut, data)
    if u.peran not in ("simpul", "admin"):
        raise Tolak("Hanya Pengelola simpul yang dapat menandai Terangkut.")
    c = _ambil_panen(db, d.id)
    _panen_boleh(u, c)
    if c.status == "terangkut":
        return
    if c.status == "dibatalkan":
        raise Tolak("Catatan yang dibatalkan tidak dapat ditandai Terangkut.")
    if d.versi_dasar < c.versi:
        raise Tolak(KONFLIK)
    kb = db.get(Keberangkatan, d.keberangkatan_id)
    if kb is None or kb.status == "batal":
        raise Tolak("Keberangkatan tidak ditemukan atau sudah batal. Pilih kapal lain.")

    h = hasil_final_terbaru(db, kb.id)
    jatah_kb = sum(b.jatah for b in h.baris if b.panen_id == c.id) if h else 0
    jumlah = jatah_kb if 0 < jatah_kb < c.tandan else c.tandan

    if jumlah < c.tandan:
        sisa = CatatanPanen(
            id=d.sisa_id,
            petani_id=c.petani_id,
            desa_id=c.desa_id,
            komoditas=c.komoditas,
            tandan=c.tandan - jumlah,
            siap_angkut=c.siap_angkut,
            status="daftar_tunggu",
            pernah_dicocokkan=True,
            induk_id=c.id,
            dibuat_oleh=u.id,
            dibuat_perangkat=c.dibuat_perangkat,
            dibuat=c.dibuat,
            diterima=c.diterima,  # urutan asli tetap dipakai saat pecahan sama
        )
        db.add(sisa)
        db.flush()
        # Jatah terkunci di keberangkatan lain ikut pindah ke catatan sisa.
        for lain in db.scalars(select(Keberangkatan).where(Keberangkatan.terkunci.is_(True), Keberangkatan.id != kb.id)):
            hl = hasil_final_terbaru(db, lain.id)
            pindah = [b for b in (hl.baris if hl else []) if b.panen_id == c.id]
            for b in pindah:
                b.panen_id = sisa.id
            if hl is not None and pindah:
                tandai(db, hl)
        tandai(db, sisa)

    acuan = db.scalars(
        select(HargaAcuan).where(HargaAcuan.tanggal <= kb.berangkat[:10]).order_by(HargaAcuan.tanggal.desc(), HargaAcuan.waktu.desc())
    ).first()
    desa = db.get(Desa, c.desa_id)
    c.tandan = jumlah
    c.status = "terangkut"
    c.jatah, c.tunggu = jumlah, 0
    c.terangkut_kb_id = kb.id
    c.terangkut_tanggal = kb.berangkat[:10]
    c.harga_terima = d.harga_terima
    c.acuan_bersih = acuan.harga - kb.tarif - (desa.biaya_tebang if desa else 0) if acuan else None
    c.versi += 1
    c.diubah = sekarang()
    tandai(db, c)


def _kapal_boleh(db: Session, u: Pengguna, kapal_id: str) -> Kapal:
    k = db.get(Kapal, kapal_id)
    if k is None or not k.aktif:
        raise Tolak("Kapal tidak ditemukan. Minta Admin menambahkan kapal ini.")
    if u.peran == "kapal" and k.pengelola_id != u.id:
        raise Tolak("Anda hanya dapat mencatat keberangkatan untuk kapal Anda sendiri.")
    if u.peran not in ("kapal", "simpul", "admin"):
        raise Tolak("Peran Anda tidak dapat mencatat keberangkatan.")
    return k


def op_keberangkatan_catat(db: Session, u: Pengguna, data: dict[str, Any]) -> None:
    d = _data(DataKeberangkatanCatat, data)
    if db.get(Keberangkatan, d.id) is not None:
        return
    _kapal_boleh(db, u, d.kapal_id)
    kb = Keberangkatan(
        id=d.id,
        kapal_id=d.kapal_id,
        asal=d.asal,
        tujuan=d.tujuan,
        berangkat=d.berangkat,
        sisa_ruang=d.sisa_ruang,
        tarif=d.tarif,
        status="penuh" if d.sisa_ruang == 0 else "buka",
        dibuat_oleh=u.id,
    )
    db.add(kb)
    db.flush()
    tandai(db, kb)


def op_keberangkatan_ubah(db: Session, u: Pengguna, data: dict[str, Any]) -> None:
    d = _data(DataKeberangkatanUbah, data)
    kb = db.get(Keberangkatan, d.id)
    if kb is None:
        raise Tolak("Keberangkatan tidak ditemukan di server.")
    _kapal_boleh(db, u, kb.kapal_id)
    if d.versi_dasar < kb.versi:
        raise Tolak(KONFLIK)
    if kb.status in ("berangkat", "batal"):
        raise Tolak("Keberangkatan yang sudah berangkat atau batal tidak dapat diubah.")
    if d.sisa_ruang is not None:
        kb.sisa_ruang = d.sisa_ruang
    if d.tarif is not None:
        kb.tarif = d.tarif
    if d.berangkat is not None:
        kb.berangkat = d.berangkat
    if d.status is not None:
        kb.status = d.status
    kb.versi += 1
    kb.diubah = sekarang()
    tandai(db, kb)


def op_hasil_sementara(db: Session, u: Pengguna, data: dict[str, Any], perangkat: Perangkat) -> None:
    """Simpul menjalankan pencocokan (FR-30). Hasil Sementara disimpan sebagai versi, dan
    keberangkatan ditandai agar server menghitung hasil Final lintas simpul."""
    d = _data(DataHasilSementara, data)
    if u.peran not in ("simpul", "admin"):
        raise Tolak("Hanya Pengelola simpul yang dapat menjalankan pencocokan.")
    kb = db.get(Keberangkatan, d.keberangkatan_id)
    if kb is None:
        raise Tolak("Keberangkatan tidak ditemukan di server.")
    if db.get(HasilPencocokan, d.id) is None:
        h = HasilPencocokan(
            id=d.id,
            keberangkatan_id=kb.id,
            versi=versi_berikut(db, kb.id),
            sifat="sementara",
            dibuat_di="perangkat",
            perangkat_id=perangkat.id,
            desa_id=u.desa_id,
            ruang=d.ruang,
            diminta=sum(b.diminta for b in d.baris),
        )
        for b in d.baris:
            h.baris.append(Jatah(panen_id=b.panen_id, desa_id=u.desa_id or "", diminta=b.diminta, jatah=b.jatah, tunggu=b.diminta - b.jatah))
        db.add(h)
    if not kb.aktif_cocok:
        kb.aktif_cocok = True
        tandai(db, kb)


def op_jatah_manual(db: Session, u: Pengguna, data: dict[str, Any]) -> None:
    d = _data(DataJatahManual, data)
    if u.peran not in ("simpul", "admin"):
        raise Tolak("Hanya Pengelola simpul yang dapat menyesuaikan jatah.")
    kb = db.get(Keberangkatan, d.keberangkatan_id)
    if kb is None or kb.terkunci:
        raise Tolak("Jatah keberangkatan ini sudah dikunci. Penyesuaian tidak dapat dilakukan lagi.")
    c = _ambil_panen(db, d.panen_id)
    _panen_boleh(u, c)
    if d.jumlah is not None and d.jumlah > c.tandan:
        raise Tolak("Jatah manual melebihi jumlah tandan yang diminta.")
    m = db.scalar(select(JatahManual).where(JatahManual.keberangkatan_id == kb.id, JatahManual.panen_id == c.id))
    lama = None if m is None else m.jumlah
    if m is None:
        m = JatahManual(id=d.id, keberangkatan_id=kb.id, panen_id=c.id, desa_id=c.desa_id, alasan=d.alasan, oleh=u.id)
        db.add(m)
    m.jumlah, m.alasan, m.oleh, m.waktu = d.jumlah, d.alasan, u.id, sekarang()
    kb.aktif_cocok = True
    db.flush()
    tandai(db, m, kb)
    audit(db, u.id, "jatah_manual", f"keberangkatan:{kb.id}/panen:{c.id}", lama, {"jumlah": d.jumlah, "alasan": d.alasan})


def op_desa_biaya(db: Session, u: Pengguna, data: dict[str, Any]) -> None:
    d = _data(DataDesaBiaya, data)
    if not (u.peran == "admin" or (u.peran == "simpul" and u.desa_id == d.desa_id)):
        raise Tolak("Hanya Pengelola simpul desa ini yang dapat mengubah biaya tebang.")
    desa = db.get(Desa, d.desa_id)
    if desa is None:
        raise Tolak("Desa tidak ditemukan.")
    lama = desa.biaya_tebang
    desa.biaya_tebang = d.biaya_tebang
    tandai(db, desa)
    audit(db, u.id, "biaya_tebang", f"desa:{desa.id}", lama, d.biaya_tebang)


def op_pengguna_pin(db: Session, u: Pengguna, data: dict[str, Any]) -> None:
    d = _data(DataPin, data)
    u.pin_hash = d.pin_hash
    tandai(db, u)
    audit(db, u.id, "ganti_pin", f"pengguna:{u.id}")


PENANGAN: dict[str, Callable[..., None]] = {
    "petani.simpan": op_petani_simpan,
    "panen.catat": op_panen_catat,
    "panen.ubah": op_panen_ubah,
    "panen.batal": op_panen_batal,
    "panen.terangkut": op_panen_terangkut,
    "keberangkatan.catat": op_keberangkatan_catat,
    "keberangkatan.ubah": op_keberangkatan_ubah,
    "hasil.sementara": op_hasil_sementara,
    "jatah.manual": op_jatah_manual,
    "desa.biaya": op_desa_biaya,
    "pengguna.pin": op_pengguna_pin,
}
BUTUH_PERANGKAT = {"panen.catat", "hasil.sementara"}


def proses_op(db: Session, perangkat: Perangkat, op: Op) -> HasilOp:
    lama = db.get(OpLog, op.op_id)
    if lama is not None:
        return HasilOp(op_id=op.op_id, status=lama.status, pesan=lama.pesan)  # type: ignore[arg-type]

    status, pesan = "diterima", ""
    u = db.get(Pengguna, op.oleh)
    titik = db.begin_nested()
    try:
        if u is None or not dalam_lingkup(perangkat, u):
            raise Tolak("Akun pengirim tidak terdaftar di perangkat ini.")
        if not u.aktif:
            raise Tolak("Akun ini dinonaktifkan Admin.")
        penangan = PENANGAN.get(op.jenis)
        if penangan is None:
            raise Tolak("Jenis catatan tidak dikenal. Perbarui aplikasi.")
        if op.jenis in BUTUH_PERANGKAT:
            penangan(db, u, op.data, perangkat)
        else:
            penangan(db, u, op.data)
        titik.commit()
    except Tolak as e:
        titik.rollback()
        status, pesan = "ditolak", str(e)
    except Exception:
        # Galat tak terduga tidak boleh memacetkan antrean: operasi ini ditolak dan dicatat,
        # operasi lain dalam kiriman yang sama tetap diproses.
        titik.rollback()
        log.exception("Operasi %s (%s) gagal diproses", op.op_id, op.jenis)
        status, pesan = "ditolak", "Server gagal memproses catatan ini. Laporkan kepada Admin bila terus terjadi."

    db.add(
        OpLog(
            op_id=op.op_id,
            perangkat_id=perangkat.id,
            desa_id=(u.desa_id if u else None) or perangkat.desa_id,
            pengguna_id=u.id if u else None,
            jenis=op.jenis,
            status=status,
            pesan=pesan,
            waktu_perangkat=op.waktu_perangkat,
            pertama_dicoba=op.pertama_dicoba,
        )
    )
    db.flush()
    return HasilOp(op_id=op.op_id, status=status, pesan=pesan)  # type: ignore[arg-type]


@router.post("/kirim", response_model=KirimKeluar)
def kirim(masuk: KirimMasuk, perangkat: Perangkat = Depends(perangkat_saat_ini), db: Session = Depends(get_db)) -> KirimKeluar:
    hasil: list[HasilOp] = []
    for mentah in masuk.ops:
        try:
            op = Op.model_validate(mentah)
        except ValidationError:
            # Bentuk operasi keliru (misalnya aplikasi versi lama): tolak satu ini saja.
            op_id = str(mentah.get("op_id", ""))[:40]
            if op_id:
                hasil.append(HasilOp(op_id=op_id, status="ditolak", pesan="Bentuk catatan tidak dikenali server. Perbarui aplikasi."))
            continue
        hasil.append(proses_op(db, perangkat, op))
    hitung_ulang(db)
    perangkat.terakhir_sinkron = sekarang()
    db.commit()
    return KirimKeluar(hasil=hasil, waktu_server=iso_utc(sekarang()) or "")


@router.get("/ambil")
def ambil(
    sejak: int = Query(0, ge=0),
    perangkat: Perangkat = Depends(perangkat_saat_ini),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Mengambil perubahan sejak kursor (FR-41). Isi dibatasi lingkup perangkat."""
    hitung_ulang(db)
    db.commit()

    pemilik = db.get(Pengguna, perangkat.pengguna_id) if perangkat.pengguna_id else None
    desa_id = perangkat.desa_id or (pemilik.desa_id if pemilik and pemilik.peran in ("simpul", "petani") else None)
    petani_saja = pemilik.petani_id if pemilik and pemilik.peran == "petani" else None

    def baru(model: Any, *syarat: Any) -> list[Any]:
        return list(db.scalars(select(model).where(model.seq > sejak, *syarat).order_by(model.seq)))

    if pemilik:
        pengguna = baru(Pengguna, Pengguna.id == pemilik.id)
    else:
        pengguna = baru(Pengguna, Pengguna.desa_id == desa_id, Pengguna.peran.in_(("petani", "simpul")))

    petani: list[Petani] = []
    panen: list[CatatanPanen] = []
    manual: list[JatahManual] = []
    panen_ids: set[str] | None = None
    if petani_saja:
        petani = baru(Petani, Petani.id == petani_saja)
        panen = baru(CatatanPanen, CatatanPanen.petani_id == petani_saja)
        panen_ids = set(db.scalars(select(CatatanPanen.id).where(CatatanPanen.petani_id == petani_saja)))
    elif desa_id:
        petani = baru(Petani, Petani.desa_id == desa_id)
        panen = baru(CatatanPanen, CatatanPanen.desa_id == desa_id)
        manual = baru(JatahManual, JatahManual.desa_id == desa_id)

    hasil = baru(HasilPencocokan, HasilPencocokan.sifat == "final")
    semua = [pengguna, petani, panen, manual, hasil]
    lain = {
        "desa": baru(Desa),
        "kapal": baru(Kapal),
        "keberangkatan": baru(Keberangkatan),
        "harga": baru(HargaAcuan),
    }
    kursor = max([sejak] + [o.seq for daftar in semua + list(lain.values()) for o in daftar])
    perangkat.terakhir_sinkron = sekarang()
    db.commit()
    return {
        "kursor": kursor,
        "waktu_server": iso_utc(sekarang()),
        "waktu_server_wib": sekarang_wib().isoformat(timespec="minutes"),
        "perangkat": {"id": perangkat.id, "desa_id": perangkat.desa_id, "pengguna_id": perangkat.pengguna_id},
        "parameter": parameter(db),
        "data": {
            "pengguna": [serial.pengguna(u) for u in pengguna],
            "desa": [serial.desa(d) for d in lain["desa"]],
            "petani": [serial.petani(p) for p in petani],
            "panen": [serial.panen(c) for c in panen],
            "kapal": [serial.kapal(k) for k in lain["kapal"]],
            "keberangkatan": [serial.keberangkatan(k) for k in lain["keberangkatan"]],
            "hasil": [serial.hasil(h, desa_id, panen_ids) for h in hasil],
            "harga": [serial.harga(h) for h in lain["harga"]],
            "jatah_manual": [serial.jatah_manual(m) for m in manual],
        },
    }

