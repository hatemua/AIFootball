"""YOLO + ByteTrack pipeline for football match video."""

from __future__ import annotations

import logging
import subprocess
import time
from pathlib import Path
from typing import Any

import cv2

logger = logging.getLogger(__name__)


class FootballPipeline:
    """YOLO detection + ByteTrack identity persistence.

    Lifecycle:
      pipeline = FootballPipeline(model_name="yolo11n.pt")
      pipeline.load()                                       # one-time, expensive
      result = pipeline.process(in_path, out_path, match_id)
    """

    def __init__(self, model_name: str = "yolo11n.pt", confidence: float = 0.3) -> None:
        self.model_name = model_name
        self.confidence = confidence
        self._model: Any = None  # ultralytics.YOLO; typed Any to avoid heavy import here

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        """Load YOLO weights into GPU memory. Idempotent."""
        if self.is_loaded:
            return
        from ultralytics import YOLO

        logger.info("Loading YOLO model %s", self.model_name)
        self._model = YOLO(self.model_name)
        logger.info("YOLO model loaded")

    def process(
        self,
        video_path: str,
        output_video_path: str,
        match_id: str,
    ) -> dict[str, Any]:
        """Run YOLO + ByteTrack on the video and write an annotated MP4.

        Returns ``{"tracking_data": [...], "stats": {...}}``.
        """
        if not self.is_loaded:
            raise RuntimeError("Pipeline not loaded — call load() first")

        in_path = Path(video_path)
        if not in_path.exists():
            raise FileNotFoundError(f"Input video not found: {video_path}")

        logger.info("Processing match %s: %s", match_id, video_path)
        start = time.perf_counter()

        # Read video metadata
        cap = cv2.VideoCapture(str(in_path))
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration = total_frames / fps if fps > 0 else 0.0
        cap.release()

        # YOLO save target — ultralytics writes to ``project/name/<input_basename>``
        out_path = Path(output_video_path)
        out_dir = out_path.parent
        out_dir.mkdir(parents=True, exist_ok=True)
        run_name = f"match_{match_id}"

        tracking_data: list[dict[str, Any]] = []
        unique_track_ids: set[int] = set()
        total_detections = 0

        results = self._model.track(
            source=str(in_path),
            tracker="bytetrack.yaml",
            classes=[0, 32],            # COCO: 0=person, 32=sports ball
            conf=self.confidence,
            persist=True,
            save=True,
            project=str(out_dir),
            name=run_name,
            stream=True,                # memory-safe for long videos
            verbose=False,
        )

        for frame_idx, result in enumerate(results):
            if result.boxes is None or result.boxes.id is None:
                continue

            timestamp = frame_idx / fps if fps > 0 else 0.0
            boxes = result.boxes.xywh.cpu().numpy()
            ids = result.boxes.id.cpu().numpy()
            classes = result.boxes.cls.cpu().numpy()
            confidences = result.boxes.conf.cpu().numpy()

            for box, track_id, cls, conf in zip(boxes, ids, classes, confidences):
                x_center, y_center, w, h = box
                tid = int(track_id)
                tracking_data.append(
                    {
                        "frame": frame_idx,
                        "timestamp_seconds": round(float(timestamp), 3),
                        "track_id": tid,
                        "class": "person" if int(cls) == 0 else "ball",
                        "x": round(float(x_center), 2),
                        "y": round(float(y_center), 2),
                        "width": round(float(w), 2),
                        "height": round(float(h), 2),
                        "confidence": round(float(conf), 3),
                    }
                )
                unique_track_ids.add(tid)
                total_detections += 1

        # Re-encode the YOLO output to a browser-friendly H.264 MP4 with faststart
        run_dir = out_dir / run_name
        source_video = self._find_yolo_output(run_dir)
        if source_video is None:
            raise RuntimeError(f"YOLO produced no video in {run_dir}")
        self._reencode_h264(source_video, out_path)

        processing_time = time.perf_counter() - start
        stats = {
            "total_frames": total_frames,
            "total_detections": total_detections,
            "unique_track_ids": len(unique_track_ids),
            "video_duration_seconds": round(duration, 2),
            "fps": round(fps, 2),
            "processing_time_seconds": round(processing_time, 2),
            "realtime_factor": round(duration / processing_time, 2) if processing_time > 0 else 0,
        }
        logger.info("Pipeline complete for %s: %s", match_id, stats)

        return {"tracking_data": tracking_data, "stats": stats}

    @staticmethod
    def _find_yolo_output(run_dir: Path) -> Path | None:
        """Locate the saved annotated video — prefer mp4, fall back to avi."""
        for pattern in ("*.mp4", "*.avi"):
            matches = sorted(run_dir.glob(pattern))
            if matches:
                return matches[0]
        return None

    @staticmethod
    def _reencode_h264(source: Path, dest: Path) -> None:
        cmd = [
            "ffmpeg", "-y", "-i", str(source),
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-movflags", "+faststart",
            str(dest),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            tail = (result.stderr or "")[-2000:]
            raise RuntimeError(f"ffmpeg re-encode failed: {tail}")
