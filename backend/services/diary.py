"""제목·문구 생성과 AI 실패 시 대체. (소유: 5번 다이어리 생성)

타임라인 각 엔트리에 짧은 문구를 붙이고, 전체 여행 제목을 만듭니다.
AI 키가 설정돼 있으면 AI 문구를, 없거나 실패하면 규칙 기반 대체 문장을 씁니다.

개인정보: AI API 에는 최소 데이터만 전달하고, 키는 서버에서만 사용합니다.
"""
from __future__ import annotations

import re

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
    """여행 제목 생성: 특정 사진이 아니라 전체 스팟을 보고 짓는다.

    - 가장 자주 등장한 장소(최빈)를 앵커로 사용
    - 여행이 5시간 이상 이어졌으면 '~에서의 하루'
    """
    from collections import Counter

    skip = {"이동 중", "장소 미정", "정차 지점"}
    places = [
        e.place.split(",")[0].strip()
        for e in entries
        if e.place and e.place not in skip
    ]
    if places:
        anchor = Counter(places).most_common(1)[0][0]
        times = sorted(e.time for e in entries if e.time)
        span_h = (
            (times[-1] - times[0]).total_seconds() / 3600 if len(times) >= 2 else 0
        )
        return f"{anchor}에서의 하루" if span_h >= 5 else f"{anchor} 여행 기록"
    if region:
        return f"{region} 여행 기록"
    return "여행 기록"


def _try_ai_notes(entries: list[TimelineEntry]):
    """Claude 비전으로 사진을 실제로 '보고' 사람처럼 메모 초안을 쓴다.

    사진 속 랜드마크·건물·음식·날씨·분위기·표정을 장소명/시각과 엮어
    관찰형 한국어 메모를 만든다. AI_API_KEY 가 없거나 호출이 실패하면
    None 을 반환해 규칙 기반 fallback 이 쓰이게 한다.
    """
    from .. import config

    if not config.AI_API_KEY:
        return None
    try:
        return _generate_vision_notes(entries, config)
    except Exception:
        return None


def _generate_vision_notes(entries: list[TimelineEntry], config) -> list[str] | None:
    import base64
    import io
    import json

    import anthropic
    from PIL import Image, ImageOps

    # 각 엔트리의 사진을 축소 JPEG(base64)로 준비
    content: list[dict] = []
    valid_index: list[int] = []  # content 에 실린 엔트리의 원본 인덱스
    for i, e in enumerate(entries):
        if not e.photo_url:
            continue
        filename = e.photo_url.rsplit("/", 1)[-1]
        path = config.UPLOAD_DIR / filename
        if not path.exists():
            continue
        try:
            with Image.open(path) as img:
                rgb = ImageOps.exif_transpose(img).convert("RGB")
                rgb.thumbnail((768, 768), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                rgb.save(buf, format="JPEG", quality=80)
            data = base64.standard_b64encode(buf.getvalue()).decode("utf-8")
        except Exception:
            continue

        place = _clean_place(e.place)
        clock = _clock_text(e).lstrip(", ") or "시각 미상"
        content.append({"type": "text", "text": f"[사진 {len(valid_index) + 1}] 장소: {place} / 시각: {clock}"})
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": data},
        })
        valid_index.append(i)

    if not valid_index:
        return None

    content.append({
        "type": "text",
        "text": (
            "너는 여행 다이어리의 메모 초안을 쓰는 작가다. 위 사진들을 각각 실제로 관찰해서, "
            "사진마다 한국어 메모 초안을 1~2문장으로 써라.\n"
            "- 사진에서 실제로 보이는 것(랜드마크나 유명 장소가 보이면 그 이름, 건물, 음식, 날씨, 계절감, "
            "실내/야외, 분위기, 사람의 표정이나 몸짓)을 장소명·시각과 자연스럽게 엮어라.\n"
            "- 사람이 직접 쓴 것처럼 담백한 관찰체('~했다', '~이다')로. 감탄사, 과장, "
            "'소중한 순간' 같은 상투어, AI 티 나는 문구 금지.\n"
            "- 사진에 없는 것을 지어내지 마라. 확실하지 않은 랜드마크 이름은 쓰지 마라.\n"
            f"- 사진 수는 {len(valid_index)}장이다. notes 배열 길이도 정확히 {len(valid_index)}이어야 한다."
        ),
    })

    client = anthropic.Anthropic(api_key=config.AI_API_KEY)
    response = client.with_options(timeout=60.0, max_retries=1).messages.create(
        model="claude-opus-4-8",
        max_tokens=2000,
        output_config={
            "format": {
                "type": "json_schema",
                "schema": {
                    "type": "object",
                    "properties": {
                        "notes": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["notes"],
                    "additionalProperties": False,
                },
            }
        },
        messages=[{"role": "user", "content": content}],
    )

    text = next((b.text for b in response.content if b.type == "text"), "")
    notes = json.loads(text).get("notes", [])
    if not notes:
        return None

    # valid_index 기준으로 전체 엔트리 길이의 리스트로 재배열 (빠진 사진은 None → fallback)
    result: list[str | None] = [None] * len(entries)
    for j, idx in enumerate(valid_index):
        if j < len(notes) and isinstance(notes[j], str) and notes[j].strip():
            result[idx] = notes[j].strip()
    return result


def _fallback_note(entry: TimelineEntry) -> str:
    """장소·시간을 바탕으로 담백한 초안 메모를 만든다.

    여행 앱의 기본 문구는 쉽게 과장되기 때문에 감탄사, 감정 단정,
    "소중한 순간" 같은 상투어를 피하고 사용자가 고쳐 쓰기 쉬운
    관찰형 문장으로 제한한다.
    """
    place = _clean_place(entry.place)
    part = _time_of_day(entry)
    time_text = _clock_text(entry)
    if place == "이동 중":
        return f"{part}, 이동하는 길 위에서 남긴 한 장면."

    # 안내 문구("이어서 적어 보세요" 류)는 넣지 않는다 — 프런트가 회색 힌트로 따로 보여준다.
    templates = [
        f"{part}의 {place}{time_text}. 잠시 걸음을 멈춘 자리.",
        f"{place}, {part}{time_text}. 발자취가 이 지점에 머물렀다.",
        f"{part}에 들른 {place}{time_text}.",
    ]
    return templates[_template_index(entry, len(templates))]


def _clock_text(entry: TimelineEntry) -> str:
    """', 오후 2:30' 형태의 시각 표기. 시간이 없으면 빈 문자열."""
    try:
        h, m = entry.time.hour, entry.time.minute
    except Exception:
        return ""
    meridiem = "오전" if h < 12 else "오후"
    h12 = h % 12 or 12
    return f", {meridiem} {h12}:{m:02d}"


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


def _clean_place(place: str) -> str:
    text = (place or "").strip()
    if not text or text in {"장소 미정", "정차 지점"}:
        return "이곳"
    text = re.sub(r"\s+", " ", text)
    # Mapbox 전체 주소가 들어오면 첫 지명만 써서 문장이 길어지지 않게 한다.
    return text.split(",")[0].strip() or "이곳"


def _template_index(entry: TimelineEntry, size: int) -> int:
    if size <= 1:
        return 0
    key = f"{entry.place}|{entry.time.isoformat() if entry.time else ''}"
    return sum(ord(ch) for ch in key) % size
