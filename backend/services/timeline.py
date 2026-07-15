"""경로와 사진 매칭 -> 시간순 타임라인. (소유: 5번 다이어리 생성)

대표사진을 촬영시간순으로 정렬하고, 위치가 있으면 가장 가까운 정차 지점에
매칭해 시간순 엔트리를 만듭니다. 시간·GPS 가 없어도 순서만으로 배치합니다.
"""
from __future__ import annotations

from math import atan2, cos, radians, sin, sqrt

from ..models import Photo, Route, SelectedPhoto, Stop, TimelineEntry

_NEAR_STOP_M = 200.0   # 사진이 이 거리 안이면 해당 정차 지점 이름을 붙임


def build(
    route: Route,
    selected: list[SelectedPhoto],
    photos: list[Photo],
) -> list[TimelineEntry]:
    """경로 + 대표사진 -> 시간순 TimelineEntry 목록."""
    photo_by_id = {p.photo_id: p for p in photos}

    # 대표사진에 해당하는 Photo 를 촬영시간순으로 정렬 (시간 없으면 뒤로)
    pairs = [(sp, photo_by_id.get(sp.photo_id)) for sp in selected]
    pairs.sort(key=lambda pair: _sort_key(pair[1]))

    entries: list[TimelineEntry] = []
    for sp, photo in pairs:
        place = _match_place(photo, route.stops)
        entries.append(TimelineEntry(
            time=(photo.taken_at if photo and photo.taken_at else None) or _fallback_time(route),
            place=place,
            note="",                       # diary.annotate 가 채움
            photo_url=sp.photo_url,
            lat=photo.lat if photo else None,
            lng=photo.lng if photo else None,
        ))
    return entries


def _sort_key(photo: Photo | None) -> float:
    if photo and photo.taken_at:
        return photo.taken_at.timestamp()
    return float("inf")   # 시간 없는 사진은 맨 뒤


def _match_place(photo: Photo | None, stops: list[Stop]) -> str:
    if not photo or photo.lat is None or photo.lng is None:
        return "이동 중"
    nearest, best = None, _NEAR_STOP_M
    for s in stops:
        d = _haversine_m(photo.lat, photo.lng, s.lat, s.lng)
        if d <= best:
            nearest, best = s, d
    if nearest is None:
        return "이동 중"
    return nearest.place or "정차 지점"


def _fallback_time(route: Route):
    """촬영시간이 없을 때: 정차 지점 도착 시각 or 현재."""
    if route.stops:
        return route.stops[0].arrived_at
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


def _haversine_m(lat1, lng1, lat2, lng2) -> float:
    r = 6_371_000
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    h = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * atan2(sqrt(h), sqrt(1 - h))
