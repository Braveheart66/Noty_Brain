# Noty Brain

AI-powered personal knowledge management system with:

- JWT auth and profile endpoints
- Notes CRUD with soft delete and restore
- Note version history (last 10 revisions)
- URL, text, and PDF ingestion
- Semantic-style search over note content
- Grounded Q&A with source note citations
- Query history
- Knowledge graph nodes and edges API
- Dashboard metrics and cluster analysis report
- React frontend for all core flows

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Django + DRF + SimpleJWT
- Data: PostgreSQL
- Services: Redis, Qdrant, Celery
- Local orchestration: Docker Compose

## Project Structure

- backend: Django API
- frontend: React app
- docker-compose.yml: full local stack
- .env.example: required environment variables

## Setup

### 1. Environment file

Copy `.env.example` to `.env` in the project root and update values as needed.

### 2. Start with Docker (recommended)

From project root:

```powershell
docker compose up --build
```

If `docker` is not recognized on Windows, install Docker Desktop first:

```powershell
winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
```

Then restart Windows or sign out/sign in, open Docker Desktop once, and run:

```powershell
docker compose up --build
```

Services:

- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- Postgres: localhost:5432
- Redis: localhost:6379
- Qdrant: http://localhost:6333

### 3. Run backend locally without Docker (optional)

```powershell
Set-Location backend
d:/Noty_Brain/.venv/Scripts/python.exe -m pip install -r requirements.txt
d:/Noty_Brain/.venv/Scripts/python.exe manage.py migrate
d:/Noty_Brain/.venv/Scripts/python.exe manage.py runserver
```

If your `.env` is Docker-oriented (`DB_HOST=postgres`), use the helper script instead:

```powershell
Set-Location d:/Noty_Brain
.\run-local-backend.ps1
```

### 4. Run frontend locally without Docker (optional)

```powershell
Set-Location frontend
npm install
npm run dev
```

Or use:

```powershell
Set-Location d:/Noty_Brain
.\run-local-frontend.ps1
```

### 5. Optional free local LLM for `/api/ask/` (Ollama)

Install Ollama and pull a lightweight model:

```powershell
ollama pull qwen2.5:3b-instruct
```

Set these values in `.env`:

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen2.5:3b-instruct
OLLAMA_TIMEOUT_SECONDS=120
```

Recreate backend so updated env vars are applied:

```powershell
docker compose up -d --force-recreate backend
```

## Testing

Run backend API tests quickly with in-memory SQLite:

```powershell
Set-Location backend
$env:DB_ENGINE='django.db.backends.sqlite3'
$env:DB_NAME=':memory:'
d:/Noty_Brain/.venv/Scripts/python.exe manage.py test notes search analytics graph -v 2 --noinput
```

Run frontend build validation:

```powershell
Set-Location frontend
npm run build
```

## Key API Endpoints

- POST /api/auth/register/
- POST /api/auth/token/
- POST /api/auth/token/refresh/
- GET /api/auth/profile/
- GET|POST /api/notes/
- GET|PATCH|DELETE /api/notes/{id}/
- POST /api/notes/{id}/restore/
- POST /api/notes/{id}/links/
- DELETE /api/notes/{id}/links/{link_id}/
- POST /api/notes/ingest/url/
- POST /api/notes/ingest/text/
- POST /api/notes/ingest/pdf/
- POST /api/search/
- POST /api/ask/
- GET /api/ask/history/
- GET /api/graph/
- GET /api/analytics/dashboard/
- POST /api/analytics/clusters/

## Important Notes

- Notes and query history are user-isolated.
- Semantic search is lexical similarity-based.
- Q&A supports optional local Ollama grounding (`LLM_PROVIDER=ollama`) with lexical fallback on errors.
- Qdrant, embeddings, and LLM provider integration can replace fallback logic in a later iteration.

## Next Actions

1. Wire sentence-transformers embedding generation and Qdrant upsert/query for true vector search.
2. Add Celery tasks for async embedding and ingestion retries.
3. Add frontend graph visualization with Cytoscape or D3 using `/api/graph/`.
4. Add pagination and rate limiting for heavy endpoints.
5. Add CI pipeline to run backend tests and frontend build on each PR.
