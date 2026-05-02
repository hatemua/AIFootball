"""YOLO + ByteTrack pipeline. Skeleton — body to be implemented."""

from __future__ import annotations

import logging
from pathlib import Path

from .models import TrackingResult

logger = logging.getLogger(__name__)


class FootballPipeline:
    """Wraps YOLO detection + ByteTrack tracking for football match video.

    Lifecycle:
      pipeline = FootballPipeline(model_path)
      pipeline.load()                   # one-time, expensive
      result = pipeline.run(video_path) # per-video
    """

    def __init__(self, model_path: Path) -> None:
        self.model_path = model_path
        self._model = None  # lazily loaded; type Any for now

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        """Load YOLO weights into memory. Idempotent."""
        if self.is_loaded:
            return
        # TODO: load Ultralytics YOLO model
        # from ultralytics import YOLO
        # self._model = YOLO(str(self.model_path))
        logger.info("TODO: load YOLO model from %s", self.model_path)

    def run(self, video_path: Path, match_id: str) -> TrackingResult:
        """Process a video end-to-end and return structured tracking output."""
        if not self.is_loaded:
            self.load()
        # TODO:
        #  1. Open video with cv2.VideoCapture
        #  2. Frame-by-frame: YOLO detect → supervision.ByteTrack update
        #  3. Aggregate events (passes, shots, sprints, possession)
        #  4. Compute per-player stats
        raise NotImplementedError("YOLO + ByteTrack pipeline not implemented yet")
