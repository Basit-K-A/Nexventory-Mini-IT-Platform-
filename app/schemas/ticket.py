"""Pydantic schemas for the ticket management API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from constants.ticket import TicketCategory, TicketPriority, TicketStatus


def _enum_value(enum_cls, value: str) -> str:
    allowed = {e.value for e in enum_cls}
    if value not in allowed:
        raise ValueError(f"must be one of: {', '.join(sorted(allowed))}")
    return value


class TicketCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=5000)
    category: TicketCategory
    priority: TicketPriority

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("title cannot be blank")
        return value.strip()

    @field_validator("description")
    @classmethod
    def description_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("description cannot be blank")
        return value.strip()


class TicketUpdate(BaseModel):
    """Full update of mutable ticket fields (staff only)."""

    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=5000)
    category: TicketCategory
    priority: TicketPriority
    resolution_notes: str | None = Field(default=None, max_length=5000)

    @field_validator("title", "description")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("cannot be blank")
        return value.strip()


class TicketStatusUpdate(BaseModel):
    status: str = Field(...)
    resolution_notes: str | None = Field(default=None, max_length=5000)

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        return _enum_value(TicketStatus, value)


class TicketAssignUpdate(BaseModel):
    assigned_to: int | None = Field(default=None, description="User id; null to unassign")


class TicketCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)

    @field_validator("body")
    @classmethod
    def body_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("comment cannot be blank")
        return value.strip()


class TicketCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    user_id: int
    body: str
    created_at: datetime


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_number: str
    title: str
    description: str
    category: str
    priority: str
    status: str
    created_by: int
    assigned_to: int | None = None
    created_at: datetime
    updated_at: datetime
    resolution_notes: str | None = None
    legacy_event_id: int | None = None


class TicketDetailResponse(TicketResponse):
    comments: list[TicketCommentResponse] = []
