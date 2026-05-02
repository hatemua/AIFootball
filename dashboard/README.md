# dashboard

Next.js 14 (App Router) + Tailwind + shadcn/ui frontend for football-pipeline.

## Layout

```
src/
├── app/
│   ├── (auth)/login, signup    # Public auth pages
│   ├── (dashboard)/            # Protected app shell with sidebar
│   │   ├── page.tsx            # Home
│   │   ├── matches/            # List, new, [id] detail
│   │   └── settings/
│   ├── api/                    # (empty for now — backend is direct)
│   ├── layout.tsx              # Root layout + Providers
│   ├── providers.tsx           # QueryClientProvider + Toaster
│   └── globals.css
├── components/
│   ├── ui/                     # shadcn primitives
│   ├── match-card.tsx
│   ├── match-upload-form.tsx
│   ├── processing-status.tsx
│   └── report-viewer.tsx
├── lib/
│   ├── api.ts                  # axios client → backend
│   ├── auth.ts                 # jose helpers (server-only)
│   └── utils.ts                # cn()
└── types/index.ts              # mirrors backend Drizzle types
```

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

The backend must be running on `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:3001`).

## Scripts

| Command            | Purpose                                |
|--------------------|----------------------------------------|
| `npm run dev`      | Next dev server                        |
| `npm run build`    | Production build                       |
| `npm start`        | Run production build                   |
| `npm run lint`     | ESLint via next/lint                   |
| `npm run typecheck`| `tsc --noEmit`                         |
| `npm run format`   | Prettier                               |

## Adding shadcn components

We pre-bundled the canonical components in `src/components/ui/`. To add more, copy them by hand from https://ui.shadcn.com/docs/components — the project's `components.json` and `tailwind.config.ts` are already set up to match.

## Auth

JWTs are issued by the backend. The dashboard:

1. Stores the token in `localStorage` after login (client-side).
2. Attaches it as `Authorization: Bearer <token>` via `lib/api.ts` interceptor.
3. Server-side helpers in `lib/auth.ts` use `jose` to verify cookies for any RSC / server actions that need to know who the user is.

`JWT_SECRET` in `.env.local` MUST match the backend's value.

## What's still TODO

- [ ] Wire login/signup forms to actual API calls
- [ ] Server-side route protection middleware (`middleware.ts`)
- [ ] File upload UI for non-YouTube matches
- [ ] Real stats wiring on the dashboard home page
- [ ] Tests
