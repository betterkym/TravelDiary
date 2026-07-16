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

from . import config
from .models import Diary, LocationPoint, Photo, PhotoFeedback, TripCreate


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _ensure_schema() -> None:
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


def _load_photo(data: str) -> Photo:
    return Photo.model_validate_json(data)


def _load_diary(data: str) -> Diary:
    return Diary.model_validate_json(data)


def _load_feedback(data: str) -> PhotoFeedback:
    return PhotoFeedback.model_validate_json(data)


def create_trip(trip_id: str, trip: TripCreate) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO trips (trip_id, meta_json, diary_json, photo_feedback_json) VALUES (?, ?, NULL, NULL)",
            (trip_id, json.dumps(_dump_model(trip), ensure_ascii=False)),
        )


def add_locations(trip_id: str, points: list[LocationPoint]) -> None:
    if not points:
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
    with _connect() as conn:
        row = conn.execute("SELECT meta_json FROM trips WHERE trip_id = ?", (trip_id,)).fetchone()
    if not row:
        return {}
    return json.loads(row["meta_json"])


def add_photos(trip_id: str, photos: list[Photo]) -> None:
    if not photos:
        return
    with _connect() as conn:
        conn.executemany(
            "INSERT INTO photos (trip_id, photo_json) VALUES (?, ?)",
            [(trip_id, json.dumps(_dump_model(photo), ensure_ascii=False)) for photo in photos],
        )


def get_photos(trip_id: str) -> list[Photo]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT photo_json FROM photos WHERE trip_id = ? ORDER BY id ASC",
            (trip_id,),
        ).fetchall()
    return [_load_photo(row["photo_json"]) for row in rows]


def save_diary(trip_id: str, diary: Diary) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE trips SET diary_json = ? WHERE trip_id = ?",
            (json.dumps(_dump_model(diary), ensure_ascii=False), trip_id),
        )


def get_diary(trip_id: str) -> Optional[Diary]:
    with _connect() as conn:
        row = conn.execute("SELECT diary_json FROM trips WHERE trip_id = ?", (trip_id,)).fetchone()
    if not row or row["diary_json"] is None:
        return None
    return _load_diary(row["diary_json"])


def list_trips_with_diaries() -> list[dict]:
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
    with _connect() as conn:
        row = conn.execute("SELECT 1 FROM trips WHERE trip_id = ?", (trip_id,)).fetchone()
    return row is not None


def save_photo_feedback(trip_id: str, feedback: PhotoFeedback) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE trips SET photo_feedback_json = ? WHERE trip_id = ?",
            (json.dumps(_dump_model(feedback), ensure_ascii=False), trip_id),
        )


def get_photo_feedback(trip_id: str) -> Optional[PhotoFeedback]:
    with _connect() as conn:
        row = conn.execute("SELECT photo_feedback_json FROM trips WHERE trip_id = ?", (trip_id,)).fetchone()
    if not row or row["photo_feedback_json"] is None:
        return None
    return _load_feedback(row["photo_feedback_json"])


def get_latest_trip_id() -> Optional[str]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT trip_id FROM trips ORDER BY rowid DESC LIMIT 1"
        ).fetchone()
    if not row:
        return None
    return row["trip_id"]
