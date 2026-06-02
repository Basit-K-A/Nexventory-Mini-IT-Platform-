"""CRUD for IT support tickets."""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from constants.roles import ROLE_VIEWER, normalize_role
from constants.ticket import TERMINAL_STATUSES
from core.query import apply_exact_filters, apply_ilike_filters, apply_sort, paginate
from dependencies.list_params import TicketListParams
from models.ticket import Ticket
from models.user import User
from schemas.pagination import PaginationMeta
from schemas.ticket import TicketAssignUpdate, TicketCreate, TicketStatusUpdate, TicketUpdate

_TICKET_SORT_COLUMNS = {
    "id": Ticket.id,
    "ticket_number": Ticket.ticket_number,
    "title": Ticket.title,
    "category": Ticket.category,
    "priority": Ticket.priority,
    "status": Ticket.status,
    "created_by": Ticket.created_by,
    "assigned_to": Ticket.assigned_to,
    "created_at": Ticket.created_at,
    "updated_at": Ticket.updated_at,
}


def _assign_ticket_number(db: Session, ticket: Ticket) -> None:
    ticket.ticket_number = f"TKT-{ticket.id:06d}"


def get_ticket(db: Session, ticket_id: int) -> Ticket | None:
    return db.query(Ticket).filter(Ticket.id == ticket_id).first()


def get_ticket_by_number(db: Session, ticket_number: str) -> Ticket | None:
    return db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()


def _apply_visibility(query, user: User):
    """Viewers only see tickets they created."""
    if normalize_role(user.role) == ROLE_VIEWER:
        return query.filter(Ticket.created_by == user.id)
    return query


def list_tickets(
    db: Session,
    user: User,
    params: TicketListParams,
) -> tuple[list[Ticket], PaginationMeta]:
    query = db.query(Ticket)
    query = _apply_visibility(query, user)

    if params.mine_only:
        query = query.filter(Ticket.created_by == user.id)
    if params.assigned_to_me:
        query = query.filter(Ticket.assigned_to == user.id)
    if params.unassigned:
        query = query.filter(Ticket.assigned_to.is_(None))
    if params.open_only:
        query = query.filter(~Ticket.status.in_(list(TERMINAL_STATUSES)))

    query = apply_exact_filters(
        query,
        Ticket,
        {
            "status": params.status,
            "priority": params.priority,
            "category": params.category,
            "created_by": params.created_by,
            "assigned_to": params.assigned_to,
        },
    )
    if params.search and params.search.strip():
        term = f"%{params.search.strip()}%"
        query = query.filter(or_(Ticket.title.ilike(term), Ticket.ticket_number.ilike(term)))

    try:
        query = apply_sort(
            query,
            allowed_columns=_TICKET_SORT_COLUMNS,
            sort_by=params.sort_by,
            sort_order=params.sort_order,
            default_column=Ticket.updated_at,
            default_desc=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return paginate(query, page=params.page, limit=params.limit)


def create_ticket(db: Session, user: User, ticket_in: TicketCreate) -> Ticket:
    ticket = Ticket(
        ticket_number="TKT-PENDING",
        title=ticket_in.title,
        description=ticket_in.description,
        category=ticket_in.category.value,
        priority=ticket_in.priority.value,
        status="Open",
        created_by=user.id,
        assigned_to=None,
    )
    db.add(ticket)
    try:
        db.flush()
        _assign_ticket_number(db, ticket)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(ticket)
    return ticket


def update_ticket(db: Session, ticket: Ticket, ticket_in: TicketUpdate) -> Ticket:
    ticket.title = ticket_in.title
    ticket.description = ticket_in.description
    ticket.category = ticket_in.category.value
    ticket.priority = ticket_in.priority.value
    ticket.resolution_notes = ticket_in.resolution_notes
    ticket.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(ticket)
    return ticket


def update_ticket_status(
    db: Session,
    ticket: Ticket,
    status_in: TicketStatusUpdate,
) -> Ticket:
    ticket.status = status_in.status
    if status_in.resolution_notes is not None:
        ticket.resolution_notes = status_in.resolution_notes
    ticket.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(ticket)
    return ticket


def assign_ticket(
    db: Session,
    ticket: Ticket,
    assign_in: TicketAssignUpdate,
) -> Ticket:
    ticket.assigned_to = assign_in.assigned_to
    if ticket.status == "Open" and assign_in.assigned_to is not None:
        ticket.status = "In Progress"
    ticket.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(ticket)
    return ticket


def delete_ticket(db: Session, ticket: Ticket) -> None:
    db.delete(ticket)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
