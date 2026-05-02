"""Placeholder pytest module. Real tests TODO."""

from pathlib import Path

import pytest

from src.pipeline import FootballPipeline


def test_pipeline_initially_unloaded() -> None:
    p = FootballPipeline(Path("./weights/yolo.pt"))
    assert p.is_loaded is False


def test_pipeline_run_raises_not_implemented(tmp_path: Path) -> None:
    p = FootballPipeline(Path("./weights/yolo.pt"))
    with pytest.raises(NotImplementedError):
        p.run(tmp_path / "fake.mp4", match_id="test-match")
