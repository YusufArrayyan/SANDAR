import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

def _normalkan_url(url: str) -> str:
    """Alamat dari penyedia (Neon, Render, Supabase) berbentuk postgres:// atau postgresql://;
    SQLAlchemy butuh nama driver psycopg."""
    for awal in ("postgres://", "postgresql://"):
        if url.startswith(awal):
            return "postgresql+psycopg://" + url[len(awal):]
    return url


DATABASE_URL = _normalkan_url(
    os.getenv("SANDAR_DATABASE_URL") or os.getenv("DATABASE_URL") or f"sqlite:///{BASE_DIR / 'sandar.db'}"
)
# Folder hasil build PWA. Bila ada, server juga melayani antarmuka.
WEB_DIST = Path(os.getenv("SANDAR_WEB_DIST", BASE_DIR.parent / "frontend" / "dist"))
CORS_ORIGINS = [o for o in os.getenv("SANDAR_CORS", "http://localhost:5173").split(",") if o]

# Iterasi PBKDF2 untuk hash PIN. Harus sama dengan frontend/src/lib/pin.ts.
PIN_ITERASI = 60000

MAKS_OP_PER_KIRIMAN = 50

VERSI = "1.1.0"

# Mode demo terbuka: pengunjung (misalnya juri) dapat mencoba SANDAR tanpa kode aktivasi,
# hanya dengan data contoh. Jangan dinyalakan di server yang berisi data petani sungguhan.
DEMO_TERBUKA = os.getenv("SANDAR_DEMO_TERBUKA") == "1"
