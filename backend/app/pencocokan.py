"""Aturan pencocokan SANDAR (PRD bagian 7).

Pembagian proporsional dengan metode sisa terbesar. Seluruh hitungan memakai
bilangan bulat agar hasilnya sama persis dengan modul TypeScript di perangkat
(frontend/src/lib/pencocokan.ts). Kedua modul diuji dengan shared/kasus_pencocokan.json.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Permintaan:
    id: str
    q: int
    dibuat: str  # ISO; dipakai untuk memecah pecahan yang sama


def bagi(ruang: int, permintaan: list[Permintaan], tetap: dict[str, int] | None = None) -> dict[str, int]:
    """Membagi `ruang` tandan kepada daftar permintaan.

    `tetap` berisi jatah hasil penyesuaian manual (FR-35). Jatah tetap dipotong lebih
    dulu dari ruang, lalu sisa ruang dibagi proporsional kepada permintaan lain.
    """
    tetap = tetap or {}
    jatah: dict[str, int] = {p.id: 0 for p in permintaan}
    sisa_ruang = max(0, int(ruang))

    for p in sorted(permintaan, key=lambda p: (p.dibuat, p.id)):
        if p.id in tetap:
            a = max(0, min(int(tetap[p.id]), p.q, sisa_ruang))
            jatah[p.id] = a
            sisa_ruang -= a

    lain = [p for p in permintaan if p.id not in tetap and p.q > 0]
    total = sum(p.q for p in lain)
    if total == 0:
        return jatah

    if total <= sisa_ruang:
        for p in lain:
            jatah[p.id] = p.q
        return jatah

    pecahan: list[tuple[int, str, str]] = []
    terbagi = 0
    for p in lain:
        bawah, sisa = divmod(sisa_ruang * p.q, total)
        jatah[p.id] = bawah
        terbagi += bawah
        pecahan.append((sisa, p.dibuat, p.id))

    # Pecahan terbesar dulu; bila sama, catatan yang dibuat lebih awal.
    pecahan.sort(key=lambda x: (-x[0], x[1], x[2]))
    for _, _, pid in pecahan[: sisa_ruang - terbagi]:
        jatah[pid] += 1
    return jatah


@dataclass(frozen=True)
class KeberangkatanRencana:
    id: str
    ruang: int
    tanggal: str  # YYYY-MM-DD hari berangkat
    berangkat: str  # YYYY-MM-DDTHH:MM, untuk urutan
    tetap: dict[str, int] = field(default_factory=dict)


@dataclass(frozen=True)
class CatatanRencana:
    id: str
    q: int  # sisa permintaan yang belum terkunci pada keberangkatan lain
    siap: str  # YYYY-MM-DD siap angkut
    dibuat: str


@dataclass
class BarisHasil:
    catatan_id: str
    diminta: int
    jatah: int

    @property
    def tunggu(self) -> int:
        return self.diminta - self.jatah


def rencana(keberangkatan: list[KeberangkatanRencana], catatan: list[CatatanRencana]) -> dict[str, list[BarisHasil]]:
    """Menjalankan pencocokan untuk beberapa keberangkatan berurutan menurut waktu.

    Sisa permintaan dari keberangkatan yang lebih awal ikut dibagi pada keberangkatan
    berikutnya (daftar tunggu tidak didahulukan, PRD bagian 16).
    """
    sisa = {c.id: c.q for c in catatan}
    hasil: dict[str, list[BarisHasil]] = {}
    for kb in sorted(keberangkatan, key=lambda k: (k.berangkat, k.id)):
        ikut = [c for c in catatan if sisa[c.id] > 0 and c.siap <= kb.tanggal]
        minta = [Permintaan(c.id, sisa[c.id], c.dibuat) for c in ikut]
        jatah = bagi(kb.ruang, minta, {k: v for k, v in kb.tetap.items() if k in sisa})
        baris = []
        for p in minta:
            baris.append(BarisHasil(p.id, p.q, jatah[p.id]))
            sisa[p.id] -= jatah[p.id]
        hasil[kb.id] = baris
    return hasil
