"""Mode demo terbuka: pengunjung mencoba SANDAR tanpa kode aktivasi."""

from app import rute


def test_demo_mati_secara_bawaan(klien):
    assert klien.get("/api/info").json()["demo_terbuka"] is False
    assert klien.post("/api/auth/demo", json={"peran": "simpul"}).status_code == 404


def test_demo_simpul_mendapat_data_desa_contoh(klien, monkeypatch):
    monkeypatch.setattr(rute, "DEMO_TERBUKA", True)
    rute._DEMO_PER_IP.clear()
    assert klien.get("/api/info").json()["demo_terbuka"] is True

    r = klien.post("/api/auth/demo", json={"peran": "simpul"})
    assert r.status_code == 200, r.text
    isi = r.json()
    assert {a["nama"] for a in isi["akun_contoh"]} == {"Andi", "Rahmat"}
    assert all(a["pin"] == "1234" for a in isi["akun_contoh"])

    d = klien.get("/api/sinkron/ambil", headers={"X-Perangkat": isi["token"]}).json()
    assert {p["nama"] for p in d["data"]["petani"]} == {"Rahmat", "Siti", "Yanto"}
    assert len(d["data"]["keberangkatan"]) >= 2

    r = klien.post("/api/auth/demo", json={"peran": "kapal"})
    assert [a["nama"] for a in r.json()["akun_contoh"]] == ["Darman"]
    # Admin tidak tersedia lewat demo terbuka.
    assert klien.post("/api/auth/demo", json={"peran": "admin"}).status_code == 422


def test_demo_dibatasi_per_ip(klien, monkeypatch):
    monkeypatch.setattr(rute, "DEMO_TERBUKA", True)
    rute._DEMO_PER_IP.clear()
    for _ in range(rute.MAKS_DEMO_PER_JAM):
        assert klien.post("/api/auth/demo", json={"peran": "mitra"}).status_code == 200
    assert klien.post("/api/auth/demo", json={"peran": "mitra"}).status_code == 429
    rute._DEMO_PER_IP.clear()
