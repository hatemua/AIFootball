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
    gpu_name: str | None = None
    pytorch_version: str | None = None


class ProcessRequest(BaseModel):
    """Request body for POST /process and POST /process-sync."""

    match_id: str = Field(..., description="Backend match ID; echoed in callbacks")
    youtube_url: str | None = Field(default=None, description="If set, download via yt-dlp")
    video_url: str | None = Field(
        default=None, description="Direct HTTP/HTTPS URL to a video file"
    )
    video_path: str | None = Field(default=None, description="Path to a pre-uploaded video")
    callback_url: str | None = Field(
        default=None,
        description="Optional webhook URL that receives the final result",
    )

    @model_validator(mode="after")
    def _exactly_one_source(self) -> ProcessRequest:
        sources = [self.youtube_url, self.video_url, self.video_path]
        if sum(1 for s in sources if s) != 1:
            raise ValueError(
                "Provide exactly one of youtube_url, video_url, or video_path"
            )
        return self

    @property
    def source_url(self) -> str:
        return self.youtube_url or self.video_url or self.video_path  # type: ignore[return-value]


class ProcessResponse(BaseModel):
    job_id: str
    status: JobState


class ProcessSyncResponse(BaseModel):
    """Response body for POST /process-sync."""

    match_id: str
    status: str
    s3_keys: dict[str, str]
    signed_urls: dict[str, str]
    stats: dict[str, Any]
    processing_time_seconds: float


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
