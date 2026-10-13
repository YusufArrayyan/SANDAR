"""Pencocokan Final di server (FR-32, FR-33, FR-23, FR-36; PRD 7.3).

Server menghitung ulang seluruh keberangkatan yang sudah diminta pencocokannya,
berurutan menurut waktu berangkat, memakai data dari semua simpul. Hasil baru disimpan
sebagai versi bila berbeda dari versi Final sebelumnya. Pada batas waktu (pukul 18.00
hari sebelum berangkat, nilai awal), hasil keberangkatan itu dikunci.
"""

from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .layanan import batas_waktu_cocok, iso_utc_presisi, parameter, sekarang_wib, tandai
from .models import CatatanPanen, HasilPencocokan, Jatah, JatahManual, Keberangkatan
from .pencocokan import CatatanRencana, KeberangkatanRencana, rencana

STATUS_JALAN = ("buka", "penuh", "berangkat")


def kunci_urut(c: CatatanPanen) -> str:
    """Urutan "dibuat lebih awal" memakai waktu terima server, bukan jam perangkat (PRD 9)."""
    return iso_utc_presisi(c.diterima)


def hasil_final_terbaru(db: Session, kb_id: str) -> HasilPencocokan | None:
    return db.scalars(
        select(HasilPencocokan)
        .where(HasilPencocokan.keberangkatan_id == kb_id, HasilPencocokan.sifat == "final")
        .order_by(HasilPencocokan.versi.desc())
        .limit(1)
    ).first()


def versi_berikut(db: Session, kb_id: str) -> int:
    v = db.scalar(select(func.max(HasilPencocokan.versi)).where(HasilPencocokan.keberangkatan_id == kb_id))
    return (v or 0) + 1


def jatah_terkunci(db: Session) -> dict[str, int]:
    """Jumlah jatah per catatan panen pada keberangkatan yang sudah dikunci dan tidak Batal."""
    total: dict[str, int] = defaultdict(int)
    for kb in db.scalars(select(Keberangkatan).where(Keberangkatan.terkunci.is_(True), Keberangkatan.status != "batal")):
        h = hasil_final_terbaru(db, kb.id)
        if h:
            for b in h.baris:
                total[b.panen_id] += b.jatah
    return total


def _hitung(db: Session) -> None:
    terkunci = jatah_terkunci(db)

    kbs = list(
        db.scalars(
            select(Keberangkatan).where(
                Keberangkatan.aktif_cocok.is_(True),
                Keberangkatan.terkunci.is_(False),
                Keberangkatan.status.in_(STATUS_JALAN),
            )
        )
    )
    pool = list(db.scalars(select(CatatanPanen).where(CatatanPanen.status.not_in(("dibatalkan", "terangkut")))))
    per_id = {c.id: c for c in pool}

    manual: dict[str, dict[str, int]] = defaultdict(dict)
    for m in db.scalars(select(JatahManual).where(JatahManual.jumlah.is_not(None))):
        manual[m.keberangkatan_id][m.panen_id] = m.jumlah  # type: ignore[assignment]
    alasan = {(m.keberangkatan_id, m.panen_id): m.alasan for m in db.scalars(select(JatahManual))}

    hasil = rencana(
        [
            KeberangkatanRencana(
                id=kb.id,
                ruang=0 if kb.status == "penuh" else kb.sisa_ruang,
                tanggal=kb.berangkat[:10],
                berangkat=kb.berangkat,
                tetap=manual.get(kb.id, {}),
            )
            for kb in kbs
        ],
        [
            CatatanRencana(id=c.id, q=c.tandan - terkunci.get(c.id, 0), siap=c.siap_angkut, dibuat=kunci_urut(c))
            for c in pool
            if c.tandan - terkunci.get(c.id, 0) > 0
        ],
    )

    jatah_buka: dict[str, int] = defaultdict(int)
    dicocokkan: set[str] = set()
    for kb in kbs:
        baris = hasil[kb.id]
        ruang = 0 if kb.status == "penuh" else kb.sisa_ruang
        for b in baris:
            jatah_buka[b.catatan_id] += b.jatah
            dicocokkan.add(b.catatan_id)

        lama = hasil_final_terbaru(db, kb.id)
        tanda_baru = (ruang, sorted((b.catatan_id, b.diminta, b.jatah) for b in baris))
        if lama is not None:
            tanda_lama = (lama.ruang, sorted((b.panen_id, b.diminta, b.jatah) for b in lama.baris))
            if tanda_lama == tanda_baru:
                continue
        h = HasilPencocokan(
            id=uuid.uuid4().hex,
            keberangkatan_id=kb.id,
            versi=versi_berikut(db, kb.id),
            sifat="final",
            dibuat_di="server",
            ruang=ruang,
            diminta=sum(b.diminta for b in baris),
        )
        for b in baris:
            h.baris.append(
                Jatah(
                    panen_id=b.catatan_id,
                    desa_id=per_id[b.catatan_id].desa_id,
                    diminta=b.diminta,
                    jatah=b.jatah,
                    tunggu=b.tunggu,
                    alasan_manual=alasan.get((kb.id, b.catatan_id)),
                )
            )
        db.add(h)
        db.flush()
        tandai(db, h)

    for c in pool:
        total = terkunci.get(c.id, 0) + jatah_buka.get(c.id, 0)
        pernah = c.pernah_dicocokkan or c.id in dicocokkan
        if total > 0:
            status = "dapat_jatah"
        elif pernah:
            status = "daftar_tunggu"
        else:
            status = "terdaftar"
        tunggu = max(0, c.tandan - total) if pernah else 0
        if (c.status, c.jatah, c.tunggu, c.pernah_dicocokkan) != (status, total, tunggu, pernah):
            c.status, c.jatah, c.tunggu, c.pernah_dicocokkan = status, total, tunggu, pernah
            tandai(db, c)


def _kunci(db: Session, kb: Keberangkatan) -> None:
    kb.terkunci = True
    tandai(db, kb)
    h = hasil_final_terbaru(db, kb.id)
    if h is not None and not h.terkunci:
        h.terkunci = True
        tandai(db, h)


def hitung_ulang(db: Session) -> None:
    """Mengunci keberangkatan yang lewat batas waktu, lalu menghitung ulang yang masih terbuka."""
    jam_batas = parameter(db)["jam_batas_cocok"]
    kini = sekarang_wib()
    while True:
        kandidat = [
            kb
            for kb in db.scalars(
                select(Keberangkatan).where(Keberangkatan.terkunci.is_(False), Keberangkatan.status.in_(STATUS_JALAN))
            )
            if kb.status == "berangkat" or batas_waktu_cocok(kb.berangkat, jam_batas) <= kini
        ]
        if not kandidat:
            break
        kb = min(kandidat, key=lambda k: (k.berangkat, k.id))
        kb.aktif_cocok = True
        _hitung(db)
        _kunci(db, kb)
    _hitung(db)
    db.flush()
