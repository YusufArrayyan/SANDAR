from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from .config import MAKS_OP_PER_KIRIMAN

_TANGGAL = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_WAKTU = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$")


def _cek_tanggal(v: str) -> str:
    if not _TANGGAL.match(v):
        raise ValueError("Format tanggal harus TTTT-BB-HH")
    return v


class Op(BaseModel):
    op_id: str = Field(min_length=8, max_length=40)
    jenis: str
    oleh: str
    data: dict[str, Any]
    waktu_perangkat: str | None = None
    pertama_dicoba: str | None = None


class KirimMasuk(BaseModel):
    # Divalidasi per operasi di sinkron.kirim agar satu operasi keliru tidak menggagalkan semuanya.
    ops: list[dict[str, Any]] = Field(max_length=MAKS_OP_PER_KIRIMAN)


class HasilOp(BaseModel):
    op_id: str
    status: Literal["diterima", "ditolak"]
    pesan: str = ""


class KirimKeluar(BaseModel):
    hasil: list[HasilOp]
    waktu_server: str


class AktivasiMasuk(BaseModel):
    kode: str
    nama_perangkat: str = ""


# --- Data per jenis operasi --------------------------------------------------


class DataPetani(BaseModel):
    id: str = Field(min_length=8, max_length=40)
    nama: str = Field(min_length=1, max_length=80)
    desa_id: str
    kelompok: str = Field(default="", max_length=80)
    hp: str = Field(default="", max_length=20)


class DataPanenCatat(BaseModel):
    id: str = Field(min_length=8, max_length=40)
    petani_id: str
    komoditas: str = Field(default="Pisang kepok", min_length=1, max_length=40)
    tandan: int = Field(ge=1, le=100000)
    siap_angkut: str
    dibuat: str

    _t = field_validator("siap_angkut")(_cek_tanggal)


class DataPanenUbah(BaseModel):
    id: str
    versi_dasar: int
    petani_id: str | None = None
    komoditas: str | None = Field(default=None, min_length=1, max_length=40)
    tandan: int | None = Field(default=None, ge=1, le=100000)
    siap_angkut: str | None = None

    @field_validator("siap_angkut")
    @classmethod
    def _tgl(cls, v: str | None) -> str | None:
        return None if v is None else _cek_tanggal(v)


class DataPanenBatal(BaseModel):
    id: str
    versi_dasar: int


class DataPanenTerangkut(BaseModel):
    id: str
    versi_dasar: int
    keberangkatan_id: str
    harga_terima: int | None = Field(default=None, ge=0, le=10_000_000)
    sisa_id: str = Field(min_length=8, max_length=40)


class DataKeberangkatanCatat(BaseModel):
    id: str = Field(min_length=8, max_length=40)
    kapal_id: str
    asal: str = Field(min_length=1, max_length=80)
    tujuan: str = Field(min_length=1, max_length=80)
    berangkat: str
    sisa_ruang: int = Field(ge=0, le=1_000_000)
    tarif: int = Field(ge=0, le=10_000_000)

    @field_validator("berangkat")
    @classmethod
    def _w(cls, v: str) -> str:
        if not _WAKTU.match(v):
            raise ValueError("Format waktu berangkat harus TTTT-BB-HHTjj:mm")
        return v


class DataKeberangkatanUbah(BaseModel):
    id: str
    versi_dasar: int
    sisa_ruang: int | None = Field(default=None, ge=0, le=1_000_000)
    tarif: int | None = Field(default=None, ge=0, le=10_000_000)
    berangkat: str | None = None
    status: Literal["buka", "penuh", "berangkat", "batal"] | None = None

    @field_validator("berangkat")
    @classmethod
    def _w(cls, v: str | None) -> str | None:
        if v is not None and not _WAKTU.match(v):
            raise ValueError("Format waktu berangkat harus TTTT-BB-HHTjj:mm")
        return v


class BarisSementara(BaseModel):
    panen_id: str
    diminta: int = Field(ge=0)
    jatah: int = Field(ge=0)


class DataHasilSementara(BaseModel):
    id: str = Field(min_length=8, max_length=40)
    keberangkatan_id: str
    versi: int = Field(ge=1)
    ruang: int = Field(ge=0)
    baris: list[BarisSementara]


class DataJatahManual(BaseModel):
    id: str = Field(min_length=8, max_length=40)
    keberangkatan_id: str
    panen_id: str
    jumlah: int | None = Field(default=None, ge=0)
    alasan: str = Field(min_length=3, max_length=300)


class DataDesaBiaya(BaseModel):
    desa_id: str
    biaya_tebang: int = Field(ge=0, le=10_000_000)


class DataPin(BaseModel):
    pin_hash: str = Field(pattern=r"^pbkdf2\$\d+\$[0-9a-f]+\$[0-9a-f]{64}$")


# --- Harga dan admin ---------------------------------------------------------


class HargaMasuk(BaseModel):
    id: str | None = None
    pasar: str = Field(min_length=2, max_length=80)
    tanggal: str
    harga: int = Field(ge=1, le=10_000_000)

    _t = field_validator("tanggal")(_cek_tanggal)


class PenggunaMasuk(BaseModel):
    nama: str = Field(min_length=1, max_length=80)
    hp: str = Field(pattern=r"^[0-9+]{8,16}$")
    peran: Literal["petani", "simpul", "kapal", "mitra", "admin"]
    desa_id: str | None = None
    pin: str = Field(pattern=r"^\d{4}$")
    kelompok: str = ""


class PenggunaUbah(BaseModel):
    nama: str | None = Field(default=None, min_length=1, max_length=80)
    aktif: bool | None = None
    pin: str | None = Field(default=None, pattern=r"^\d{4}$")
    desa_id: str | None = None


class DesaMasuk(BaseModel):
    nama: str = Field(min_length=1, max_length=80)
    kode: str = Field(min_length=2, max_length=20)
    jumlah_petani_pisang: int = Field(default=0, ge=0)
    biaya_tebang: int = Field(default=0, ge=0)


class DesaUbah(BaseModel):
    nama: str | None = None
    jumlah_petani_pisang: int | None = Field(default=None, ge=0)
    biaya_tebang: int | None = Field(default=None, ge=0)


class KapalMasuk(BaseModel):
    nama: str = Field(min_length=1, max_length=80)
    jenis: Literal["feri", "perintis", "nelayan"]
    pengelola_id: str | None = None


class KapalUbah(BaseModel):
    nama: str | None = None
    jenis: Literal["feri", "perintis", "nelayan"] | None = None
    pengelola_id: str | None = None
    aktif: bool | None = None


class KodeMasuk(BaseModel):
    desa_id: str | None = None
    pengguna_id: str | None = None
    keterangan: str = ""


class ParameterMasuk(BaseModel):
    batas_harga_lama_hari: int | None = Field(default=None, ge=1, le=60)
    jam_batas_cocok: int | None = Field(default=None, ge=0, le=23)
    pin_maks_salah: int | None = Field(default=None, ge=3, le=20)
    pin_kunci_menit: int | None = Field(default=None, ge=1, le=120)
    selisih_jam_menit: int | None = Field(default=None, ge=1, le=1440)
