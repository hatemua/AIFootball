"""FastAPI app exposing the GPU pipeline over HTTP."""

from __future__ import annotations

import logging
import shutil
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator
from uuid import uuid4

from fastapi import FastAPI, HTTPException

from .config import settings
from .models import (
    HealthResponse,
    JobState,
    JobStatus,
    ProcessRequest,
    ProcessResponse,
    ProcessSyncResponse,
)
from .pipeline import FootballPipeline
from .storage import (
    s3_key_input,
    s3_key_output_video,
    s3_key_tracking,
    storage,
)
from .youtube import download_video

logging.basicConfig(
    level=settings.log_level,
    format='{"level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)
logger = logging.getLogger(__name__)

# Singleton pipeline; loaded at startup via lifespan.
pipeline = FootballPipeline(
    model_name=settings.yolo_model,
    confidence=settings.yolo_confidence,
)

# In-memory job registry. TODO: swap for Redis or a sqlite file once
# multi-worker concurrency matters.
JOBS: dict[str, JobStatus] = {}


def _torch_info() -> tuple[bool, str | None, str | None]:
    """(gpu_available, gpu_name, pytorch_version) — None on import error."""
    try:
        import torch  # type: ignore[import-not-found]
    except ImportError:
        return False, None, None
    available = bool(torch.cuda.is_available())
    name = torch.cuda.get_device_name(0) if available else None
    return available, name, torch.__version__


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Load the YOLO model into GPU memory before serving requests."""
    logger.info("Loading YOLO model %s", settings.yolo_model)
    pipeline.load()
    logger.info("YOLO model loaded")
    yield


app = FastAPI(
    title="football-pipeline GPU server",
    version="0.1.0",
    description="YOLO + ByteTrack processing for football match videos.",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    gpu_available, gpu_name, pytorch_version = _torch_info()
    return HealthResponse(
        status="ok",
        gpu_available=gpu_available,
        model_loaded=pipeline.is_loaded,
        gpu_name=gpu_name,
        pytorch_version=pytorch_version,
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
    # that downloads (if youtube_url), runs pipeline.process, and POSTs callback_url.
    return ProcessResponse(job_id=job_id, status=JobState.QUEUED)


@app.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job(job_id: str) -> JobStatus:
    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/process-sync", response_model=ProcessSyncResponse)
async def process_sync(req: ProcessRequest) -> ProcessSyncResponse:
    """Synchronous end-to-end pipeline: download → S3 → YOLO+ByteTrack → S3."""
    start = time.perf_counter()

    work_dir = Path(settings.temp_dir) / req.match_id
    work_dir.mkdir(parents=True, exist_ok=True)
    raw_path = work_dir / "raw.mp4"
    annotated_path = work_dir / "annotated.mp4"
    used_local_path = bool(req.video_path)

    try:
        # 1. Download (or use the provided local path as-is)
        if used_local_path:
            raw_path = Path(req.video_path)  # type: ignore[arg-type]
            logger.info("Using provided video_path %s", raw_path)
        else:
            logger.info("[%s] download from %s", req.match_id, req.source_url)
            download_video(
                source_url=req.source_url,
                output_path=str(raw_path),
                cookies_path=settings.cookies_path,
            )

        # 2. Upload raw to S3 (skip if a local path was provided — caller already owns it)
        raw_key = s3_key_input(req.match_id)
        if not used_local_path:
            logger.info("[%s] upload raw → %s", req.match_id, raw_key)
            storage.upload_file(str(raw_path), raw_key)

        # 3. Run YOLO + ByteTrack
        logger.info("[%s] run pipeline", req.match_id)
        result = pipeline.process(
            video_path=str(raw_path),
            output_video_path=str(annotated_path),
            match_id=req.match_id,
        )

        # 4. Upload annotated MP4
        annotated_key = s3_key_output_video(req.match_id)
        if annotated_path.exists():
            logger.info("[%s] upload annotated → %s", req.match_id, annotated_key)
            storage.upload_file(str(annotated_path), annotated_key)
        else:
            logger.warning("Annotated video missing at %s", annotated_path)

        # 5. Upload tracking JSON
        tracking_key = s3_key_tracking(req.match_id)
        logger.info("[%s] upload tracking → %s", req.match_id, tracking_key)
        storage.upload_json(
            {"match_id": req.match_id, **result},
            tracking_key,
        )

        # 6. Build signed URLs (1 hour)
        s3_keys = {
            "raw_video": raw_key,
            "annotated_video": annotated_key,
            "tracking_data": tracking_key,
        }
        signed_urls = {
            name: storage.get_signed_url(key, expires=3600)
            for name, key in s3_keys.items()
        }

        elapsed = round(time.perf_counter() - start, 2)
        logger.info("[%s] complete in %ss", req.match_id, elapsed)

        return ProcessSyncResponse(
            match_id=req.match_id,
            status="completed",
            s3_keys=s3_keys,
            signed_urls=signed_urls,
            stats=result["stats"],
            processing_time_seconds=elapsed,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Pipeline failed for match %s", req.match_id)
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {exc}")

    finally:
        # Cleanup local working dir (never touch a user-provided video_path)
        try:
            if not used_local_path and raw_path.exists():
                raw_path.unlink()
            if annotated_path.exists():
                annotated_path.unlink()
            run_subdir = work_dir / f"match_{req.match_id}"
            if run_subdir.exists():
                shutil.rmtree(run_subdir, ignore_errors=True)
        except Exception as cleanup_err:
            logger.warning("Cleanup failed for %s: %s", req.match_id, cleanup_err)
