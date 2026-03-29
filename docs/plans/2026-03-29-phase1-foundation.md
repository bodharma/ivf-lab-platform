# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend foundation — all domain models, Alembic migrations, RLS policies, auth system, tenant/audit middleware, base repository/service patterns, and a seed script that populates realistic test data.

**Architecture:** Classic layered REST. SQLAlchemy 2.0 async models → repository layer → service layer → FastAPI routers. Multi-tenancy via shared DB with `clinic_id` + Postgres RLS. Auth via custom JWT + bcrypt.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, PostgreSQL 16, asyncpg, Pydantic v2, python-jose, passlib, structlog, pytest, httpx

**Spec:** `docs/tech/2026-03-29-mvp-a-design-spec.md` (Obsidian: `Life/Projects/ivf-lab-platform/technical/2026-03-29-mvp-a-design-spec.md`)

---

## File Map

### Domain Models (`backend/src/ivf_lab/domain/models/`)
| File | Responsibility |
|------|---------------|
| `base.py` | ✅ Exists — `Base`, `TenantBase` with id, clinic_id, created_at |
| `clinic.py` | Clinic model (tenant root, not RLS-scoped) |
| `user.py` | User model with role enum |
| `patient_alias.py` | PatientAlias with self-referencing partner link |
| `cycle.py` | Cycle with status/type enums, FK to patient + embryologist |
| `embryo.py` | Embryo with source/disposition enums, FK to cycle + storage |
| `embryo_event.py` | EmbryoEvent append-only, event_type enum, JSONB data |
| `checklist.py` | ChecklistTemplate, ChecklistInstance, ChecklistItemResponse |
| `storage.py` | StorageLocation self-referencing tree |
| `audit_log.py` | AuditLog append-only |
| `__init__.py` | Re-export all models for Alembic discovery |
| `enums.py` | All string enums (UserRole, CycleType, CycleStatus, etc.) |

### Config (`backend/src/ivf_lab/config/`)
| File | Responsibility |
|------|---------------|
| `settings.py` | ✅ Exists — env-driven settings |
| `database.py` | ✅ Exists — engine + session factory. Add RLS session setup. |

### Infrastructure — Auth (`backend/src/ivf_lab/infrastructure/auth/`)
| File | Responsibility |
|------|---------------|
| `jwt.py` | Create/verify JWT access + refresh tokens |
| `password.py` | bcrypt hash + verify |
| `permissions.py` | Role-based permission checker decorator |

### Infrastructure — Middleware (`backend/src/ivf_lab/infrastructure/middleware/`)
| File | Responsibility |
|------|---------------|
| `tenant.py` | Extract clinic_id from JWT, SET app.current_clinic_id |
| `audit.py` | Auto-log write operations to audit_log |
| `error_handler.py` | Global exception → JSON error envelope |

### Infrastructure — API (`backend/src/ivf_lab/infrastructure/api/`)
| File | Responsibility |
|------|---------------|
| `deps.py` | FastAPI dependencies: get_db, get_current_user |
| `auth.py` | Auth router: login, refresh, logout, me |

### Infrastructure — Schemas (`backend/src/ivf_lab/infrastructure/schemas/`)
| File | Responsibility |
|------|---------------|
| `common.py` | Error envelope, pagination |
| `auth.py` | LoginRequest, TokenResponse, UserResponse |

### Domain — Repositories (`backend/src/ivf_lab/domain/repositories/`)
| File | Responsibility |
|------|---------------|
| `base.py` | Generic async CRUD repository |
| `user_repo.py` | User queries (find by email, etc.) |

### Domain — Services (`backend/src/ivf_lab/domain/services/`)
| File | Responsibility |
|------|---------------|
| `auth_service.py` | Login logic, token management |

### Migrations (`backend/src/ivf_lab/migrations/`)
| File | Responsibility |
|------|---------------|
| `env.py` | Alembic async config |
| `alembic.ini` | Alembic settings |
| `versions/001_initial_schema.py` | All tables |
| `versions/002_rls_policies.py` | RLS enable + policies |

### Scripts (`ops/scripts/`)
| File | Responsibility |
|------|---------------|
| `seed.py` | Create test clinic, users, patients, cycles, embryos, events |

### Tests
| File | Responsibility |
|------|---------------|
| `tests/conftest.py` | Test DB, fixtures (test clinic, test user, async client) |
| `tests/unit/test_password.py` | bcrypt hash/verify |
| `tests/unit/test_jwt.py` | Token create/verify |
| `tests/unit/test_enums.py` | Enum coverage |
| `tests/integration/test_health.py` | GET /health |
| `tests/integration/test_auth_api.py` | Login, refresh, me endpoints |

---

## Task 1: Domain Enums

**Files:**
- Create: `backend/src/ivf_lab/domain/models/enums.py`
- Test: `backend/tests/unit/test_enums.py`

- [ ] **Step 1: Write test for enums**

```python
# tests/unit/test_enums.py
from ivf_lab.domain.models.enums import (
    UserRole,
    CycleType,
    CycleStatus,
    CycleOutcome,
    EmbryoSource,
    EmbryoDisposition,
    EmbryoEventType,
    ProcedureType,
    ChecklistStatus,
    LocationType,
    AuditAction,
)


def test_user_roles():
    assert UserRole.EMBRYOLOGIST == "embryologist"
    assert UserRole.SENIOR_EMBRYOLOGIST == "senior_embryologist"
    assert UserRole.LAB_MANAGER == "lab_manager"
    assert UserRole.CLINIC_ADMIN == "clinic_admin"


def test_cycle_statuses():
    assert CycleStatus.PLANNED == "planned"
    assert CycleStatus.ACTIVE == "active"
    assert CycleStatus.COMPLETED == "completed"
    assert CycleStatus.CANCELLED == "cancelled"


def test_embryo_event_types():
    assert EmbryoEventType.FERTILIZATION_CHECK == "fertilization_check"
    assert EmbryoEventType.CLEAVAGE_GRADE == "cleavage_grade"
    assert EmbryoEventType.BLASTOCYST_GRADE == "blastocyst_grade"
    assert EmbryoEventType.DISPOSITION_CHANGE == "disposition_change"
    assert EmbryoEventType.TRANSFER == "transfer"
    assert EmbryoEventType.VITRIFICATION == "vitrification"
    assert EmbryoEventType.WARMING == "warming"
    assert EmbryoEventType.BIOPSY == "biopsy"
    assert EmbryoEventType.OBSERVATION == "observation"


def test_embryo_dispositions():
    assert EmbryoDisposition.IN_CULTURE == "in_culture"
    assert EmbryoDisposition.VITRIFIED == "vitrified"
    assert EmbryoDisposition.TRANSFERRED == "transferred"
    assert EmbryoDisposition.DISCARDED == "discarded"
    assert EmbryoDisposition.DONATED == "donated"
    assert EmbryoDisposition.BIOPSIED_PENDING == "biopsied_pending"
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

Run: `cd backend && uv run pytest tests/unit/test_enums.py -v`

- [ ] **Step 3: Implement enums**

```python
# src/ivf_lab/domain/models/enums.py
import enum


class UserRole(str, enum.Enum):
    EMBRYOLOGIST = "embryologist"
    SENIOR_EMBRYOLOGIST = "senior_embryologist"
    LAB_MANAGER = "lab_manager"
    CLINIC_ADMIN = "clinic_admin"


class CycleType(str, enum.Enum):
    FRESH_IVF = "fresh_ivf"
    FRESH_ICSI = "fresh_icsi"
    FET = "fet"
    DONOR_OOCYTE = "donor_oocyte"
    DONOR_EMBRYO = "donor_embryo"


class CycleStatus(str, enum.Enum):
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CycleOutcome(str, enum.Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    BIOCHEMICAL = "biochemical"
    CLINICAL = "clinical"
    ONGOING = "ongoing"
    LIVE_BIRTH = "live_birth"
    MISCARRIAGE = "miscarriage"


class EmbryoSource(str, enum.Enum):
    FRESH = "fresh"
    THAWED = "thawed"
    DONATED = "donated"


class EmbryoDisposition(str, enum.Enum):
    IN_CULTURE = "in_culture"
    VITRIFIED = "vitrified"
    TRANSFERRED = "transferred"
    DISCARDED = "discarded"
    DONATED = "donated"
    BIOPSIED_PENDING = "biopsied_pending"


class EmbryoEventType(str, enum.Enum):
    FERTILIZATION_CHECK = "fertilization_check"
    CLEAVAGE_GRADE = "cleavage_grade"
    BLASTOCYST_GRADE = "blastocyst_grade"
    DISPOSITION_CHANGE = "disposition_change"
    TRANSFER = "transfer"
    VITRIFICATION = "vitrification"
    WARMING = "warming"
    BIOPSY = "biopsy"
    OBSERVATION = "observation"


class ProcedureType(str, enum.Enum):
    RETRIEVAL = "retrieval"
    ICSI = "icsi"
    ASSESSMENT = "assessment"
    TRANSFER = "transfer"
    VITRIFICATION = "vitrification"
    WARMING = "warming"


class ChecklistStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class LocationType(str, enum.Enum):
    ROOM = "room"
    INCUBATOR = "incubator"
    CRYO_TANK = "cryo_tank"
    SHELF = "shelf"
    GOBLET = "goblet"
    CANE = "cane"
    POSITION = "position"


class AuditAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    VIEW = "view"
    EXPORT = "export"
    LOGIN = "login"
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd backend && uv run pytest tests/unit/test_enums.py -v`

- [ ] **Step 5: Commit**

```bash
git add backend/src/ivf_lab/domain/models/enums.py backend/tests/unit/test_enums.py
git commit -m "feat: add domain enums for all entity types"
```

---

## Task 2: SQLAlchemy Models — Core Entities

**Files:**
- Create: `backend/src/ivf_lab/domain/models/clinic.py`
- Create: `backend/src/ivf_lab/domain/models/user.py`
- Create: `backend/src/ivf_lab/domain/models/patient_alias.py`
- Create: `backend/src/ivf_lab/domain/models/cycle.py`
- Create: `backend/src/ivf_lab/domain/models/embryo.py`
- Create: `backend/src/ivf_lab/domain/models/embryo_event.py`
- Modify: `backend/src/ivf_lab/domain/models/__init__.py`

- [ ] **Step 1: Create Clinic model (not tenant-scoped — it IS the tenant)**

```python
# src/ivf_lab/domain/models/clinic.py
import uuid
from datetime import datetime

from sqlalchemy import Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ivf_lab.domain.models.base import Base


class Clinic(Base):
    __tablename__ = "clinics"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(Text, default="UTC")
    settings: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
```

- [ ] **Step 2: Create User model**

```python
# src/ivf_lab/domain/models/user.py
import uuid

from sqlalchemy import Boolean, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from ivf_lab.domain.models.base import TenantBase
from ivf_lab.domain.models.enums import UserRole


class User(TenantBase):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(Text)
    password_hash: Mapped[str] = mapped_column(Text)
    full_name: Mapped[str] = mapped_column(Text)
    role: Mapped[UserRole] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
```

- [ ] **Step 3: Create PatientAlias model**

```python
# src/ivf_lab/domain/models/patient_alias.py
import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from ivf_lab.domain.models.base import TenantBase


class PatientAlias(TenantBase):
    __tablename__ = "patient_aliases"

    alias_code: Mapped[str] = mapped_column(Text)
    partner_alias_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("patient_aliases.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
```

- [ ] **Step 4: Create Cycle model**

```python
# src/ivf_lab/domain/models/cycle.py
import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from ivf_lab.domain.models.base import TenantBase
from ivf_lab.domain.models.enums import CycleOutcome, CycleStatus, CycleType


class Cycle(TenantBase):
    __tablename__ = "cycles"

    patient_alias_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("patient_aliases.id")
    )
    cycle_code: Mapped[str] = mapped_column(Text)
    cycle_type: Mapped[CycleType] = mapped_column(Text)
    status: Mapped[CycleStatus] = mapped_column(
        Text, default=CycleStatus.PLANNED
    )
    start_date: Mapped[date] = mapped_column(Date)
    retrieval_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    insemination_time: Mapped[datetime | None] = mapped_column(nullable=True)
    transfer_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    outcome: Mapped[CycleOutcome | None] = mapped_column(Text, nullable=True)
    assigned_embryologist_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
```

- [ ] **Step 5: Create Embryo model**

```python
# src/ivf_lab/domain/models/embryo.py
import uuid

from sqlalchemy import ForeignKey, SmallInteger, Text
from sqlalchemy.orm import Mapped, mapped_column

from ivf_lab.domain.models.base import TenantBase
from ivf_lab.domain.models.enums import EmbryoDisposition, EmbryoSource


class Embryo(TenantBase):
    __tablename__ = "embryos"

    cycle_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cycles.id"))
    embryo_code: Mapped[str] = mapped_column(Text)
    source: Mapped[EmbryoSource] = mapped_column(Text, default=EmbryoSource.FRESH)
    disposition: Mapped[EmbryoDisposition] = mapped_column(
        Text, default=EmbryoDisposition.IN_CULTURE
    )
    storage_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("storage_locations.id"), nullable=True
    )

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
```

- [ ] **Step 6: Create EmbryoEvent model**

```python
# src/ivf_lab/domain/models/embryo_event.py
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, SmallInteger, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ivf_lab.domain.models.base import TenantBase
from ivf_lab.domain.models.enums import EmbryoEventType


class EmbryoEvent(TenantBase):
    __tablename__ = "embryo_events"

    embryo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("embryos.id"))
    event_type: Mapped[EmbryoEventType] = mapped_column(Text)
    event_day: Mapped[int] = mapped_column(SmallInteger)
    observed_at: Mapped[datetime]
    time_hpi: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSONB, default=dict)
    performed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
```

- [ ] **Step 7: Update models __init__.py to export all models**

```python
# src/ivf_lab/domain/models/__init__.py
from ivf_lab.domain.models.base import Base, TenantBase
from ivf_lab.domain.models.clinic import Clinic
from ivf_lab.domain.models.user import User
from ivf_lab.domain.models.patient_alias import PatientAlias
from ivf_lab.domain.models.cycle import Cycle
from ivf_lab.domain.models.embryo import Embryo
from ivf_lab.domain.models.embryo_event import EmbryoEvent
from ivf_lab.domain.models.enums import (
    AuditAction,
    ChecklistStatus,
    CycleOutcome,
    CycleStatus,
    CycleType,
    EmbryoDisposition,
    EmbryoEventType,
    EmbryoSource,
    LocationType,
    ProcedureType,
    UserRole,
)

__all__ = [
    "Base",
    "TenantBase",
    "Clinic",
    "User",
    "PatientAlias",
    "Cycle",
    "Embryo",
    "EmbryoEvent",
    "AuditAction",
    "ChecklistStatus",
    "CycleOutcome",
    "CycleStatus",
    "CycleType",
    "EmbryoDisposition",
    "EmbryoEventType",
    "EmbryoSource",
    "LocationType",
    "ProcedureType",
    "UserRole",
]
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/ivf_lab/domain/models/
git commit -m "feat: add SQLAlchemy models for core entities (clinic, user, patient, cycle, embryo, embryo_event)"
```

---

## Task 3: SQLAlchemy Models — Supporting Entities

**Files:**
- Create: `backend/src/ivf_lab/domain/models/checklist.py`
- Create: `backend/src/ivf_lab/domain/models/storage.py`
- Create: `backend/src/ivf_lab/domain/models/audit_log.py`
- Modify: `backend/src/ivf_lab/domain/models/__init__.py`

- [ ] **Step 1: Create Checklist models (template + instance + response)**

```python
# src/ivf_lab/domain/models/checklist.py
import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, SmallInteger, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ivf_lab.domain.models.base import TenantBase
from ivf_lab.domain.models.enums import ChecklistStatus, ProcedureType


class ChecklistTemplate(TenantBase):
    __tablename__ = "checklist_templates"

    name: Mapped[str] = mapped_column(Text)
    procedure_type: Mapped[ProcedureType] = mapped_column(Text)
    items: Mapped[list] = mapped_column(JSONB, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )


class ChecklistInstance(TenantBase):
    __tablename__ = "checklist_instances"

    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("checklist_templates.id")
    )
    cycle_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cycles.id"))
    embryo_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("embryos.id"), nullable=True
    )
    status: Mapped[ChecklistStatus] = mapped_column(
        Text, default=ChecklistStatus.PENDING
    )
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )


class ChecklistItemResponse(TenantBase):
    __tablename__ = "checklist_item_responses"

    checklist_instance_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("checklist_instances.id")
    )
    item_index: Mapped[int] = mapped_column(SmallInteger)
    value: Mapped[dict] = mapped_column(JSONB, default=dict)
    completed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    completed_at: Mapped[datetime]

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
```

- [ ] **Step 2: Create StorageLocation model**

```python
# src/ivf_lab/domain/models/storage.py
import uuid

from sqlalchemy import Boolean, ForeignKey, SmallInteger, Text
from sqlalchemy.orm import Mapped, mapped_column

from ivf_lab.domain.models.base import TenantBase
from ivf_lab.domain.models.enums import LocationType


class StorageLocation(TenantBase):
    __tablename__ = "storage_locations"

    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("storage_locations.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(Text)
    location_type: Mapped[LocationType] = mapped_column(Text)
    is_managed: Mapped[bool] = mapped_column(Boolean, default=False)
    capacity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
```

- [ ] **Step 3: Create AuditLog model**

```python
# src/ivf_lab/domain/models/audit_log.py
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ivf_lab.domain.models.base import Base
from ivf_lab.domain.models.enums import AuditAction


class AuditLog(Base):
    """Append-only audit log. No UPDATE/DELETE at DB role level."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    action: Mapped[AuditAction] = mapped_column(Text)
    resource_type: Mapped[str] = mapped_column(Text)
    resource_id: Mapped[uuid.UUID]
    changes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    request_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
```

- [ ] **Step 4: Update __init__.py with all models**

Add imports for `ChecklistTemplate`, `ChecklistInstance`, `ChecklistItemResponse`, `StorageLocation`, `AuditLog` to `__init__.py` and `__all__`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ivf_lab/domain/models/
git commit -m "feat: add checklist, storage, and audit_log models"
```

---

## Task 4: Alembic Setup + Initial Migration

**Files:**
- Create: `backend/src/ivf_lab/migrations/env.py`
- Create: `backend/alembic.ini`
- Create: `backend/src/ivf_lab/migrations/versions/001_initial_schema.py` (auto-generated)

- [ ] **Step 1: Create alembic.ini at backend root**

```ini
# backend/alembic.ini
[alembic]
script_location = src/ivf_lab/migrations
sqlalchemy.url = postgresql+asyncpg://ivf_app:ivf_pass@localhost:5432/ivf_lab

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 2: Create Alembic env.py with async support**

```python
# src/ivf_lab/migrations/env.py
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from ivf_lab.config.settings import settings
from ivf_lab.domain.models import Base  # noqa: F401 — triggers model discovery

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Create migrations/script.py.mako**

```mako
# src/ivf_lab/migrations/script.py.mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 4: Start test DB, auto-generate migration**

Run:
```bash
cd backend
docker compose -f ../ops/docker/docker-compose.dev.yml up db -d
uv run alembic revision --autogenerate -m "initial schema"
```

- [ ] **Step 5: Review generated migration, apply it**

Run: `cd backend && uv run alembic upgrade head`

- [ ] **Step 6: Commit**

```bash
git add backend/alembic.ini backend/src/ivf_lab/migrations/
git commit -m "feat: add Alembic setup and initial schema migration"
```

---

## Task 5: RLS Policies Migration

**Files:**
- Create: `backend/src/ivf_lab/migrations/versions/002_rls_policies.py` (manual migration)

- [ ] **Step 1: Write manual RLS migration**

```python
# src/ivf_lab/migrations/versions/002_rls_policies.py
"""Enable RLS on all tenant-scoped tables

Revision ID: 002
Revises: 001  (replace with actual revision from Task 4)
"""
from alembic import op

revision = "002_rls"
down_revision = None  # SET TO ACTUAL 001 REVISION ID

TENANT_TABLES = [
    "users",
    "patient_aliases",
    "cycles",
    "embryos",
    "embryo_events",
    "checklist_templates",
    "checklist_instances",
    "checklist_item_responses",
    "storage_locations",
    "audit_logs",
]


def upgrade() -> None:
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY clinic_isolation ON {table}
            USING (clinic_id = current_setting('app.current_clinic_id')::uuid)
        """)
        op.execute(f"""
            CREATE POLICY clinic_isolation_insert ON {table}
            FOR INSERT
            WITH CHECK (clinic_id = current_setting('app.current_clinic_id')::uuid)
        """)


def downgrade() -> None:
    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS clinic_isolation_insert ON {table}")
        op.execute(f"DROP POLICY IF EXISTS clinic_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
```

- [ ] **Step 2: Apply migration**

Run: `cd backend && uv run alembic upgrade head`

- [ ] **Step 3: Commit**

```bash
git add backend/src/ivf_lab/migrations/versions/
git commit -m "feat: enable RLS policies on all tenant-scoped tables"
```

---

## Task 6: Auth — Password & JWT Utilities

**Files:**
- Create: `backend/src/ivf_lab/infrastructure/auth/password.py`
- Create: `backend/src/ivf_lab/infrastructure/auth/jwt.py`
- Test: `backend/tests/unit/test_password.py`
- Test: `backend/tests/unit/test_jwt.py`

- [ ] **Step 1: Write password tests**

```python
# tests/unit/test_password.py
from ivf_lab.infrastructure.auth.password import hash_password, verify_password


def test_hash_and_verify():
    raw = "secureP@ssw0rd"
    hashed = hash_password(raw)
    assert hashed != raw
    assert verify_password(raw, hashed) is True


def test_wrong_password():
    hashed = hash_password("correct")
    assert verify_password("wrong", hashed) is False
```

- [ ] **Step 2: Write JWT tests**

```python
# tests/unit/test_jwt.py
import uuid
from ivf_lab.infrastructure.auth.jwt import create_access_token, decode_token


def test_create_and_decode():
    user_id = uuid.uuid4()
    clinic_id = uuid.uuid4()
    token = create_access_token(user_id=str(user_id), clinic_id=str(clinic_id), role="embryologist")
    payload = decode_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["clinic_id"] == str(clinic_id)
    assert payload["role"] == "embryologist"


def test_invalid_token():
    payload = decode_token("invalid.token.here")
    assert payload is None
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `cd backend && uv run pytest tests/unit/test_password.py tests/unit/test_jwt.py -v`

- [ ] **Step 4: Implement password module**

```python
# src/ivf_lab/infrastructure/auth/password.py
from passlib.context import CryptContext

_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(raw: str) -> str:
    return _ctx.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    return _ctx.verify(raw, hashed)
```

- [ ] **Step 5: Implement JWT module**

```python
# src/ivf_lab/infrastructure/auth/jwt.py
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from ivf_lab.config.settings import settings

ALGORITHM = settings.jwt_algorithm


def create_access_token(
    user_id: str,
    clinic_id: str,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    payload = {
        "sub": user_id,
        "clinic_id": clinic_id,
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.jwt_refresh_token_expire_days
    )
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None
```

- [ ] **Step 6: Run tests — expect PASS**

Run: `cd backend && uv run pytest tests/unit/test_password.py tests/unit/test_jwt.py -v`

- [ ] **Step 7: Commit**

```bash
git add backend/src/ivf_lab/infrastructure/auth/ backend/tests/unit/
git commit -m "feat: add password hashing and JWT token utilities"
```

---

## Task 7: Tenant Middleware + DB Session Dependency

**Files:**
- Modify: `backend/src/ivf_lab/config/database.py`
- Create: `backend/src/ivf_lab/infrastructure/middleware/tenant.py`
- Create: `backend/src/ivf_lab/infrastructure/middleware/error_handler.py`
- Create: `backend/src/ivf_lab/infrastructure/api/deps.py`
- Create: `backend/src/ivf_lab/infrastructure/schemas/common.py`

- [ ] **Step 1: Create common response schemas**

```python
# src/ivf_lab/infrastructure/schemas/common.py
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str
    code: str | None = None


class PaginatedResponse(BaseModel):
    total: int
    page: int
    limit: int
```

- [ ] **Step 2: Create error handler middleware**

```python
# src/ivf_lab/infrastructure/middleware/error_handler.py
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except ValueError as e:
            return JSONResponse(status_code=400, content={"detail": str(e)})
        except PermissionError as e:
            return JSONResponse(status_code=403, content={"detail": str(e)})
        except Exception:
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )
```

- [ ] **Step 3: Create tenant middleware**

```python
# src/ivf_lab/infrastructure/middleware/tenant.py
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.infrastructure.auth.jwt import decode_token


async def set_tenant_context(session: AsyncSession, token: str | None) -> dict | None:
    """Decode JWT and set RLS context on the DB session. Returns payload or None."""
    if not token:
        return None
    payload = decode_token(token)
    if not payload or "clinic_id" not in payload:
        return None
    await session.execute(
        text("SET LOCAL app.current_clinic_id = :cid"),
        {"cid": payload["clinic_id"]},
    )
    return payload
```

- [ ] **Step 4: Create FastAPI dependencies**

```python
# src/ivf_lab/infrastructure/api/deps.py
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.config.database import async_session_factory
from ivf_lab.infrastructure.middleware.tenant import set_tenant_context


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        async with session.begin():
            yield session


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_db)],
    authorization: str | None = Header(None),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )
    token = authorization.removeprefix("Bearer ")
    payload = await set_tenant_context(session, token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/ivf_lab/infrastructure/
git commit -m "feat: add tenant middleware, error handler, and FastAPI dependencies"
```

---

## Task 8: Auth API Router

**Files:**
- Create: `backend/src/ivf_lab/infrastructure/schemas/auth.py`
- Create: `backend/src/ivf_lab/domain/repositories/base.py`
- Create: `backend/src/ivf_lab/domain/repositories/user_repo.py`
- Create: `backend/src/ivf_lab/domain/services/auth_service.py`
- Create: `backend/src/ivf_lab/infrastructure/api/auth.py`
- Modify: `backend/src/ivf_lab/main.py`
- Test: `backend/tests/integration/test_health.py`
- Test: `backend/tests/integration/test_auth_api.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Auth Pydantic schemas**

```python
# src/ivf_lab/infrastructure/schemas/auth.py
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    clinic_id: str
```

- [ ] **Step 2: Base repository**

```python
# src/ivf_lab/domain/repositories/base.py
import uuid
from typing import TypeVar, Generic

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.base import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    def __init__(self, session: AsyncSession, model: type[T]) -> None:
        self._session = session
        self._model = model

    async def get_by_id(self, id: uuid.UUID) -> T | None:
        return await self._session.get(self._model, id)

    async def create(self, entity: T) -> T:
        self._session.add(entity)
        await self._session.flush()
        return entity
```

- [ ] **Step 3: User repository**

```python
# src/ivf_lab/domain/repositories/user_repo.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.user import User
from ivf_lab.domain.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, User)

    async def find_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(User).where(User.email == email, User.is_active.is_(True))
        )
        return result.scalar_one_or_none()
```

- [ ] **Step 4: Auth service**

```python
# src/ivf_lab/domain/services/auth_service.py
from ivf_lab.domain.repositories.user_repo import UserRepository
from ivf_lab.infrastructure.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from ivf_lab.infrastructure.auth.password import verify_password


class AuthService:
    def __init__(self, user_repo: UserRepository) -> None:
        self._user_repo = user_repo

    async def login(self, email: str, password: str) -> dict | None:
        user = await self._user_repo.find_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            return None
        return {
            "access_token": create_access_token(
                user_id=str(user.id),
                clinic_id=str(user.clinic_id),
                role=user.role.value if hasattr(user.role, "value") else user.role,
            ),
            "refresh_token": create_refresh_token(user_id=str(user.id)),
        }

    def refresh(self, refresh_token: str) -> dict | None:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None
        # Note: in production, check refresh token hasn't been revoked
        return {
            "access_token": create_access_token(
                user_id=payload["sub"],
                clinic_id="",  # Will need to lookup user for full token
                role="",
            ),
        }
```

- [ ] **Step 5: Auth router**

```python
# src/ivf_lab/infrastructure/api/auth.py
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.repositories.user_repo import UserRepository
from ivf_lab.domain.services.auth_service import AuthService
from ivf_lab.infrastructure.api.deps import get_current_user, get_db
from ivf_lab.infrastructure.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
):
    service = AuthService(UserRepository(session))
    result = await service.login(body.email, body.password)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return TokenResponse(**result)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    service = AuthService.__new__(AuthService)
    result = service.refresh(body.refresh_token)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    return TokenResponse(
        access_token=result["access_token"],
        refresh_token=body.refresh_token,
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: Annotated[dict, Depends(get_current_user)]):
    return UserResponse(
        id=current_user["sub"],
        email="",  # TODO: fetch from DB
        full_name="",
        role=current_user["role"],
        clinic_id=current_user["clinic_id"],
    )
```

- [ ] **Step 6: Wire router into main.py**

```python
# src/ivf_lab/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ivf_lab.config.settings import settings
from ivf_lab.infrastructure.api.auth import router as auth_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="IVF Lab Platform",
        version="0.1.0",
        description="B2B SaaS for IVF laboratories",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
```

- [ ] **Step 7: Create test conftest with fixtures**

```python
# tests/conftest.py
import asyncio
import uuid
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ivf_lab.config.settings import settings
from ivf_lab.domain.models import Base
from ivf_lab.domain.models.clinic import Clinic
from ivf_lab.domain.models.user import User
from ivf_lab.infrastructure.auth.password import hash_password
from ivf_lab.main import create_app

TEST_DB_URL = settings.database_url


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def engine():
    eng = create_async_engine(TEST_DB_URL)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest.fixture
async def session(engine) -> AsyncGenerator[AsyncSession, None]:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as sess:
        async with sess.begin():
            yield sess
            await sess.rollback()


@pytest.fixture
async def test_clinic(session: AsyncSession) -> Clinic:
    clinic = Clinic(name="Test Clinic", timezone="UTC")
    session.add(clinic)
    await session.flush()
    return clinic


@pytest.fixture
async def test_user(session: AsyncSession, test_clinic: Clinic) -> User:
    user = User(
        clinic_id=test_clinic.id,
        email="embryologist@test.com",
        password_hash=hash_password("testpass123"),
        full_name="Dr. Test",
        role="embryologist",
    )
    session.add(user)
    await session.flush()
    return user


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    app = create_app()
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c
```

- [ ] **Step 8: Write integration tests**

```python
# tests/integration/test_health.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

```python
# tests/integration/test_auth_api.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    response = await client.post(
        "/auth/login",
        json={"email": "wrong@test.com", "password": "wrong"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_without_token(client: AsyncClient):
    response = await client.get("/auth/me")
    assert response.status_code == 401
```

- [ ] **Step 9: Run tests**

Run: `cd backend && uv run pytest -v`

- [ ] **Step 10: Commit**

```bash
git add backend/
git commit -m "feat: add auth system — JWT login, refresh, me endpoints with tests"
```

---

## Task 9: Audit Logging Middleware

**Files:**
- Create: `backend/src/ivf_lab/infrastructure/middleware/audit.py`
- Create: `backend/src/ivf_lab/domain/services/audit_service.py`

- [ ] **Step 1: Create audit service**

```python
# src/ivf_lab/domain/services/audit_service.py
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.audit_log import AuditLog
from ivf_lab.domain.models.enums import AuditAction


async def log_audit(
    session: AsyncSession,
    clinic_id: uuid.UUID,
    actor_id: uuid.UUID,
    action: AuditAction,
    resource_type: str,
    resource_id: uuid.UUID,
    changes: dict | None = None,
    ip_address: str | None = None,
    request_id: uuid.UUID | None = None,
) -> None:
    entry = AuditLog(
        clinic_id=clinic_id,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        changes=changes,
        ip_address=ip_address,
        request_id=request_id,
    )
    session.add(entry)
    await session.flush()
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/ivf_lab/domain/services/audit_service.py
git commit -m "feat: add audit logging service"
```

---

## Task 10: Seed Script

**Files:**
- Create: `ops/scripts/seed.py`

- [ ] **Step 1: Write seed script**

```python
# ops/scripts/seed.py
"""Seed the database with realistic test data for development."""
import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ivf_lab.config.settings import settings
from ivf_lab.domain.models import Base
from ivf_lab.domain.models.checklist import ChecklistTemplate
from ivf_lab.domain.models.clinic import Clinic
from ivf_lab.domain.models.cycle import Cycle
from ivf_lab.domain.models.embryo import Embryo
from ivf_lab.domain.models.embryo_event import EmbryoEvent
from ivf_lab.domain.models.patient_alias import PatientAlias
from ivf_lab.domain.models.storage import StorageLocation
from ivf_lab.domain.models.user import User
from ivf_lab.infrastructure.auth.password import hash_password


async def seed():
    engine = create_async_engine(settings.database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as session:
        async with session.begin():
            # Clinic
            clinic = Clinic(name="ReproMed IVF Clinic", timezone="Europe/Kyiv")
            session.add(clinic)
            await session.flush()

            # Users
            users = []
            for name, email, role in [
                ("Dr. Koval", "koval@repromedclinic.com", "senior_embryologist"),
                ("Dr. Shevchenko", "shevchenko@repromedclinic.com", "embryologist"),
                ("Dr. Bondar", "bondar@repromedclinic.com", "lab_manager"),
                ("Admin", "admin@repromedclinic.com", "clinic_admin"),
            ]:
                u = User(
                    clinic_id=clinic.id,
                    email=email,
                    password_hash=hash_password("demo123"),
                    full_name=name,
                    role=role,
                )
                session.add(u)
                users.append(u)
            await session.flush()

            embryologist = users[0]

            # Patients
            patients = []
            for i in range(1, 6):
                p = PatientAlias(
                    clinic_id=clinic.id,
                    alias_code=f"PAT-2026-{i:04d}",
                )
                session.add(p)
                patients.append(p)
            await session.flush()

            # Storage
            room = StorageLocation(
                clinic_id=clinic.id, name="Lab Room 1", location_type="room", is_managed=False
            )
            session.add(room)
            await session.flush()

            tank = StorageLocation(
                clinic_id=clinic.id, name="Cryo Tank A", location_type="cryo_tank",
                is_managed=True, parent_id=room.id,
            )
            session.add(tank)
            await session.flush()

            # Cycle with embryos (active, Day 5)
            now = datetime.now(timezone.utc)
            insem_time = now - timedelta(hours=114)

            cycle1 = Cycle(
                clinic_id=clinic.id,
                patient_alias_id=patients[0].id,
                cycle_code="CYC-2026-0001",
                cycle_type="fresh_icsi",
                status="active",
                start_date=date.today() - timedelta(days=14),
                retrieval_date=date.today() - timedelta(days=5),
                insemination_time=insem_time,
                assigned_embryologist_id=embryologist.id,
            )
            session.add(cycle1)
            await session.flush()

            # Create 6 embryos
            embryos = []
            for i in range(1, 7):
                e = Embryo(
                    clinic_id=clinic.id,
                    cycle_id=cycle1.id,
                    embryo_code=f"E{i}",
                    source="fresh",
                    disposition="in_culture",
                )
                session.add(e)
                embryos.append(e)
            await session.flush()

            # Add fertilization events (Day 1) for all
            for e in embryos:
                ev = EmbryoEvent(
                    clinic_id=clinic.id,
                    embryo_id=e.id,
                    event_type="fertilization_check",
                    event_day=1,
                    observed_at=insem_time + timedelta(hours=17),
                    time_hpi=17.0,
                    data={"pronuclei": "2pn", "polar_bodies": 2},
                    performed_by=embryologist.id,
                )
                session.add(ev)

            # Add Day 3 cleavage grades for first 4
            for i, e in enumerate(embryos[:4]):
                ev = EmbryoEvent(
                    clinic_id=clinic.id,
                    embryo_id=e.id,
                    event_type="cleavage_grade",
                    event_day=3,
                    observed_at=insem_time + timedelta(hours=66),
                    time_hpi=66.0,
                    data={
                        "cell_count": [8, 8, 6, 4][i],
                        "fragmentation": [1, 1, 2, 3][i],
                        "symmetry": "even",
                        "multinucleation": False,
                    },
                    performed_by=embryologist.id,
                )
                session.add(ev)

            # Checklist template
            tpl = ChecklistTemplate(
                clinic_id=clinic.id,
                name="Day 5 Assessment",
                procedure_type="assessment",
                items=[
                    {"order": 1, "label": "Confirm patient alias", "required": True, "field_type": "checkbox"},
                    {"order": 2, "label": "Remove dish from incubator", "required": True, "field_type": "checkbox"},
                    {"order": 3, "label": "Check dish label matches cycle", "required": True, "field_type": "checkbox"},
                    {"order": 4, "label": "Assess each embryo", "required": True, "field_type": "checkbox"},
                    {"order": 5, "label": "Record grades in system", "required": True, "field_type": "checkbox"},
                    {"order": 6, "label": "Decision: transfer/freeze/discard", "required": True, "field_type": "checkbox"},
                    {"order": 7, "label": "Return dish to incubator", "required": True, "field_type": "checkbox"},
                    {"order": 8, "label": "Confirm incubator door closed", "required": True, "field_type": "checkbox"},
                ],
            )
            session.add(tpl)

            await session.flush()
            print(f"Seeded clinic: {clinic.name} ({clinic.id})")
            print(f"Seeded {len(users)} users (password: demo123)")
            print(f"Seeded {len(patients)} patients")
            print(f"Seeded 1 cycle with {len(embryos)} embryos")
            print(f"Seeded 1 checklist template")


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 2: Test seed runs without errors**

Run: `cd backend && uv run python -m ops.scripts.seed` (or adjust import path)

- [ ] **Step 3: Commit**

```bash
git add ops/scripts/seed.py
git commit -m "feat: add seed script with realistic test clinic data"
```

---

## Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Domain enums | — |
| 2 | Core SQLAlchemy models (clinic, user, patient, cycle, embryo, event) | 1 |
| 3 | Supporting models (checklist, storage, audit_log) | 1 |
| 4 | Alembic setup + initial migration | 2, 3 |
| 5 | RLS policies migration | 4 |
| 6 | Auth utilities (password + JWT) | — |
| 7 | Tenant middleware + API deps | 6 |
| 8 | Auth API router + tests | 2, 6, 7 |
| 9 | Audit logging service | 3 |
| 10 | Seed script | 2, 3, 6 |

**Parallelizable:** Tasks 1 + 6 can run in parallel. Tasks 2 + 3 can run in parallel after 1. Tasks 4 depends on 2+3 completing.
