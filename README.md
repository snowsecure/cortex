# CORTEX

**Structured Data, On Demand**

CORTEX is an intelligent document processing application for title insurance. It turns unstructured PDFs into structured, queryable data using AI—powered by [Retab](https://retab.com) and built by **SAIL** (Stewart AI Lab).

---

## What CORTEX Does

1. **Upload** — Drop PDF packets (single or multi-document files).
2. **Split** — AI detects document boundaries and classifies each segment.
3. **Extract** — Structured data is pulled using configurable schemas.
4. **Export** — Output as JSON, CSV, or TPS-ready formats.

Low-confidence extractions are routed to a **Review** queue for human verification. Processing history, cost tracking, and export templates are built in.

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- A **Retab API key** ([retab.com](https://retab.com))

### Run Locally

```bash
# Install dependencies
npm install

# Start backend (API + DB) and frontend together
npm start
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)  
- **Backend:** [http://localhost:3001](http://localhost:3001)

Run them separately if you prefer:

```bash
npm run server   # Backend only → http://localhost:3001
npm run dev      # Frontend only → http://localhost:5173
```

On first load, enter your Retab API key in the app (stored locally in the browser).

### Production Build

```bash
npm run build
NODE_ENV=production node server.js
```

Serves the built app from the same server at port 3001.

---

## Docker (ready to go)

Docker runs CORTEX in a container so you don’t need Node.js installed. One URL serves both the app and the API.

### If you’ve never used Docker

1. **Install Docker Desktop**  
   - [Mac/Windows](https://www.docker.com/products/docker-desktop/) — download and install, then open Docker Desktop and leave it running.  
   - Linux: install [Docker Engine](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/).

2. **Open a terminal** in the project folder (where `docker-compose.yml` lives).

3. **Start CORTEX:**
   ```bash
   docker-compose up -d
   ```
   The first time, this builds the image (can take a minute or two). Later runs start in seconds.

4. **Open your browser** to:
   ```
   http://localhost:3001
   ```
   That’s the app. No separate frontend URL.

5. **First time in the app:** Enter your [Retab API key](https://retab.com) when prompted (it’s stored in your browser only).

### Docker commands you’ll use

| What you want | Command |
|---------------|--------|
| **Start CORTEX** (in background) | `docker-compose up -d` |
| **See if it’s running** | `docker-compose ps` |
| **View logs** (live) | `docker-compose logs -f` |
| **Stop CORTEX** | `docker-compose down` |
| **Stop and delete all data** (fresh start) | `docker-compose down -v` |
| **Rebuild after code changes** | `docker-compose up -d --build` |

### Run the image without Compose

If you prefer not to use Compose:

```bash
docker build -t cortex .
docker run -d -p 3001:3001 -v cortex-data:/app/data --name cortex cortex
```

Open **http://localhost:3001**. To stop: `docker stop cortex`. Data is in the `cortex-data` volume.

### Troubleshooting

- **“Port 3001 is already in use”**  
  Something else is using 3001. Stop that app, or set a different port:  
  `PORT=3002 docker-compose up -d`  
  Then open http://localhost:3002.

- **Where is my data?**  
  In a Docker volume named `cortex-data`. It persists across restarts. To wipe it: `docker-compose down -v`.

- **Changes I made aren’t showing**  
  Rebuild the image: `docker-compose up -d --build`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CORTEX Stack                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Browser (React)          Express Server           Retab API    │
│   ┌─────────────┐          ┌─────────────┐          ┌─────────┐  │
│   │  CORTEX UI   │ ◄──────► │  server.js  │ ◄──────► │ ai.     │  │
│   │  (Vite)      │   REST   │  (Node)     │   HTTPS  │ retab.  │  │
│   └─────────────┘          └──────┬──────┘          │ com     │  │
│                                   │                 └─────────┘  │
│                            ┌──────▼──────┐                       │
│                            │   SQLite    │                       │
│                            │   (sessions, │                       │
│                            │   packets,   │                       │
│                            │   documents) │                       │
│                            └─────────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

- **Frontend:** React 19, Vite, Tailwind CSS. State lives in React + optional backend session.
- **Backend:** Express, proxies extraction/split/classify to Retab, stores sessions/packets/documents in SQLite.
- **Retab:** External AI for document splitting, classification, and schema-based extraction.

---

## Backend API (Summary)

| Area | Endpoints |
|------|-----------|
| **Health** | `GET /health`, `GET /api/status` |
| **Sessions** | `GET/POST /api/sessions`, `GET/PATCH /api/sessions/:id`, `POST .../close` |
| **Packets** | `POST/GET/PATCH/DELETE /api/packets`, `POST .../complete` |
| **Documents** | `POST/GET /api/documents`, `GET /api/sessions/:id/review-queue`, `POST /api/documents/:id/review` |
| **Retab proxy** | `POST /api/documents/extract`, `split`, `classify`, `parse`; `POST/GET /api/jobs`; `POST /api/schemas/generate` |
| **History & usage** | `GET/POST/DELETE /api/history`, `GET /api/usage` |
| **Export templates** | `GET/POST/DELETE /api/export-templates` |

See the source (e.g. `server.js`) for request/response shapes and detailed behavior.

---

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend port |
| `NODE_ENV` | `development` | `development` or `production` |
| `DB_PATH` | `./data` | Directory for SQLite DB |
| `CORS_ORIGIN` | `*` | Allowed CORS origin(s) |
| `VITE_API_URL` | `http://localhost:3001` | Backend URL used by frontend build |

Database file: `./data/sail-idp.db` (WAL mode). In Docker, persist `/app/data`.

---

## Document Types (Examples)

CORTEX supports many title-related document types, including:

- Deeds (warranty, quitclaim, grant, survivorship)
- Mortgages & deeds of trust
- Liens (mechanic’s, tax, judgment)
- Easements & rights of way
- Title policies, settlement statements (HUD-1, ALTA)
- Surveys, plats, powers of attorney, affidavits, notices, and more

Schemas and categories are configurable; see in-app **Schemas** and **Help & Docs**.

---

## Cost Model (Retab)

- **1 credit ≈ $0.01**
- **Credits per run** ≈ `model_credits × pages × n_consensus`
- Model tiers (e.g. small / medium / large) and consensus settings are in **Settings** in the app.

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
