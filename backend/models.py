"""공통 데이터 모델. (소유: 2번 백엔드·통합)

README '공통 데이터 계약' 의 JSON 형식을 그대로 코드로 옮긴 것입니다.
모든 담당자는 실제 모듈 완성 전에도 이 형태의 fixture 로 병렬 개발합니다.
이 형식이 바뀌면 반드시 팀에 공유하고 README 의 예시도 함께 고칩니다.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# --- 입력: 여행 / 위치 ---------------------------------------------------

class TripCreate(BaseModel):
    """POST /api/trips 요청 본문."""
    title: str
    start_date: str            # "2026-07-15"
    region: str


class LocationPoint(BaseModel):
    """브라우저 Geolocation 한 지점. (3번 GPS·경로 입력)"""
    lat: float
    lng: float
    time: datetime
    accuracy_m: Optional[float] = None


class LocationBatch(BaseModel):
    """POST /api/trips/{trip_id}/locations 요청 본문."""
    points: list[LocationPoint] = Field(default_factory=list)


# --- 처리 결과: 경로 (3번) -----------------------------------------------

class Stop(BaseModel):
    """정차 지점."""
    lat: float
    lng: float
    arrived_at: datetime
    left_at: Optional[datetime] = None
    place: Optional[str] = None


class Route(BaseModel):
    distance_m: int = 0
    duration_sec: int = 0
    stops: list[Stop] = Field(default_factory=list)


# --- 처리 결과: 사진 (4번) -----------------------------------------------

class Photo(BaseModel):
    """업로드된 사진 1장의 분석 결과."""
    photo_id: str
    filename: str
    taken_at: Optional[datetime] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    quality_score: Optional[float] = None
    group_id: Optional[str] = None       # 유사사진 그룹 (dedupe)


class SelectedPhoto(BaseModel):
    """대표사진으로 선택된 사진과 그 이유."""
    photo_id: str
    photo_url: str
    reason: str = ""


# --- 처리 결과: 다이어리 (5번) -------------------------------------------

class TimelineEntry(BaseModel):
    time: datetime
    place: str
    note: str
    photo_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class Diary(BaseModel):
    """GET /api/trips/{trip_id}/diary 응답 (공통 데이터 계약)."""
    trip_id: str
    route: Route = Field(default_factory=Route)
    selected_photos: list[SelectedPhoto] = Field(default_factory=list)
    timeline: list[TimelineEntry] = Field(default_factory=list)
