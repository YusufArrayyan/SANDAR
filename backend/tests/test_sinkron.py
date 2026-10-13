import uuid
from datetime import timedelta

from sqlalchemy import select

from app.db import SessionLocal
from app.layanan import hari_ini_wib
from app.models import CatatanPanen, Keberangkatan, Pengguna, Petani


def _id():
    return uuid.uuid4().hex


def aktifkan(klien, kode):
    r = klien.post("/api/auth/aktivasi", json={"kode": kode})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def pengguna(hp):
    with SessionLocal() as db:
        return db.scalar(select(Pengguna).where(Pengguna.hp == hp))


def op(jenis, oleh, data, op_id=None):
    return {"op_id": op_id or _id(), "jenis": jenis, "oleh": oleh, "data": data, "waktu_perangkat": "2026-10-13T08:00:00Z"}


def kirim(klien, token, *ops):
    r = klien.post("/api/sinkron/kirim", json={"ops": list(ops)}, headers={"X-Perangkat": token})
    assert r.status_code == 200, r.text
    return r.json()["hasil"]


def ambil(klien, token, sejak=0):
    r = klien.get(f"/api/sinkron/ambil?sejak={sejak}", headers={"X-Perangkat": token})
    assert r.status_code == 200, r.text
    return r.json()


def test_aktivasi_sekali_pakai(klien):
    aktifkan(klien, "MEOK2026")
    r = klien.post("/api/auth/aktivasi", json={"kode": "MEOK2026"})
    assert r.status_code == 409


def test_ambil_berisi_lingkup_desa(klien):
    t = aktifkan(klien, "MEOK2026")
    d = ambil(klien, t)
    nama_petani = {p["nama"] for p in d["data"]["petani"]}
    assert nama_petani == {"Rahmat", "Siti", "Yanto"}  # Dewi dari Banjarsari tidak ikut
    assert len(d["data"]["panen"]) == 3
    assert all(u["peran"] in ("petani", "simpul") for u in d["data"]["pengguna"])
    # kursor: ambil lagi tidak mengembalikan apa pun yang baru
    d2 = ambil(klien, t, d["kursor"])
    assert d2["data"]["panen"] == []


def test_petani_hanya_melihat_catatannya(klien):
    t = aktifkan(klien, "PETANI01")
    d = ambil(klien, t)
    assert [p["nama"] for p in d["data"]["petani"]] == ["Rahmat"]
    assert len(d["data"]["panen"]) == 1
    assert len(d["data"]["pengguna"]) == 1


def test_kirim_idempoten(klien):
    t = aktifkan(klien, "MEOK2026")
    andi = pengguna("081234567890")
    d = ambil(klien, t)
    rahmat = next(p for p in d["data"]["petani"] if p["nama"] == "Rahmat")
    pid = _id()
    o = op("panen.catat", andi.id, {"id": pid, "petani_id": rahmat["id"], "tandan": 30,
                                     "siap_angkut": hari_ini_wib().isoformat(), "dibuat": "2026-10-13T08:00:00"})
    assert kirim(klien, t, o)[0]["status"] == "diterima"
    assert kirim(klien, t, o)[0]["status"] == "diterima"
    with SessionLocal() as db:
        assert db.scalar(select(CatatanPanen).where(CatatanPanen.id == pid)).tandan == 30
        assert len(list(db.scalars(select(CatatanPanen).where(CatatanPanen.petani_id == rahmat["id"])))) == 2


def test_batas_50_operasi(klien):
    t = aktifkan(klien, "MEOK2026")
    andi = pengguna("081234567890")
    ops = [op("desa.biaya", andi.id, {"desa_id": andi.desa_id, "biaya_tebang": i}) for i in range(51)]
    r = klien.post("/api/sinkron/kirim", json={"ops": ops}, headers={"X-Perangkat": t})
    assert r.status_code == 422


def test_pencocokan_final_sesuai_contoh_prd(klien):
    t = aktifkan(klien, "MEOK2026")
    andi = pengguna("081234567890")
    d = ambil(klien, t)
    kb = next(k for k in d["data"]["keberangkatan"] if k["sisa_ruang"] == 300)
    hasil = kirim(klien, t, op("hasil.sementara", andi.id, {"id": _id(), "keberangkatan_id": kb["id"], "versi": 1, "ruang": 300, "baris": []}))
    assert hasil[0]["status"] == "diterima"
    d = ambil(klien, t)
    final = [h for h in d["data"]["hasil"] if h["keberangkatan_id"] == kb["id"]]
    assert final and final[-1]["sifat"] == "final"
    nama = {p["id"]: p["nama"] for p in d["data"]["petani"]}
    panen = {c["id"]: nama[c["petani_id"]] for c in d["data"]["panen"]}
    jatah = {panen[b["panen_id"]]: b["jatah"] for b in final[-1]["baris"]}
    assert jatah == {"Rahmat": 75, "Siti": 94, "Yanto": 131}
    status = {nama[c["petani_id"]]: (c["status"], c["jatah"], c["tunggu"]) for c in d["data"]["panen"]}
    assert status["Siti"] == ("dapat_jatah", 94, 56)


def test_keberangkatan_batal_mengembalikan_daftar_tunggu(klien):
    t = aktifkan(klien, "MEOK2026")
    tk = aktifkan(klien, "KAPAL001")
    andi = pengguna("081234567890")
    darman = pengguna("081300000001")
    d = ambil(klien, t)
    kb = next(k for k in d["data"]["keberangkatan"] if k["sisa_ruang"] == 300)
    kirim(klien, t, op("hasil.sementara", andi.id, {"id": _id(), "keberangkatan_id": kb["id"], "versi": 1, "ruang": 300, "baris": []}))
    h = kirim(klien, tk, op("keberangkatan.ubah", darman.id, {"id": kb["id"], "versi_dasar": kb["versi"], "status": "batal"}))
    assert h[0]["status"] == "diterima", h
    with SessionLocal() as db:
        for c in db.scalars(select(CatatanPanen).join(Petani).where(Petani.desa_id == andi.desa_id)):
            assert c.status == "daftar_tunggu"
            assert c.jatah == 0


def test_pengelola_kapal_hanya_kapal_sendiri(klien):
    tk = aktifkan(klien, "KAPAL001")
    darman = pengguna("081300000001")
    d = ambil(klien, tk)
    feri = next(k for k in d["data"]["kapal"] if k["jenis"] == "feri")
    h = kirim(klien, tk, op("keberangkatan.catat", darman.id, {
        "id": _id(), "kapal_id": feri["id"], "asal": "A", "tujuan": "B", "berangkat": "2026-12-01T06:00", "sisa_ruang": 10, "tarif": 1}))
    assert h[0]["status"] == "ditolak"


def test_konflik_ubah_yang_lebih_dulu_menang(klien):
    t = aktifkan(klien, "MEOK2026")
    andi = pengguna("081234567890")
    d = ambil(klien, t)
    c = d["data"]["panen"][0]
    a = kirim(klien, t, op("panen.ubah", andi.id, {"id": c["id"], "versi_dasar": c["versi"], "tandan": 100}))
    b = kirim(klien, t, op("panen.ubah", andi.id, {"id": c["id"], "versi_dasar": c["versi"], "tandan": 90}))
    assert a[0]["status"] == "diterima"
    assert b[0]["status"] == "ditolak" and "perangkat lain" in b[0]["pesan"]
    with SessionLocal() as db:
        assert db.get(CatatanPanen, c["id"]).tandan == 100


def test_kunci_pada_batas_waktu_dan_terangkut_memisah_sisa(klien):
    t = aktifkan(klien, "MEOK2026")
    andi = pengguna("081234567890")
    d = ambil(klien, t)
    kb = next(k for k in d["data"]["keberangkatan"] if k["sisa_ruang"] == 300)
    # Majukan waktu berangkat ke besok pagi: batas waktu (18.00 hari ini) mungkin belum lewat,
    # jadi tandai Berangkat agar server langsung mengunci.
    with SessionLocal() as db:
        k = db.get(Keberangkatan, kb["id"])
        besok = (hari_ini_wib() + timedelta(days=1)).isoformat()
        k.berangkat = f"{besok}T06:00"
        for c in db.scalars(select(CatatanPanen)):
            c.siap_angkut = hari_ini_wib().isoformat()
        db.commit()
    tk = aktifkan(klien, "KAPAL001")
    darman = pengguna("081300000001")
    kirim(klien, tk, op("keberangkatan.ubah", darman.id, {"id": kb["id"], "versi_dasar": kb["versi"], "status": "berangkat"}))
    d = ambil(klien, t)
    kbd = next(k for k in d["data"]["keberangkatan"] if k["id"] == kb["id"])
    assert kbd["terkunci"]
    nama = {p["id"]: p["nama"] for p in d["data"]["petani"]}
    siti = next(c for c in d["data"]["panen"] if nama[c["petani_id"]] == "Siti")
    # Final lintas simpul: Dewi (Banjarsari) ikut berbagi. Q = 570, R = 300.
    assert siti["jatah"] == 79

    # Jatah sudah Final: catatan tidak dapat diubah lagi.
    h = kirim(klien, t, op("panen.ubah", andi.id, {"id": siti["id"], "versi_dasar": siti["versi"], "tandan": 1}))
    assert h[0]["status"] == "ditolak"

    sisa_id = _id()
    h = kirim(klien, t, op("panen.terangkut", andi.id, {
        "id": siti["id"], "versi_dasar": siti["versi"], "keberangkatan_id": kb["id"], "harga_terima": 40000, "sisa_id": sisa_id}))
    assert h[0]["status"] == "diterima", h
    with SessionLocal() as db:
        asal = db.get(CatatanPanen, siti["id"])
        sisa = db.get(CatatanPanen, sisa_id)
        assert (asal.status, asal.tandan) == ("terangkut", 79)
        assert asal.acuan_bersih == 60000 - 8000 - 7000
        assert sisa.tandan == 71 and sisa.induk_id == siti["id"]
        # Sisa ikut feri berikutnya setelah feri dicocokkan.
        assert sisa.status in ("daftar_tunggu", "terdaftar", "dapat_jatah")


def test_perangkat_dinonaktifkan(klien):
    t = aktifkan(klien, "MEOK2026")
    ta = aktifkan(klien, "ADMIN001")
    admin = pengguna("0811000000")
    hdr = {"X-Perangkat": ta, "X-Pengguna": admin.id}
    perangkat = klien.get("/api/admin/perangkat", headers=hdr).json()
    simpul = next(p for p in perangkat if p["desa_id"])
    assert klien.patch(f"/api/admin/perangkat/{simpul['id']}?aktif=false", headers=hdr).status_code == 200
    r = klien.get("/api/sinkron/ambil", headers={"X-Perangkat": t})
    assert r.status_code == 403


def test_harga_hanya_mitra(klien):
    tm = aktifkan(klien, "MITRA001")
    mitra = pengguna("081400000001")
    r = klien.post("/api/harga", json={"pasar": "Pasar Minggu, Kota Bengkulu", "tanggal": "2026-10-13", "harga": 61000},
                   headers={"X-Perangkat": tm, "X-Pengguna": mitra.id})
    assert r.status_code == 200
    t = aktifkan(klien, "MEOK2026")
    andi = pengguna("081234567890")
    r = klien.post("/api/harga", json={"pasar": "X", "tanggal": "2026-10-13", "harga": 1},
                   headers={"X-Perangkat": t, "X-Pengguna": andi.id})
    assert r.status_code == 403


def test_ringkasan_indikator(klien):
    ta = aktifkan(klien, "ADMIN001")
    admin = pengguna("0811000000")
    r = klien.get("/api/ringkasan/indikator", headers={"X-Perangkat": ta, "X-Pengguna": admin.id})
    assert r.status_code == 200
    assert {d["desa"] for d in r.json()["desa"]} == {"Meok", "Banjarsari"}
    r = klien.get("/api/admin/ekspor/panen.csv", headers={"X-Perangkat": ta, "X-Pengguna": admin.id})
    assert r.status_code == 200 and "Rahmat" in r.text


def test_operasi_keliru_tidak_memacetkan_kiriman(klien, monkeypatch):
    from app import sinkron

    t = aktifkan(klien, "MEOK2026")
    andi = pengguna("081234567890")

    def meledak(*_a, **_k):
        raise RuntimeError("galat tak terduga")

    monkeypatch.setitem(sinkron.PENANGAN, "pengguna.pin", meledak)
    ops = [
        {"op_id": "bentuk-keliru-1", "jenis": "desa.biaya"},  # tanpa oleh dan data
        op("pengguna.pin", andi.id, {"pin_hash": "x"}),
        op("desa.biaya", andi.id, {"desa_id": andi.desa_id, "biaya_tebang": 9000}),
    ]
    r = klien.post("/api/sinkron/kirim", json={"ops": ops}, headers={"X-Perangkat": t})
    assert r.status_code == 200, r.text
    status = [h["status"] for h in r.json()["hasil"]]
    assert status == ["ditolak", "ditolak", "diterima"]


def test_simpul_tidak_bisa_mengubah_petani_desa_lain(klien):
    t = aktifkan(klien, "MEOK2026")
    andi = pengguna("081234567890")
    with SessionLocal() as db:
        dewi = db.scalar(select(Petani).where(Petani.nama == "Dewi"))
    h = kirim(klien, t, op("petani.simpan", andi.id, {"id": dewi.id, "nama": "Diganti", "desa_id": andi.desa_id}))
    assert h[0]["status"] == "ditolak"
    with SessionLocal() as db:
        assert db.get(Petani, dewi.id).nama == "Dewi"


def test_kode_aktivasi_dibatasi(klien):
    from app import rute

    rute._GAGAL_AKTIVASI.clear()
    for _ in range(rute.MAKS_GAGAL_AKTIVASI):
        assert klien.post("/api/auth/aktivasi", json={"kode": "SALAH000"}).status_code == 404
    assert klien.post("/api/auth/aktivasi", json={"kode": "MEOK2026"}).status_code == 429
    rute._GAGAL_AKTIVASI.clear()


def test_urutan_memakai_waktu_terima_server(klien):
    """Pecahan sama: catatan yang lebih dulu diterima server didahulukan, walau jam perangkat lebih awal."""
    t = aktifkan(klien, "MEOK2026")
    andi = pengguna("081234567890")
    with SessionLocal() as db:
        for c in db.scalars(select(CatatanPanen)):
            c.status = "dibatalkan"
        db.commit()
    d = ambil(klien, t)
    rahmat = next(p for p in d["data"]["petani"] if p["nama"] == "Rahmat")
    siti = next(p for p in d["data"]["petani"] if p["nama"] == "Siti")
    kb = next(k for k in d["data"]["keberangkatan"] if k["sisa_ruang"] == 300)
    siap = hari_ini_wib().isoformat()
    a, b = _id(), _id()
    # a diterima lebih dulu, tetapi jam perangkatnya lebih lambat.
    kirim(klien, t, op("panen.catat", andi.id, {"id": a, "petani_id": rahmat["id"], "tandan": 1, "siap_angkut": siap, "dibuat": "2026-10-13T10:00:00Z"}))
    kirim(klien, t, op("panen.catat", andi.id, {"id": b, "petani_id": siti["id"], "tandan": 1, "siap_angkut": siap, "dibuat": "2026-10-13T08:00:00Z"}))
    with SessionLocal() as db:
        db.get(Keberangkatan, kb["id"]).sisa_ruang = 1
        db.commit()
    kirim(klien, t, op("hasil.sementara", andi.id, {"id": _id(), "keberangkatan_id": kb["id"], "versi": 1, "ruang": 1, "baris": []}))
    with SessionLocal() as db:
        assert db.get(CatatanPanen, a).jatah == 1
        assert db.get(CatatanPanen, b).jatah == 0
