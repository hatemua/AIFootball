# football-pipeline

AI-powered football match analysis platform. Upload a YouTube link or video file; get back tracked players, events (passes, shots, sprints, possession), per-player stats, and PDF reports.

## Architecture

```
┌──────────────────────┐
│  Dashboard (Next.js) │  :3000   ← user-facing UI
└──────────┬───────────┘
           │ HTTPS (axios + JWT)
           ▼
┌──────────────────────┐         ┌──────────────────┐
│  Backend (Fastify)   │  :3001  │  Postgres :5432  │
│  - REST API          │ ──────▶ │  (Drizzle ORM)   │
│  - Auth (JWT)        │         └──────────────────┘
│  - BullMQ orchestrator│
└──────────┬───────────┘         ┌──────────────────┐
           │                     │  Redis :6379     │
           ├────────────────────▶│  (BullMQ queues) │
           │                     └──────────────────┘
           │ HTTP (axios)
           ▼
┌──────────────────────┐
│  GPU Server (FastAPI)│  :8000  ← runs on RunPod (separate)
│  - YOLO + ByteTrack  │
│  - yt-dlp downloader │
│  └─ POSTs callback ──┴──▶ Backend webhook on completion
└──────────────────────┘
```

Three independent services live in this monorepo:

| Service       | Stack                       | Port  | Where it runs        |
|---------------|------------------------------|-------|----------------------|
| `dashboard/`  | Next.js 14 + Tailwind + shadcn | 3000  | Local / Vercel       |
| `backend/`    | Fastify + Drizzle + BullMQ  | 3001  | Local / Docker       |
| `gpu-server/` | FastAPI + Ultralytics       | 8000  | **RunPod** (GPU pod) |

## Quick start

You need: Docker Desktop, Node.js 20+, Python 3.11+, npm.

```bash
# 1. Clone & enter
cd football-pipeline

# 2. Copy env template
cp .env.example .env

# 3. Bring up Postgres + Redis
docker-compose up -d postgres redis

# 4. Install backend, generate & apply migrations, start it
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run dev          # → http://localhost:3001

# 5. In a second terminal, start the dashboard
cd ../dashboard
npm install
npm run dev          # → http://localhost:3000

# 6. (Optional) start the GPU server locally for development
cd ../gpu-server
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.api:app --reload  # → http://localhost:8000
```

## Environment variables

See `.env.example` for the full list with comments. Key vars:

- `DATABASE_URL` — Postgres connection (backend, Drizzle)
- `REDIS_URL` — Redis connection (BullMQ)
- `JWT_SECRET` — must be **identical** in `backend/.env` and `dashboard/.env`
- `GPU_SERVER_URL` — where backend reaches the GPU server
- `BACKEND_PUBLIC_URL` — where the GPU server posts callbacks
- `NEXT_PUBLIC_BACKEND_URL` — where dashboard reaches the backend
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `S3_BUCKET` — same on both `backend/.env` and `gpu-server/.env`

## S3 setup

All durable artifacts (raw videos, annotated videos, tracking/events JSON, PDF reports) live in S3. Local disk on each service is for temp/intermediate files only.

**Bucket:** `talentailabsfootball-874772885665-eu-central-1-an` (region `eu-central-1`)

**IAM:** create a programmatic-access user with `AmazonS3FullAccess` for now. Scope down to a single-bucket policy later.

**Env vars (both services):**

```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=eu-central-1
S3_BUCKET=talentailabsfootball-874772885665-eu-central-1-an
```

**Folder layout:**

| Prefix | Contents |
|--------|----------|
| `inputs/{match_id}/raw.mp4`         | uploaded or YouTube-downloaded source video |
| `outputs/{match_id}/annotated.mp4`  | YOLO-annotated video |
| `outputs/{match_id}/tracking.json`  | structured tracking data |
| `outputs/{match_id}/events.json`    | extracted tactical events |
| `reports/{match_id}.pdf`            | final PDF report |
| `temp/*`                            | intermediate / test files (auto-deleted) |

**Verify the connection:**

```bash
# gpu-server side
cd gpu-server
python -m tests.test_storage         # uploads, downloads, verifies, deletes
uvicorn src.api:app
curl http://localhost:8000/health/s3  # → {"connected": true, ...}

# backend side
cd backend
npm run test:s3                       # uploads, fetches via signed URL, deletes
npm run dev
curl http://localhost:3001/diagnostic/s3  # → {"connected": true, ...}
```

## Development workflow

- **Backend changes**: `cd backend && npm run dev` (tsx watch). Schema changes: edit `src/db/schema.ts` → `npm run db:generate` → `npm run db:migrate`.
- **Dashboard changes**: `cd dashboard && npm run dev`. Add shadcn components by hand in `src/components/ui/`.
- **GPU server changes**: `cd gpu-server && uvicorn src.api:app --reload`. Code changes auto-reload.
- **Type sharing**: dashboard mirrors backend types in `dashboard/src/types/index.ts`. Keep in sync manually until a shared package is introduced.

## Deployment notes

- **Dashboard** → Vercel (auto-deploy from main).
- **Backend** → any Node host (Fly.io, Railway, etc.). Provision Postgres + Redis. Set env. Run migrations.
- **GPU Server** → RunPod GPU pod. Build the Dockerfile, push to a registry, set as the pod template. Expose port 8000.
- **Webhook URL**: in prod, set `BACKEND_PUBLIC_URL` so the GPU server can POST job-complete callbacks.

## What's not done yet

This repo is currently a scaffold. See each service's README for the TODO list:

- [ ] YOLO + ByteTrack pipeline implementation (`gpu-server/`)
- [ ] Auth flows (`backend/routes/auth.ts`)
- [ ] PDF report generation (`backend/services/reports.ts`)
- [ ] Dashboard pages beyond skeleton
- [ ] Tests
