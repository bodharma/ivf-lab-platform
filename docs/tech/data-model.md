# Data Model

## Entity Relationship Diagram

```
Clinic (tenant root)
  ├── User (roles: embryologist, senior_embryologist, lab_manager, clinic_admin)
  ├── PatientAlias (alias_code, self-ref partner_alias_id)
  │     └── Cycle (planned → active → completed|cancelled)
  │           ├── Embryo (in_culture → vitrified|transferred|discarded|donated|biopsied_pending)
  │           │     └── EmbryoEvent (append-only)
  │           └── ChecklistInstance
  │                 └── ChecklistItemResponse
  ├── ChecklistTemplate (reusable definitions)
  ├── StorageLocation (self-ref tree via parent_id)
  └── AuditLog (append-only)
```

All tenant-scoped tables extend `TenantBase`:
- `id` UUID PK (gen_random_uuid())
- `clinic_id` UUID FK clinics.id (indexed, RLS filter)
- `created_at` TIMESTAMPTZ (now())

## Tables

### clinics

NOT tenant-scoped (it IS the tenant). Extends Base directly.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | No | gen_random_uuid() | PK |
| name | TEXT | No | | |
| timezone | TEXT | No | "UTC" | IANA tz name |
| settings | JSONB | Yes | | Clinic config |
| created_at | TIMESTAMPTZ | No | now() | |

### users

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|----|----|
| id | UUID | No | gen_random_uuid() | | PK |
| clinic_id | UUID | No | | clinics.id | Indexed |
| email | TEXT | No | | | |
| password_hash | TEXT | No | | | bcrypt cost 12 |
| full_name | TEXT | No | | | |
| role | TEXT | No | | | UserRole enum value |
| is_active | BOOLEAN | No | true | | Soft delete |
| created_at | TIMESTAMPTZ | No | now() | | |

### patient_aliases

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|----|----|
| id | UUID | No | gen_random_uuid() | | PK |
| clinic_id | UUID | No | | clinics.id | Indexed |
| alias_code | TEXT | No | | | e.g. "P-2024-001" |
| partner_alias_id | UUID | Yes | | patient_aliases.id | Self-ref |
| notes | TEXT | Yes | | | No PII |
| created_at | TIMESTAMPTZ | No | now() | | |

### cycles

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|----|----|
| id | UUID | No | gen_random_uuid() | | PK |
| clinic_id | UUID | No | | clinics.id | Indexed |
| patient_alias_id | UUID | No | | patient_aliases.id | |
| cycle_code | TEXT | No | | | e.g. "C-2024-042" |
| cycle_type | TEXT | No | | | CycleType enum |
| status | TEXT | No | "planned" | | CycleStatus enum |
| start_date | DATE | No | | | |
| retrieval_date | DATE | Yes | | | |
| insemination_time | TIMESTAMPTZ | Yes | | | Key for HPI |
| transfer_date | DATE | Yes | | | |
| outcome | TEXT | Yes | | | CycleOutcome enum |
| assigned_embryologist_id | UUID | Yes | | users.id | |
| notes | TEXT | Yes | | | |
| created_at | TIMESTAMPTZ | No | now() | | |

**State machine:** planned → active|cancelled, active → completed|cancelled

### embryos

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|----|----|
| id | UUID | No | gen_random_uuid() | | PK |
| clinic_id | UUID | No | | clinics.id | Indexed |
| cycle_id | UUID | No | | cycles.id | |
| embryo_code | TEXT | No | | | e.g. "E1" |
| source | TEXT | No | "fresh" | | EmbryoSource enum |
| disposition | TEXT | No | "in_culture" | | Derived cache |
| storage_location_id | UUID | Yes | | storage_locations.id | Set on vitrification |
| created_at | TIMESTAMPTZ | No | now() | | |

**Disposition transitions:**
- in_culture → vitrified, transferred, discarded, donated, biopsied_pending
- biopsied_pending → in_culture
- vitrified → in_culture

### embryo_events

Append-only. Source of truth for embryo state.

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|----|----|
| id | UUID | No | gen_random_uuid() | | PK |
| clinic_id | UUID | No | | clinics.id | Indexed |
| embryo_id | UUID | No | | embryos.id | |
| event_type | TEXT | No | | | EmbryoEventType enum |
| event_day | SMALLINT | No | | | Day of development |
| observed_at | TIMESTAMPTZ | No | | | When observed |
| time_hpi | NUMERIC(6,2) | Yes | | | Computed server-side |
| data | JSONB | No | '{}' | | Polymorphic event data |
| performed_by | UUID | No | | users.id | |
| notes | TEXT | Yes | | | |
| created_at | TIMESTAMPTZ | No | now() | | |

**Event data schemas:**

| event_type | data fields |
|------------|-------------|
| fertilization_check | pronuclei (str), polar_bodies (int) |
| cleavage_grade | cell_count (int), fragmentation (1-4), symmetry (str), multinucleation (bool) |
| blastocyst_grade | expansion (1-6), icm (A/B/C), te (A/B/C) |
| disposition_change | from (str), to (str), reason (str?), storage_location_id (str?) |
| transfer | catheter_type (str?), difficulty (str?) |
| vitrification | device (str?), medium (str?) |
| warming | survival (bool), re_expansion_time_min (int?) |
| biopsy | cells_removed (int), purpose (str) |
| observation | note (str) |

### checklist_templates

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|----|----|
| id | UUID | No | gen_random_uuid() | | PK |
| clinic_id | UUID | No | | clinics.id | Indexed |
| name | TEXT | No | | | |
| procedure_type | TEXT | No | | | ProcedureType enum |
| items | JSONB | No | [] | | Array of item defs |
| is_active | BOOLEAN | No | true | | |
| created_at | TIMESTAMPTZ | No | now() | | |

**Item format:** `[{"order": 1, "label": "...", "required": true, "field_type": "boolean|number|text"}]`

### checklist_instances

| Column | Type | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| id | UUID | No | gen_random_uuid() | PK |
| clinic_id | UUID | No | | clinics.id |
| template_id | UUID | No | | checklist_templates.id |
| cycle_id | UUID | No | | cycles.id |
| embryo_id | UUID | Yes | | embryos.id |
| status | TEXT | No | "pending" | |
| started_at | TIMESTAMPTZ | Yes | | |
| completed_at | TIMESTAMPTZ | Yes | | |
| completed_by | UUID | Yes | | users.id |
| created_at | TIMESTAMPTZ | No | now() | |

**Status:** pending → in_progress (first item) → completed (all items)

### checklist_item_responses

| Column | Type | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| id | UUID | No | gen_random_uuid() | PK |
| clinic_id | UUID | No | | clinics.id |
| checklist_instance_id | UUID | No | | checklist_instances.id |
| item_index | SMALLINT | No | | |
| value | JSONB | No | {} | |
| completed_by | UUID | No | | users.id |
| completed_at | TIMESTAMPTZ | No | | |

### storage_locations

Self-referencing tree. parent_id=NULL for root nodes.

| Column | Type | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| id | UUID | No | gen_random_uuid() | PK |
| clinic_id | UUID | No | | clinics.id |
| parent_id | UUID | Yes | | storage_locations.id |
| name | TEXT | No | | |
| location_type | TEXT | No | | LocationType enum |
| is_managed | BOOLEAN | No | false | |
| capacity | SMALLINT | Yes | | |
| created_at | TIMESTAMPTZ | No | now() | |

### audit_logs

Append-only. Extends Base (not TenantBase) but has clinic_id FK.

| Column | Type | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| id | UUID | No | gen_random_uuid() | PK |
| clinic_id | UUID | No | | clinics.id |
| actor_id | UUID | No | | users.id |
| action | TEXT | No | | AuditAction enum |
| resource_type | TEXT | No | | |
| resource_id | UUID | No | | |
| changes | JSONB | Yes | | Before/after diff |
| ip_address | INET | Yes | | |
| request_id | UUID | Yes | | Correlation ID |
| created_at | TIMESTAMPTZ | No | now() | |

## Enums

Defined in `domain/models/enums.py`:

| Enum | Values |
|------|--------|
| UserRole | embryologist, senior_embryologist, lab_manager, clinic_admin |
| CycleType | fresh_ivf, fresh_icsi, fet, donor_oocyte, donor_embryo |
| CycleStatus | planned, active, completed, cancelled |
| CycleOutcome | positive, negative, biochemical, clinical, ongoing, live_birth, miscarriage |
| EmbryoSource | fresh, thawed, donated |
| EmbryoDisposition | in_culture, vitrified, transferred, discarded, donated, biopsied_pending |
| EmbryoEventType | fertilization_check, cleavage_grade, blastocyst_grade, disposition_change, transfer, vitrification, warming, biopsy, observation |
| ProcedureType | retrieval, icsi, assessment, transfer, vitrification, warming |
| ChecklistStatus | pending, in_progress, completed |
| LocationType | room, incubator, cryo_tank, shelf, goblet, cane, position |
| AuditAction | create, update, delete, view, export, login |

## RLS Policies

All tenant-scoped tables have:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation ON <table>
  USING (clinic_id = current_setting('app.current_clinic_id')::uuid);

CREATE POLICY clinic_isolation_insert ON <table>
  FOR INSERT
  WITH CHECK (clinic_id = current_setting('app.current_clinic_id')::uuid);
```

Tables: users, patient_aliases, cycles, embryos, embryo_events, checklist_templates, checklist_instances, checklist_item_responses, storage_locations, audit_logs

Session variable set per-transaction: `SET LOCAL app.current_clinic_id = '<uuid>'`
