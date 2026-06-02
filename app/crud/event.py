"""
CRUD helpers for Event — database access only, no HTTP logic.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.query import apply_exact_filters, apply_ilike_filters, apply_sort, paginate
from dependencies.list_params import EventListParams
from models.event import Event
from schemas.event import EventCreate, EventUpdate
from schemas.pagination import PaginationMeta

_EVENT_SORT_COLUMNS = {
    "id": Event.id,
    "timestamp": Event.timestamp,
    "event_type": Event.event_type,
    "severity": Event.severity,
    "device_id": Event.device_id,
}


def get_event(db: Session, event_id: int) -> Event | None:
    return db.query(Event).filter(Event.id == event_id).first()


def list_events(
    db: Session,
    params: EventListParams,
) -> tuple[list[Event], PaginationMeta]:
    query = db.query(Event)
    query = apply_exact_filters(
        query,
        Event,
        {
            "device_id": params.device_id,
            "severity": params.severity,
            "event_type": params.event_type,
        },
    )
    query = apply_ilike_filters(query, Event, {"message": params.message_contains})

    try:
        query = apply_sort(
            query,
            allowed_columns=_EVENT_SORT_COLUMNS,
            sort_by=params.sort_by,
            sort_order=params.sort_order,
            default_column=Event.timestamp,
            default_desc=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return paginate(query, page=params.page, limit=params.limit)


def create_event(db: Session, event_in: EventCreate) -> Event:
    db_event = Event(
        event_type=event_in.event_type,
        severity=event_in.severity.value,
        message=event_in.message,
        device_id=event_in.device_id,
    )
    if event_in.timestamp is not None:
        db_event.timestamp = event_in.timestamp
    db.add(db_event)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(db_event)
    return db_event


def update_event(db: Session, event: Event, event_in: EventUpdate) -> Event:
    event.event_type = event_in.event_type
    event.severity = event_in.severity.value
    event.message = event_in.message
    event.device_id = event_in.device_id
    if event_in.timestamp is not None:
        event.timestamp = event_in.timestamp
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(event)
    return event


def resolve_event(db: Session, event: Event, *, resolved_by: int) -> Event:
    """Mark an event resolved (idempotent)."""
    from datetime import datetime, timezone

    if event.resolved_at is None:
        event.resolved_at = datetime.now(timezone.utc)
        event.resolved_by = resolved_by
        try:
            db.commit()
        except Exception:
            db.rollback()
            raise
        db.refresh(event)
    return event
