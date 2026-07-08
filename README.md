# NSA Connect

Membership and operations platform for the Nepalese Students' Association (NSA) at Southeast Missouri State University.

Handles member registration and approvals, role-based access, events with prep tasks, treasury tracking, and board dashboards.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| API | [FastAPI](https://fastapi.tiangolo.com/) |
| Frontend | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS 4](https://tailwindcss.com/) |
| Database | [PostgreSQL 16](https://www.postgresql.org/) |
| ORM | [SQLAlchemy 2](https://www.sqlalchemy.org/) |
| Migrations | [Alembic](https://alembic.sqlalchemy.org/) |
| Cache / queue | [Redis 7](https://redis.io/) + [Celery](https://docs.celeryq.dev/) |
| Email | [SendGrid](https://sendgrid.com/) |
| Receipts | [Cloudinary](https://cloudinary.com/) |
| Tests | [pytest](https://docs.pytest.org/) + [Vitest](https://vitest.dev/) |

---

## Project Structure

```
NSA-Connect/
├── docker-compose.yml       # Postgres, Redis, backend, Celery worker/beat, db-backup
├── BACKUPS.md               # Database backup & restore runbook
├── backup/                  # Automated PostgreSQL backup system
├── backups/                 # Local backup artifacts (gitignored)
├── backend/
│   ├── app/                 # FastAPI application
│   ├── alembic/             # Database migrations
│   ├── scripts/             # Dev utilities (seed data)
│   └── tests/
└── frontend/                # React SPA
```

---

## Quick Start (Docker)

```bash
# From project root
docker compose up -d

# Apply migrations
docker compose exec backend alembic upgrade head

# Optional: seed demo events + finance data
docker compose exec backend python -m scripts.seed_demo_data
```

| URL | Description |
|-----|-------------|
| http://localhost:8000/docs | Swagger API docs |
| http://localhost:8000/api/v1/health | Health check |
| http://localhost:5173 | Frontend dev server (run separately) |

### Frontend dev server

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL=http://localhost:8000/api` in `frontend/.env` if needed (defaults to `/api` via Vite proxy in dev).

---

## Local Backend (without Docker for API)

```bash
docker compose up -d postgres redis

cd backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env   # edit as needed
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env`.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis for Celery |
| `SECRET_KEY` | JWT signing key |
| `SENDGRID_API_KEY` | Transactional email |
| `EMAIL_ENABLED` | Set `true` to send real emails |
| `CLOUDINARY_CLOUD_NAME` | Receipt image uploads |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `AI_ENABLED` | Set `true` to enable all AI features (default `false`) |
| `ANTHROPIC_API_KEY` | Anthropic key for checklist, announcement, minutes, and chat |
| `ANTHROPIC_MODEL` | Claude model (default `claude-sonnet-4-20250514`) |
| `OPENAI_API_KEY` | OpenAI key for constitution embeddings |
| `EMBEDDING_MODEL` | Embedding model (default `text-embedding-3-small`) |
| `CONSTITUTION_CHUNK_SIZE_TOKENS` | Tokens per constitution chunk (default `800`) |
| `CONSTITUTION_CHUNK_OVERLAP_TOKENS` | Token overlap between chunks (default `200`) |
| `CONSTITUTION_SEARCH_DEFAULT_LIMIT` | Chunks returned by semantic search (default `5`) |
| `AI_CHAT_RAG_CHUNK_LIMIT` | Constitution chunks injected into chat RAG context (default `5`) |

---

## Roles & Access

| Role | Access |
|------|--------|
| **general** | Member dashboard, events, profile |
| **board** | Approvals, member directory, finance budget view |
| **treasurer** | Full finance (log entries, receipts, summaries) |
| **president** | All treasurer + board capabilities, role promotion |

---

## Key API Endpoints

| Method | Path | Access |
|--------|------|--------|
| `POST` | `/api/v1/auth/register` | Public |
| `POST` | `/api/v1/auth/login` | Public |
| `GET` | `/api/v1/members/pending` | Board+ |
| `GET` | `/api/v1/members/{id}` | Board+ |
| `GET` | `/api/v1/events` | Authenticated |
| `POST` | `/api/v1/events` | Board+ |
| `GET` | `/api/v1/finance/summary` | Treasurer+ |
| `GET` | `/api/v1/finance/event-budgets` | Board+ |
| `GET` | `/api/v1/finance/expenses/by-category` | Board+ |
| `POST` | `/api/v1/finance` | Treasurer+ |
| `POST` | `/api/v1/finance/receipts` | Treasurer+ |

---

## AI Features

NSA Connect ships four AI-assisted workflows powered by Anthropic Claude, plus a
constitution knowledge base backed by OpenAI embeddings and pgvector semantic
search. All AI features are gated behind `AI_ENABLED=true`; when disabled, the
endpoints return `503 Service Unavailable`.

### Setup

```bash
# backend/.env
AI_ENABLED=true
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...        # only needed for constitution upload/search/chat RAG
```

The constitution table requires the pgvector extension, which is created by the
migrations — run `alembic upgrade head` after enabling AI.

### What's included

| Feature | Where | Access |
|---------|-------|--------|
| **Event prep checklist** | "Generate Checklist" button in the create-event form (`/events`) | Board+ |
| **Announcement email draft** | `/board/announcement-email` | Board+ |
| **Meeting minutes summary** | `/board/meeting-minutes` | Board+ |
| **AI assistant chat** | `/assistant` (streaming, with constitution RAG + live data tools) | Authenticated |
| **Constitution knowledge base** | PDF upload + semantic search feeding chat | Upload: Board+, Search: Authenticated |

### AI Endpoints

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| `POST` | `/api/v1/ai/generate-checklist` | Board+ | Categorized prep tasks from an event name/type |
| `POST` | `/api/v1/ai/draft-announcement-email` | Board+ | Subject + formatted body from an event name |
| `POST` | `/api/v1/ai/summarize-minutes` | Board+ | Structured summary, decisions, action items from raw notes |
| `POST` | `/api/v1/ai/chat` | Authenticated | RAG + live-data answer (non-streaming) |
| `POST` | `/api/v1/ai/chat/stream` | Authenticated | Same as chat, streamed token-by-token (SSE) |
| `POST` | `/api/v1/constitution/upload` | Board+ | Upload constitution PDF → chunk → embed → store |
| `POST` | `/api/v1/constitution/search` | Authenticated | Cosine-similarity semantic search over chunks |

### Examples

**Generate an event prep checklist**

```bash
curl -X POST http://localhost:8000/api/v1/ai/generate-checklist \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_name": "Dashain Celebration", "event_type": "cultural"}'
```

```json
{
  "categories": [
    { "category": "Venue & Setup", "tasks": ["Reserve University Center ballroom", "Confirm AV and sound check"] },
    { "category": "Food & Beverage", "tasks": ["Order catering", "Confirm dietary restrictions"] }
  ]
}
```

**Draft an announcement email**

```bash
curl -X POST http://localhost:8000/api/v1/ai/draft-announcement-email \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_name": "Spring Social", "event_type": "social", "location": "Student Center"}'
```

```json
{
  "subject": "You're invited: Spring Social",
  "body": "Hi NSA members,\n\nJoin us for Spring Social...\n\nBest,\nNepalese Students' Association (NSA Connect)"
}
```

**Summarize meeting minutes**

```bash
curl -X POST http://localhost:8000/api/v1/ai/summarize-minutes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"meeting_title": "March Board Meeting", "notes": "dashain oct - sapan reserve room\ntreasurer send budget sheet"}'
```

```json
{
  "summary": "The board reviewed upcoming events and budget items...",
  "key_decisions": ["Approved Dashain date"],
  "action_items": [
    { "task": "Reserve University Center room for Dashain", "owner": "Sapan", "due": null }
  ]
}
```

**Chat with the AI assistant (streaming)**

The assistant retrieves relevant constitution passages and can call live-data
tools (events, prep tasks, member counts, finance) before answering. Tokens
stream back as Server-Sent Events; the chat UI renders them live with a typing
indicator, a blinking cursor, and a **Stop** button.

```bash
curl -N -X POST http://localhost:8000/api/v1/ai/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "How are officers elected?", "history": []}'
```

```
event: status
data: {"phase": "retrieving"}

event: token
data: {"text": "According "}

event: token
data: {"text": "to the constitution..."}

event: metadata
data: {"constitution_sources": [{"section": "Article I", "excerpt": "Officers must be elected by a majority vote."}], "tool_calls": []}
```

**Upload the constitution for retrieval**

```bash
curl -X POST http://localhost:8000/api/v1/constitution/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@nsa_constitution.pdf"
```

Extracts text, splits into overlapping token chunks, generates embeddings, and
replaces the stored chunks so the chat assistant can cite the latest document.

---

## Database

```bash
cd backend
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

### Seed demo data

```bash
cd backend
python -m scripts.seed_demo_data
```

Creates sample events and finance entries (skips if entries already exist).

---

## Tests

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm test

# Frontend production build
cd frontend && npm run build
```

---

## Service Ports

| Service | Port |
|---------|------|
| Backend API | 8000 |
| Frontend (Vite) | 5173 |
| PostgreSQL | 5433 |
| Redis | 6379 |

---

## License

TBD
