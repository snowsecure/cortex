# SAIL-IDP v0.2.0

**Stewart AI Intelligent Document Processing**

Enterprise-ready document ingestion and extraction platform powered by Retab AI.

## Features

- **Batch Document Processing**: Upload multiple document packets for parallel processing
- **Intelligent Splitting**: Automatically splits multi-document PDFs into individual documents
- **Schema-Based Extraction**: Extract structured data using predefined title document schemas
- **Human Review Queue**: Flag low-confidence extractions for manual review
- **Persistent Storage**: SQLite database for robust data persistence
- **Cost Tracking**: Real-time credit usage and cost monitoring
- **Customizable Exports**: Export data in JSON, CSV, or summary formats
- **Docker Ready**: Production-ready containerization

## Quick Start

### Development Mode

```bash
# Install dependencies
npm install

# Start both frontend and backend
npm start

# Or run separately:
npm run server  # Backend on http://localhost:3001
npm run dev     # Frontend on http://localhost:5173
```

### Production Mode

```bash
# Build and run
npm run production

# Server runs at http://localhost:3001
```

### Docker Deployment

```bash
# Build and start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Stop and remove data (WARNING: deletes database)
docker-compose down -v
```

Or build manually:

```bash
docker build -t sail-idp .
docker run -p 3001:3001 -v sail-idp-data:/app/data sail-idp
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SAIL-IDP Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   React     │────│   Express   │────│   Retab API         │ │
│  │   Frontend  │    │   Backend   │    │   (ai.retab.com)    │ │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘ │
│                            │                                    │
│                     ┌──────▼──────┐                            │
│                     │   SQLite    │                            │
│                     │   Database  │                            │
│                     └─────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Health & Status
- `GET /health` - Health check
- `GET /api/status` - Server status with database stats

### Sessions
- `GET /api/sessions/active` - Get or create active session
- `GET /api/sessions/:id` - Get session by ID
- `GET /api/sessions/:id/full` - Get session with all packets and documents
- `POST /api/sessions` - Create new session
- `PATCH /api/sessions/:id` - Update session
- `POST /api/sessions/:id/close` - Close session

### Packets
- `POST /api/packets` - Create packet(s)
- `GET /api/packets/:id` - Get packet
- `GET /api/sessions/:id/packets` - Get packets by session
- `PATCH /api/packets/:id` - Update packet
- `POST /api/packets/:id/complete` - Mark packet complete
- `DELETE /api/packets/:id` - Delete packet

### Documents
- `POST /api/documents` - Create document(s)
- `GET /api/documents/:id` - Get document
- `GET /api/packets/:id/documents` - Get documents by packet
- `GET /api/sessions/:id/review-queue` - Get documents needing review
- `POST /api/documents/:id/review` - Review document (approve/reject)

### Retab Proxy
- `POST /api/documents/extract` - Extract data from document
- `POST /api/documents/split` - Split document into subdocuments
- `POST /api/documents/classify` - Classify document type
- `POST /api/documents/parse` - Parse document
- `POST /api/schemas/generate` - Generate schema
- `POST /api/jobs` - Create async job
- `GET /api/jobs/:id` - Get job status

### History & Usage
- `GET /api/history` - Get processing history
- `POST /api/history` - Create history entry
- `DELETE /api/history/:id` - Delete history entry
- `DELETE /api/history` - Clear all history
- `GET /api/usage` - Get usage statistics

### Export Templates
- `GET /api/export-templates` - List templates
- `POST /api/export-templates` - Save template
- `DELETE /api/export-templates/:name` - Delete template

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `DB_PATH` | `./data` | Database directory |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |
| `VITE_API_URL` | `http://localhost:3001` | API URL for frontend |

## Database Schema

### Tables

- **sessions** - Processing sessions
- **packets** - Document packets
- **documents** - Extracted documents
- **history** - Processing history
- **usage_daily** - Daily usage aggregates
- **export_templates** - Saved export configurations

### Data Persistence

- Database stored at `./data/sail-idp.db`
- WAL mode enabled for concurrent access
- In Docker, mount `/app/data` volume for persistence

## Cost Tracking

Based on Retab pricing:
- **1 Credit = $0.01**
- **retab-small = 1.0 credit/page**
- **Formula**: `credits = model_credits × pages × n_consensus`

## Document Types Supported

- Deeds (Warranty, Quitclaim, Grant, Survivorship, etc.)
- Mortgages & Deeds of Trust
- Liens (Mechanic's, Tax, Judgment, etc.)
- Easements & Rights of Way
- Title Insurance Policies
- Settlement Statements (HUD-1, ALTA)
- Surveys & Plats
- Powers of Attorney
- Affidavits
- Notices & Agreements
- And more...

## Development

```bash
# Run linting
npm run lint

# Preview production build
npm run preview
```

## License

Proprietary - Stewart Title
