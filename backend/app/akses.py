"""Token perangkat dan hak akses per peran (PRD 11, 13).

PIN diperiksa di perangkat. Setiap permintaan ke server membawa token perangkat
(`X-Perangkat`) dan id pengguna yang sedang masuk (`X-Pengguna`). Server memeriksa
bahwa pengguna itu termasuk lingkup perangkat, masih aktif, dan perannya sesuai.
"""

from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .layanan import hash_token
from .models import Pengguna, Perangkat


def perangkat_saat_ini(x_perangkat: str = Header(default=""), db: Session = Depends(get_db)) -> Perangkat:
    if not x_perangkat:
        raise HTTPException(401, "Perangkat belum diaktifkan. Masukkan kode aktivasi dari Admin.")
    p = db.scalar(select(Perangkat).where(Perangkat.token_hash == hash_token(x_perangkat)))
    if p is None:
        raise HTTPException(401, "Token perangkat tidak dikenal. Aktifkan ulang dengan kode baru dari Admin.")
    if not p.aktif:
        raise HTTPException(403, "Perangkat ini dinonaktifkan Admin. Hubungi Admin untuk kode aktivasi baru.")
    return p


def dalam_lingkup(perangkat: Perangkat, pengguna: Pengguna) -> bool:
    if perangkat.pengguna_id:
        return pengguna.id == perangkat.pengguna_id
    if perangkat.desa_id:
        return pengguna.desa_id == perangkat.desa_id and pengguna.peran in ("petani", "simpul")
    return False


def pengguna_saat_ini(
    x_pengguna: str = Header(default=""),
    perangkat: Perangkat = Depends(perangkat_saat_ini),
    db: Session = Depends(get_db),
) -> Pengguna:
    u = db.get(Pengguna, x_pengguna) if x_pengguna else None
    if u is None or not dalam_lingkup(perangkat, u):
        raise HTTPException(403, "Akun ini tidak terdaftar di perangkat ini.")
    if not u.aktif:
        raise HTTPException(403, "Akun ini dinonaktifkan Admin.")
    return u


def wajib_peran(*peran: str) -> Callable[..., Pengguna]:
    def _cek(u: Pengguna = Depends(pengguna_saat_ini)) -> Pengguna:
        if u.peran not in peran:
            raise HTTPException(403, "Peran Anda tidak boleh membuka fitur ini.")
        return u

    return _cek
