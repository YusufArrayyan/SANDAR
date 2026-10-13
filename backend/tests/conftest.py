import os
import tempfile
from pathlib import Path

# Bawaan: SQLite sementara. Untuk menguji terhadap PostgreSQL, isi SANDAR_UJI_DATABASE_URL.
_tmp = Path(tempfile.mkdtemp()) / "uji.db"
os.environ["SANDAR_DATABASE_URL"] = os.getenv("SANDAR_UJI_DATABASE_URL", f"sqlite:///{_tmp}")
os.environ["SANDAR_WEB_DIST"] = str(Path(tempfile.mkdtemp()) / "tidak-ada")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import isi  # noqa: E402


@pytest.fixture()
def klien():
    Base.metadata.drop_all(engine)
    isi(demo=True)
    with TestClient(app) as k:
        yield k
