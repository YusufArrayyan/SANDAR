"""Aplikasi FastAPI SANDAR. Seluruh API berada di bawah /api."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import rute, sinkron
from .config import CORS_ORIGINS, WEB_DIST
from .db import Base, SessionLocal, engine
from .layanan import siapkan_penghitung
from .rencana import hitung_ulang

log = logging.getLogger("sandar")


async def _penjaga_batas_waktu() -> None:
    """Mengunci hasil pencocokan tepat pada batas waktu, walau tidak ada perangkat yang sinkron."""
    while True:
        await asyncio.sleep(300)
        try:
            with SessionLocal() as db:
                hitung_ulang(db)
                db.commit()
        except Exception:  # pragma: no cover
            log.exception("Gagal menghitung ulang pencocokan")


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        siapkan_penghitung(db)
    tugas = asyncio.create_task(_penjaga_batas_waktu())
    yield
    tugas.cancel()


app = FastAPI(title="SANDAR API", version="1.0.0-rc.1", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(sinkron.router, prefix="/api")
app.include_router(rute.router, prefix="/api")


@app.get("/api/sehat")
def sehat() -> dict[str, str]:
    return {"status": "ok"}


if WEB_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

    @app.get("/{jalur:path}", include_in_schema=False)
    def antarmuka(jalur: str) -> FileResponse:
        berkas = (WEB_DIST / jalur).resolve()
        if jalur and berkas.is_file() and WEB_DIST.resolve() in berkas.parents:
            return FileResponse(berkas)
        return FileResponse(WEB_DIST / "index.html", headers={"Cache-Control": "no-cache"})
