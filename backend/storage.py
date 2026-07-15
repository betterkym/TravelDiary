"""임시 저장소. (소유: 2번 백엔드·통합)

MVP 단계에서는 프로세스 메모리 + outputs/ 파일에 저장합니다.
DB 도입 시 이 모듈의 함수 시그니처만 유지하면 나머지 코드는 그대로 둘 수 있습니다.
"""
from __future__ import annotations

from typing import Optional

from . import config
from .models import Diary, LocationPoint, Photo, TripCreate

# trip_id -> 데이터. 프로세스가 죽으면 사라집니다(MVP 한계).
_trips: dict[str, dict] = {}


def create_trip(trip_id: str, trip: TripCreate) -> None:
    _trips[trip_id] = {
        "meta": trip.model_dump(),
        "locations": [],
        "photos": [],
        "diary": None,
    }


def add_locations(trip_id: str, points: list[LocationPoint]) -> None:
    _trips[trip_id]["locations"].extend(points)


def get_locations(trip_id: str) -> list[LocationPoint]:
    return _trips[trip_id]["locations"]


def add_photos(trip_id: str, photos: list[Photo]) -> None:
    _trips[trip_id]["photos"].extend(photos)


def get_photos(trip_id: str) -> list[Photo]:
    return _trips[trip_id]["photos"]


def save_diary(trip_id: str, diary: Diary) -> None:
    _trips[trip_id]["diary"] = diary


def get_diary(trip_id: str) -> Optional[Diary]:
    return _trips.get(trip_id, {}).get("diary")


def exists(trip_id: str) -> bool:
    return trip_id in _trips
