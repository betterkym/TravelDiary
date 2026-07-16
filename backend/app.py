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
from fastapi.staticfiles import StaticFiles

from . import config, pipeline, storage
from .models import Diary, DiaryNoteUpdate, LocationBatch, PhotoFeedback, TripCreate
from .services import exif

app = FastAPI(title="Travel Diary API", version="0.1.0")

app.mount("/uploads", StaticFiles(directory=config.UPLOAD_DIR), name="uploads")
app.mount("/outputs", StaticFiles(directory=config.OUTPUT_DIR), name="outputs")

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


@app.get("/api/trips/{trip_id}/photos")
def list_photos(trip_id: str):
    _require_trip(trip_id)
    return {"photos": storage.get_photos(trip_id)}


@app.post("/api/trips/{trip_id}/generate", response_model=Diary)
def generate(trip_id: str):
    _require_trip(trip_id)
    return pipeline.generate(trip_id)


@app.post("/api/trips/{trip_id}/photo-feedback")
def photo_feedback(trip_id: str, feedback: PhotoFeedback):
    _require_trip(trip_id)
    storage.save_photo_feedback(trip_id, feedback)
    return {"accepted_count": len(feedback.accepted_photo_ids), "rejected_count": len(feedback.rejected_photo_ids)}


@app.get("/api/trips/{trip_id}/diary", response_model=Diary)
def get_diary(trip_id: str):
    _require_trip(trip_id)
    diary = storage.get_diary(trip_id)
    if diary is None:
        raise HTTPException(404, "아직 생성된 다이어리가 없습니다. 먼저 generate 를 호출하세요.")
    return diary


@app.patch("/api/trips/{trip_id}/diary/notes/{entry_index}", response_model=Diary)
def update_diary_note(trip_id: str, entry_index: int, payload: DiaryNoteUpdate):
    _require_trip(trip_id)
    diary = storage.get_diary(trip_id)
    if diary is None:
        raise HTTPException(404, "아직 생성된 다이어리가 없습니다. 먼저 generate 를 호출하세요.")
    if entry_index < 0 or entry_index >= len(diary.timeline):
        raise HTTPException(404, "수정할 메모를 찾지 못했습니다.")
    note = payload.note.strip()
    if not note:
        raise HTTPException(400, "메모는 비워둘 수 없습니다.")
    if len(note) > 300:
        raise HTTPException(400, "메모는 300자 이내로 작성해 주세요.")
    diary.timeline[entry_index].note = note
    storage.save_diary(trip_id, diary)
    return diary


@app.get("/api/trips/latest")
def latest_trip():
    trip_id = storage.get_latest_trip_id()
    if trip_id is None:
        raise HTTPException(404, "저장된 여행이 없습니다.")
    return {"trip_id": trip_id}


def _require_trip(trip_id: str) -> None:
    if not storage.exists(trip_id):
        raise HTTPException(404, "존재하지 않는 여행입니다.")


app.mount("/", StaticFiles(directory=config.BASE_DIR, html=True), name="frontend")
