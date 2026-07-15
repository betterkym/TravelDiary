"""제목·문구 생성과 AI 실패 시 대체. (소유: 5번 다이어리 생성)

타임라인 각 엔트리에 짧은 문구를 붙이고, 전체 여행 제목을 만듭니다.
AI 호출이 실패하면 규칙 기반 대체 문장으로 넘어갑니다(fallback).

개인정보: AI API 에는 결과 생성에 필요한 최소 데이터만 전달합니다.
AI 키는 서버에서만 사용합니다(config.AI_API_KEY).
"""
from __future__ import annotations

from ..models import TimelineEntry


def annotate(entries: list[TimelineEntry]) -> list[TimelineEntry]:
    """각 엔트리의 note 를 채워 반환.

    TODO(5번):
      - prompts/curator.txt 로 AI 문구 생성
      - 실패/키없음 시 _fallback_note 로 대체
    현재는 항상 fallback 문구를 사용합니다.
    """
    for e in entries:
        if not e.note:
            e.note = _fallback_note(e)
    return entries


def make_title(entries: list[TimelineEntry], region: str = "") -> str:
    """여행 제목 생성. 현재는 지역 기반 fallback."""
    if region:
        return f"{region} 여행 기록"
    return "여행 기록"


def _fallback_note(entry: TimelineEntry) -> str:
    place = entry.place or "이곳"
    return f"{place}에서의 순간"
