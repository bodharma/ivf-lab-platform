# IVF Lab Platform

B2B SaaS platform for embryologists and IVF laboratories.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12+ / FastAPI / SQLAlchemy 2.0 / Alembic |
| Database | PostgreSQL 16 (RLS for multi-tenancy) |
| Frontend | React 18 / TypeScript / Vite |
| Infra | Docker Compose / Hetzner Cloud |
| Monitoring | Grafana / Loki / Prometheus |

## Quick Start

### Prerequisites
- Python 3.12+, [uv](https://docs.astral.sh/uv/)
- Node.js 20+, npm
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)

### Development

```bash
# Backend
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn ivf_lab.main:app --reload

# Frontend
cd frontend/apps/embryologist-console
npm install
npm run dev

# Full stack via Docker
docker compose -f ops/docker/docker-compose.dev.yml up
```

### Tests

```bash
cd backend
uv run pytest
```

## Project Structure

```
ivf-lab-platform/
├── backend/          # FastAPI application
│   ├── src/ivf_lab/  # Source code
│   │   ├── domain/   # Models, services, repositories
│   │   └── infrastructure/  # API, schemas, auth, middleware
│   └── tests/
├── frontend/         # React applications
│   ├── apps/embryologist-console/
│   └── shared/       # Shared components & API client
├── docs/             # Documentation
├── ops/              # Docker, scripts
└── .github/          # CI/CD
```

## MVP Roadmap

- **MVP A** — Embryologist Digital Workbench (current)
- **MVP B** — Tracking / Witnessing
- **MVP C** — Time-lapse Viewer
- **MVP D** — Analytics Dashboard
