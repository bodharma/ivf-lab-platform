# API Design

## Conventions

**Base path:** All routes served under `/api/` via Nginx reverse proxy.

**Auth:** Bearer JWT in `Authorization` header. All endpoints except `/auth/login`, `/auth/refresh`, and `/health` require auth.

**Content-Type:** `application/json` for all request/response bodies. Export endpoints return `text/csv`.

**IDs:** UUIDs throughout. Passed as strings in JSON, validated server-side.

**Timestamps:** UTC ISO 8601 format (`2026-03-29T14:30:00+00:00`). Frontend converts to clinic timezone for display.

**Pagination:** `limit` (default 50) + `offset` (default 0) query parameters on list endpoints.

**Error format:**
```json
{"detail": "Human-readable error message"}
```

**Status codes:**
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (POST with new resource) |
| 400 | Bad request / invalid state transition |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role |
| 404 | Resource not found |
| 422 | Domain validation error |
| 500 | Internal error |

## URL Patterns

Resources use plural nouns. Nested resources where the relationship is strong:

```
/auth/login                         POST
/auth/refresh                       POST
/auth/me                            GET

/patients                           GET (list), POST (create)
/patients/{id}                      PATCH (update)

/cycles                             GET (list), POST (create)
/cycles/today                       GET (dashboard view)
/cycles/week                        GET (week schedule)
/cycles/{id}                        GET (detail), PATCH (update)
/cycles/{cycle_id}/embryos          GET (list), POST (create)
/cycles/{cycle_id}/checklists       GET (list), POST (create)

/embryos/{id}                       GET (detail)
/embryos/{id}/events                GET (list), POST (record)

/checklist-templates                GET (list), POST (create)
/checklist-templates/{id}           PATCH (update)
/checklists/{id}                    GET (detail)
/checklists/{id}/items/{index}      POST (complete item)

/storage                            GET (tree), POST (create)
/storage/{id}                       GET (detail)

/users                              GET (list), POST (create)
/users/{id}                         PATCH (update)

/audit                              GET (list, filtered)

/export/cycles                      GET (CSV download)
/export/embryos                     GET (CSV download)

/health                             GET (no auth)
```

## Endpoint Reference

### Auth

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | /auth/login | No | - | Returns access + refresh tokens |
| POST | /auth/refresh | No | - | Exchanges refresh token for new access token |
| GET | /auth/me | Yes | Any | Returns user info from JWT claims |

### Patients

| Method | Path | Auth | Role | Params |
|--------|------|------|------|--------|
| GET | /patients | Yes | Any | ?search=&limit=50&offset=0 |
| POST | /patients | Yes | Any | Body: {alias_code, partner_alias_id?, notes?} |
| PATCH | /patients/{id} | Yes | Any | Body: {partner_alias_id?, notes?} |

### Cycles

| Method | Path | Auth | Role | Params |
|--------|------|------|------|--------|
| GET | /cycles | Yes | Any | ?status=&patient_alias_id=&limit=50&offset=0 |
| GET | /cycles/today | Yes | Any | Returns active cycles with embryo summaries |
| GET | /cycles/week | Yes | Any | Returns 7-day assessment schedule |
| POST | /cycles | Yes | Any | Body: {patient_alias_id, cycle_code, cycle_type, start_date, ...} |
| GET | /cycles/{id} | Yes | Any | Returns CycleDetailResponse with embryos |
| PATCH | /cycles/{id} | Yes | Any | Body: {status?, retrieval_date?, insemination_time?, ...} |

### Embryos

| Method | Path | Auth | Role | Params |
|--------|------|------|------|--------|
| GET | /cycles/{cycle_id}/embryos | Yes | Any | List embryos for cycle |
| POST | /cycles/{cycle_id}/embryos | Yes | Any | Body: {embryo_code, source?} |
| GET | /embryos/{id} | Yes | Any | |
| GET | /embryos/{id}/events | Yes | Any | Chronological event list |
| POST | /embryos/{id}/events | Yes | Any | Body: {event_type, event_day, observed_at, data, notes?} |

### Checklists

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | /checklist-templates | Yes | Any |
| POST | /checklist-templates | Yes | lab_manager+ |
| PATCH | /checklist-templates/{id} | Yes | lab_manager+ |
| POST | /cycles/{cycle_id}/checklists | Yes | Any |
| GET | /cycles/{cycle_id}/checklists | Yes | Any |
| GET | /checklists/{id} | Yes | Any |
| POST | /checklists/{id}/items/{index} | Yes | Any |

### Storage

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | /storage | Yes | Any |
| GET | /storage/{id} | Yes | Any |
| POST | /storage | Yes | Any |

### Users

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | /users | Yes | clinic_admin |
| POST | /users | Yes | clinic_admin |
| PATCH | /users/{id} | Yes | clinic_admin |

### Audit & Export

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | /audit | Yes | lab_manager+ |
| GET | /export/cycles | Yes | Any |
| GET | /export/embryos | Yes | Any |

## Event Data Schemas

The `data` field in POST /embryos/{id}/events is polymorphic by `event_type`:

```
fertilization_check: {pronuclei: "2pn", polar_bodies: 2}
cleavage_grade:      {cell_count: 8, fragmentation: 1, symmetry: "even", multinucleation: false}
blastocyst_grade:    {expansion: 4, icm: "A", te: "B"}
disposition_change:  {from: "in_culture", to: "vitrified", reason: "...", storage_location_id: "..."}
transfer:            {catheter_type: "Wallace", difficulty: "easy"}
vitrification:       {device: "Cryotop", medium: "Kitazato"}
warming:             {survival: true, re_expansion_time_min: 45}
biopsy:              {cells_removed: 5, purpose: "PGT-A"}
observation:         {note: "Zona slightly thickened"}
```

Validation classes defined in `infrastructure/schemas/embryo_event.py` (EVENT_DATA_SCHEMAS map).
