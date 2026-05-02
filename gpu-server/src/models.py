"""Pydantic request/response schemas for the GPU server."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, model_validator


class JobState(str, Enum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class HealthResponse(BaseModel):
    status: str = "ok"
    gpu_available: bool
    model_loaded: bool


class ProcessRequest(BaseModel):
    """Request body for POST /process and POST /process-sync."""

    match_id: str = Field(..., description="Backend match ID; echoed in callbacks")
    youtube_url: str | None = Field(default=None, description="If set, download via yt-dlp")
    video_path: str | None = Field(default=None, description="Path to a pre-uploaded video")
    callback_url: str | None = Field(
        default=None,
        description="Optional webhook URL that receives the final result",
    )

    @model_validator(mode="after")
    def _exactly_one_source(self) -> ProcessRequest:
        if bool(self.youtube_url) == bool(self.video_path):
            raise ValueError("Provide exactly one of youtube_url or video_path")
        return self


class ProcessResponse(BaseModel):
    job_id: str
    status: JobState


class JobStatus(BaseModel):
    job_id: str
    match_id: str
    status: JobState
    progress_pct: int = 0
    error: str | None = None
    result: dict[str, Any] | None = None


class TrackingResult(BaseModel):
    """Final structured output of the pipeline (passed back via callback)."""

    match_id: str
    duration_seconds: float
    events: list[dict[str, Any]] = Field(default_factory=list)
    players: list[dict[str, Any]] = Field(default_factory=list)
