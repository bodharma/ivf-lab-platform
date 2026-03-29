# Security

## Row-Level Security (Multi-Tenancy)

Every tenant-scoped table has a `clinic_id` column and two RLS policies:

```sql
-- Filters SELECT, UPDATE, DELETE
CREATE POLICY clinic_isolation ON <table>
  USING (clinic_id = current_setting('app.current_clinic_id')::uuid);

-- Filters INSERT
CREATE POLICY clinic_isolation_insert ON <table>
  FOR INSERT
  WITH CHECK (clinic_id = current_setting('app.current_clinic_id')::uuid);
```

**How it works per request:**

1. `get_current_user()` in `infrastructure/api/deps.py` extracts the JWT
2. `set_tenant_context()` in `infrastructure/middleware/tenant.py` runs:
   ```python
   await session.execute(text(f"SET LOCAL app.current_clinic_id = '{clinic_id_str}'"))
   ```
3. `SET LOCAL` is transaction-scoped — resets when the session transaction ends
4. All subsequent queries in that session are automatically filtered by RLS
5. The `clinic_id_str` is validated as a UUID before interpolation to prevent SQL injection

**Tables with RLS:** users, patient_aliases, cycles, embryos, embryo_events, checklist_templates, checklist_instances, checklist_item_responses, storage_locations, audit_logs

**Key property:** Even if application code omits a WHERE clause on clinic_id, RLS prevents cross-tenant data access.

## Auth Flow

### Login

```
POST /auth/login {email, password}
  → AuthService.login()
    → UserRepository.find_by_email(email)
    → verify_password(password, user.password_hash)  # bcrypt cost 12
    → create_access_token(user_id, clinic_id, role)  # 15 min, HS256
    → create_refresh_token(user_id)                   # 7 days, HS256
  → Return {access_token, refresh_token, token_type: "bearer"}
```

### Authenticated Request

```
Authorization: Bearer <access_token>
  → get_current_user() dependency
    → Extract token from header
    → decode_token(token)  # jose.jwt.decode with HS256
    → set_tenant_context(session, token)  # SET LOCAL
    → Return payload: {sub, clinic_id, role, iat, exp}
```

### Token Refresh

```
POST /auth/refresh {refresh_token}
  → decode_token(refresh_token)
  → Create new access_token (15 min)
  → Return {access_token, refresh_token (same), token_type}
```

### JWT Claims

**Access token:**
```json
{
  "sub": "<user_id>",
  "clinic_id": "<clinic_id>",
  "role": "embryologist",
  "iat": 1711699200,
  "exp": 1711700100
}
```

**Refresh token:**
```json
{
  "sub": "<user_id>",
  "type": "refresh",
  "exp": 1712304000
}
```

## Role Matrix

| Action | embryologist | senior_embryologist | lab_manager | clinic_admin |
|--------|:---:|:---:|:---:|:---:|
| Record embryo events | Y | Y | Y | Y |
| Create/update cycles | Y | Y | Y | Y |
| Create/update patients | Y | Y | Y | Y |
| Create/manage storage | Y | Y | Y | Y |
| Create checklist instances | Y | Y | Y | Y |
| Complete checklist items | Y | Y | Y | Y |
| Export data (CSV) | Y | Y | Y | Y |
| Discard embryo* | N | Y | Y | Y |
| Create/update checklist templates | N | N | Y | Y |
| Query audit logs | N | N | Y | Y |
| Manage users (CRUD) | N | N | N | Y |

*Discard restriction is planned for the service layer but not yet enforced.

### Enforcement Points

Role checks are implemented in router files:

- **Checklist templates:** `TEMPLATE_ROLES = {"lab_manager", "clinic_admin"}` in `api/checklists.py`
- **Audit logs:** `ALLOWED_ROLES = {"lab_manager", "clinic_admin"}` in `api/audit.py`
- **User management:** `_require_clinic_admin()` in `api/users.py`

These raise `HTTPException(status_code=403)` if the role check fails.

## Audit Logging

### audit_logs Table

Append-only. No UPDATE or DELETE operations.

| Field | Type | Purpose |
|-------|------|---------|
| actor_id | UUID (FK users.id) | Who |
| action | TEXT | What (create, update, delete, view, export, login) |
| resource_type | TEXT | Which entity type |
| resource_id | UUID | Which specific entity |
| changes | JSONB | Before/after diff |
| ip_address | INET | Client IP |
| request_id | UUID | Request correlation |
| created_at | TIMESTAMPTZ | When |

### Access Restrictions

- Only lab_manager and clinic_admin can query via GET /audit
- Query supports filtering by actor_id, resource_type, date range
- Results are ordered by created_at descending with limit/offset pagination

## Password Security

- Hashing: bcrypt with cost factor 12 (`infrastructure/auth/password.py`)
- Config: `settings.bcrypt_rounds = 12`, `settings.max_login_attempts = 5`, `settings.lockout_minutes = 15`
- Account lockout is configured but not yet enforced in code (planned)

## No PII

The platform stores `PatientAlias` records with opaque `alias_code` values. No patient names, dates of birth, or identification numbers are stored anywhere in the database. The mapping from alias codes to real patient identities lives in the clinic's own EHR system.

## Error Handling

`ErrorHandlerMiddleware` in `infrastructure/middleware/error_handler.py`:
- `ValueError` → 400
- `PermissionError` → 403
- Any other exception → 500 with generic "Internal server error" (no stack traces)

FastAPI HTTPExceptions from routers pass through directly with their status codes and detail messages.
