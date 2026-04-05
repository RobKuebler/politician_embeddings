"""Shared helpers for exporting frontend JSON payloads."""

from __future__ import annotations

import json
import math
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    import logging
    from pathlib import Path


def period_output_dir(output_dir: Path, period: int) -> Path:
    """Return the output subdirectory for a period, creating it if needed."""
    target = output_dir / str(period)
    target.mkdir(exist_ok=True)
    return target


def sanitize_json_data(obj: object) -> object:
    """Recursively replace float NaN/inf with None for JSON output."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {key: sanitize_json_data(value) for key, value in obj.items()}
    if isinstance(obj, list):
        return [sanitize_json_data(value) for value in obj]
    return obj


def write_json(
    path: Path,
    data: object,
    *,
    log: logging.Logger | None = None,
) -> None:
    """Write sanitized JSON data; create parent dirs if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(sanitize_json_data(data), ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    if log is not None:
        log.info("Wrote %s (%.1f KB)", path, path.stat().st_size / 1024)


def clean_matrix(arr: np.ndarray, precision: int) -> list:
    """Convert a 2D numpy array to a nested list, replacing NaN with None."""
    return [
        [None if np.isnan(value) else round(float(value), precision) for value in row]
        for row in arr.tolist()
    ]


def split_topics(value: object) -> list[str]:
    """Split pipe-separated topic strings into a list."""
    if not isinstance(value, str):
        return []
    return [topic.strip() for topic in value.split("|") if topic.strip()]
