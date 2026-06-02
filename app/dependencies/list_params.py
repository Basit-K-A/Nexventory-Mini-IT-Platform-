"""
FastAPI dependencies for list endpoints — pagination, filters, and sort query params.

Use `name: type = Query(default, ...)` (not defaults inside Annotated[Query(...)])
so class-based Depends() works on current FastAPI versions.
"""

from fastapi import HTTPException, Query

from constants.roles import ALLOWED_ROLES
from core.query import DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT
from schemas.validators import DeviceStatus, EventSeverity


class DeviceListParams:
    """GET /devices query parameters."""

    def __init__(
        self,
        page: int = Query(DEFAULT_PAGE, ge=1, description="1-based page number"),
        limit: int = Query(
            DEFAULT_LIMIT,
            ge=1,
            le=MAX_LIMIT,
            description="Rows per page (max 100)",
        ),
        sort_by: str | None = Query(
            None,
            description="Sort column: id, hostname, status, department, owner_id, created_at, …",
        ),
        sort_order: str = Query("desc", description="Sort direction: asc or desc"),
        status: DeviceStatus | None = Query(None, description="Filter by device status"),
        department: str | None = Query(
            None,
            max_length=100,
            description="Filter by department (exact match)",
        ),
        owner_id: int | None = Query(None, gt=0, description="Filter by owning user id"),
        assigned_to: int | None = Query(
            None,
            gt=0,
            description="Alias for owner_id (assigned user)",
        ),
        hostname: str | None = Query(
            None,
            max_length=255,
            description="Hostname contains (case-insensitive)",
        ),
        operating_system: str | None = Query(
            None,
            max_length=100,
            description="OS exact match",
        ),
    ):
        self.page = page
        self.limit = limit
        self.sort_by = sort_by.strip() if sort_by and sort_by.strip() else None
        self.sort_order = sort_order.strip().lower() if sort_order else "desc"
        self.status = status.value if status else None
        self.department = department.strip() if department and department.strip() else None
        self.owner_id = owner_id or assigned_to
        self.hostname = hostname
        self.operating_system = (
            operating_system.strip()
            if operating_system and operating_system.strip()
            else None
        )


class EventListParams:
    def __init__(
        self,
        page: int = Query(DEFAULT_PAGE, ge=1, description="1-based page number"),
        limit: int = Query(
            DEFAULT_LIMIT,
            ge=1,
            le=MAX_LIMIT,
            description="Rows per page (max 100)",
        ),
        sort_by: str | None = Query(
            None,
            description="Sort column: id, timestamp, event_type, severity, device_id",
        ),
        sort_order: str = Query("desc", description="Sort direction: asc or desc"),
        device_id: int | None = Query(None, gt=0),
        severity: EventSeverity | None = Query(None),
        event_type: str | None = Query(
            None,
            max_length=100,
            description="Exact event type",
        ),
        message_contains: str | None = Query(
            None,
            max_length=200,
            description="Substring in message",
        ),
    ):
        self.page = page
        self.limit = limit
        self.sort_by = sort_by.strip() if sort_by and sort_by.strip() else None
        self.sort_order = sort_order.strip().lower() if sort_order else "desc"
        self.device_id = device_id
        self.severity = severity.value if severity else None
        self.event_type = event_type.strip() if event_type and event_type.strip() else None
        self.message_contains = (
            message_contains.strip()
            if message_contains and message_contains.strip()
            else None
        )


class AuditLogListParams:
    def __init__(
        self,
        page: int = Query(DEFAULT_PAGE, ge=1, description="1-based page number"),
        limit: int = Query(
            DEFAULT_LIMIT,
            ge=1,
            le=MAX_LIMIT,
            description="Rows per page (max 100)",
        ),
        sort_by: str | None = Query(
            None,
            description="Sort column: id, timestamp, action, user_id, ip_address, status_code",
        ),
        sort_order: str = Query("desc", description="Sort direction: asc or desc"),
        action: str | None = Query(None, max_length=100),
        user_id: int | None = Query(None, gt=0),
        ip_address: str | None = Query(None, max_length=45),
        status_code: int | None = Query(None, ge=100, le=599),
        endpoint_contains: str | None = Query(None, max_length=255),
    ):
        self.page = page
        self.limit = limit
        self.sort_by = sort_by.strip() if sort_by and sort_by.strip() else None
        self.sort_order = sort_order.strip().lower() if sort_order else "desc"
        self.action = action.strip() if action and action.strip() else None
        self.user_id = user_id
        self.ip_address = ip_address.strip() if ip_address and ip_address.strip() else None
        self.status_code = status_code
        self.endpoint_contains = (
            endpoint_contains.strip()
            if endpoint_contains and endpoint_contains.strip()
            else None
        )


class UserListParams:
    def __init__(
        self,
        page: int = Query(DEFAULT_PAGE, ge=1, description="1-based page number"),
        limit: int = Query(
            DEFAULT_LIMIT,
            ge=1,
            le=MAX_LIMIT,
            description="Rows per page (max 100)",
        ),
        sort_by: str | None = Query(
            None,
            description="Sort column: id, username, email, role, created_at, is_active",
        ),
        sort_order: str = Query("desc", description="Sort direction: asc or desc"),
        role: str | None = Query(None, max_length=50),
        is_active: bool | None = Query(None),
        username: str | None = Query(
            None,
            max_length=50,
            description="Username contains",
        ),
        email: str | None = Query(
            None,
            max_length=255,
            description="Email contains",
        ),
    ):
        self.page = page
        self.limit = limit
        self.sort_by = sort_by.strip() if sort_by and sort_by.strip() else None
        self.sort_order = sort_order.strip().lower() if sort_order else "desc"
        if role and role.strip():
            role_val = role.strip().lower()
            if role_val not in ALLOWED_ROLES:
                allowed = ", ".join(sorted(ALLOWED_ROLES))
                raise HTTPException(
                    status_code=422,
                    detail=f"role filter must be one of: {allowed}",
                )
            self.role = role_val
        else:
            self.role = None
        self.is_active = is_active
        self.username = username
        self.email = email


class TicketListParams:
    """GET /tickets query parameters."""

    def __init__(
        self,
        page: int = Query(DEFAULT_PAGE, ge=1, description="1-based page number"),
        limit: int = Query(
            DEFAULT_LIMIT,
            ge=1,
            le=MAX_LIMIT,
            description="Rows per page (max 100)",
        ),
        sort_by: str | None = Query(
            None,
            description=(
                "Sort column: id, ticket_number, title, category, priority, status, "
                "created_by, assigned_to, created_at, updated_at"
            ),
        ),
        sort_order: str = Query("desc", description="Sort direction: asc or desc"),
        status: str | None = Query(None, max_length=30),
        priority: str | None = Query(None, max_length=20),
        category: str | None = Query(None, max_length=50),
        created_by: int | None = Query(None, gt=0),
        assigned_to: int | None = Query(None, gt=0),
        search: str | None = Query(None, max_length=255, description="Title or ticket number"),
        mine_only: bool = Query(False, description="Only tickets created by the current user"),
        assigned_to_me: bool = Query(False, description="Only tickets assigned to the current user"),
        unassigned: bool = Query(False, description="Only tickets with no assignee"),
        open_only: bool = Query(False, description="Exclude Resolved and Closed"),
    ):
        self.page = page
        self.limit = limit
        self.sort_by = sort_by.strip() if sort_by and sort_by.strip() else None
        self.sort_order = sort_order.strip().lower() if sort_order else "desc"
        self.status = status.strip() if status and status.strip() else None
        self.priority = priority.strip() if priority and priority.strip() else None
        self.category = category.strip() if category and category.strip() else None
        self.created_by = created_by
        self.assigned_to = assigned_to
        self.search = search
        self.mine_only = mine_only
        self.assigned_to_me = assigned_to_me
        self.unassigned = unassigned
        self.open_only = open_only
