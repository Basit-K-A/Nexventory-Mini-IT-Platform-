"""
Device API routes.

Uses Depends(get_db) so each request gets its own SQLAlchemy session.
RBAC: read = any authenticated user; write = admin or technician.
"""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from auth.roles import require_any_role, require_role
from constants.audit_actions import AuditAction
from constants.roles import ROLE_ADMIN, ROLE_ANALYST, ROLE_TECHNICIAN
from crud import device as device_crud
from crud import user as user_crud
from database import get_db
from dependencies.list_params import DeviceListParams
from models.user import User
from schemas.device import DeviceCreate, DeviceResponse, DeviceUpdate
from schemas.pagination import PaginatedResponse, paginated_response
from services.audit import log_audit_background
from services.background_tasks import schedule_cache_invalidation, schedule_placeholder
from services.list_cache import cached_paginated_list

router = APIRouter(prefix="/devices", tags=["devices"])

# RBAC for devices:
# - read/update: admin + analyst + technician (viewers are blocked entirely)
# - create/delete: admin + analyst (technicians may edit, not provision or remove)
RequireDeviceRead = require_role([ROLE_ADMIN, ROLE_ANALYST, ROLE_TECHNICIAN])
RequireDeviceUpdate = require_any_role(ROLE_ADMIN, ROLE_ANALYST, ROLE_TECHNICIAN)
RequireDeviceAdmin = require_role([ROLE_ADMIN, ROLE_ANALYST])


@router.post(
    "",
    response_model=DeviceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a device",
    response_description="Created device record",
)
def create_device(
    device_in: DeviceCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(RequireDeviceAdmin)],
    db: Session = Depends(get_db),
):
    if not user_crud.get_user_by_id(db, device_in.owner_id):
        raise HTTPException(status_code=404, detail="Owner user not found")
    device = device_crud.create_device(db, device_in)
    log_audit_background(
        background_tasks,
        request,
        action=AuditAction.DEVICE_CREATED,
        status_code=status.HTTP_201_CREATED,
        user_id=current_user.id,
        details=f"device_id={device.id} hostname={device.hostname}",
    )
    schedule_cache_invalidation(background_tasks, "inventory")
    schedule_placeholder(background_tasks, "device_created_notification", device_id=device.id)
    return device


@router.get(
    "",
    response_model=PaginatedResponse[DeviceResponse],
    summary="List devices (paginated)",
    response_description="Devices matching filters with pagination metadata",
)
def list_devices(
    request: Request,
    _current_user: Annotated[User, Depends(RequireDeviceRead)],
    params: Annotated[DeviceListParams, Depends()],
    db: Session = Depends(get_db),
):
    """
    List inventory devices with optional filters, sorting, and pagination.

    RBAC: admin and technician only (viewers cannot see devices).
    Responses are cached briefly in Redis when available.
    """

    def _build() -> PaginatedResponse[DeviceResponse]:
        items, meta = device_crud.list_devices(db, params)
        return paginated_response(items, meta, DeviceResponse)

    return cached_paginated_list("devices", params, _build)


@router.put(
    "/{device_id}",
    response_model=DeviceResponse,
    summary="Update a device",
)
def update_device(
    device_id: int,
    device_in: DeviceUpdate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(RequireDeviceUpdate)],
    db: Session = Depends(get_db),
):
    device = device_crud.get_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not user_crud.get_user_by_id(db, device_in.owner_id):
        raise HTTPException(status_code=404, detail="Owner user not found")
    updated = device_crud.update_device(db, device, device_in)
    log_audit_background(
        background_tasks,
        request,
        action=AuditAction.DEVICE_UPDATED,
        status_code=status.HTTP_200_OK,
        user_id=current_user.id,
        details=f"device_id={device_id} hostname={updated.hostname}",
    )
    schedule_cache_invalidation(background_tasks, "inventory")
    return updated


@router.delete(
    "/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a device",
)
def delete_device(
    device_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(RequireDeviceAdmin)],
    db: Session = Depends(get_db),
):
    device = device_crud.get_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    hostname = device.hostname
    device_crud.delete_device(db, device)
    log_audit_background(
        background_tasks,
        request,
        action=AuditAction.DEVICE_DELETED,
        status_code=status.HTTP_204_NO_CONTENT,
        user_id=current_user.id,
        details=f"device_id={device_id} deleted hostname={hostname}",
    )
    schedule_cache_invalidation(background_tasks, "inventory")
