"""공통 설정 로더. (소유: 2번 백엔드·통합)

.env 값을 한 곳에서 읽어 다른 모듈에 노출합니다.
실제 비밀값은 .env 에만 두고 커밋하지 않습니다.
"""
from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # python-dotenv 미설치 환경에서도 임포트는 되도록
    pass

BASE_DIR = Path(__file__).resolve().parent.parent

RAILWAY_VOLUME_MOUNT_PATH = os.getenv("RAILWAY_VOLUME_MOUNT_PATH", "").strip()
STORAGE_ROOT = Path(RAILWAY_VOLUME_MOUNT_PATH) if RAILWAY_VOLUME_MOUNT_PATH else BASE_DIR


def _storage_path(env_name: str, default_name: str) -> Path:
    value = os.getenv(env_name, "").strip()
    return Path(value) if value else STORAGE_ROOT / default_name


UPLOAD_DIR = _storage_path("UPLOAD_DIR", "uploads")
OUTPUT_DIR = _storage_path("OUTPUT_DIR", "outputs")
DATA_DIR = _storage_path("DATA_DIR", "data")
DB_PATH = Path(os.getenv("DB_PATH", str(DATA_DIR / "travel_diary.sqlite3")))

MAX_PHOTOS = int(os.getenv("MAX_PHOTOS", "30"))
MAX_PHOTO_MB = int(os.getenv("MAX_PHOTO_MB", "15"))
ALLOWED_MIME = {"image/jpeg", "image/png"}

MAPBOX_ACCESS_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN", "")
AI_API_KEY = os.getenv("AI_API_KEY", "")

# Supabase 저장소. 두 값이 모두 있으면 backend/storage.py 가 SQLite 대신
# Supabase REST API(PostgREST)를 사용합니다. 서비스 롤 키는 서버 환경변수에만 둡니다.
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    or os.getenv("SUPABASE_SECRET_KEY", "")
)

# 대표사진 최대 개수 (같은 장소는 한 그룹으로 묶이므로, 서로 다른 스팟 수 기준)
MAX_SELECTED_PHOTOS = 12

# 필요한 폴더 보장
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
