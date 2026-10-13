"""Kasus uji bersama: angka harus sama dengan modul TypeScript di perangkat."""

import json
from pathlib import Path

import pytest

from app.pencocokan import CatatanRencana, KeberangkatanRencana, Permintaan, bagi, rencana

KASUS = json.loads((Path(__file__).resolve().parents[2] / "shared" / "kasus_pencocokan.json").read_text(encoding="utf8"))


@pytest.mark.parametrize("kasus", KASUS["bagi"], ids=lambda k: k["nama"])
def test_bagi(kasus):
    minta = [Permintaan(p["id"], p["q"], p["dibuat"]) for p in kasus["permintaan"]]
    hasil = bagi(kasus["ruang"], minta, kasus.get("tetap"))
    assert hasil == kasus["jatah"]
    total_q = sum(p.q for p in minta)
    for p in minta:
        assert 0 <= hasil[p.id] <= p.q
    if total_q > kasus["ruang"] and not kasus.get("tetap"):
        assert sum(hasil.values()) == kasus["ruang"]


@pytest.mark.parametrize("kasus", KASUS["rencana"], ids=lambda k: k["nama"])
def test_rencana(kasus):
    hasil = rencana(
        [KeberangkatanRencana(k["id"], k["ruang"], k["tanggal"], k["berangkat"]) for k in kasus["keberangkatan"]],
        [CatatanRencana(c["id"], c["q"], c["siap"], c["dibuat"]) for c in kasus["catatan"]],
    )
    assert {kb: {b.catatan_id: b.jatah for b in baris} for kb, baris in hasil.items()} == kasus["jatah"]


def test_pencocokan_500_permintaan_cepat():
    import time

    minta = [Permintaan(f"p{i}", 10 + i % 37, f"2026-10-15T08:{i % 60:02d}:00") for i in range(500)]
    mulai = time.perf_counter()
    hasil = bagi(3000, minta)
    assert time.perf_counter() - mulai < 1
    assert sum(hasil.values()) == 3000
