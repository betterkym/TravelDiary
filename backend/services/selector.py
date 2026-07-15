"""대표사진 선별. (소유: 4번 사진 분석·선별)

품질점수와 유사그룹을 바탕으로 대표사진을 최대 8장 고릅니다.
사진 파이프라인의 마지막 단계입니다: exif -> quality -> dedupe -> selector.

완료 기준: 대표사진 최대 8장을 선택 이유와 함께 반환.
"""
from __future__ import annotations

from .. import config
from ..models import Photo, SelectedPhoto


def select(photos: list[Photo], max_count: int = config.MAX_SELECTED_PHOTOS) -> list[SelectedPhoto]:
    """그룹별 최고 품질 1장 -> 상위 max_count 장.

    TODO(4번):
      - 그룹마다 quality_score 가 가장 높은 사진만 후보로
      - 후보를 품질순 정렬 후 상위 max_count 장 선택
      - reason 에 선택 근거(품질/유일성 등) 기록
    현재는 앞에서부터 max_count 장을 그대로 고르는 통과 구현입니다.
    """
    selected: list[SelectedPhoto] = []
    for p in photos[:max_count]:
        selected.append(
            SelectedPhoto(
                photo_id=p.photo_id,
                photo_url=f"/outputs/{p.filename}",
                reason="stub: 순서대로 선택",
            )
        )
    return selected
