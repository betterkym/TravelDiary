"""Pytest storage isolation.

Tests must not write to the local development SQLite database. These
environment variables are set before test modules import backend.config.
"""
from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path


_TEST_ROOT = Path(tempfile.mkdtemp(prefix="traveldiary-tests-"))

os.environ["DATA_DIR"] = str(_TEST_ROOT / "data")
os.environ["DB_PATH"] = str(_TEST_ROOT / "data" / "travel_diary.sqlite3")
os.environ["UPLOAD_DIR"] = str(_TEST_ROOT / "uploads")
os.environ["OUTPUT_DIR"] = str(_TEST_ROOT / "outputs")

# Unit tests should never hit a real remote Supabase project from .env.
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
os.environ["SUPABASE_SECRET_KEY"] = ""


def pytest_unconfigure(config):
    shutil.rmtree(_TEST_ROOT, ignore_errors=True)
