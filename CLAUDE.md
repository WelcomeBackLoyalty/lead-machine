# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

General-purpose lead generation tool. Express/TypeScript backend with React/ShadCN frontend. Uses the Exa API (Websets + Enrichments) to find structured contact leads for any type of search query. Users describe what leads they want in natural language, and the tool returns structured results (contact name, title, email, phone, LinkedIn, company, website, etc.). Jobs are async with frontend polling; results stored in-memory and exportable as CSV.

## Commands

- `npm run dev` — Start both servers concurrently (Express :3100 + Vite :5173)
- `npm run dev:server` — Start Express dev server only (tsx watch)
- `npm run dev:client` — Start Vite dev server only
- `npm run build` — Build client to `public/` then compile server to `dist/`
- `npm run build:client` — Build client only
- `npm start` — Run compiled server from `dist/server.js` (serves API + static)
- `npm run check` — Type-check server without emitting (`tsc --noEmit`)

## Architecture

### Backend (`src/server.ts`)

Single-file Express server with all routes, types, and business logic. No database; jobs stored in an in-memory `Map<string, LeadJob>`. Serves both the API and the built frontend static files from `public/`.

### Frontend (`client/`)

React 19 + ShadCN + Tailwind v3 + Vite. "Nightfall Emerald" dark theme with glass-morphism cards, dot-grid background, and emerald accents.

```
client/
  ├── package.json, tsconfig.json, vite.config.ts
  ├── postcss.config.js, tailwind.config.ts, components.json
  ├── index.html
  └── src/
      ├── main.tsx, App.tsx, globals.css
      ├── types.ts, lib/utils.ts
      ├── hooks/use-jobs.ts      # All API calls, polling, state (useReducer)
      └── components/
          ├── ui/                 # ShadCN primitives
          ├── search-form.tsx     # Natural language query input
          ├── job-status.tsx      # Status strip with badge, elapsed time, export
          ├── results-table.tsx   # Scrollable data table with clickable links
          └── jobs-sidebar.tsx    # Brand + job list with live status badges
```

**Dev mode**: Vite (:5173) proxies `/api/*` to Express (:3100). Run both with `npm run dev`.

**Production**: `npm run build` compiles client to `public/`, server to `dist/`. Express serves both.

### Core Flow

1. User submits a natural-language search request via form
2. Server passes the request directly to Exa as a Webset search query with enrichment definitions
3. Server polls Exa until the Webset completes (20-min timeout)
4. Results are fetched, flattened from enrichments, deduplicated (5-field composite key), and stored in-memory
5. Frontend detects completion via polling and renders results table
6. User can export as CSV

### Key Types

- **LeadRow** — 13-field output schema (company name/website/employee count, contact name/title/linkedin/email/phone, office phone, contact page URL, source URL/description, webset item ID)
- **LeadJob** — Job state with status (`pending` | `running` | `completed` | `failed`), timestamps, webset info, and result rows
- **EnrichmentDefinition** — Maps field keys to Exa enrichment instructions with format metadata

### API Endpoints

- `GET /api/config` — UI defaults and column metadata
- `POST /api/jobs` — Create job (body: `{ request: string, count?: number }`)
- `GET /api/jobs` — List all jobs
- `GET /api/jobs/:id` — Job status
- `GET /api/jobs/:id/results` — Result rows
- `GET /api/jobs/:id/export.csv` — CSV download

## Environment

Requires `EXA_API_KEY` in `.env` (see `.env.example`). Optional `PORT` (defaults to 3100).

## Key Patterns

- **`route()` wrapper** — Async error-catching middleware for all route handlers
- **Enrichment field mapping** — Enrichment results mapped to `LeadRow` fields via metadata-driven associations
- **Deduplication** — Composite key from company name + website + contact name + email + phone (normalized lowercase, trimmed)
- **Count clamping** — Job count parameter clamped to 10–1000 range
- **Direct query passthrough** — User's search request is sent directly to Exa without modification
- **`useJobs` hook** — Single React hook managing all job state via `useReducer`, API calls, and polling intervals

<!-- BEGIN KNOWLEDGE-BASE REFERENCES — DO NOT EDIT MANUALLY -->

## Knowledge Base Context

When you need context about this service, the ecosystem, or cross-cutting architecture,
read from the sibling `knowledge-base/` repo:

- `../knowledge-base/services/lead-machine.md` — this service's profile (start here)
- `../knowledge-base/onboarding/system-overview.md` — ecosystem overview
- `../knowledge-base/architecture/` — cross-cutting architecture docs
- `../knowledge-base/specs/` — feature specs and PRDs
- `../knowledge-base/decisions/` — architecture decision records
- `../knowledge-base/runbooks/` — operational runbooks

The service profile contains wiki-links (`[[doc-name]]`) to related docs — resolve them
by looking for matching filenames in the directories above.

<!-- END KNOWLEDGE-BASE REFERENCES -->
