# CORTEX

**Structured Data, On Demand**

CORTEX is an intelligent document processing application for title insurance. It turns unstructured PDFs into structured, queryable data using AI—powered by [Retab](https://retab.com) and built by **SAIL** (Stewart AI Lab).

---

## Business Value

### What Problem CORTEX Solves

- **Manual data entry** — Reduces time spent typing data from deeds, mortgages, liens, and other title documents into downstream systems.
- **Inconsistent extraction** — Applies the same AI and schemas across documents so output is uniform and predictable.
- **Scattered review** — Centralizes low-confidence results in a single review queue with PDF side-by-side and field-level corrections.
- **Rigid exports** — Delivers data in the formats you need (JSON, CSV, TPS-ready) with configurable templates and document-type breakdowns.

### Outcomes

- **Faster throughput** — Upload packets, run split/classify/extract in one flow, then export.
- **Higher quality** — Human review only where the model is uncertain; sealed results are stored and reflected in exports.
- **Cost control** — Per-run credit usage and processing history so you can tune model and consensus settings.
- **Auditability** — Session and document history, reviewer attribution, and export templates live in one place.

### Supported Document Types (Examples)

Deeds (warranty, quitclaim, grant, survivorship), mortgages and deeds of trust, liens (mechanic’s, tax, judgment), easements, title policies, settlement statements (HUD-1, ALTA), surveys, plats, powers of attorney, affidavits, notices, and more. Schemas and categories are configurable in the app.

---

## Technical Overview

### High-Level Flow

1. **Upload** — PDF packets (single or multi-document) via drag-and-drop or file picker; stored on server or processed in-browser.
2. **Split** — Retab detects document boundaries and classifies each segment.
3. **Extract** — Structured data is pulled using configurable schemas; low-confidence items are flagged for review.
4. **Review** — Human verification with PDF preview, field-level edits, and document-type override; sealed results persist.
5. **Export** — JSON, CSV, or TPS-ready formats with optional templates and filters.

### Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, Tailwind CSS, shadcn-style UI; state in React + optional backend session. |
| **Backend** | Node.js, Express 5; proxies split/classify/extract to Retab; REST API and static serve. |
| **Data** | SQLite (better-sqlite3), WAL mode; sessions, packets, documents, history, export templates. |
| **AI** | Retab API (document splitting, classification, schema-based extraction). |

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (React + Vite)  ◄──REST──►  Express (Node)  ◄──HTTPS──►  Retab API
│                                      │
│                                      ▼
│                                 SQLite (sessions, packets, documents)
└─────────────────────────────────────────────────────────────────────┘
```

- **Frontend:** React 19, Vite, Tailwind. Optional DB-backed session for persistence across tabs.
- **Backend:** Express, file upload (multer), temp PDF cleanup, rate limiting, structured logging (pino).
- **Retab:** External service for split, classify, and extract; credits and model tiers configurable in app.

### Key Technical Details

- **PDF handling:** Uploads stored under `data/temp-pdfs` (14-day TTL); display uses Blob URLs and pdfjs-dist canvas renderer; 75 MB max file size to stay within base64/JSON limits.
- **Human review:** Review queue filters by `needsReview` and status; edits and category overrides stored per document; exports respect overrides and schema-aware merging.
- **Resilience:** Error boundaries, API timeouts, graceful shutdown, DB integrity checks, optional backups, zombie packet recovery.
- **Security:** Path traversal checks on file serve, PDF magic-byte validation on upload, safe error messages in production, admin clear protected by env password.

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **Retab API key** — [retab.com](https://retab.com)

### Run Locally

```bash
npm install
npm start
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend:** [http://localhost:3005](http://localhost:3005)

Or run separately:

```bash
npm run server   # Backend only → :3005
npm run dev      # Frontend only → :5173
```

On first load, enter your Retab API key in the app (stored locally in the browser).

### Production

```bash
npm run build
NODE_ENV=production node server.js
```

Serves the built app from the same server on port 3005.

---

## Docker

One URL serves both app and API; no Node.js required on the host.

1. **Install** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac/Windows) or Docker Engine + Compose (Linux).
2. **Start:** `docker-compose up -d`
3. **Open:** [http://localhost:3005](http://localhost:3005)
4. Enter your Retab API key when prompted (browser-only).

| Task | Command |
|------|--------|
| Start (background) | `docker-compose up -d` |
| Logs | `docker-compose logs -f` |
| Stop | `docker-compose down` |
| Stop + remove data | `docker-compose down -v` |
| Rebuild after code change | `docker-compose up -d --build` |

Data (database and uploaded PDFs) is stored in the `cortex-data` volume and persists across `docker-compose up -d --build` and container restarts; use `docker-compose down` without `-v` to keep it.

**Without Compose:** `docker build -t sail-idp .` then  
`docker run -d -p 3005:3005 -v sail-idp-data:/app/data --name sail-idp sail-idp`

**Port in use:** `PORT=3007 docker-compose up -d` then open http://localhost:3007.

---

## Backend API (Summary)

| Area | Endpoints |
|------|-----------|
| Health | `GET /health`, `GET /api/status` |
| Sessions | `GET/POST /api/sessions`, `GET/PATCH /api/sessions/:id`, `POST .../close`, `GET .../full` |
| Packets | `POST /api/upload`, `GET/PATCH/DELETE /api/packets/:id`, `GET .../file`, `POST .../complete` |
| Documents | `GET/PATCH /api/documents/:id`, `GET /api/sessions/:id/review-queue`, `POST /api/documents/:id/review` |
| Retab proxy | `POST /api/documents/extract`, `split`, `classify`, `parse`; `POST/GET /api/jobs`; `POST /api/schemas/generate` |
| History & usage | `GET/POST/DELETE /api/history`, `GET /api/usage` |
| Export templates | `GET/POST/DELETE /api/export-templates` |
| Admin | `GET /api/admin/metrics`, `POST /api/admin/clear-database` (body: `{ "password": "..." }`) |

Request/response shapes and behavior: see `server.js` and route handlers.

---

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3005` | Backend (and app in production) port |
| `NODE_ENV` | `development` | `development` or `production` |
| `DB_PATH` | `./data` | Directory for SQLite DB and temp PDFs |
| `ADMIN_CLEAR_PASSWORD` | `stewart` | Password for `POST /api/admin/clear-database` |
| `CORS_ORIGIN` | `*` | Allowed CORS origin(s) |
| `VITE_API_URL` | (empty) | Backend URL for frontend; empty = same origin |

Database: `./data/sail-idp.db` (WAL). In Docker, persist `/app/data`.

---

## Cost Model (Retab)

- **1 credit ≈ $0.01**
- **Credits per run** ≈ `model_credits × pages × n_consensus`
- Model tiers and consensus are configurable under **Settings** in the app.

---

## Development

```bash
npm run lint     # ESLint
npm run build    # Vite production build
npm run preview  # Preview production build locally
```

---

## License

Proprietary — Stewart Title.

---

**CORTEX** — *Powered by SAIL*
