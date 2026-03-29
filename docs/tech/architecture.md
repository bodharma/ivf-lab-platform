# Architecture

## Codebase Navigation

```
backend/src/ivf_lab/
├── config/
│   ├── settings.py          Env-driven config (IVF_ prefix). DB URL, JWT settings, bcrypt rounds.
│   └── database.py          SQLAlchemy async engine + session factory (pool_size=10, max_overflow=20).
├── domain/
│   ├── models/              SQLAlchemy 2.0 ORM models. All tenant tables extend TenantBase.
│   │   ├── base.py          Base (DeclarativeBase) + TenantBase (id, clinic_id, created_at).
│   │   ├── enums.py         All string enums: UserRole, CycleStatus, EmbryoDisposition, etc.
│   │   ├── clinic.py        Tenant root. NOT RLS-scoped.
│   │   ├── user.py          Staff members. role is TEXT (UserRole enum value).
│   │   ├── patient_alias.py No PII. alias_code + partner self-ref.
│   │   ├── cycle.py         Treatment cycle. insemination_time is key for HPI computation.
│   │   ├── embryo.py        Embryo. disposition is a derived cache from events.
│   │   ├── embryo_event.py  Append-only. JSONB data field for polymorphic grading schemas.
│   │   ├── checklist.py     ChecklistTemplate + ChecklistInstance + ChecklistItemResponse.
│   │   ├── storage.py       Self-referencing tree (parent_id).
│   │   └── audit_log.py     Append-only. JSONB changes field for before/after diffs.
│   ├── repositories/        Data access. Each repo takes AsyncSession in constructor.
│   │   ├── base.py          Generic CRUD: get_by_id, create, etc.
│   │   ├── cycle_repo.py    list_cycles, get_today_cycles, get_week_cycles, get_detail, get_embryos_for_cycle
│   │   ├── embryo_repo.py   list_by_cycle, get_with_events, list_events
│   │   ├── checklist_repo.py Template + Instance repos
│   │   ├── patient_repo.py  list_patients (with search), create
│   │   ├── storage_repo.py  list_all, get_by_id, create
│   │   └── user_repo.py     find_by_email, list_users
│   └── services/            Business logic. Stateless functions.
│       ├── auth_service.py  Login: verify password, create tokens
│       ├── cycle_service.py State machine: transition_status(), update_cycle()
│       ├── embryo_service.py create_embryo(), record_event() (validates transitions, computes HPI)
│       ├── checklist_service.py create_instance(), complete_item() (auto-completes instance)
│       └── audit_service.py Audit log creation
├── infrastructure/
│   ├── api/                 FastAPI routers. One file per domain.
│   │   ├── deps.py          get_db() (session generator), get_current_user() (JWT extraction + RLS setup)
│   │   ├── auth.py          POST /auth/login, /auth/refresh, GET /auth/me
│   │   ├── patients.py      GET/POST /patients, PATCH /patients/{id}
│   │   ├── cycles.py        GET/POST /cycles, GET /cycles/today, /cycles/week, /cycles/{id}, PATCH
│   │   ├── embryos.py       GET/POST /cycles/{id}/embryos, GET /embryos/{id}, GET/POST /embryos/{id}/events
│   │   ├── checklists.py    Templates CRUD + Instance lifecycle + Item completion
│   │   ├── storage.py       GET/POST /storage, GET /storage/{id}
│   │   ├── users.py         GET/POST /users, PATCH /users/{id} — clinic_admin only
│   │   ├── audit.py         GET /audit — lab_manager+ only
│   │   └── export.py        GET /export/cycles, /export/embryos — CSV download
│   ├── auth/
│   │   ├── jwt.py           create_access_token(), create_refresh_token(), decode_token()
│   │   └── password.py      hash_password() (bcrypt cost 12), verify_password()
│   ├── middleware/
│   │   ├── tenant.py        set_tenant_context(): decode JWT → SET LOCAL app.current_clinic_id
│   │   └── error_handler.py ErrorHandlerMiddleware: ValueError→400, PermissionError→403, Exception→500
│   └── schemas/             Pydantic v2 request/response models. Separate from ORM models.
│       ├── common.py        ErrorResponse, PaginatedResponse
│       ├── auth.py          LoginRequest, TokenResponse, RefreshRequest, UserResponse
│       ├── patient.py       PatientCreate, PatientUpdate, PatientResponse
│       ├── cycle.py         CycleCreate, CycleUpdate, CycleResponse, CycleDetailResponse, CycleTodayResponse
│       ├── embryo.py        EmbryoCreate, EmbryoResponse
│       ├── embryo_event.py  Per-event-type data schemas + EmbryoEventCreate, EmbryoEventResponse
│       ├── checklist.py     Template/Instance/Item schemas
│       ├── storage.py       StorageCreate, StorageResponse, StorageTreeResponse
│       ├── user.py          UserCreate, UserUpdate, UserResponse
│       └── audit.py         AuditLogResponse
└── main.py                  create_app() factory. Mounts CORS + all routers + /health.
```

## Layer Responsibilities

```
HTTP Request
  → FastAPI Router (infrastructure/api/)
    Handles HTTP concerns: path params, query params, status codes, auth.
    Converts between Pydantic schemas and domain objects.
  → Service (domain/services/)
    Business logic: state machines, validation, computed fields.
    Stateless functions that take a session + data.
  → Repository (domain/repositories/)
    SQLAlchemy queries. Takes AsyncSession in constructor.
    Returns ORM model instances.
  → Model (domain/models/)
    SQLAlchemy 2.0 mapped classes. Define table structure.
  → PostgreSQL (with RLS)
    Automatic clinic_id filtering via row-level security.
```

Rules:
- Routers depend on services and repositories. They do not contain business logic.
- Services depend on repositories. They validate transitions and compute derived fields.
- Repositories depend only on models and SQLAlchemy. No business logic.
- Models are pure data definitions. No methods with side effects.
- Pydantic schemas (infrastructure/schemas/) are separate from ORM models (domain/models/).

## How to Add a New Endpoint

1. **Schema** — Create request/response Pydantic models in `infrastructure/schemas/yourmodule.py`:
   ```python
   from pydantic import BaseModel

   class ThingCreate(BaseModel):
       name: str
       category: str

   class ThingResponse(BaseModel):
       id: str
       name: str
       category: str
       created_at: datetime
   ```

2. **Model** (if new table) — Create ORM model in `domain/models/yourmodel.py`:
   ```python
   from .base import TenantBase
   class Thing(TenantBase):
       __tablename__ = "things"
       clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), index=True)
       name: Mapped[str] = mapped_column(Text)
       category: Mapped[str] = mapped_column(Text)
   ```
   Import it in `domain/models/__init__.py` so Alembic discovers it.

3. **Migration** (if new table) — `cd backend && uv run alembic revision --autogenerate -m "add things table"` then add RLS policies manually in the migration.

4. **Repository** — Create `domain/repositories/thing_repo.py`:
   ```python
   from sqlalchemy import select
   class ThingRepository:
       def __init__(self, session: AsyncSession):
           self._session = session
       async def list_all(self) -> list[Thing]:
           result = await self._session.execute(select(Thing))
           return list(result.scalars().all())
   ```

5. **Service** (if business logic needed) — Create `domain/services/thing_service.py`.

6. **Router** — Create `infrastructure/api/things.py`:
   ```python
   router = APIRouter(prefix="/things", tags=["things"])

   @router.get("", response_model=list[ThingResponse])
   async def list_things(
       session: Annotated[AsyncSession, Depends(get_db)],
       current_user: Annotated[dict, Depends(get_current_user)],
   ) -> list[ThingResponse]:
       repo = ThingRepository(session)
       items = await repo.list_all()
       return [ThingResponse(id=str(t.id), name=t.name, ...) for t in items]
   ```

7. **Wire** — Import and include the router in `main.py`:
   ```python
   from ivf_lab.infrastructure.api.things import router as things_router
   app.include_router(things_router)
   ```

## How Multi-Tenancy Works

1. User logs in → receives JWT with `clinic_id` claim
2. Every authenticated request extracts the JWT via `get_current_user()` dependency
3. `set_tenant_context()` runs: `SET LOCAL app.current_clinic_id = '<uuid>'`
4. All subsequent SQL queries in that transaction are filtered by RLS
5. `SET LOCAL` is transaction-scoped — it resets when the transaction ends

RLS is enabled on all tenant-scoped tables. Policies:
```sql
CREATE POLICY clinic_isolation ON <table>
  USING (clinic_id = current_setting('app.current_clinic_id')::uuid);
```

Even if a repository query forgets a WHERE clause, RLS prevents cross-tenant reads.

## How Auth Works

1. **Login:** POST /auth/login with email + password
   - `AuthService.login()` finds user by email, verifies bcrypt hash
   - Creates access token (15 min, contains sub/clinic_id/role) + refresh token (7 days, contains sub only)
   - Returns both tokens to client

2. **Authenticated requests:** Client sends `Authorization: Bearer <access_token>`
   - `get_current_user()` dependency extracts and decodes JWT
   - On success: returns payload dict with `sub`, `clinic_id`, `role`
   - On failure: raises 401

3. **Token refresh:** POST /auth/refresh with refresh_token
   - Decodes refresh token, creates new access token
   - Returns new access token + same refresh token

4. **Role checks:** Some endpoints check `current_user["role"]` against allowed sets:
   - `TEMPLATE_ROLES = {"lab_manager", "clinic_admin"}` for checklist template management
   - `ALLOWED_ROLES = {"lab_manager", "clinic_admin"}` for audit log access
   - `_require_clinic_admin()` for user management
