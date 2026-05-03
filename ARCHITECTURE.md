# football-pipeline — Architecture & Stack

End-to-end architecture for the three services in this monorepo: how each one fits, what libraries it uses, and why those choices.

---

## High-level topology

```
┌────────────────────────┐
│  Dashboard (Next.js)   │  port 3000   user-facing UI
└────────────┬───────────┘
             │  HTTPS · axios + JWT bearer
             ▼
┌────────────────────────┐         ┌─────────────────────┐
│   Backend (Fastify)    │ port 3001         Postgres :5432
│   - REST API           │ ────────▶  Drizzle ORM
│   - JWT auth           │         └─────────────────────┘
│   - BullMQ orchestrator│         ┌─────────────────────┐
└────────────┬───────────┘ ────────▶  Redis :6379  (BullMQ)
             │                     └─────────────────────┘
             │  HTTP · axios
             ▼
┌────────────────────────┐         ┌─────────────────────┐
│   GPU Server (FastAPI) │ port 8000          AWS S3
│   - YOLO + ByteTrack   │ ────────▶  videos · tracking · reports
│   - yt-dlp downloader  │         └─────────────────────┘
│   - boto3 to S3        │
└────────────┬───────────┘
             │  HTTP callback
             ▼  POST /api/webhooks/gpu/job-complete  (back to backend)
```

**Why three services:** The dashboard is a static-friendly Next.js app, the backend coordinates state and queues jobs, and the GPU server is intentionally isolated so it can run on GPU-class hardware (RunPod / AWS EC2 g4dn) without dragging the rest of the stack onto an expensive box. They communicate over HTTP only — no shared filesystem, no shared database connection from the GPU side.

**Storage model:** Postgres holds metadata (users, matches, events, players, reports, jobs). Redis holds queues only. S3 holds every binary artifact (raw videos, annotated videos, tracking JSON, events JSON, PDF reports). Local disk on either backend or gpu-server is for temp/intermediate work only.

---

## 1. `dashboard/` — Next.js 14 (App Router)

**Role:** User-facing single-page-feeling SPA. Renders auth pages, the matches list, an upload form, per-match detail with live processing status, and a settings page.

**Where it runs:** Local dev (`npm run dev`), eventually Vercel for prod.

### Stack

| Library | Version | Role |
|---|---|---|
| **next** | ^14.2.15 | App Router framework — file-based routing under `src/app/`, server components by default, client components opt-in with `'use client'`. Built with `output: 'standalone'` for Docker. |
| **react / react-dom** | ^18.3.1 | UI runtime. |
| **typescript** | ^5.6.3 | Strict mode. Path alias `@/*` → `./src/*`. |
| **tailwindcss** | ^3.4.14 | Utility-first CSS. Dark mode via `class` strategy, HSL token-based color system. |
| **tailwindcss-animate** | ^1.0.7 | Animation utilities for shadcn. |
| **shadcn/ui** | (copy-pasted) | Component library on top of Radix primitives. Components live directly in `src/components/ui/` so you own and customize them. |
| **@radix-ui/react-dialog**, **react-label**, **react-progress**, **react-slot**, **react-toast** | ^1.x | Headless accessible primitives that shadcn wraps. |
| **lucide-react** | ^0.453.0 | Icon set. |
| **class-variance-authority + clsx + tailwind-merge** | — | Variant-based className composition (the shadcn `cn()` helper). |
| **@tanstack/react-query** | ^5.59.16 | Server state — all fetching is `useQuery`/`useMutation`. Configured in `app/providers.tsx` with `staleTime: 30s`, `refetchOnWindowFocus: false`, `retry: 1`. |
| **axios** | ^1.7.7 | HTTP client. Single instance in `lib/api.ts` — sets `baseURL` from `NEXT_PUBLIC_BACKEND_URL`, `withCredentials: true`, 30s timeout. Request interceptor auto-attaches `Authorization: Bearer <token>` from `localStorage`; response interceptor clears token + redirects to `/login` on 401. |
| **react-hook-form + @hookform/resolvers** | ^7.53 / ^3.9 | Form state and validation. |
| **zod** | ^3.23.8 | Schema validation for forms (login/signup/upload). Reused on the backend too — ideal for keeping shape definitions in one mental model. |
| **jose** | ^5.9.4 | JWT verification on Next.js server side (server components, route handlers). Uses the same `JWT_SECRET` as backend so it can read tokens issued there. |

### Directory layout

```
dashboard/src/
├── app/                       Next.js App Router routes
│   ├── (auth)/login/          login page
│   ├── (auth)/signup/         signup page
│   ├── (dashboard)/           authenticated layout group
│   │   ├── page.tsx           home (stats placeholders)
│   │   ├── matches/           list, detail [id], new
│   │   └── settings/          account settings (TODO)
│   ├── layout.tsx             root layout
│   └── providers.tsx          QueryClientProvider, Toaster
├── components/
│   ├── match-card.tsx         match list item
│   ├── match-upload-form.tsx  YouTube URL form
│   ├── processing-status.tsx  polls job status every 3s
│   ├── report-viewer.tsx      PDF / insights display
│   └── ui/                    shadcn primitives (button, card, dialog, form, input, label, progress, table, toast, badge)
├── lib/
│   ├── api.ts                 axios instance + interceptors
│   ├── auth.ts                jose helpers (verifyToken, getSession)
│   └── utils.ts               cn() helper
└── types/
    └── index.ts               TS types mirrored from backend Drizzle inferred types
```

### Auth flow

1. User submits `/login` → POST `/api/auth/login` on backend.
2. Backend returns a signed JWT (`{ sub, email }`).
3. Dashboard stores it in `localStorage` and (planned) sets a `jwt` cookie for server-side reads.
4. `lib/api.ts` interceptor attaches it to every outbound request.
5. Server components call `getSession()` from `lib/auth.ts` — `jose.jwtVerify` validates the cookie token using the shared `JWT_SECRET`.

The dashboard never talks to the database or GPU server directly — only the backend.

### State management

No Zustand / Redux / Context. All server state goes through React Query; form state through react-hook-form. Token lives in localStorage. That's the entire state surface.

---

## 2. `backend/` — Fastify + Drizzle + BullMQ

**Role:** Orchestrator. Owns the database, issues JWTs, enqueues processing jobs, receives GPU webhooks, generates PDF reports, exposes signed S3 URLs.

**Where it runs:** Local node (`npm run dev`), eventually any Node host (Fly.io, Railway, EC2).

### Stack

| Library | Version | Role |
|---|---|---|
| **fastify** | ^5.0.0 | HTTP framework. Plugin-based — every route file is a plugin registered in `server.ts`. Faster than Express, built-in JSON-schema validation, first-class async. |
| **@fastify/cors** | ^10.0.1 | CORS — currently `origin: true, credentials: true`. |
| **@fastify/jwt** | ^9.0.1 | JWT issuance + verification. Payload typed as `{ sub, email }`. Same secret as dashboard. |
| **@fastify/multipart** | ^9.0.1 | Multipart upload parsing (5 GB limit) — for direct video uploads from dashboard. |
| **drizzle-orm** | ^0.36.0 | Type-safe SQL ORM. Schema-first (`src/db/schema.ts`), no decorators, no runtime overhead. Inferred TS types via `$inferSelect` / `$inferInsert`. |
| **drizzle-kit** | ^0.27.0 | Migration generator and Studio UI. `npm run db:generate` reads the schema and emits SQL diffs into `src/db/migrations/`. |
| **postgres** | ^3.4.4 | Postgres driver Drizzle uses under the hood. |
| **bullmq** | ^5.21.0 | Redis-backed job queue. Two queues: `process-match` and `generate-report`. |
| **ioredis** | ^5.4.1 | Redis client BullMQ uses. |
| **@aws-sdk/client-s3** | ^3.677.0 | S3 client — head/delete/list and direct PUT for the test script. |
| **@aws-sdk/s3-request-presigner** | ^3.677.0 | Generates presigned download URLs (so dashboards/clients can fetch S3 objects without backend proxying). |
| **axios** | ^1.7.7 | HTTP client used to call the GPU server (`POST /process`). |
| **bcrypt** | ^5.1.1 | Password hashing for the users table. |
| **zod** | ^3.23.8 | Request body validation (used in every route file) and env var validation in `config.ts`. |
| **pino + pino-pretty** | ^9.4 / ^11.3 | Structured JSON logging. Pretty output in dev, raw JSON in prod. |
| **dotenv** | ^16.4.5 | Loads `.env` for the zod schema in `config.ts`. |
| **tsx** | ^4.19.1 | TS execution + watch mode for `npm run dev` and one-off scripts (`scripts/test-s3.ts`). |
| **typescript** | ^5.6.3 | ESM build via `tsc`. |

### Directory layout

```
backend/src/
├── server.ts              Fastify bootstrap — plugins, routes, workers, listen
├── config.ts              Zod env schema, exports typed `config`
├── db/
│   ├── schema.ts          Drizzle table definitions (users, matches, match_events,
│   │                      match_players, reports, jobs)
│   ├── index.ts           Drizzle client + Postgres pool
│   └── migrations/        Generated SQL (drizzle-kit output)
├── middleware/
│   ├── auth.ts            requireAuth preHandler (verifies JWT, sets request.user)
│   └── error-handler.ts   Catches ZodError → 400, FastifyError → mapped status
├── routes/
│   ├── auth.ts            /api/auth/{signup,login,logout,me}
│   ├── matches.ts         /api/matches CRUD (auth-gated)
│   ├── reports.ts         /api/reports — list / fetch
│   ├── webhooks.ts        /api/webhooks/gpu/job-complete (no auth, shared-secret TODO)
│   └── diagnostic.ts      /diagnostic/s3
├── services/
│   ├── gpu-client.ts      Axios wrapper over GPU_SERVER_URL — POST /process etc.
│   ├── auth.ts            Password hashing, JWT minting helpers
│   ├── reports.ts         PDF generation (TODO)
│   └── s3.ts              S3 client + signed URL helpers + key builders
├── queues/
│   └── index.ts           BullMQ Queue definitions + shared IORedis connection
├── workers/
│   ├── process-match.ts   Consumes process-match queue: calls gpu-server, awaits webhook
│   └── generate-report.ts Consumes generate-report queue: builds PDF, uploads to S3
└── scripts/
    └── test-s3.ts         Standalone S3 round-trip integration test
```

### Database schema (Postgres via Drizzle)

| Table | Purpose | Notable columns |
|---|---|---|
| `users` | Auth principals | id, email (unique), password_hash, name |
| `matches` | One row per uploaded match | source_type (youtube/upload), source_url, video_path, status enum, **5 S3 key columns** (raw_video, annotated_video, tracking_data, events_data, report) |
| `match_events` | Per-frame events | event_type enum (pass/shot/sprint/possession), frame_number, timestamp, position x/y, jsonb metadata |
| `match_players` | Aggregated per-track stats | track_id, team, jersey_number, total_distance_m, total_sprints, total_passes |
| `reports` | Generated PDFs | type (single/multi/opponent), pdf_path, jsonb insights |
| `jobs` | BullMQ job mirror | type, status enum, progress_pct, error_message |

### Job flow (BullMQ)

1. User uploads via dashboard → `POST /api/matches` creates `matches` row (status `pending`).
2. Backend enqueues `processMatchQueue.add('process-match', { matchId, sourceType, sourceUrl })`.
3. `process-match` worker picks it up → calls `gpu-server POST /process` with callback URL → updates `matches.status = 'processing'`.
4. GPU server downloads (or reads upload), runs YOLO + ByteTrack, uploads outputs to S3, calls back `/api/webhooks/gpu/job-complete`.
5. Webhook handler persists `match_events` + `match_players`, sets `matches.status = 'completed'`, enqueues `generateReportQueue`.
6. `generate-report` worker builds PDF, uploads to S3, writes `reports` row.

Workers run in-process during dev (started inside `start()` in `server.ts`). For prod, split each worker into its own process (`node dist/workers/process-match-runner.js`).

### Auth

`signup` hashes with bcrypt, `login` verifies and signs a JWT via `@fastify/jwt`. `requireAuth` middleware decodes the bearer token on protected routes and attaches `request.user = { sub, email }`. Same `JWT_SECRET` is used by the dashboard's `jose` so server components can read the same token.

---

## 3. `gpu-server/` — FastAPI + Ultralytics

**Role:** Heavy-compute service. Downloads YouTube videos, runs YOLO object detection + ByteTrack player tracking, extracts tactical events, uploads everything to S3, calls back to the backend.

**Where it runs:** GPU-class machine — RunPod pod or AWS EC2 g4dn/g5 instance. Code is identical regardless of host.

### Stack

| Library | Version | Role |
|---|---|---|
| **fastapi** | 0.115.0 | Async Python web framework. Pydantic-typed request/response models, OpenAPI auto-docs at `/docs`, dependency injection. |
| **uvicorn[standard]** | 0.32.0 | ASGI server — runs FastAPI. `[standard]` pulls in `uvloop` (faster event loop), `httptools` (faster HTTP parsing), `watchfiles` (`--reload`). |
| **gunicorn** | 25.x (prod) | Process manager. Standard FastAPI prod setup is `gunicorn -k uvicorn.workers.UvicornWorker -w N`. Provides daemonization, multi-worker, graceful reload. |
| **pydantic** | 2.9.2 | Data validation. Defines request/response models (`ProcessRequest`, `JobStatus`, etc.) in `models.py`. |
| **pydantic-settings** | 2.6.0 | Env var loader. Reads `.env` into a typed `Settings` class with `Field(alias="ENV_VAR")` aliases. |
| **python-multipart** | 0.0.12 | Multipart parsing for file uploads (FastAPI dependency for `UploadFile`). |
| **httpx** | 0.27.2 | Async HTTP client — used to POST callbacks back to the backend. |
| **ultralytics** | 8.3.20 | YOLO (You Only Look Once) implementation — modern v8/v11. Loads `.pt` weights, runs frame detection. Pulls in PyTorch + CUDA libs (~3 GB). |
| **opencv-python-headless** | 4.10.0.84 | Video frame iteration (`cv2.VideoCapture`), frame manipulation. Headless = no GUI deps, smaller install for servers. |
| **supervision** | 0.24.0 | Roboflow's tracker/annotator library. Provides `ByteTrack` for player tracking, plus annotation primitives (boxes, traces, labels) for the annotated output video. |
| **yt-dlp** | 2024.10.07 | YouTube downloader. Active fork of youtube-dl with regular updates as YouTube changes APIs. |
| **boto3 + botocore** | 1.35.49 | AWS S3 client. Same role as the backend's `@aws-sdk/client-s3` — upload outputs, download inputs, presigned URLs, head/delete. |
| **pytest** | 8.3.3 | Testing. `tests/test_pipeline.py` (skeleton), `tests/test_storage.py` (S3 round-trip integration test). |
| **black + isort + ruff** | latest | Formatting/linting. |

### Directory layout

```
gpu-server/
├── src/
│   ├── api.py             FastAPI app: /health, /health/s3, /process,
│   │                      /process-sync, /jobs/{id}
│   ├── config.py          pydantic-settings Settings class
│   ├── models.py          Pydantic request/response + JobState enum
│   ├── pipeline.py        FootballPipeline class — load() + run() (TODO body)
│   ├── storage.py         Local workdir helpers + S3Storage class + key builders
│   └── youtube.py         yt-dlp wrapper for downloading source videos
├── tests/
│   ├── test_pipeline.py   Pipeline unit tests (skeleton)
│   └── test_storage.py    S3 round-trip integration test
├── requirements.txt       Pinned deps
├── Dockerfile             Container build (CUDA-aware base image planned)
└── start.sh               Production entrypoint
```

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness — returns `gpu_available` (torch.cuda.is_available) and `model_loaded` |
| GET | `/health/s3` | Verifies S3 reachability via `list_objects_v2(MaxKeys=1)` |
| POST | `/process` | **Async** — enqueue a job, return job_id immediately |
| POST | `/process-sync` | **Sync** — runs pipeline inline. Test/small-clip use only |
| GET | `/jobs/{job_id}` | Poll job status |
| GET | `/docs` | Auto-generated Swagger UI (FastAPI built-in) |

### Pipeline lifecycle (planned)

```
1. POST /process { match_id, youtube_url | video_path, callback_url }
2. Download (yt-dlp) → temp/ on local disk
3. cv2.VideoCapture frame loop:
   - YOLO detect (ultralytics) → bounding boxes
   - supervision.ByteTrack update → track IDs
   - Aggregate events: passes, shots, sprints, possession
4. Annotate frames → write annotated.mp4 → upload to S3
5. Serialize tracking.json + events.json → upload to S3
6. POST callback_url with structured result
7. Cleanup temp/ on local disk
```

The `S3Storage` singleton in `storage.py` handles all S3 I/O. Standard key builders (`s3_key_input`, `s3_key_output_video`, `s3_key_tracking`, `s3_key_events`, `s3_key_report`) mirror the backend's `s3Keys` map so both services agree on object paths.

### Process management

- **Dev:** `uvicorn src.api:app --reload`
- **Prod:** Gunicorn with Uvicorn workers, supervised by supervisord (or systemd on EC2).
- Single GPU = single worker (each worker loads the full YOLO model into VRAM).

---

## Cross-cutting: AWS S3 (the spine)

Both gpu-server and backend talk to the same S3 bucket (`talentailabsfootball-874772885665-eu-central-1-an`, eu-central-1). Layout:

| Prefix | Producer | Consumer |
|---|---|---|
| `inputs/{match_id}/raw.mp4` | gpu-server (yt-dlp) or backend (uploads) | gpu-server (pipeline input) |
| `outputs/{match_id}/annotated.mp4` | gpu-server | backend (signed URL → dashboard) |
| `outputs/{match_id}/tracking.json` | gpu-server | backend (report worker) |
| `outputs/{match_id}/events.json` | gpu-server | backend (report worker, dashboard insights) |
| `reports/{match_id}.pdf` | backend (report worker) | dashboard (signed URL download) |
| `temp/*` | both (test scripts, intermediate) | (auto-deleted) |

Diagnostic endpoints on both services confirm connectivity:
- `GET http://gpu-server:8000/health/s3`
- `GET http://backend:3001/diagnostic/s3`

---

## Cross-cutting: Postgres (backend only)

Only the backend connects. Schema in `backend/src/db/schema.ts`. Migrations under `backend/src/db/migrations/` are generated by `drizzle-kit generate` (reads the TS schema, emits SQL diffs) and applied with `drizzle-kit migrate`.

For local dev: either `docker compose up -d postgres` or a native install with a `postgres` superuser and a `football_pipeline` database.

---

## Cross-cutting: Redis (backend only)

Only used by BullMQ. Two queues: `process-match` (matches → GPU server) and `generate-report` (completed matches → PDF). One IORedis connection shared across queues + workers in `backend/src/queues/index.ts`.

---

## Local dev quick reference

```bash
# Postgres + Redis (or skip with native installs)
docker compose up -d postgres redis

# Backend
cd backend && npm install && npm run db:migrate && npm run dev

# Dashboard
cd dashboard && npm install && npm run dev

# GPU server (heavy install — torch + CUDA libs)
cd gpu-server
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload
```

Each service has its own `.env.example` — copy to `.env` and fill in real values. Critical: `JWT_SECRET` must be **identical** across `backend/.env` and `dashboard/.env.local` (both use it to sign/verify the same tokens).

---

## What's wired vs what's TODO

| Capability | Status |
|---|---|
| S3 plumbing (both sides) | ✅ done |
| Database schema + migrations | ✅ done |
| BullMQ queue scaffolding | ✅ done |
| Auth (signup/login routes) | 🟡 routes exist, return 501 |
| GPU pipeline (YOLO + ByteTrack) | ❌ TODO — `pipeline.py` raises NotImplementedError |
| YouTube download (yt-dlp glue) | 🟡 dep installed, no caller yet |
| GPU webhook handler (persisting events/players) | 🟡 route exists, returns 501 |
| PDF report generation | ❌ TODO — `services/reports.ts` empty |
| Dashboard auth wiring | 🟡 forms exist, no API calls |
| Dashboard match detail polling | ✅ done (uses react-query refetchInterval) |

This file is a snapshot — drift will accumulate as features land. The current source of truth for any given detail is always the code.
