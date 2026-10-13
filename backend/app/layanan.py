"""Fungsi bantu bersama: hash PIN, token, seq, audit, dan waktu WIB."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import PIN_ITERASI
from .models import PARAMETER_AWAL, LogAudit, Parameter, Penghitung

WIB = timezone(timedelta(hours=7))


# --- PIN ---------------------------------------------------------------------
# Format: pbkdf2$<iterasi>$<garam hex>$<hash hex>. Perangkat memeriksa PIN dengan
# format yang sama melalui WebCrypto, sehingga masuk dapat dilakukan tanpa sinyal.


def hash_pin(pin: str, garam: str | None = None, iterasi: int = PIN_ITERASI) -> str:
    garam = garam or secrets.token_hex(16)
    turunan = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(garam), iterasi, dklen=32)
    return f"pbkdf2${iterasi}${garam}${turunan.hex()}"


def cek_pin(pin: str, tersimpan: str) -> bool:
    try:
        _, iterasi, garam, _ = tersimpan.split("$")
        return hmac.compare_digest(hash_pin(pin, garam, int(iterasi)), tersimpan)
    except ValueError:
        return False


def pin_valid(pin: str) -> bool:
    return len(pin) == 4 and pin.isdigit()


# --- Token perangkat ---------------------------------------------------------


def buat_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def buat_kode_aktivasi() -> str:
    alfabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alfabet) for _ in range(8))


# --- seq ---------------------------------------------------------------------


def seq_berikut(db: Session) -> int:
    baris = db.execute(select(Penghitung).where(Penghitung.nama == "seq").with_for_update()).scalar_one_or_none()
    if baris is None:
        baris = Penghitung(nama="seq", nilai=0)
        db.add(baris)
    baris.nilai += 1
    db.flush()
    return baris.nilai


def tandai(db: Session, *objek: Any) -> None:
    """Menaikkan seq pada objek yang berubah agar ikut terkirim ke perangkat."""
    for o in objek:
        o.seq = seq_berikut(db)


# --- Audit -------------------------------------------------------------------


def audit(db: Session, pengguna_id: str | None, tindakan: str, objek: str, lama: Any = None, baru: Any = None) -> None:
    def teks(v: Any) -> str | None:
        if v is None:
            return None
        return v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, default=str)

    db.add(LogAudit(pengguna_id=pengguna_id, tindakan=tindakan, objek=objek, nilai_lama=teks(lama), nilai_baru=teks(baru)))


# --- Parameter ---------------------------------------------------------------


def parameter(db: Session) -> dict[str, int]:
    nilai = dict(PARAMETER_AWAL)
    for p in db.scalars(select(Parameter)):
        nilai[p.kunci] = p.nilai
    return nilai


# --- Waktu WIB ---------------------------------------------------------------


def sekarang_wib() -> datetime:
    return datetime.now(WIB).replace(tzinfo=None)


def hari_ini_wib() -> date:
    return sekarang_wib().date()


def batas_waktu_cocok(berangkat: str, jam_batas: int) -> datetime:
    """Batas waktu pencocokan: pukul `jam_batas` WIB pada hari sebelum berangkat (FR-33)."""
    hari = datetime.fromisoformat(berangkat).date() - timedelta(days=1)
    return datetime(hari.year, hari.month, hari.day, jam_batas)


def iso_utc(dt: datetime | None) -> str | None:
    return None if dt is None else dt.replace(microsecond=0).isoformat() + "Z"


def iso_utc_presisi(dt: datetime) -> str:
    """Waktu terima server sampai mikrodetik; dipakai sebagai kunci urutan pencocokan."""
    return dt.isoformat(timespec="microseconds") + "Z"


def siapkan_penghitung(db: Session) -> None:
    """Membuat baris penghitung seq lebih dulu agar penulisan pertama tidak saling bentrok."""
    if db.get(Penghitung, "seq") is None:
        db.add(Penghitung(nama="seq", nilai=0))
        db.commit()
