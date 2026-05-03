"""Placeholder pytest module for FootballPipeline.

Real end-to-end behavior is exercised by hitting POST /process-sync — those
tests need a GPU + a real video and live in the integration suite (TODO).
"""

from src.pipeline import FootballPipeline


def test_pipeline_initially_unloaded() -> None:
    p = FootballPipeline(model_name="yolo11n.pt", confidence=0.3)
    assert p.is_loaded is False


def test_pipeline_constructor_defaults() -> None:
    p = FootballPipeline()
    assert p.model_name == "yolo11n.pt"
    assert p.confidence == 0.3
    assert p.is_loaded is False
