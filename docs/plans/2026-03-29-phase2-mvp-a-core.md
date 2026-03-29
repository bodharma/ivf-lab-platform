# Phase 2: MVP A Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build the full backend API for MVP A (cycles, embryos, events, checklists, storage, patients) and scaffold the React frontend with auth flow, dashboard, and core views.

**Architecture:** REST API with layered services. Frontend: React + TypeScript + Vite + TanStack Query + React Hook Form + shadcn/ui.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Pydantic v2, React 18, TypeScript, Vite, TanStack Query, Zod

---

## Backend Tasks (API)

### Task 1: Patient Aliases CRUD
- `backend/src/ivf_lab/infrastructure/schemas/patient.py` — PatientCreate, PatientUpdate, PatientResponse
- `backend/src/ivf_lab/domain/repositories/patient_repo.py` — list (with search), create, update
- `backend/src/ivf_lab/infrastructure/api/patients.py` — GET /patients, POST /patients, PATCH /patients/{id}
- `backend/tests/integration/test_patients_api.py`

### Task 2: Cycles CRUD + State Machine
- `backend/src/ivf_lab/infrastructure/schemas/cycle.py` — CycleCreate, CycleUpdate, CycleResponse, CycleTodayResponse
- `backend/src/ivf_lab/domain/repositories/cycle_repo.py` — list, today, get_detail, create, update
- `backend/src/ivf_lab/domain/services/cycle_service.py` — state transitions (planned→active→completed|cancelled), validation
- `backend/src/ivf_lab/infrastructure/api/cycles.py` — GET /cycles, GET /cycles/today, POST /cycles, GET /cycles/{id}, PATCH /cycles/{id}
- `backend/tests/integration/test_cycles_api.py`

### Task 3: Embryos CRUD + Event Recording
- `backend/src/ivf_lab/infrastructure/schemas/embryo.py` — EmbryoCreate, EmbryoResponse
- `backend/src/ivf_lab/infrastructure/schemas/embryo_event.py` — discriminated unions per event_type, EmbryoEventCreate, EmbryoEventResponse
- `backend/src/ivf_lab/domain/repositories/embryo_repo.py` — list by cycle, get with events
- `backend/src/ivf_lab/domain/services/embryo_service.py` — create embryo, record event, compute time_hpi, disposition transitions
- `backend/src/ivf_lab/infrastructure/api/embryos.py` — GET /cycles/{id}/embryos, POST /cycles/{id}/embryos, GET /embryos/{id}, GET /embryos/{id}/events, POST /embryos/{id}/events
- `backend/tests/integration/test_embryos_api.py`

### Task 4: Checklists CRUD + Execution
- `backend/src/ivf_lab/infrastructure/schemas/checklist.py` — TemplateCreate/Response, InstanceCreate/Response, ItemComplete
- `backend/src/ivf_lab/domain/repositories/checklist_repo.py`
- `backend/src/ivf_lab/domain/services/checklist_service.py` — create instance from template, complete items, auto-complete status
- `backend/src/ivf_lab/infrastructure/api/checklists.py` — all checklist endpoints
- `backend/tests/integration/test_checklists_api.py`

### Task 5: Storage Locations CRUD
- `backend/src/ivf_lab/infrastructure/schemas/storage.py`
- `backend/src/ivf_lab/domain/repositories/storage_repo.py`
- `backend/src/ivf_lab/infrastructure/api/storage.py` — GET /storage, GET /storage/{id}, POST /storage
- `backend/tests/integration/test_storage_api.py`

### Task 6: Audit Log Query Endpoint
- `backend/src/ivf_lab/infrastructure/schemas/audit.py`
- `backend/src/ivf_lab/infrastructure/api/audit.py` — GET /audit (lab_manager+ only)
- `backend/tests/integration/test_audit_api.py`

### Task 7: Wire All Routers + OpenAPI
- Modify `backend/src/ivf_lab/main.py` — include all routers
- Verify OpenAPI docs at /docs

## Frontend Tasks

### Task 8: React Scaffold + Auth
- Initialize Vite + React + TypeScript in `frontend/apps/embryologist-console/`
- Install: @tanstack/react-query, react-router-dom, react-hook-form, zod, @hookform/resolvers
- Setup: routing, auth context, API client (typed fetch), login page
- Protected route wrapper

### Task 9: Dashboard / Today View
- Fetch GET /cycles/today
- Render cycle cards sorted by urgency
- Embryo mini-grid per cycle with grade badges
- Pending checklists inline

### Task 10: Cycle View + Embryo Grid
- Fetch GET /cycles/{id} with embryos
- Embryo table (Code, Day, Grade, HPI, Status)
- Checklists section
- Activity log

### Task 11: Embryo Detail + Grade Forms
- Fetch GET /embryos/{id} with events
- Event timeline
- Day-aware grade form (fertilization / cleavage / blastocyst)
- POST /embryos/{id}/events on submit

### Task 12: Checklist Runner
- Fetch GET /checklists/{id}
- Step-by-step item completion
- POST /checklists/{id}/items/{index}

## Task Dependencies

```
Task 1 (patients) ──┐
Task 2 (cycles) ────┤── Task 7 (wire routers) ── Task 8 (frontend scaffold)
Task 3 (embryos) ───┤                                    │
Task 4 (checklists) ┤                            Task 9 (dashboard)
Task 5 (storage) ───┤                            Task 10 (cycle view)
Task 6 (audit) ─────┘                            Task 11 (embryo detail)
                                                  Task 12 (checklist runner)
```

Backend tasks 1-6 are independent. Task 7 depends on all. Frontend tasks 9-12 depend on 8.
