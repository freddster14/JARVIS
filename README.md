# JARVIS

A personal AI scheduling assistant. JARVIS plans your week around your tasks,
fixed commitments, and when you actually wake up — then keeps you on track with
push reminders and an honest weekly review.

## What it does

- **AI weekly scheduling.** Describe your recurring tasks (duration, weekly
  goal, priority) and your fixed blocks (work, gym, appointments). Claude builds
  a conflict-free weekly schedule that fits sessions into your available windows,
  places meal breaks, spreads work across the week, and prioritizes tasks that
  are behind their goal.
- **Wake-aware planning.** Each day's window starts at your wake time. Use a
  fixed wake time, or "morning ping" mode where JARVIS asks if you're up and
  falls back to a default if you don't respond.
- **Push reminders.** Web-push notifications fire 30 minutes before each task
  with a short, AI-written nudge and Done / Skip actions — even when the tab is
  closed.
- **Today view.** A focused panel highlights what's happening now or next, with
  one-tap Done/Skip.
- **Reschedule.** Drag a task to a new day/time; overlaps are rejected
  server-side.
- **Insights.** Per-task goal progress, completion-rate trends, and an
  on-demand AI weekly review. A review is also generated and pushed
  automatically every Sunday night.

## Stack

| Layer    | Tech                                                        |
| -------- | ---------------------------------------------------------- |
| Client   | React 18, Vite, TypeScript, Tailwind, TanStack Query       |
| Server   | Express, TypeScript, Prisma (SQLite), node-cron            |
| AI       | Anthropic Claude (`@anthropic-ai/sdk`, tool-use)           |
| Push     | Web Push (VAPID) + service worker                          |

This is an npm workspaces monorepo: `client/` and `server/`.

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

- `ANTHROPIC_API_KEY` — from <https://console.anthropic.com>
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — generate with
  `npx web-push generate-vapid-keys`
- `VAPID_EMAIL` — a contact email for push services
- `PORT` (default `3001`) and `CLIENT_URL` (default `http://localhost:5173`)
  are optional.

### 3. Set up the database

```bash
npm run db:migrate --workspace=server
```

### 4. Run

```bash
npm run dev
```

This starts the API on `http://localhost:3001` and the client on
`http://localhost:5173` concurrently.

## Useful scripts

| Command                                       | What it does                          |
| --------------------------------------------- | ------------------------------------- |
| `npm run dev`                                 | Run client + server in watch mode     |
| `npm run build`                               | Build both workspaces                 |
| `npm test --workspace=server`                 | Run the server test suite (vitest)    |
| `npm run db:studio --workspace=server`        | Open Prisma Studio                    |
| `npm run db:migrate --workspace=server`       | Create / apply a migration            |

## How scheduling works

1. You define **tasks** (e.g. "Job Applications — 30 min, 5×/week, priority 4")
   and **fixed blocks** (unavailable time).
2. JARVIS records your **wake time** each day (fixed, ping-confirmed, or
   fallback).
3. On **Generate Schedule**, the server gathers tasks, fixed blocks, this
   week's wake logs, and the last 4 weeks of completion history, then asks
   Claude (via a structured tool-use schema) to emit a full week of
   non-overlapping schedule items.
4. A **cron job** runs every minute to fire 30-minute reminders, handle morning
   pings and wake fallbacks, and — every Sunday at 23:30 — tally completions and
   generate the weekly review.

## API overview

| Method & path                          | Purpose                              |
| -------------------------------------- | ------------------------------------ |
| `GET/POST/PATCH/DELETE /api/tasks`     | Manage tasks                         |
| `GET/POST/PATCH/DELETE /api/blocks`    | Manage fixed blocks                  |
| `GET /api/schedule`                    | Schedule items for a week            |
| `PATCH /api/schedule/:id/status`       | Mark done / skipped / pending        |
| `PATCH /api/schedule/:id/reschedule`   | Move an item (overlap-checked)       |
| `POST /api/ai/generate-schedule`       | Generate a weekly schedule           |
| `POST /api/ai/weekly-review`           | Generate an AI weekly review         |
| `GET /api/stats/today\|week\|history`  | Progress and trend stats             |
| `GET/PATCH /api/wake/profile`          | Wake-up settings                     |
| `POST /api/wake/confirm`               | Log today's wake time                |
| `GET /api/wake/log`                    | Recent wake history                  |
| `GET/POST/DELETE /api/push/*`          | Push subscription management         |

## Notes

- The database is SQLite (`server/prisma/dev.db`) for zero-config local dev.
- Push notifications require HTTPS in production (localhost is exempt) and a
  browser that supports the Push API.
