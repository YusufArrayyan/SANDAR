"""Bentuk data yang dikirim ke perangkat. Nama bidang sama dengan tabel Dexie di frontend."""

from __future__ import annotations

from typing import Any

from .layanan import iso_utc, iso_utc_presisi
from .models import (
    CatatanPanen,
    Desa,
    HargaAcuan,
    HasilPencocokan,
    JatahManual,
    Kapal,
    Keberangkatan,
    Pengguna,
    Petani,
)


def pengguna(u: Pengguna) -> dict[str, Any]:
    return {
        "id": u.id,
        "nama": u.nama,
        "hp": u.hp,
        "peran": u.peran,
        "desa_id": u.desa_id,
        "petani_id": u.petani_id,
        "aktif": u.aktif,
        "pin_hash": u.pin_hash,
    }


def desa(d: Desa) -> dict[str, Any]:
    return {
        "id": d.id,
        "nama": d.nama,
        "kode": d.kode,
        "jumlah_petani_pisang": d.jumlah_petani_pisang,
        "biaya_tebang": d.biaya_tebang,
    }


def petani(p: Petani) -> dict[str, Any]:
    return {"id": p.id, "nama": p.nama, "desa_id": p.desa_id, "kelompok": p.kelompok, "hp": p.hp}


def panen(c: CatatanPanen) -> dict[str, Any]:
    return {
        "id": c.id,
        "petani_id": c.petani_id,
        "desa_id": c.desa_id,
        "komoditas": c.komoditas,
        "tandan": c.tandan,
        "siap_angkut": c.siap_angkut,
        "status": c.status,
        "jatah": c.jatah,
        "tunggu": c.tunggu,
        "harga_terima": c.harga_terima,
        "terangkut_kb_id": c.terangkut_kb_id,
        "terangkut_tanggal": c.terangkut_tanggal,
        "induk_id": c.induk_id,
        "dibuat_oleh": c.dibuat_oleh,
        "dibuat": c.dibuat,
        "diterima": iso_utc_presisi(c.diterima),
        "diubah": iso_utc(c.diubah),
        "versi": c.versi,
    }


def kapal(k: Kapal) -> dict[str, Any]:
    return {"id": k.id, "nama": k.nama, "jenis": k.jenis, "pengelola_id": k.pengelola_id, "aktif": k.aktif}


def keberangkatan(kb: Keberangkatan) -> dict[str, Any]:
    return {
        "id": kb.id,
        "kapal_id": kb.kapal_id,
        "asal": kb.asal,
        "tujuan": kb.tujuan,
        "berangkat": kb.berangkat,
        "sisa_ruang": kb.sisa_ruang,
        "tarif": kb.tarif,
        "status": kb.status,
        "aktif_cocok": kb.aktif_cocok,
        "terkunci": kb.terkunci,
        "dibuat_oleh": kb.dibuat_oleh,
        "versi": kb.versi,
    }


def hasil(h: HasilPencocokan, desa_id: str | None, panen_ids: set[str] | None) -> dict[str, Any]:
    """Baris jatah hanya dikirim untuk desa perangkat (privasi, PRD 11)."""
    baris = [
        {
            "panen_id": b.panen_id,
            "diminta": b.diminta,
            "jatah": b.jatah,
            "tunggu": b.tunggu,
            "alasan_manual": b.alasan_manual,
        }
        for b in h.baris
        if (panen_ids is not None and b.panen_id in panen_ids) or (panen_ids is None and desa_id and b.desa_id == desa_id)
    ]
    return {
        "id": h.id,
        "keberangkatan_id": h.keberangkatan_id,
        "versi": h.versi,
        "sifat": h.sifat,
        "dibuat_di": h.dibuat_di,
        "ruang": h.ruang,
        "diminta": h.diminta,
        "terkunci": h.terkunci,
        "waktu": iso_utc(h.waktu),
        "baris": baris,
    }


def harga(h: HargaAcuan) -> dict[str, Any]:
    return {"id": h.id, "pasar": h.pasar, "tanggal": h.tanggal, "harga": h.harga, "waktu": iso_utc(h.waktu)}


def jatah_manual(m: JatahManual) -> dict[str, Any]:
    return {
        "id": m.id,
        "keberangkatan_id": m.keberangkatan_id,
        "panen_id": m.panen_id,
        "jumlah": m.jumlah,
        "alasan": m.alasan,
        "oleh": m.oleh,
        "waktu": iso_utc(m.waktu),
    }
