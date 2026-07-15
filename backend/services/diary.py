"""제목·문구 생성과 AI 실패 시 대체. (소유: 5번 다이어리 생성)

타임라인 각 엔트리에 짧은 문구를 붙이고, 전체 여행 제목을 만듭니다.
AI 키가 설정돼 있으면 AI 문구를, 없거나 실패하면 규칙 기반 대체 문장을 씁니다.

개인정보: AI API 에는 최소 데이터만 전달하고, 키는 서버에서만 사용합니다.
"""
from __future__ import annotations

from ..models import TimelineEntry


def annotate(entries: list[TimelineEntry]) -> list[TimelineEntry]:
    """각 엔트리의 note 를 채워 반환."""
    ai_notes = _try_ai_notes(entries)   # 실패하면 None
    for i, e in enumerate(entries):
        if e.note:
            continue
        if ai_notes and i < len(ai_notes) and ai_notes[i]:
            e.note = ai_notes[i]
        else:
            e.note = _fallback_note(e)
    return entries


def make_title(entries: list[TimelineEntry], region: str = "") -> str:
    """여행 제목 생성. AI 없으면 지역/장소 기반 fallback."""
    if region:
        return f"{region} 여행 기록"
    for e in entries:
        if e.place and e.place not in ("이동 중", "장소 미정", "정차 지점"):
            return f"{e.place} 여행 기록"
    return "여행 기록"


def _try_ai_notes(entries: list[TimelineEntry]):
    """AI 문구 생성 훅. 키가 없으면 조용히 None (fallback 사용).

    TODO(5번): config.AI_API_KEY 로 실제 AI SDK 호출 후 notes 리스트 반환.
    지금은 키 유무만 확인하고, 실제 호출은 붙이지 않았습니다(외부 의존).
    """
    from .. import config

    if not config.AI_API_KEY:
        return None
    # 실제 SDK 연동 전까지는 fallback 을 쓰도록 None 반환
    return None


def _fallback_note(entry: TimelineEntry) -> str:
    """촬영 시간대 + 장소로 만드는 규칙 기반 한 줄 문구."""
    place = entry.place if entry.place and entry.place != "장소 미정" else "이곳"
    part = _time_of_day(entry)
    if place == "이동 중":
        return f"{part} 이동하며 남긴 한 컷"
    return f"{part} {place}에서의 순간"


def _time_of_day(entry: TimelineEntry) -> str:
    try:
        h = entry.time.hour
    except Exception:
        return "여행 중"
    if 5 <= h < 11:
        return "아침"
    if 11 <= h < 15:
        return "한낮"
    if 15 <= h < 18:
        return "오후"
    if 18 <= h < 21:
        return "저녁"
    return "밤"
