# IVF Lab Platform

## Project
B2B SaaS for IVF laboratories. Monorepo: FastAPI backend + React frontend.

## Stack
- Backend: Python 3.12+ / FastAPI / SQLAlchemy 2.0 / Alembic / PostgreSQL 16
- Frontend: React 18 / TypeScript / Vite / TanStack Query / React Hook Form
- Infra: Docker Compose / Hetzner Cloud / Grafana+Loki+Prometheus

## Structure
- backend/src/ivf_lab/ — FastAPI application
  - domain/ — models, services, repositories (business logic)
  - infrastructure/ — api routers, schemas, auth, middleware (HTTP layer)
- frontend/apps/embryologist-console/ — React SPA
- ops/ — Docker, deployment scripts

## Conventions
- SQLAlchemy 2.0 async style (mapped_column, async session)
- Pydantic v2 schemas separate from ORM models
- All tenant-scoped tables have clinic_id column with RLS
- EmbryoEvent is append-only (source of truth for embryo state)
- Audit log is append-only (no UPDATE/DELETE)
- Patient aliases only — no PII stored
- UTC timestamps everywhere, frontend converts to clinic timezone

## Commands
- Backend: cd backend && uv run uvicorn ivf_lab.main:app --reload
- Frontend: cd frontend/apps/embryologist-console && npm run dev
- Tests: cd backend && uv run pytest
- Migrations: cd backend && uv run alembic upgrade head
- Docker: docker compose -f ops/docker/docker-compose.yml up

## Key Domain Rules
- Embryo disposition derived from latest disposition_change event
- Cycle states: planned → active → completed|cancelled
- Grading is day-aware: Day 1 = fertilization, Day 2-3 = cleavage, Day 5-6 = blastocyst (Gardner)
- time_hpi computed server-side from cycle.insemination_time
- Discard requires senior_embryologist or higher role
