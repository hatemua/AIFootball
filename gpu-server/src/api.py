"""FastAPI app exposing the GPU pipeline over HTTP."""

from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import FastAPI, HTTPException

from .config import settings
from .models import (
    HealthResponse,
    JobState,
    JobStatus,
    ProcessRequest,
    ProcessResponse,
)
from .pipeline import FootballPipeline
from .storage import storage

logging.basicConfig(
    level=settings.log_level,
    format='{"level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="football-pipeline GPU server",
    version="0.1.0",
    description="YOLO + ByteTrack processing for football match videos.",
)

# Singleton pipeline; loaded lazily on first request.
pipeline = FootballPipeline(settings.model_path)

# In-memory job registry. TODO: swap for Redis or a sqlite file once
# multi-worker concurrency matters.
JOBS: dict[str, JobStatus] = {}


def _gpu_available() -> bool:
    try:
        import torch  # type: ignore[import-not-found]

        return bool(torch.cuda.is_available())
    except ImportError:
        return False


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        gpu_available=_gpu_available(),
        model_loaded=pipeline.is_loaded,
    )


@app.get("/health/s3")
async def health_s3() -> dict:
    """Verify S3 reachability by issuing a 1-key list against the bucket."""
    try:
        storage.client.list_objects_v2(Bucket=storage.bucket, MaxKeys=1)
    except Exception as exc:
        logger.exception("S3 health check failed")
        raise HTTPException(status_code=503, detail=f"S3 connection failed: {exc}")
    return {
        "connected": True,
        "bucket": storage.bucket,
        "region": settings.aws_default_region,
    }


@app.post("/process", response_model=ProcessResponse, status_code=202)
async def process(req: ProcessRequest) -> ProcessResponse:
    """Enqueue an async processing job. Returns immediately with a job_id."""
    job_id = uuid4().hex
    JOBS[job_id] = JobStatus(job_id=job_id, match_id=req.match_id, status=JobState.QUEUED)
    logger.info("Queued job %s for match %s", job_id, req.match_id)
    # TODO: enqueue background task (asyncio.create_task or a worker queue)
    # that downloads (if youtube_url), runs pipeline.run, and POSTs callback_url.
    return ProcessResponse(job_id=job_id, status=JobState.QUEUED)


@app.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job(job_id: str) -> JobStatus:
    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/process-sync", response_model=JobStatus)
async def process_sync(req: ProcessRequest) -> JobStatus:
    """Synchronous variant — runs the pipeline inline. For small clips / testing only."""
    job_id = uuid4().hex
    status = JobStatus(job_id=job_id, match_id=req.match_id, status=JobState.PROCESSING)
    JOBS[job_id] = status
    # TODO: download (if youtube_url) and call pipeline.run; populate status.result
    logger.info("TODO: run sync pipeline for match %s", req.match_id)
    status.status = JobState.FAILED
    status.error = "Not implemented yet"
    return status
