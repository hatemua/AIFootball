# gpu-server

GPU-bound video processing service. Receives HTTP requests from `backend/`, runs YOLO + ByteTrack on football match videos, and POSTs structured tracking results back via a callback URL.

Runs on **RunPod** in production. Locally, you can run it on CPU (slow) or any CUDA box.

## Endpoints

| Method | Path                | Purpose                                          |
|--------|---------------------|--------------------------------------------------|
| GET    | `/health`           | Reports GPU + model status                       |
| POST   | `/process`          | Async: enqueue, returns `{ job_id, status }`     |
| GET    | `/jobs/{job_id}`    | Poll job status                                  |
| POST   | `/process-sync`     | Synchronous (small clips / testing only)         |

`POST /process` body (`ProcessRequest` in `src/models.py`):

```json
{
  "match_id": "uuid-from-backend",
  "youtube_url": "https://youtu.be/...",   // OR video_path, not both
  "video_path": null,
  "callback_url": "https://backend/api/webhooks/gpu/job-complete"
}
```

## Local development

```bash
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env

uvicorn src.api:app --reload  # http://localhost:8000
# Health check:
curl http://localhost:8000/health
```

## Environment variables

See `.env.example`. All vars are read by `src/config.py` via `pydantic-settings`.

| Var                         | Default                  | Purpose                          |
|-----------------------------|--------------------------|----------------------------------|
| `MODEL_PATH`                | `./weights/yolo.pt`      | YOLO weights file                |
| `STORAGE_DIR`               | `./storage`              | Working dir for downloads        |
| `BACKEND_CALLBACK_BASE_URL` | `http://localhost:3001`  | Where job-complete callbacks go  |
| `LOG_LEVEL`                 | `INFO`                   | Python logging level             |

## Deploy to RunPod

1. Build & push: `docker build -t <registry>/football-gpu-server .` then push.
2. Create a RunPod **GPU Pod template** pointing at your image. Expose port 8000.
3. Set env vars (`MODEL_PATH`, `BACKEND_CALLBACK_BASE_URL` etc.).
4. Mount or bake in your YOLO weights at the configured `MODEL_PATH`.
5. Note the pod's public URL — set it as `GPU_SERVER_URL` in the backend's env.

## What's still TODO

- [ ] `src/pipeline.py` — actual YOLO + ByteTrack loop
- [ ] `src/youtube.py` — yt-dlp download
- [ ] `src/api.py` — background task that runs the pipeline and POSTs the callback
- [ ] Real job persistence (currently an in-memory dict — lost on restart)
- [ ] Tests beyond the smoke-test placeholder

## Code style

- Black + isort + ruff. Run `black src tests && isort src tests && ruff check src tests`.
- Type hints required on all public functions; `mypy` not yet wired in.
