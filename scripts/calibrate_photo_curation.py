"""Photo curation calibration helper.

Scan a folder of photos, score them with the current pipeline, and print a
compact report so we can tune thresholds against real samples.
"""
from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

from backend.services.dedupe import group as group_similar_photos
from backend.services.exif import extract as extract_photo
from backend.services.quality import score as score_photo
from backend.services.selector import select as select_photos


def iter_image_files(folder: Path) -> list[Path]:
    exts = {".jpg", ".jpeg", ".png", ".heic", ".heif"}
    return sorted(
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in exts
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "folder",
        nargs="?",
        default="uploads/pic",
        help="Folder containing the sample photos.",
    )
    parser.add_argument(
        "--max-count",
        type=int,
        default=8,
        help="How many representative photos to print.",
    )
    args = parser.parse_args()

    folder = Path(args.folder).expanduser().resolve()
    if not folder.exists():
        raise SystemExit(f"Folder not found: {folder}")

    files = iter_image_files(folder)
    if not files:
        raise SystemExit(f"No image files found in: {folder}")

    photos = [extract_photo(path) for path in files]
    for photo in photos:
        path = folder / photo.filename
        score_photo(photo, path)

    paths = {photo.photo_id: folder / photo.filename for photo in photos}
    photos = group_similar_photos(photos, paths)
    selected = select_photos(photos, max_count=args.max_count)

    scores = [p.quality_score or 0.0 for p in photos]
    print(f"folder: {folder}")
    print(f"images: {len(files)}")
    print(f"score_min: {min(scores):.3f}")
    print(f"score_avg: {sum(scores) / len(scores):.3f}")
    print(f"score_max: {max(scores):.3f}")
    print(f"group_count: {len(set(p.group_id for p in photos))}")
    print(f"selected_count: {len(selected)}")
    print()

    print("top-selected:")
    for item in selected:
        match = next((p for p in photos if p.photo_id == item.photo_id), None)
        score = match.quality_score if match else None
        group_id = match.group_id if match else None
        print(f"- {item.reason} | score={score:.3f} | group={group_id} | url={item.photo_url}")

    print()
    print("score-histogram:")
    buckets = Counter(int((p.quality_score or 0.0) * 10) for p in photos)
    for bucket in range(10, -1, -1):
        count = buckets.get(bucket, 0)
        low = bucket / 10
        high = min(1.0, low + 0.1)
        print(f"{low:.1f}-{high:.1f}: {'#' * count} ({count})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
