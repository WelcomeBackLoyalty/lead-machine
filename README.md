# Lead Machine

A general-purpose lead generation tool powered by [Exa](https://exa.ai). Describe what leads you're looking for in natural language, and get structured contact results (name, title, email, phone, LinkedIn, company, website, etc.) with CSV export.

Built with Express/TypeScript on the backend and React/ShadCN/Tailwind on the frontend.

## Quick Start

```bash
# 1. Install dependencies
npm install
cd client && npm install && cd ..

# 2. Set up environment
cp .env.example .env
# Edit .env and add your Exa API key

# 3. Run in development mode
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (Vite dev server with API proxy to Express on :3100).

## Search Examples

Use natural language in the search form:

- `Find me contacts for owners of landscaping companies in Texas`
- `Give me a list of founders of AI startups in San Francisco with their LinkedIn and email`
- `Contacts for proprietors of homeowners association management companies in Florida`

## Output Columns

| Column | Description |
|--------|-------------|
| `company_name` | Organization name |
| `company_website` | Official website URL |
| `employee_count` | Estimated employee count |
| `contact_name` | Primary contact / decision-maker |
| `contact_title` | Role (CEO, Owner, Director, etc.) |
| `contact_linkedin` | LinkedIn profile URL |
| `contact_email` | Public email address |
| `contact_phone` | Direct phone number |
| `office_phone` | Main office phone |
| `contact_page_url` | Organization contact page |
| `source_url` | Source web page |
| `source_description` | Source page description |
| `webset_item_id` | Exa Webset item identifier |

## Architecture

```
├── src/server.ts          # Express API (single-file backend)
├── client/                # React 19 + ShadCN + Tailwind + Vite
│   ├── src/
│   │   ├── App.tsx        # Sidebar + main content layout
│   │   ├── hooks/         # useJobs — API calls, polling, state
│   │   └── components/    # search-form, job-status, results-table, jobs-sidebar
│   └── vite.config.ts     # Builds to ../public, proxies /api to :3100
├── public/                # Build output (gitignored)
└── dist/                  # Compiled server (gitignored)
```

**Dev mode**: Vite dev server (:5173) proxies `/api/*` to Express (:3100). Both run concurrently via `npm run dev`.

**Production**: Client builds to `public/`, server compiles to `dist/`. Express serves both API and static files on a single port.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both servers (Express + Vite) concurrently |
| `npm run dev:server` | Start Express only (tsx watch, :3100) |
| `npm run dev:client` | Start Vite only (:5173) |
| `npm run build` | Build client to `public/` + compile server to `dist/` |
| `npm start` | Run production server from `dist/server.js` |
| `npm run check` | Type-check server (`tsc --noEmit`) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/config` | UI defaults and column metadata |
| `POST` | `/api/jobs` | Create a job (`{ request: string, count?: number }`) |
| `GET` | `/api/jobs` | List all jobs |
| `GET` | `/api/jobs/:id` | Job status |
| `GET` | `/api/jobs/:id/results` | Result rows (completed jobs only) |
| `GET` | `/api/jobs/:id/export.csv` | Download CSV |

## How It Works

1. User submits a natural-language search request
2. Server creates an Exa Webset with the query and enrichment definitions
3. Server polls Exa until the Webset completes (20-min timeout)
4. Results are fetched, flattened from enrichments, deduplicated, and stored in-memory
5. Frontend polls job status every 3 seconds and renders results on completion
6. User can export results as CSV

## Production Deploy

```bash
npm run build
npm start
```

The server runs on port 3100 by default (configurable via `PORT` in `.env`), serving both the API and the built frontend.

## Limits & Behavior

- **Count range**: 10–1000 (clamped)
- **Webset timeout**: 20 minutes
- **Storage**: In-memory only — restarting the server clears all jobs
- **Deduplication**: Composite key from company name + website + contact name + email + phone
- **Runtime**: Small jobs (~10 leads) take 30s–3m. Larger jobs take longer depending on data availability.

## Troubleshooting

- **500 errors during polling**: Check server terminal output for details. Usually caused by upstream Exa API issues.
- **Empty contact fields**: Expected when public web data is unavailable. Try a narrower query or smaller batch.
- **CSV download issues**: Use the direct URL: `http://localhost:3100/api/jobs/<JOB_ID>/export.csv`

## Environment

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXA_API_KEY` | Yes | — | Your Exa API key |
| `PORT` | No | `3100` | Server port |
