"""Model data SANDAR (PRD bagian 10).

Catatan waktu:
- Waktu server disimpan sebagai datetime UTC tanpa zona.
- Tanggal dan jam lapangan (siap angkut, waktu berangkat) disimpan sebagai teks WIB,
  misalnya "2026-10-18" dan "2026-10-19T06:00", sama seperti yang diisi di perangkat.

Setiap tabel yang ikut sinkronisasi punya kolom `seq`. Nilainya naik setiap kali baris
berubah, dan perangkat mengambil perubahan dengan `GET /sinkron/ambil?sejak=<seq>`.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def sekarang() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


PERAN = ("petani", "simpul", "kapal", "mitra", "admin")
STATUS_PANEN = ("terdaftar", "dapat_jatah", "daftar_tunggu", "terangkut", "dibatalkan")
STATUS_KEBERANGKATAN = ("buka", "penuh", "berangkat", "batal")
JENIS_KAPAL = ("feri", "perintis", "nelayan")


class Penghitung(Base):
    """Satu baris penghitung global untuk kolom seq."""

    __tablename__ = "penghitung"
    nama: Mapped[str] = mapped_column(String(20), primary_key=True)
    nilai: Mapped[int] = mapped_column(Integer, default=0)


class Desa(Base):
    __tablename__ = "desa"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    nama: Mapped[str] = mapped_column(String(80))
    kode: Mapped[str] = mapped_column(String(20), unique=True)
    jumlah_petani_pisang: Mapped[int] = mapped_column(Integer, default=0)
    # ParameterDesa: biaya tebang dan angkut darat per tandan (FR-44)
    biaya_tebang: Mapped[int] = mapped_column(Integer, default=0)
    seq: Mapped[int] = mapped_column(Integer, default=0, index=True)


class Pengguna(Base):
    __tablename__ = "pengguna"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    nama: Mapped[str] = mapped_column(String(80))
    hp: Mapped[str] = mapped_column(String(20), unique=True)
    peran: Mapped[str] = mapped_column(String(10))
    desa_id: Mapped[str | None] = mapped_column(ForeignKey("desa.id"), nullable=True)
    petani_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    aktif: Mapped[bool] = mapped_column(Boolean, default=True)
    pin_hash: Mapped[str] = mapped_column(String(200))
    seq: Mapped[int] = mapped_column(Integer, default=0, index=True)


class Perangkat(Base):
    __tablename__ = "perangkat"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    nama: Mapped[str] = mapped_column(String(80), default="")
    token_hash: Mapped[str] = mapped_column(String(100), unique=True)
    # Perangkat simpul terikat ke desa; perangkat pribadi terikat ke satu pengguna.
    desa_id: Mapped[str | None] = mapped_column(ForeignKey("desa.id"), nullable=True)
    pengguna_id: Mapped[str | None] = mapped_column(ForeignKey("pengguna.id"), nullable=True)
    aktif: Mapped[bool] = mapped_column(Boolean, default=True)
    dibuat: Mapped[datetime] = mapped_column(DateTime, default=sekarang)
    terakhir_sinkron: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class KodeAktivasi(Base):
    __tablename__ = "kode_aktivasi"
    kode: Mapped[str] = mapped_column(String(20), primary_key=True)
    desa_id: Mapped[str | None] = mapped_column(ForeignKey("desa.id"), nullable=True)
    pengguna_id: Mapped[str | None] = mapped_column(ForeignKey("pengguna.id"), nullable=True)
    keterangan: Mapped[str] = mapped_column(String(120), default="")
    dibuat: Mapped[datetime] = mapped_column(DateTime, default=sekarang)
    dipakai_oleh: Mapped[str | None] = mapped_column(String(40), nullable=True)
    dipakai_pada: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Petani(Base):
    __tablename__ = "petani"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    nama: Mapped[str] = mapped_column(String(80))
    desa_id: Mapped[str] = mapped_column(ForeignKey("desa.id"))
    kelompok: Mapped[str] = mapped_column(String(80), default="")
    hp: Mapped[str] = mapped_column(String(20), default="")
    dibuat: Mapped[datetime] = mapped_column(DateTime, default=sekarang)
    seq: Mapped[int] = mapped_column(Integer, default=0, index=True)


class CatatanPanen(Base):
    __tablename__ = "catatan_panen"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    petani_id: Mapped[str] = mapped_column(ForeignKey("petani.id"))
    desa_id: Mapped[str] = mapped_column(ForeignKey("desa.id"), index=True)
    komoditas: Mapped[str] = mapped_column(String(40), default="Pisang kepok")
    tandan: Mapped[int] = mapped_column(Integer)
    siap_angkut: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(15), default="terdaftar")
    # Ringkasan hasil pencocokan Final terbaru, diisi server.
    jatah: Mapped[int] = mapped_column(Integer, default=0)
    tunggu: Mapped[int] = mapped_column(Integer, default=0)
    pernah_dicocokkan: Mapped[bool] = mapped_column(Boolean, default=False)
    harga_terima: Mapped[int | None] = mapped_column(Integer, nullable=True)
    acuan_bersih: Mapped[int | None] = mapped_column(Integer, nullable=True)
    terangkut_kb_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    terangkut_tanggal: Mapped[str | None] = mapped_column(String(10), nullable=True)
    induk_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    dibuat_oleh: Mapped[str] = mapped_column(String(40))
    dibuat_perangkat: Mapped[str] = mapped_column(String(40))
    # Waktu dibuat menurut perangkat; dipakai untuk memecah pecahan yang sama.
    dibuat: Mapped[str] = mapped_column(String(32))
    diterima: Mapped[datetime] = mapped_column(DateTime, default=sekarang)
    diubah: Mapped[datetime] = mapped_column(DateTime, default=sekarang)
    versi: Mapped[int] = mapped_column(Integer, default=1)
    seq: Mapped[int] = mapped_column(Integer, default=0, index=True)

    petani: Mapped[Petani] = relationship()


class Kapal(Base):
    __tablename__ = "kapal"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    nama: Mapped[str] = mapped_column(String(80))
    jenis: Mapped[str] = mapped_column(String(10))
    pengelola_id: Mapped[str | None] = mapped_column(ForeignKey("pengguna.id"), nullable=True)
    aktif: Mapped[bool] = mapped_column(Boolean, default=True)
    seq: Mapped[int] = mapped_column(Integer, default=0, index=True)


class Keberangkatan(Base):
    __tablename__ = "keberangkatan"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    kapal_id: Mapped[str] = mapped_column(ForeignKey("kapal.id"))
    asal: Mapped[str] = mapped_column(String(80))
    tujuan: Mapped[str] = mapped_column(String(80))
    berangkat: Mapped[str] = mapped_column(String(16))  # WIB
    sisa_ruang: Mapped[int] = mapped_column(Integer)
    tarif: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(10), default="buka")
    # Pencocokan sudah diminta (oleh simpul atau batas waktu); server menghitung Final.
    aktif_cocok: Mapped[bool] = mapped_column(Boolean, default=False)
    terkunci: Mapped[bool] = mapped_column(Boolean, default=False)
    dibuat_oleh: Mapped[str] = mapped_column(String(40))
    diubah: Mapped[datetime] = mapped_column(DateTime, default=sekarang)
    versi: Mapped[int] = mapped_column(Integer, default=1)
    seq: Mapped[int] = mapped_column(Integer, default=0, index=True)

    kapal: Mapped[Kapal] = relationship()


class HasilPencocokan(Base):
    __tablename__ = "hasil_pencocokan"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    keberangkatan_id: Mapped[str] = mapped_column(ForeignKey("keberangkatan.id"), index=True)
    versi: Mapped[int] = mapped_column(Integer)
    sifat: Mapped[str] = mapped_column(String(10))  # sementara | final
    dibuat_di: Mapped[str] = mapped_column(String(10))  # perangkat | server
    perangkat_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    desa_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    ruang: Mapped[int] = mapped_column(Integer)
    diminta: Mapped[int] = mapped_column(Integer)
    terkunci: Mapped[bool] = mapped_column(Boolean, default=False)
    waktu: Mapped[datetime] = mapped_column(DateTime, default=sekarang)
    seq: Mapped[int] = mapped_column(Integer, default=0, index=True)

    baris: Mapped[list[Jatah]] = relationship(back_populates="hasil", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("keberangkatan_id", "sifat", "versi", "perangkat_id"),)


class Jatah(Base):
    __tablename__ = "jatah"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hasil_id: Mapped[str] = mapped_column(ForeignKey("hasil_pencocokan.id"), index=True)
    panen_id: Mapped[str] = mapped_column(String(40), index=True)
    desa_id: Mapped[str] = mapped_column(String(40))
    diminta: Mapped[int] = mapped_column(Integer)
    jatah: Mapped[int] = mapped_column(Integer)
    tunggu: Mapped[int] = mapped_column(Integer)
    alasan_manual: Mapped[str | None] = mapped_column(Text, nullable=True)

    hasil: Mapped[HasilPencocokan] = relationship(back_populates="baris")


class JatahManual(Base):
    """Penyesuaian manual jatah oleh Pengelola simpul (FR-35)."""

    __tablename__ = "jatah_manual"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    keberangkatan_id: Mapped[str] = mapped_column(ForeignKey("keberangkatan.id"))
    panen_id: Mapped[str] = mapped_column(String(40))
    desa_id: Mapped[str] = mapped_column(String(40))
    jumlah: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = dihapus
    alasan: Mapped[str] = mapped_column(Text)
    oleh: Mapped[str] = mapped_column(String(40))
    waktu: Mapped[datetime] = mapped_column(DateTime, default=sekarang)
    seq: Mapped[int] = mapped_column(Integer, default=0, index=True)

    __table_args__ = (UniqueConstraint("keberangkatan_id", "panen_id"),)


class HargaAcuan(Base):
    __tablename__ = "harga_acuan"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    pasar: Mapped[str] = mapped_column(String(80))
    tanggal: Mapped[str] = mapped_column(String(10))
    harga: Mapped[int] = mapped_column(Integer)
    oleh: Mapped[str] = mapped_column(String(40))
    waktu: Mapped[datetime] = mapped_column(DateTime, default=sekarang)
    seq: Mapped[int] = mapped_column(Integer, default=0, index=True)


class Parameter(Base):
    """Parameter yang dapat diubah Admin (PRD 5.3 dan 6.7)."""

    __tablename__ = "parameter"
    kunci: Mapped[str] = mapped_column(String(40), primary_key=True)
    nilai: Mapped[int] = mapped_column(Integer)
    seq: Mapped[int] = mapped_column(Integer, default=0, index=True)


PARAMETER_AWAL = {
    "batas_harga_lama_hari": 7,
    "jam_batas_cocok": 18,
    "pin_maks_salah": 5,
    "pin_kunci_menit": 5,
    "selisih_jam_menit": 10,
}


class OpLog(Base):
    """Setiap operasi dari antrean kirim. Kunci utama op_id membuat pengiriman idempoten."""

    __tablename__ = "op_log"
    op_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    perangkat_id: Mapped[str] = mapped_column(String(40), index=True)
    desa_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    pengguna_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    jenis: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(10))  # diterima | ditolak
    pesan: Mapped[str] = mapped_column(Text, default="")
    waktu_perangkat: Mapped[str | None] = mapped_column(String(32), nullable=True)
    pertama_dicoba: Mapped[str | None] = mapped_column(String(32), nullable=True)
    diterima: Mapped[datetime] = mapped_column(DateTime, default=sekarang, index=True)


class LogAudit(Base):
    __tablename__ = "log_audit"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pengguna_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    tindakan: Mapped[str] = mapped_column(String(40))
    objek: Mapped[str] = mapped_column(String(80))
    nilai_lama: Mapped[str | None] = mapped_column(Text, nullable=True)
    nilai_baru: Mapped[str | None] = mapped_column(Text, nullable=True)
    waktu: Mapped[datetime] = mapped_column(DateTime, default=sekarang, index=True)
