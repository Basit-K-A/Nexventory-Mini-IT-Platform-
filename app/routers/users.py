"""
Admin user management — list users and assign RBAC roles.
"""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from auth.roles import require_any_role, require_role
from constants.audit_actions import AuditAction
from constants.roles import ROLE_ADMIN, ROLE_ANALYST
from crud import user as user_crud
from database import get_db
from dependencies.list_params import UserListParams
from models.user import User
from schemas.pagination import PaginatedResponse, paginated_response
from schemas.user import UserResponse, UserRoleUpdate
from services.audit import log_audit_background
from services.list_cache import cached_paginated_list

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "",
    response_model=PaginatedResponse[UserResponse],
    summary="List users (paginated)",
)
def list_users(
    request: Request,
    _user: Annotated[User, Depends(require_any_role(ROLE_ADMIN, ROLE_ANALYST))],
    params: Annotated[UserListParams, Depends()],
    db: Session = Depends(get_db),
):
    """
    List platform users. Admin and analyst.

    **Filters**: `role`, `is_active`, `username`, `email`
    """
    def _build() -> PaginatedResponse[UserResponse]:
        items, meta = user_crud.list_users(db, params)
        return paginated_response(items, meta, UserResponse)

    return cached_paginated_list("users", params, _build)


@router.patch("/{user_id}/role", response_model=UserResponse, summary="Change user role")
def change_user_role(
    user_id: int,
    role_in: UserRoleUpdate,
    request: Request,
    background_tasks: BackgroundTasks,
    admin: Annotated[User, Depends(require_role(ROLE_ADMIN))],
    db: Session = Depends(get_db),
):
    """Assign a new RBAC role to a user. Admin only."""
    target = user_crud.get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == admin.id and role_in.role != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own admin role",
        )
    previous = target.role
    updated = user_crud.update_user_role(db, target, role_in.role)
    log_audit_background(
        background_tasks,
        request,
        action=AuditAction.ROLE_UPDATED,
        status_code=status.HTTP_200_OK,
        user_id=admin.id,
        details=(
            f"target_user_id={user_id} previous_role={previous} new_role={role_in.role}"
        ),
    )
    return updated
