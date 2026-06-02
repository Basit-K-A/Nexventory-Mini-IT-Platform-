# API Reference

Base URL:

- **Through nginx (recommended):** `http://<host>/api`
- **Direct (local dev):** `http://localhost:8000`

Interactive docs are always available at `/docs` (Swagger UI) and `/redoc`.

All list endpoints return the standard **paginated envelope**, and all errors return the
standard **error envelope** (see the bottom of this document).

---

## Authentication flow

Nexventory uses JWT bearer tokens (OAuth2 password flow).

1. **Register** a user — `POST /register`.
2. **Log in** — `POST /token` with form fields `username` and `password`. You receive a
   short-lived `access_token` and a longer-lived `refresh_token`.
3. **Call the API** — send `Authorization: Bearer <access_token>` on every request.
4. **Refresh** — when the access token expires, `POST /token/refresh` with the refresh token
   to get a new pair. (A refresh token cannot be used as a bearer credential.)

```bash
# 1. Register
curl -X POST http://localhost:8000/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"StrongP@ss1"}'

# 2. Log in (form-encoded!)
curl -X POST http://localhost:8000/token \
  -d "username=alice&password=StrongP@ss1"

# 3. Authenticated request
curl http://localhost:8000/users/me/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Roles (RBAC)

| Role         | Capabilities |
|--------------|--------------|
| `admin`      | Full access (bypasses all role checks); user administration |
| `analyst`    | Read audit logs and dashboard |
| `technician` | Read/update devices, create events |
| `viewer`     | Read events (default role for new registrations) |

`admin` always passes. Denied requests return `403 {"detail": "Forbidden"}` and are recorded
in the audit log.

---

## Endpoint catalog

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | none | Create an account (always assigned `viewer`) |
| POST | `/token` | none | Log in; returns access + refresh tokens |
| POST | `/token/refresh` | none (refresh token in body) | Exchange a refresh token for a new pair |
| GET | `/users/me/` | bearer | Current user's profile |
| GET | `/users/me/items/` | bearer | Example protected resource |

### Users (admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users` | admin | List users (paginated, filterable) |
| PATCH | `/users/{id}/role` | admin | Change a user's role |

### Devices

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/devices` | admin | Register a device |
| GET | `/devices` | admin, technician | List devices (paginated) |
| PUT | `/devices/{id}` | admin, technician | Update a device |
| DELETE | `/devices/{id}` | admin | Delete a device |

### Events

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/events` | admin, technician | Create a device event |
| GET | `/events` | any authenticated | List events (paginated) |

> **Legacy:** `/events` remains for backward compatibility. New IT requests should use **Tickets**.

### Tickets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/tickets` | any authenticated | List tickets (viewers: own tickets only) |
| POST | `/tickets` | any authenticated | Create a support ticket |
| GET | `/tickets/{id}` | owner or staff | Ticket detail + comments |
| PUT | `/tickets/{id}` | staff | Update title, description, category, priority, resolution notes |
| PATCH | `/tickets/{id}/status` | staff | Change status (audited; closed actions logged separately) |
| PATCH | `/tickets/{id}/assign` | staff | Assign or unassign (`assigned_to` user id or `null`) |
| POST | `/tickets/{id}/assign/me` | staff | Self-assign |
| DELETE | `/tickets/{id}` | admin | Permanently delete |
| GET | `/tickets/{id}/comments` | owner or staff | List comments |
| POST | `/tickets/{id}/comments` | owner (own ticket) or staff | Add comment |

**List filters:** `status`, `priority`, `category`, `search`, `mine_only`, `assigned_to_me`, `unassigned`, `open_only`.

**Roles:** *viewer* = employee submitting requests; *technician* / *analyst* = IT staff; *admin* = full access including delete.

### Audit logs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/audit-logs` | admin, analyst | Security audit trail (paginated, filterable) |

### Dashboard (admin, analyst)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/overview` | High-level security KPIs |
| GET | `/dashboard/security-summary` | Severity breakdown + top event types |
| GET | `/dashboard/recent-alerts` | Recent alerts (`limit`, `unresolved_only`) |
| GET | `/dashboard/failed-logins` | Failed logins grouped by IP (`hours`) |
| GET | `/dashboard/top-active-users` | Most active users (`hours`) |
| GET | `/dashboard/top-ip-addresses` | Most active source IPs (`hours`) |
| GET | `/dashboard/recent-audit-logs` | Recent audit entries (`limit`) |
| GET | `/dashboard/recent-events` | Recent infrastructure events (`limit`) |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Overall application status (no DB) |
| GET | `/health/live` | Liveness — process is running (no DB) |
| GET | `/health/ready` | Readiness — verifies PostgreSQL connectivity (`503` if down) |

---

## Common query parameters (list endpoints)

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | int ≥ 1 | 1 | 1-based page index |
| `limit` | int 1–100 | 10 | Rows per page |
| `sort_by` | string | resource default | Allowed columns vary per resource |
| `sort_order` | `asc` \| `desc` | `desc` | Sort direction |

Resource-specific filters: devices (`status`, `department`, `owner_id`, `hostname`,
`operating_system`); events (`device_id`, `severity`, `event_type`, `message_contains`);
audit logs (`action`, `user_id`, `ip_address`, `status_code`, `endpoint_contains`);
users (`role`, `is_active`, `username`, `email`).

---

## Request / response examples

### Create a device — `POST /devices`

Request:

```json
{
  "hostname": "srv-db-01",
  "ip_address": "10.0.1.15",
  "operating_system": "Ubuntu 22.04",
  "status": "active",
  "department": "IT",
  "owner_id": 2
}
```

Response `201 Created`:

```json
{
  "id": 1,
  "hostname": "srv-db-01",
  "ip_address": "10.0.1.15",
  "operating_system": "Ubuntu 22.04",
  "status": "active",
  "department": "IT",
  "owner_id": 2,
  "created_at": "2026-06-01T12:00:00Z"
}
```

### List devices — `GET /devices?page=1&limit=10&status=active`

Response `200 OK` (paginated envelope):

```json
{
  "data": [
    {
      "id": 1,
      "hostname": "srv-db-01",
      "ip_address": "10.0.1.15",
      "operating_system": "Ubuntu 22.04",
      "status": "active",
      "department": "IT",
      "owner_id": 2,
      "created_at": "2026-06-01T12:00:00Z"
    }
  ],
  "pagination": {
    "total_records": 1,
    "total_pages": 1,
    "current_page": 1,
    "page_size": 10
  }
}
```

### Log in — `POST /token`

Response `200 OK`:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900
}
```

---

## Common error responses

Every error shares one envelope. `detail` mirrors `message` for backward compatibility, and
`request_id` correlates the failure with server logs.

```json
{
  "error": true,
  "message": "Forbidden",
  "code": "FORBIDDEN",
  "detail": "Forbidden",
  "request_id": "9f2c1a7b8e4d4f2ca1b2c3d4e5f60718"
}
```

| Status | `code` | When |
|--------|--------|------|
| 400 | `BAD_REQUEST` | Invalid operation (e.g. duplicate username) |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired token, bad credentials |
| 403 | `FORBIDDEN` | Authenticated but role not permitted |
| 404 | `NOT_FOUND` | Resource (or referenced owner/device) does not exist |
| 422 | `VALIDATION_ERROR` | Body/query failed validation (adds `errors[]` in dev) |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit or login lockout (sends `Retry-After`) |
| 500 | `INTERNAL_SERVER_ERROR` | Unhandled error (message generic in production) |
| 503 | `SERVICE_UNAVAILABLE` | `/health/ready` when the database is unreachable |

Validation error example (`422`, development):

```json
{
  "error": true,
  "message": "Validation error",
  "code": "VALIDATION_ERROR",
  "detail": "Validation error",
  "errors": [
    {"type": "value_error", "loc": ["body", "ip_address"], "msg": "ip_address must be a valid IPv4 or IPv6 address"}
  ]
}
```
