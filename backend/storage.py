"""여행 저장소.

Supabase 환경변수가 있으면 Postgres(JSON 컬럼)로 저장하고,
없으면 기존 SQLite를 그대로 사용합니다.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from typing import Optional

from . import config
from .models import Diary, LocationPoint, Photo, PhotoFeedback, TripCreate

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None


def _dump_model(model) -> dict:
    return model.model_dump(mode="json")


def _load_photo(data) -> Photo:
    if isinstance(data, str):
        return Photo.model_validate_json(data)
    return Photo.model_validate(data)


def _load_diary(data) -> Diary:
    if isinstance(data, str):
        return Diary.model_validate_json(data)
    return Diary.model_validate(data)


def _load_feedback(data) -> PhotoFeedback:
    if isinstance(data, str):
        return PhotoFeedback.model_validate_json(data)
    return PhotoFeedback.model_validate(data)


def _jsonify(value):
    return json.dumps(value, ensure_ascii=False)


def _parse_json(value):
    if value is None:
        return None
    if isinstance(value, str):
        return json.loads(value)
    return value


def _using_postgres() -> bool:
    return config.DB_BACKEND == "postgres"


def _sqlite_connect() -> sqlite3.Connection:
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def _connect():
    if _using_postgres():
        if psycopg is None:
            raise RuntimeError("psycopg is required when SUPABASE_DB_URL/DATABASE_URL is set")
        conn = psycopg.connect(config.DATABASE_URL)
        try:
            yield conn
        finally:
            conn.close()
    else:
        conn = _sqlite_connect()
        try:
            yield conn
        finally:
            conn.close()


def _ensure_schema() -> None:
    if _using_postgres():
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS trips (
                        trip_id TEXT PRIMARY KEY,
                        meta_json JSONB NOT NULL,
                        diary_json JSONB,
                        photo_feedback_json JSONB,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS locations (
                        id BIGSERIAL PRIMARY KEY,
                        trip_id TEXT NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
                        lat DOUBLE PRECISION NOT NULL,
                        lng DOUBLE PRECISION NOT NULL,
                        time TIMESTAMPTZ NOT NULL,
                        accuracy_m DOUBLE PRECISION
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS photos (
                        id BIGSERIAL PRIMARY KEY,
                        trip_id TEXT NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
                        photo_json JSONB NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS preference_profile (
                        profile_key TEXT PRIMARY KEY,
                        profile_json JSONB NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
            conn.commit()
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

            CREATE TABLE IF NOT EXISTS preference_profile (
                profile_key TEXT PRIMARY KEY,
                profile_json TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )


_ensure_schema()


def create_trip(trip_id: str, trip: TripCreate) -> None:
    payload = _dump_model(trip)
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO trips (trip_id, meta_json, diary_json, photo_feedback_json) VALUES (%s, %s::jsonb, NULL, NULL)",
                    (trip_id, _jsonify(payload)),
                )
            conn.commit()
        else:
            conn.execute(
                "INSERT INTO trips (trip_id, meta_json, diary_json, photo_feedback_json) VALUES (?, ?, NULL, NULL)",
                (trip_id, _jsonify(payload)),
            )


def add_locations(trip_id: str, points: list[LocationPoint]) -> None:
    if not points:
        return
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO locations (trip_id, lat, lng, time, accuracy_m) VALUES (%s, %s, %s, %s, %s)",
                    [(trip_id, point.lat, point.lng, point.time, point.accuracy_m) for point in points],
                )
            conn.commit()
        else:
            conn.executemany(
                "INSERT INTO locations (trip_id, lat, lng, time, accuracy_m) VALUES (?, ?, ?, ?, ?)",
                [
                    (trip_id, point.lat, point.lng, point.time.isoformat(), point.accuracy_m)
                    for point in points
                ],
            )


def get_locations(trip_id: str) -> list[LocationPoint]:
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT lat, lng, time, accuracy_m FROM locations WHERE trip_id = %s ORDER BY time ASC, id ASC",
                    (trip_id,),
                )
                rows = cur.fetchall()
            return [
                LocationPoint(lat=row[0], lng=row[1], time=row[2], accuracy_m=row[3])
                for row in rows
            ]
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
        if _using_postgres():
            with conn.cursor() as cur:
                cur.execute("SELECT meta_json FROM trips WHERE trip_id = %s", (trip_id,))
                row = cur.fetchone()
            return _parse_json(row[0]) if row else {}
        row = conn.execute("SELECT meta_json FROM trips WHERE trip_id = ?", (trip_id,)).fetchone()
    if not row:
        return {}
    return _parse_json(row["meta_json"]) or {}


def add_photos(trip_id: str, photos: list[Photo]) -> None:
    if not photos:
        return
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO photos (trip_id, photo_json) VALUES (%s, %s::jsonb)",
                    [(trip_id, _jsonify(_dump_model(photo))) for photo in photos],
                )
            conn.commit()
        else:
            conn.executemany(
                "INSERT INTO photos (trip_id, photo_json) VALUES (?, ?)",
                [(trip_id, _jsonify(_dump_model(photo))) for photo in photos],
            )


def get_photos(trip_id: str) -> list[Photo]:
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT photo_json FROM photos WHERE trip_id = %s ORDER BY id ASC",
                    (trip_id,),
                )
                rows = cur.fetchall()
            return [_load_photo(row[0]) for row in rows]
        rows = conn.execute(
            "SELECT photo_json FROM photos WHERE trip_id = ? ORDER BY id ASC",
            (trip_id,),
        ).fetchall()
    return [_load_photo(row["photo_json"]) for row in rows]


def save_diary(trip_id: str, diary: Diary) -> None:
    payload = _jsonify(_dump_model(diary))
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE trips SET diary_json = %s::jsonb WHERE trip_id = %s",
                    (payload, trip_id),
                )
            conn.commit()
        else:
            conn.execute(
                "UPDATE trips SET diary_json = ? WHERE trip_id = ?",
                (payload, trip_id),
            )


def get_diary(trip_id: str) -> Optional[Diary]:
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.execute("SELECT diary_json FROM trips WHERE trip_id = %s", (trip_id,))
                row = cur.fetchone()
            if not row or row[0] is None:
                return None
            return _load_diary(row[0])
        row = conn.execute("SELECT diary_json FROM trips WHERE trip_id = ?", (trip_id,)).fetchone()
    if not row or row["diary_json"] is None:
        return None
    return _load_diary(row["diary_json"])


def exists(trip_id: str) -> bool:
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM trips WHERE trip_id = %s", (trip_id,))
                row = cur.fetchone()
            return row is not None
        row = conn.execute("SELECT 1 FROM trips WHERE trip_id = ?", (trip_id,)).fetchone()
    return row is not None


def save_photo_feedback(trip_id: str, feedback: PhotoFeedback) -> None:
    payload = _jsonify(_dump_model(feedback))
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE trips SET photo_feedback_json = %s::jsonb WHERE trip_id = %s",
                    (payload, trip_id),
                )
            conn.commit()
        else:
            conn.execute(
                "UPDATE trips SET photo_feedback_json = ? WHERE trip_id = ?",
                (payload, trip_id),
            )


def get_photo_feedback(trip_id: str) -> Optional[PhotoFeedback]:
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.execute("SELECT photo_feedback_json FROM trips WHERE trip_id = %s", (trip_id,))
                row = cur.fetchone()
            if not row or row[0] is None:
                return None
            return _load_feedback(row[0])
        row = conn.execute("SELECT photo_feedback_json FROM trips WHERE trip_id = ?", (trip_id,)).fetchone()
    if not row or row["photo_feedback_json"] is None:
        return None
    return _load_feedback(row["photo_feedback_json"])


def get_latest_trip_id() -> Optional[str]:
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.execute("SELECT trip_id FROM trips ORDER BY created_at DESC LIMIT 1")
                row = cur.fetchone()
            return row[0] if row else None
        row = conn.execute("SELECT trip_id FROM trips ORDER BY rowid DESC LIMIT 1").fetchone()
    if not row:
        return None
    return row["trip_id"]


def get_preference_profile(profile_key: str = "default") -> dict:
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT profile_json FROM preference_profile WHERE profile_key = %s",
                    (profile_key,),
                )
                row = cur.fetchone()
            return _parse_json(row[0]) if row else {}
        row = conn.execute(
            "SELECT profile_json FROM preference_profile WHERE profile_key = ?",
            (profile_key,),
        ).fetchone()
    if not row:
        return {}
    return _parse_json(row["profile_json"]) or {}


def save_preference_profile(profile: dict, profile_key: str = "default") -> None:
    payload = _jsonify(profile)
    with _connect() as conn:
        if _using_postgres():
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO preference_profile (profile_key, profile_json, updated_at)
                    VALUES (%s, %s::jsonb, NOW())
                    ON CONFLICT (profile_key)
                    DO UPDATE SET profile_json = EXCLUDED.profile_json, updated_at = NOW()
                    """,
                    (profile_key, payload),
                )
            conn.commit()
        else:
            conn.execute(
                """
                INSERT INTO preference_profile (profile_key, profile_json, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(profile_key)
                DO UPDATE SET profile_json = excluded.profile_json, updated_at = CURRENT_TIMESTAMP
                """,
                (profile_key, payload),
            )


def update_preference_profile_from_feedback(photos: list[Photo], feedback: PhotoFeedback) -> dict:
    profile = get_preference_profile()
    accepted_ids = set(feedback.accepted_photo_ids)
    rejected_ids = set(feedback.rejected_photo_ids)
    accepted = [p for p in photos if p.photo_id in accepted_ids]
    rejected = [p for p in photos if p.photo_id in rejected_ids]
    if not accepted and not rejected:
        return profile

    features = [
        "quality_score",
        "composition_score",
        "face_hint_score",
        "resolution_score",
        "exposure_score",
        "backlight_score",
        "saturation_score",
        "edge_balance_score",
    ]

    def avg(items, attr):
        values = [getattr(p, attr) for p in items if getattr(p, attr) is not None]
        return sum(values) / len(values) if values else 0.0

    def update_weight(name: str, accepted_val: float, rejected_val: float) -> None:
        delta = accepted_val - rejected_val
        weights = profile.setdefault("weights", {})
        current = float(weights.get(name, 0.0))
        # EMA-like update so repeated feedback accumulates instead of overwriting.
        weights[name] = round(current * 0.7 + delta * 0.3, 4)

    def update_theme_weight(name: str, accepted_val: float, rejected_val: float) -> None:
        delta = accepted_val - rejected_val
        themes = profile.setdefault("themes", {})
        current = float(themes.get(name, 0.0))
        themes[name] = round(current * 0.7 + delta * 0.3, 4)

    for feature in features:
        update_weight(feature, avg(accepted, feature), avg(rejected, feature))

    accepted_theme = _theme_summary(accepted)
    rejected_theme = _theme_summary(rejected)
    for theme in ("person", "landscape", "food"):
        update_theme_weight(theme, accepted_theme.get(theme, 0.0), rejected_theme.get(theme, 0.0))

    stats = profile.setdefault("stats", {})
    stats["samples"] = int(stats.get("samples", 0)) + len(accepted) + len(rejected)
    stats["accepted"] = int(stats.get("accepted", 0)) + len(accepted)
    stats["rejected"] = int(stats.get("rejected", 0)) + len(rejected)
    save_preference_profile(profile)
    return profile


def _theme_summary(items: list[Photo]) -> dict[str, float]:
    if not items:
        return {"person": 0.0, "landscape": 0.0, "food": 0.0}

    total = len(items)
    person = 0.0
    landscape = 0.0
    food = 0.0
    for photo in items:
        face = photo.face_hint_score or 0.0
        composition = photo.composition_score or 0.0
        saturation = photo.saturation_score or 0.0
        width = float(photo.width or 0)
        height = float(photo.height or 0)
        aspect = width / height if width and height else 1.0

        person += min(1.0, face * 1.2)
        landscape += max(0.0, 1.0 - face) * (1.0 if aspect >= 1.1 else 0.6) * (0.5 + composition * 0.5)
        food += max(0.0, 1.0 - face) * (0.5 + saturation * 0.5) * (0.9 if 0.8 <= aspect <= 1.35 else 0.6)

    return {
        "person": person / total,
        "landscape": landscape / total,
        "food": food / total,
    }
