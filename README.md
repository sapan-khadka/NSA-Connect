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
├── docker-compose.yml       # Postgres, Redis, backend, Celery worker/beat
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
