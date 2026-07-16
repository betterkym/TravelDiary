"""SQLite 저장소. (소유: 2번 백엔드·통합)

여행 메타데이터, 위치, 사진, 다이어리, 피드백을 SQLite 에 저장해
서버 재시작 후에도 복원될 수 있게 합니다.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from . import config
from .models import Diary, LocationPoint, Photo, PhotoFeedback, TripCreate


def _using_supabase() -> bool:
    return bool(config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _ensure_schema() -> None:
    if _using_supabase():
        return
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS trips (
                trip_id TEXT PRIMARY KEY,
                meta_json TEXT NOT NULL,
                diary_json TEXT,
                photo_feedback_json TEXT
            );

            CREATE TABLE IF NOT EXISTS locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                time TEXT NOT NULL,
                accuracy_m REAL,
                FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id TEXT NOT NULL,
                photo_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE
            );
            """
        )


_ensure_schema()


def _dump_model(model) -> dict:
    return model.model_dump(mode="json")


def _load_photo(data: str | dict) -> Photo:
    if isinstance(data, str):
        return Photo.model_validate_json(data)
    return Photo.model_validate(data)


def _load_diary(data: str | dict) -> Diary:
    if isinstance(data, str):
        return Diary.model_validate_json(data)
    return Diary.model_validate(data)


def _load_feedback(data: str | dict) -> PhotoFeedback:
    if isinstance(data, str):
        return PhotoFeedback.model_validate_json(data)
    return PhotoFeedback.model_validate(data)


def _supabase_request(
    method: str,
    table: str,
    *,
    params: dict[str, str | int] | None = None,
    payload: dict | list | None = None,
    prefer: str | None = None,
):
    query = f"?{urlencode(params or {}, safe='.,()*')}" if params else ""
    url = f"{config.SUPABASE_URL}/rest/v1/{table}{query}"
    headers = {
        "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
        "Accept": "application/json",
    }
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer

    request = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {table} failed: {error.code} {detail}") from error
    except URLError as error:
        raise RuntimeError(f"Supabase {method} {table} failed: {error}") from error

    if not raw:
        return None
    return json.loads(raw)


def _supabase_one(table: str, params: dict[str, str | int]) -> Optional[dict]:
    rows = _supabase_request("GET", table, params={**params, "limit": 1})
    if not rows:
        return None
    return rows[0]


def create_trip(trip_id: str, trip: TripCreate) -> None:
    if _using_supabase():
        _supabase_request(
            "POST",
            "trips",
            payload={
                "trip_id": trip_id,
                "meta_json": _dump_model(trip),
                "diary_json": None,
                "photo_feedback_json": None,
            },
            prefer="return=minimal",
        )
        return

    with _connect() as conn:
        conn.execute(
            "INSERT INTO trips (trip_id, meta_json, diary_json, photo_feedback_json) VALUES (?, ?, NULL, NULL)",
            (trip_id, json.dumps(_dump_model(trip), ensure_ascii=False)),
        )


def add_locations(trip_id: str, points: list[LocationPoint]) -> None:
    if not points:
        return
    if _using_supabase():
        _supabase_request(
            "POST",
            "locations",
            payload=[
                {
                    "trip_id": trip_id,
                    "lat": point.lat,
                    "lng": point.lng,
                    "time": point.time.isoformat(),
                    "accuracy_m": point.accuracy_m,
                }
                for point in points
            ],
            prefer="return=minimal",
        )
        return

    with _connect() as conn:
        conn.executemany(
            "INSERT INTO locations (trip_id, lat, lng, time, accuracy_m) VALUES (?, ?, ?, ?, ?)",
            [
                (
                    trip_id,
                    point.lat,
                    point.lng,
                    point.time.isoformat(),
                    point.accuracy_m,
                )
                for point in points
            ],
        )


def get_locations(trip_id: str) -> list[LocationPoint]:
    if _using_supabase():
        rows = _supabase_request(
            "GET",
            "locations",
            params={
                "select": "lat,lng,time,accuracy_m",
                "trip_id": f"eq.{trip_id}",
                "order": "time.asc,id.asc",
            },
        ) or []
        return [
            LocationPoint(
                lat=row["lat"],
                lng=row["lng"],
                time=datetime.fromisoformat(row["time"]),
                accuracy_m=row.get("accuracy_m"),
            )
            for row in rows
        ]

    with _connect() as conn:
        rows = conn.execute(
            "SELECT lat, lng, time, accuracy_m FROM locations WHERE trip_id = ? ORDER BY time ASC, id ASC",
            (trip_id,),
        ).fetchall()
    return [
        LocationPoint(
            lat=row["lat"],
            lng=row["lng"],
            time=datetime.fromisoformat(row["time"]),
            accuracy_m=row["accuracy_m"],
        )
        for row in rows
    ]


def get_meta(trip_id: str) -> dict:
    if _using_supabase():
        row = _supabase_one(
            "trips",
            {"select": "meta_json", "trip_id": f"eq.{trip_id}"},
        )
        return row["meta_json"] if row and row.get("meta_json") else {}

    with _connect() as conn:
        row = conn.execute("SELECT meta_json FROM trips WHERE trip_id = ?", (trip_id,)).fetchone()
    if not row:
        return {}
    return json.loads(row["meta_json"])


def add_photos(trip_id: str, photos: list[Photo]) -> None:
    if not photos:
        return
    if _using_supabase():
        _supabase_request(
            "POST",
            "photos",
            payload=[
                {"trip_id": trip_id, "photo_json": _dump_model(photo)}
                for photo in photos
            ],
            prefer="return=minimal",
        )
        return

    with _connect() as conn:
        conn.executemany(
            "INSERT INTO photos (trip_id, photo_json) VALUES (?, ?)",
            [(trip_id, json.dumps(_dump_model(photo), ensure_ascii=False)) for photo in photos],
        )


def get_photos(trip_id: str) -> list[Photo]:
    if _using_supabase():
        rows = _supabase_request(
            "GET",
            "photos",
            params={
                "select": "photo_json",
                "trip_id": f"eq.{trip_id}",
                "order": "id.asc",
            },
        ) or []
        return [_load_photo(row["photo_json"]) for row in rows]

    with _connect() as conn:
        rows = conn.execute(
            "SELECT photo_json FROM photos WHERE trip_id = ? ORDER BY id ASC",
            (trip_id,),
        ).fetchall()
    return [_load_photo(row["photo_json"]) for row in rows]


def save_diary(trip_id: str, diary: Diary) -> None:
    if _using_supabase():
        _supabase_request(
            "PATCH",
            "trips",
            params={"trip_id": f"eq.{trip_id}"},
            payload={"diary_json": _dump_model(diary)},
            prefer="return=minimal",
        )
        return

    with _connect() as conn:
        conn.execute(
            "UPDATE trips SET diary_json = ? WHERE trip_id = ?",
            (json.dumps(_dump_model(diary), ensure_ascii=False), trip_id),
        )


def get_diary(trip_id: str) -> Optional[Diary]:
    if _using_supabase():
        row = _supabase_one(
            "trips",
            {"select": "diary_json", "trip_id": f"eq.{trip_id}"},
        )
        if not row or row.get("diary_json") is None:
            return None
        return _load_diary(row["diary_json"])

    with _connect() as conn:
        row = conn.execute("SELECT diary_json FROM trips WHERE trip_id = ?", (trip_id,)).fetchone()
    if not row or row["diary_json"] is None:
        return None
    return _load_diary(row["diary_json"])


def list_trips_with_diaries() -> list[dict]:
    if _using_supabase():
        rows = _supabase_request(
            "GET",
            "trips",
            params={
                "select": "trip_id,meta_json,diary_json",
                "diary_json": "not.is.null",
                "order": "created_at.desc",
            },
        ) or []
        return [
            {
                "trip_id": row["trip_id"],
                "meta": row.get("meta_json") or {},
                "diary": _load_diary(row["diary_json"]),
            }
            for row in rows
        ]

    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT trip_id, meta_json, diary_json
            FROM trips
            WHERE diary_json IS NOT NULL
            ORDER BY rowid DESC
            """
        ).fetchall()

    trips = []
    for row in rows:
        trips.append(
            {
                "trip_id": row["trip_id"],
                "meta": json.loads(row["meta_json"]) if row["meta_json"] else {},
                "diary": _load_diary(row["diary_json"]),
            }
        )
    return trips


def exists(trip_id: str) -> bool:
    if _using_supabase():
        row = _supabase_one(
            "trips",
            {"select": "trip_id", "trip_id": f"eq.{trip_id}"},
        )
        return row is not None

    with _connect() as conn:
        row = conn.execute("SELECT 1 FROM trips WHERE trip_id = ?", (trip_id,)).fetchone()
    return row is not None


def save_photo_feedback(trip_id: str, feedback: PhotoFeedback) -> None:
    if _using_supabase():
        _supabase_request(
            "PATCH",
            "trips",
            params={"trip_id": f"eq.{trip_id}"},
            payload={"photo_feedback_json": _dump_model(feedback)},
            prefer="return=minimal",
        )
        return

    with _connect() as conn:
        conn.execute(
            "UPDATE trips SET photo_feedback_json = ? WHERE trip_id = ?",
            (json.dumps(_dump_model(feedback), ensure_ascii=False), trip_id),
        )


def get_photo_feedback(trip_id: str) -> Optional[PhotoFeedback]:
    if _using_supabase():
        row = _supabase_one(
            "trips",
            {"select": "photo_feedback_json", "trip_id": f"eq.{trip_id}"},
        )
        if not row or row.get("photo_feedback_json") is None:
            return None
        return _load_feedback(row["photo_feedback_json"])

    with _connect() as conn:
        row = conn.execute("SELECT photo_feedback_json FROM trips WHERE trip_id = ?", (trip_id,)).fetchone()
    if not row or row["photo_feedback_json"] is None:
        return None
    return _load_feedback(row["photo_feedback_json"])


def get_latest_trip_id() -> Optional[str]:
    if _using_supabase():
        row = _supabase_one(
            "trips",
            {
                "select": "trip_id",
                "diary_json": "not.is.null",
                "order": "created_at.desc",
            },
        )
        return row["trip_id"] if row else None

    with _connect() as conn:
        row = conn.execute(
            "SELECT trip_id FROM trips WHERE diary_json IS NOT NULL ORDER BY rowid DESC LIMIT 1"
        ).fetchone()
    if not row:
        return None
    return row["trip_id"]
