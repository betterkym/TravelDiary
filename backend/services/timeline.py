"""경로와 사진 매칭 -> 시간순 타임라인. (소유: 5번 다이어리 생성)

대표사진을 촬영시간순으로 정렬하고, 위치가 있으면 가장 가까운 정차 지점에
매칭해 시간순 엔트리를 만듭니다. 시간·GPS 가 없어도 순서만으로 배치합니다.
"""
from __future__ import annotations

from math import atan2, cos, radians, sin, sqrt

from ..models import Photo, Route, SelectedPhoto, Stop, TimelineEntry

_NEAR_STOP_M = 200.0   # 사진이 이 거리 안이면 해당 정차 지점 이름을 붙임
_SAME_FEED_RADIUS_M = 120.0
_SAME_FEED_MAX_GAP_SEC = 90 * 60


def build(
    route: Route,
    selected: list[SelectedPhoto],
    photos: list[Photo],
) -> list[TimelineEntry]:
    """경로 + 대표사진 -> 시간순 TimelineEntry 목록.

    타임라인 카드는 "대표사진 1장"이 아니라 "같은 장소에 머문 기록 1개"를
    기준으로 만든다. 같은 위치에서 대표사진이 여러 장 뽑혀도 하나의 피드에
    묶어 보여 주기 위함이다.
    """
    photo_by_id = {p.photo_id: p for p in photos}

    # 대표사진에 해당하는 Photo 를 촬영시간순으로 정렬 (시간 없으면 뒤로)
    pairs = [(sp, photo_by_id.get(sp.photo_id)) for sp in selected]
    pairs.sort(key=lambda pair: _sort_key(pair[1]))

    groups = _group_same_feed(pairs)

    entries: list[TimelineEntry] = []
    for group in groups:
        first_sp, first_photo = group["items"][0]
        place = _match_place(first_photo, route.stops)
        photo_urls = [sp.photo_url for sp, _ in group["items"] if sp.photo_url]
        photo_ids = [sp.photo_id for sp, _ in group["items"] if sp.photo_id]
        entries.append(TimelineEntry(
            time=group["first_time"] or _fallback_time(route),
            place=place,
            note="",                       # diary.annotate 가 채움
            photo_url=photo_urls[0] if photo_urls else first_sp.photo_url,
            photo_urls=photo_urls,
            photo_ids=photo_ids,
            photo_count=len(group["items"]),
            lat=group["lat"],
            lng=group["lng"],
        ))
    return entries


def _group_same_feed(pairs: list[tuple[SelectedPhoto, Photo | None]]) -> list[dict]:
    groups: list[dict] = []
    for sp, photo in pairs:
        target = _find_merge_target(groups, photo)
        if target is None:
            groups.append(_new_group(sp, photo))
        else:
            _append_to_group(target, sp, photo)
    return groups


def _new_group(sp: SelectedPhoto, photo: Photo | None) -> dict:
    has_location = photo is not None and photo.lat is not None and photo.lng is not None
    return {
        "items": [(sp, photo)],
        "first_time": photo.taken_at if photo and photo.taken_at else None,
        "last_time": photo.taken_at if photo and photo.taken_at else None,
        "lat": float(photo.lat) if has_location else None,
        "lng": float(photo.lng) if has_location else None,
        "located_count": 1 if has_location else 0,
    }


def _append_to_group(group: dict, sp: SelectedPhoto, photo: Photo | None) -> None:
    group["items"].append((sp, photo))
    if photo and photo.taken_at:
        group["last_time"] = photo.taken_at
    if photo and photo.lat is not None and photo.lng is not None:
        count = group["located_count"]
        if count <= 0 or group["lat"] is None or group["lng"] is None:
            group["lat"] = float(photo.lat)
            group["lng"] = float(photo.lng)
            group["located_count"] = 1
            return
        group["lat"] = ((group["lat"] * count) + float(photo.lat)) / (count + 1)
        group["lng"] = ((group["lng"] * count) + float(photo.lng)) / (count + 1)
        group["located_count"] = count + 1


def _find_merge_target(groups: list[dict], photo: Photo | None) -> dict | None:
    if photo is None:
        return None
    for group in reversed(groups):
        if _can_merge(group, photo):
            return group
    return None


def _can_merge(group: dict, photo: Photo) -> bool:
    if group["lat"] is None or group["lng"] is None or photo.lat is None or photo.lng is None:
        return False

    if group["last_time"] and photo.taken_at:
        if group["last_time"].date() != photo.taken_at.date():
            return False
        gap = abs((photo.taken_at - group["last_time"]).total_seconds())
        if gap > _SAME_FEED_MAX_GAP_SEC:
            return False

    distance = _haversine_m(float(photo.lat), float(photo.lng), group["lat"], group["lng"])
    return distance <= _SAME_FEED_RADIUS_M


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
