# backend

Fastify backend that orchestrates the football-pipeline. Talks to Postgres (Drizzle), Redis (BullMQ), and the GPU server (axios).

## Layout

```
src/
├── server.ts            # Fastify entry point
├── config.ts            # Zod-validated env loader
├── db/
│   ├── schema.ts        # Drizzle schema (users, matches, events, ...)
│   ├── migrations/      # Generated migrations (drizzle-kit)
│   └── index.ts         # Drizzle client (postgres-js)
├── routes/              # auth, matches, reports, webhooks
├── services/            # gpu-client, auth, reports
├── workers/             # BullMQ workers (run in-process for dev)
├── queues/              # BullMQ queue definitions
└── middleware/          # auth (requireAuth), error-handler
```

## Setup

```bash
npm install
cp .env.example .env
# Edit .env, then:
npm run db:generate      # creates a migration from schema.ts
npm run db:migrate       # applies migrations to DATABASE_URL
npm run dev              # tsx watch → http://localhost:3001
```

`docker-compose up -d postgres redis` from the repo root brings up the stores.

## Scripts

| Command              | What it does                                    |
|----------------------|-------------------------------------------------|
| `npm run dev`        | tsx watch mode, in-process workers              |
| `npm run build`      | tsc → dist/                                     |
| `npm start`          | run compiled server                             |
| `npm run db:generate`| drizzle-kit: generate migration from schema     |
| `npm run db:migrate` | drizzle-kit: apply migrations                   |
| `npm run db:studio`  | open drizzle-studio                             |
| `npm run typecheck`  | tsc --noEmit                                    |
| `npm run lint`       | eslint                                          |
| `npm run format`     | prettier --write                                |

## Endpoints

Public (no auth):
- `GET /health`
- `POST /api/auth/signup` · `POST /api/auth/login` · `POST /api/auth/logout`
- `POST /api/webhooks/gpu/job-complete` (called by gpu-server)

Authenticated (Bearer JWT):
- `GET /api/auth/me`
- `GET|POST /api/matches`, `GET|DELETE /api/matches/:id`
- `GET|POST /api/reports`, `GET /api/reports/:id`

All handlers currently return **501 Not Implemented**.

## Environment

See `.env.example`. `config.ts` validates and exits on bad config.

## Workers

For dev, `process-match` and `generate-report` workers boot inside the API process (see `server.ts`). For prod, split them into separate Node processes so an API restart doesn't lose in-flight jobs.

## What's still TODO

- [ ] Auth route bodies
- [ ] Match upload + GPU job orchestration
- [ ] PDF generation (`services/reports.ts`)
- [ ] Webhook signature verification
- [ ] Tests
