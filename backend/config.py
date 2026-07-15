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

UPLOAD_DIR = BASE_DIR / os.getenv("UPLOAD_DIR", "uploads")
OUTPUT_DIR = BASE_DIR / os.getenv("OUTPUT_DIR", "outputs")

MAX_PHOTOS = int(os.getenv("MAX_PHOTOS", "30"))
MAX_PHOTO_MB = int(os.getenv("MAX_PHOTO_MB", "15"))
ALLOWED_MIME = {"image/jpeg", "image/png"}

MAPBOX_ACCESS_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN", "")
AI_API_KEY = os.getenv("AI_API_KEY", "")

# 대표사진 최대 개수
MAX_SELECTED_PHOTOS = 8

# 필요한 폴더 보장
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
