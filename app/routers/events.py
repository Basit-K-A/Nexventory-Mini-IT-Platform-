"""
Event API routes — log entries tied to a device via device_id foreign key.

RBAC: read = any authenticated user; create = admin or technician.
"""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from auth.roles import require_any_role
from auth.security import get_current_active_user
from constants.audit_actions import AuditAction
from constants.roles import ROLE_ADMIN, ROLE_ANALYST, ROLE_TECHNICIAN
from crud import device as device_crud
from crud import event as event_crud
from database import get_db
from dependencies.list_params import EventListParams
from models.user import User
from schemas.event import EventCreate, EventResponse, EventUpdate
from schemas.pagination import PaginatedResponse, paginated_response
from services.audit import log_audit_background
from services.background_tasks import schedule_cache_invalidation
from services.list_cache import cached_paginated_list

router = APIRouter(prefix="/events", tags=["events"])

RequireEventWrite = require_any_role(ROLE_ADMIN, ROLE_ANALYST, ROLE_TECHNICIAN)


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an event",
)
def create_event(
    event_in: EventCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(RequireEventWrite)],
    db: Session = Depends(get_db),
):
    if not device_crud.get_device(db, event_in.device_id):
        raise HTTPException(status_code=404, detail="Device not found")
    event = event_crud.create_event(db, event_in)
    log_audit_background(
        background_tasks,
        request,
        action=AuditAction.EVENT_CREATED,
        status_code=status.HTTP_201_CREATED,
        user_id=current_user.id,
        details=(
            f"event_id={event.id} device_id={event.device_id} "
            f"type={event.event_type} severity={event.severity}"
        ),
    )
    schedule_cache_invalidation(background_tasks, "inventory")
    return event


@router.put(
    "/{event_id}",
    response_model=EventResponse,
    summary="Update an event",
)
def update_event(
    event_id: int,
    event_in: EventUpdate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(RequireEventWrite)],
    db: Session = Depends(get_db),
):
    event = event_crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not device_crud.get_device(db, event_in.device_id):
        raise HTTPException(status_code=404, detail="Device not found")
    updated = event_crud.update_event(db, event, event_in)
    log_audit_background(
        background_tasks,
        request,
        action=AuditAction.EVENT_UPDATED,
        status_code=status.HTTP_200_OK,
        user_id=current_user.id,
        details=(
            f"event_id={updated.id} device_id={updated.device_id} "
            f"type={updated.event_type} severity={updated.severity}"
        ),
    )
    schedule_cache_invalidation(background_tasks, "inventory")
    return updated


@router.post(
    "/{event_id}/resolve",
    response_model=EventResponse,
    summary="Resolve an event",
)
def resolve_event(
    event_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(RequireEventWrite)],
    db: Session = Depends(get_db),
):
    event = event_crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    resolved = event_crud.resolve_event(db, event, resolved_by=current_user.id)
    log_audit_background(
        background_tasks,
        request,
        action=AuditAction.EVENT_RESOLVED,
        status_code=status.HTTP_200_OK,
        user_id=current_user.id,
        details=f"event_id={resolved.id} device_id={resolved.device_id}",
    )
    schedule_cache_invalidation(background_tasks, "inventory")
    return resolved


@router.get(
    "",
    response_model=PaginatedResponse[EventResponse],
    summary="List events (paginated)",
)
def list_events(
    request: Request,
    _current_user: Annotated[User, Depends(get_current_active_user)],
    params: Annotated[EventListParams, Depends()],
    db: Session = Depends(get_db),
):
    """List device events with filters, sort, and pagination (Redis-cached when enabled)."""

    def _build() -> PaginatedResponse[EventResponse]:
        items, meta = event_crud.list_events(db, params)
        return paginated_response(items, meta, EventResponse)

    return cached_paginated_list("events", params, _build)
