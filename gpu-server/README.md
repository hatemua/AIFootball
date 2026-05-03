# gpu-server

GPU-bound video processing service. Receives HTTP requests from `backend/`, runs YOLO + ByteTrack on football match videos, and POSTs structured tracking results back via a callback URL.

Runs on **RunPod** in production. Locally, you can run it on CPU (slow) or any CUDA box.

## Endpoints

| Method | Path                | Purpose                                          |
|--------|---------------------|--------------------------------------------------|
| GET    | `/health`           | Reports GPU + model + PyTorch info               |
| GET    | `/health/s3`        | Verifies S3 reachability                         |
| POST   | `/process`          | Async: enqueue, returns `{ job_id, status }`     |
| GET    | `/jobs/{job_id}`    | Poll job status                                  |
| POST   | `/process-sync`     | Synchronous end-to-end pipeline                  |

`POST /process-sync` and `POST /process` body (`ProcessRequest` in `src/models.py`):

```json
{
  "match_id": "uuid-from-backend",
  "youtube_url": "https://youtu.be/...",       // exactly one of these three
  "video_url":   "https://example.com/x.mp4",
  "video_path":  "/abs/path/to/local.mp4",
  "callback_url": "https://backend/api/webhooks/gpu/job-complete"
}
```

## Testing /process-sync

End-to-end smoke test (download → S3 → YOLO+ByteTrack → S3 → signed URLs).

```bash
# Direct MP4 (no cookies needed — easiest)
curl -X POST http://localhost:8000/process-sync \
  -H "Content-Type: application/json" \
  -d '{
    "match_id": "smoke-001",
    "video_url": "https://media.roboflow.com/supervision/video-examples/croatia-chile-world-cup-2014.mp4"
  }'

# YouTube (requires COOKIES_PATH pointing at a Netscape-format cookies.txt
# exported from a logged-in browser via the "Get cookies.txt" extension)
curl -X POST http://localhost:8000/process-sync \
  -H "Content-Type: application/json" \
  -d '{
    "match_id": "smoke-002",
    "youtube_url": "https://www.youtube.com/watch?v=__P_wgqL2lM"
  }'

# Verify S3 artifacts landed
aws s3 ls s3://${S3_BUCKET}/inputs/smoke-001/
aws s3 ls s3://${S3_BUCKET}/outputs/smoke-001/
```

Response shape:

```json
{
  "match_id": "smoke-001",
  "status": "completed",
  "s3_keys": {
    "raw_video": "inputs/smoke-001/raw.mp4",
    "annotated_video": "outputs/smoke-001/annotated.mp4",
    "tracking_data":  "outputs/smoke-001/tracking.json"
  },
  "signed_urls": { "raw_video": "https://...", "annotated_video": "https://...", "tracking_data": "https://..." },
  "stats": { "total_frames": 1234, "unique_track_ids": 23, "realtime_factor": 1.6, "...": "..." },
  "processing_time_seconds": 47.3
}
```

## Pre-deployment setup

Before starting the service, download the YOLO model weights:

```bash
./scripts/download_models.sh
```

This downloads `yolo11n.pt` (~5.4 MB) into `./weights/`. The path must match `YOLO_MODEL` in your `.env`.

For production, always use an absolute path in `YOLO_MODEL` so the service finds the model regardless of the working directory.

## Local development

```bash
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
./scripts/download_models.sh   # one-time, fetches yolo11n.pt into ./weights/

uvicorn src.api:app --reload  # http://localhost:8000
# Health check:
curl http://localhost:8000/health
```

## Environment variables

See `.env.example`. All vars are read by `src/config.py` via `pydantic-settings`.

| Var                         | Default                  | Purpose                                        |
|-----------------------------|--------------------------|------------------------------------------------|
| `STORAGE_DIR`               | `./storage`              | Working dir for downloads                      |
| `BACKEND_CALLBACK_BASE_URL` | `http://localhost:3001`  | Where job-complete callbacks go                |
| `LOG_LEVEL`                 | `INFO`                   | Python logging level                           |
| `AWS_ACCESS_KEY_ID`         | —                        | S3 credentials (required)                      |
| `AWS_SECRET_ACCESS_KEY`     | —                        | S3 credentials (required)                      |
| `AWS_DEFAULT_REGION`        | `eu-central-1`           | AWS region                                     |
| `S3_BUCKET`                 | —                        | Bucket for inputs/outputs/reports (required)   |
| `COOKIES_PATH`              | (none)                   | Netscape cookies.txt for yt-dlp YouTube auth   |
| `TEMP_DIR`                  | `/tmp`                   | Per-job working directory                      |
| `YOLO_MODEL`                | `yolo11n.pt`             | Ultralytics model name (auto-downloads)        |
| `YOLO_CONFIDENCE`           | `0.3`                    | Detection confidence threshold (0.0–1.0)       |

## Deploy to RunPod

1. Build & push: `docker build -t <registry>/football-gpu-server .` then push.
2. Create a RunPod **GPU Pod template** pointing at your image. Expose port 8000.
3. Set env vars (`YOLO_MODEL`, `BACKEND_CALLBACK_BASE_URL` etc.).
4. Mount or bake in your YOLO weights at the configured `YOLO_MODEL` path.
5. Note the pod's public URL — set it as `GPU_SERVER_URL` in the backend's env.

## What's still TODO

- [x] `src/pipeline.py` — YOLO + ByteTrack loop with ffmpeg re-encode
- [x] `src/youtube.py` — multi-source downloader (yt-dlp + direct HTTP via httpx)
- [x] `src/api.py` — `/process-sync` end-to-end with S3 upload + signed URLs
- [ ] `src/api.py` — background task for `/process` (async) that POSTs `callback_url`
- [ ] Real job persistence (currently an in-memory dict — lost on restart)
- [ ] Event extraction (passes, shots, sprints, possession) on top of the raw tracking_data
- [ ] Tests beyond the storage round-trip + pipeline placeholder

## Code style

- Black + isort + ruff. Run `black src tests && isort src tests && ruff check src tests`.
- Type hints required on all public functions; `mypy` not yet wired in.
