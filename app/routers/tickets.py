"""
IT ticket management API — primary workflow for Nexventory support requests.

Legacy /events endpoints remain for backward compatibility; new work should use tickets.
"""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from auth.security import get_current_active_user
from auth.ticket_permissions import (
    RequireTicketAdmin,
    RequireTicketStaff,
    can_comment_on_ticket,
    require_ticket_visible,
)
from constants.audit_actions import AuditAction
from constants.ticket import TERMINAL_STATUSES
from crud import ticket as ticket_crud
from crud import ticket_comment as comment_crud
from crud import user as user_crud
from database import get_db
from dependencies.list_params import TicketListParams
from models.ticket import Ticket
from models.user import User
from schemas.pagination import PaginatedResponse, paginated_response
from schemas.ticket import (
    TicketAssignUpdate,
    TicketCommentCreate,
    TicketCommentResponse,
    TicketCreate,
    TicketDetailResponse,
    TicketResponse,
    TicketStatusUpdate,
    TicketUpdate,
)
from services.audit import log_audit_background

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _audit(
    background_tasks: BackgroundTasks,
    request: Request,
    *,
    action: str,
    status_code: int,
    user_id: int,
    details: str,
) -> None:
    log_audit_background(
        background_tasks,
        request,
        action=action,
        status_code=status_code,
        user_id=user_id,
        details=details,
    )


@router.get(
    "",
    response_model=PaginatedResponse[TicketResponse],
    summary="List tickets (paginated)",
)
def list_tickets(
    request: Request,
    current_user: Annotated[User, Depends(get_current_active_user)],
    params: Annotated[TicketListParams, Depends()],
    db: Session = Depends(get_db),
):
    """List tickets. Viewers only see tickets they created."""
    items, meta = ticket_crud.list_tickets(db, current_user, params)
    return paginated_response(items, meta, TicketResponse)


@router.post(
    "",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a ticket",
)
def create_ticket(
    ticket_in: TicketCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    """Any authenticated user may submit a ticket (viewer workflow)."""
    ticket = ticket_crud.create_ticket(db, current_user, ticket_in)
    _audit(
        background_tasks,
        request,
        action=AuditAction.TICKET_CREATED,
        status_code=status.HTTP_201_CREATED,
        user_id=current_user.id,
        details=f"ticket_id={ticket.id} number={ticket.ticket_number}",
    )
    return ticket


@router.get(
    "/{ticket_id}",
    response_model=TicketDetailResponse,
    summary="Get ticket details",
)
def get_ticket(
    ticket_id: int,
    request: Request,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    ticket = require_ticket_visible(db, current_user, ticket_id)
    comments = comment_crud.list_comments(db, ticket.id)
    return TicketDetailResponse(
        **TicketResponse.model_validate(ticket).model_dump(),
        comments=[TicketCommentResponse.model_validate(c) for c in comments],
    )


@router.put(
    "/{ticket_id}",
    response_model=TicketResponse,
    summary="Update a ticket",
)
def update_ticket(
    ticket_id: int,
    ticket_in: TicketUpdate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(RequireTicketStaff)],
    db: Session = Depends(get_db),
):
    ticket = require_ticket_visible(db, current_user, ticket_id)
    updated = ticket_crud.update_ticket(db, ticket, ticket_in)
    _audit(
        background_tasks,
        request,
        action=AuditAction.TICKET_UPDATED,
        status_code=status.HTTP_200_OK,
        user_id=current_user.id,
        details=f"ticket_id={ticket.id} number={ticket.ticket_number}",
    )
    return updated


@router.patch(
    "/{ticket_id}/status",
    response_model=TicketResponse,
    summary="Update ticket status",
)
def update_ticket_status(
    ticket_id: int,
    status_in: TicketStatusUpdate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(RequireTicketStaff)],
    db: Session = Depends(get_db),
):
    ticket = require_ticket_visible(db, current_user, ticket_id)
    previous = ticket.status
    updated = ticket_crud.update_ticket_status(db, ticket, status_in)
    action = (
        AuditAction.TICKET_CLOSED
        if updated.status in TERMINAL_STATUSES
        else AuditAction.TICKET_STATUS_CHANGED
    )
    _audit(
        background_tasks,
        request,
        action=action,
        status_code=status.HTTP_200_OK,
        user_id=current_user.id,
        details=(
            f"ticket_id={ticket.id} previous_status={previous} "
            f"new_status={updated.status}"
        ),
    )
    return updated


@router.patch(
    "/{ticket_id}/assign",
    response_model=TicketResponse,
    summary="Assign or unassign a ticket",
)
def assign_ticket(
    ticket_id: int,
    assign_in: TicketAssignUpdate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(RequireTicketStaff)],
    db: Session = Depends(get_db),
):
    ticket = require_ticket_visible(db, current_user, ticket_id)
    if assign_in.assigned_to is not None:
        assignee = user_crud.get_user_by_id(db, assign_in.assigned_to)
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee user not found")
    updated = ticket_crud.assign_ticket(db, ticket, assign_in)
    _audit(
        background_tasks,
        request,
        action=AuditAction.TICKET_ASSIGNED,
        status_code=status.HTTP_200_OK,
        user_id=current_user.id,
        details=f"ticket_id={ticket.id} assigned_to={updated.assigned_to}",
    )
    return updated


@router.post(
    "/{ticket_id}/assign/me",
    response_model=TicketResponse,
    summary="Assign ticket to yourself",
)
def assign_ticket_to_me(
    ticket_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(RequireTicketStaff)],
    db: Session = Depends(get_db),
):
    ticket = require_ticket_visible(db, current_user, ticket_id)
    updated = ticket_crud.assign_ticket(
        db, ticket, TicketAssignUpdate(assigned_to=current_user.id)
    )
    _audit(
        background_tasks,
        request,
        action=AuditAction.TICKET_ASSIGNED,
        status_code=status.HTTP_200_OK,
        user_id=current_user.id,
        details=f"ticket_id={ticket.id} self_assigned=true",
    )
    return updated


@router.delete(
    "/{ticket_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a ticket (admin)",
)
def delete_ticket(
    ticket_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(RequireTicketAdmin)],
    db: Session = Depends(get_db),
):
    ticket = require_ticket_visible(db, current_user, ticket_id)
    number = ticket.ticket_number
    ticket_crud.delete_ticket(db, ticket)
    _audit(
        background_tasks,
        request,
        action=AuditAction.TICKET_DELETED,
        status_code=status.HTTP_204_NO_CONTENT,
        user_id=current_user.id,
        details=f"ticket_id={ticket_id} number={number}",
    )


@router.get(
    "/{ticket_id}/comments",
    response_model=list[TicketCommentResponse],
    summary="List ticket comments",
)
def list_ticket_comments(
    ticket_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    ticket = require_ticket_visible(db, current_user, ticket_id)
    return comment_crud.list_comments(db, ticket.id)


@router.post(
    "/{ticket_id}/comments",
    response_model=TicketCommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a comment",
)
def add_ticket_comment(
    ticket_id: int,
    body: TicketCommentCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    ticket = require_ticket_visible(db, current_user, ticket_id)
    if not can_comment_on_ticket(current_user, ticket):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    comment = comment_crud.create_comment(
        db, ticket_id=ticket.id, user_id=current_user.id, body=body.body
    )
    _audit(
        background_tasks,
        request,
        action=AuditAction.TICKET_COMMENT_ADDED,
        status_code=status.HTTP_201_CREATED,
        user_id=current_user.id,
        details=f"ticket_id={ticket.id} comment_id={comment.id}",
    )
    return comment
