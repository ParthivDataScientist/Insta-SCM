"""Unit tests for pure date-window math used in resource availability."""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace

from app.services.availability import (
    _build_available_windows,
    _get_project_window,
    _ranges_overlap,
)


class TestRangeOverlap:
    """``_ranges_overlap`` drives conflict detection for parallel assignments."""

    def test_overlapping_ranges(self) -> None:
        assert _ranges_overlap(
            date(2026, 1, 1),
            date(2026, 1, 10),
            date(2026, 1, 5),
            date(2026, 1, 15),
        )

    def test_disjoint_ranges(self) -> None:
        assert not _ranges_overlap(
            date(2026, 1, 1),
            date(2026, 1, 2),
            date(2026, 1, 5),
            date(2026, 1, 10),
        )

    def test_open_ended_right_overlaps(self) -> None:
        assert _ranges_overlap(
            date(2026, 2, 1),
            None,
            date(2026, 1, 15),
            date(2026, 2, 5),
        )


def _project(
    *,
    allocation_start: date | None = None,
    allocation_end: date | None = None,
    dispatch: date | None = None,
    dismantle: date | None = None,
    event_start: date | None = None,
    event_end: date | None = None,
    stage: str = "Win",
) -> SimpleNamespace:
    return SimpleNamespace(
        allocation_start_date=allocation_start,
        allocation_end_date=allocation_end,
        dispatch_date=dispatch,
        dismantling_date=dismantle,
        event_start_date=event_start,
        event_end_date=event_end,
        stage=stage,
    )


class TestAvailableWindows:
    """``_build_available_windows`` merges busy intervals then inverts to free slots."""

    def test_gap_between_busy_blocks(self) -> None:
        projects = [
            _project(allocation_start=date(2026, 3, 1), allocation_end=date(2026, 3, 5)),
            _project(allocation_start=date(2026, 3, 10), allocation_end=date(2026, 3, 12)),
        ]
        windows = _build_available_windows(projects, anchor_start=date(2026, 3, 1))
        assert len(windows) >= 1
        gap = next(w for w in windows if w["start_date"] == date(2026, 3, 6))
        assert gap["end_date"] == date(2026, 3, 9)
        assert gap["days"] == 4

    def test_inverts_end_when_before_start(self) -> None:
        p = _project(
            allocation_start=date(2026, 4, 10),
            allocation_end=date(2026, 4, 1),
        )
        start, end = _get_project_window(p)
        assert start == date(2026, 4, 10)
        assert end == date(2026, 4, 10)
