"""FastAPI 서버 진입점. (소유: 2번 백엔드·통합)

README '예정 API' 5개를 구현합니다. 각 엔드포인트는 storage/pipeline 을 호출하며,
하위 모듈이 stub 이어도 전체 흐름이 끝까지 동작합니다.

로컬 실행:
    uvicorn backend.app:app --reload
문서:
    http://localhost:8000/docs
"""
from __future__ import annotations

import shutil
import uuid

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import config, pipeline, storage
from .models import Diary, LocationBatch, TripCreate
from .services import exif

app = FastAPI(title="Travel Diary API", version="0.1.0")

# 프런트(localhost:8000 정적 서버 등)에서 호출 허용. 배포 시 도메인을 좁히세요.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/trips")
def create_trip(trip: TripCreate):
    trip_id = f"trip_{uuid.uuid4().hex[:8]}"
    storage.create_trip(trip_id, trip)
    return {"trip_id": trip_id}


@app.post("/api/trips/{trip_id}/locations")
def add_locations(trip_id: str, batch: LocationBatch):
    _require_trip(trip_id)
    storage.add_locations(trip_id, batch.points)
    return {"count": len(storage.get_locations(trip_id))}


@app.post("/api/trips/{trip_id}/photos")
def upload_photos(trip_id: str, files: list[UploadFile] = File(...)):
    _require_trip(trip_id)
    if len(files) > config.MAX_PHOTOS:
        raise HTTPException(400, f"사진은 최대 {config.MAX_PHOTOS}장까지 업로드할 수 있습니다.")

    saved = []
    for f in files:
        if f.content_type not in config.ALLOWED_MIME:
            raise HTTPException(400, f"지원하지 않는 형식: {f.content_type}")
        dest = config.UPLOAD_DIR / f"{uuid.uuid4().hex}_{f.filename}"
        with dest.open("wb") as out:
            shutil.copyfileobj(f.file, out)
        saved.append(exif.extract(dest))

    storage.add_photos(trip_id, saved)
    return {"count": len(storage.get_photos(trip_id))}


@app.post("/api/trips/{trip_id}/generate", response_model=Diary)
def generate(trip_id: str):
    _require_trip(trip_id)
    return pipeline.generate(trip_id)


@app.get("/api/trips/{trip_id}/diary", response_model=Diary)
def get_diary(trip_id: str):
    _require_trip(trip_id)
    diary = storage.get_diary(trip_id)
    if diary is None:
        raise HTTPException(404, "아직 생성된 다이어리가 없습니다. 먼저 generate 를 호출하세요.")
    return diary


def _require_trip(trip_id: str) -> None:
    if not storage.exists(trip_id):
        raise HTTPException(404, "존재하지 않는 여행입니다.")
