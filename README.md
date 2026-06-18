# NSA Connect

A membership management platform for NSA (Norwegian Students' Association), built to handle member registration, roles, and approvals in one place.

**Week 1 status:** Project foundation — API skeleton, database models, Docker dev environment, Alembic migrations, and health checks are in place. Auth, member endpoints, and events are planned next.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| API | [FastAPI](https://fastapi.tiangolo.com/) |
| Database | [PostgreSQL 16](https://www.postgresql.org/) |
| ORM | [SQLAlchemy 2](https://www.sqlalchemy.org/) |
| Migrations | [Alembic](https://alembic.sqlalchemy.org/) |
| Cache | [Redis 7](https://redis.io/) |
| Server | [Uvicorn](https://www.uvicorn.org/) |
| Config | [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) |
| Containers | Docker & Docker Compose |
| Tests | [pytest](https://docs.pytest.org/) |

All Python dependencies are **pinned** in `requirements.txt` (runtime) and `requirements-dev.txt` (development) for reproducible builds.

---

## Project Structure

```
NSA-Connect/
├── docker-compose.yml      # Postgres, Redis, and backend services
├── backend/
│   ├── app/
│   │   ├── api/v1/         # API route handlers
│   │   ├── core/           # Config, database, security
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── services/       # Business logic
│   ├── alembic/            # Database migrations
│   ├── tests/              # pytest test suite
│   ├── Dockerfile          # Dev backend image
│   ├── requirements.txt    # Production/runtime deps
│   └── requirements-dev.txt
└── README.md
```

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended), **or**
- Python 3.13+ and a local PostgreSQL instance

---

## Quick Start (Docker)

The fastest way to run everything:

```bash
# From the project root
docker compose up -d

# Apply database migrations
docker compose exec backend alembic upgrade head
```

The API will be available at:

| URL | Description |
|-----|-------------|
| http://localhost:8000 | Root endpoint |
| http://localhost:8000/docs | Interactive API docs (Swagger) |
| http://localhost:8000/api/v1/health | Health check (includes DB ping) |

Stop all services:

```bash
docker compose down
```

---

## Local Development (without Docker for the API)

Use Docker only for Postgres and Redis, and run the API on your machine:

```bash
# Start Postgres and Redis
docker compose up -d postgres redis

# Set up Python environment
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements-dev.txt

# Run migrations
alembic upgrade head

# Start the API with hot reload
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Environment Variables

Create `backend/.env` to override defaults (optional):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/nsa_connect
```

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/nsa_connect` | PostgreSQL connection string |

---

## Database

```bash
# Create a new migration after model changes
alembic revision --autogenerate -m "describe your change"

# Apply migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1
```

**Current schema:** `members` table with roles (`president`, `treasurer`, `board`, `general`) and approval status (`pending`, `approved`, `rejected`).

---

## Running Tests

```bash
cd backend
source venv/bin/activate
pytest
```

---

## API Endpoints (Week 1)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | API status message |
| `GET` | `/api/v1/health` | Health check with database connectivity |

More endpoints (auth, members, events) coming in upcoming weeks.

---

## Service Ports

| Service | Port | Notes |
|---------|------|-------|
| Backend API | `8000` | FastAPI / Uvicorn |
| PostgreSQL | `5433` | Mapped from container port `5432` |
| Redis | `6379` | Cache / sessions (planned) |

---

## License

TBD
