"""
Reusable RBAC helpers for ticket endpoints.

Viewer: own tickets only.
Technician / analyst: all tickets (operate).
Admin: full access including delete.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from auth.roles import require_any_role, require_role
from constants.roles import ROLE_ADMIN, ROLE_ANALYST, ROLE_TECHNICIAN, ROLE_VIEWER, normalize_role
from crud import ticket as ticket_crud
from models.ticket import Ticket
from models.user import User

RequireTicketStaff = require_any_role(ROLE_ADMIN, ROLE_TECHNICIAN, ROLE_ANALYST)
RequireTicketAdmin = require_role(ROLE_ADMIN)
RequireTicketTechnicianOrAdmin = require_any_role(ROLE_ADMIN, ROLE_TECHNICIAN)


def is_ticket_staff(user: User) -> bool:
    role = normalize_role(user.role)
    return role in {ROLE_ADMIN, ROLE_TECHNICIAN, ROLE_ANALYST}


def can_view_ticket(user: User, ticket: Ticket) -> bool:
    if is_ticket_staff(user):
        return True
    return normalize_role(user.role) == ROLE_VIEWER and ticket.created_by == user.id


def can_comment_on_ticket(user: User, ticket: Ticket) -> bool:
    if is_ticket_staff(user):
        return True
    return normalize_role(user.role) == ROLE_VIEWER and ticket.created_by == user.id


def get_ticket_or_404(db: Session, ticket_id: int) -> Ticket:
    ticket = ticket_crud.get_ticket(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


def require_ticket_visible(db: Session, user: User, ticket_id: int) -> Ticket:
    ticket = get_ticket_or_404(db, ticket_id)
    if not can_view_ticket(user, ticket):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return ticket
