"""
Pydantic schemas for Event API input/output.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from schemas.validators import EventSeverity


class EventCreate(BaseModel):
    event_type: str = Field(
        min_length=1,
        max_length=100,
        pattern=r"^[a-zA-Z0-9_\-\s]+$",
    )
    severity: EventSeverity
    message: str = Field(min_length=1, max_length=2000)
    device_id: int = Field(gt=0)
    timestamp: datetime | None = None

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("message cannot be blank")
        return value.strip()


class EventUpdate(BaseModel):
    """Body for PUT /events/{id} — full replacement of mutable fields."""

    event_type: str = Field(
        min_length=1,
        max_length=100,
        pattern=r"^[a-zA-Z0-9_\-\s]+$",
    )
    severity: EventSeverity
    message: str = Field(min_length=1, max_length=2000)
    device_id: int = Field(gt=0)
    timestamp: datetime | None = None

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("message cannot be blank")
        return value.strip()


class EventResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "event_type": "disk_usage",
                "severity": "high",
                "message": "Disk usage above 90%",
                "timestamp": "2026-05-28T12:00:00Z",
                "device_id": 3,
            }
        },
    )

    id: int
    event_type: str
    severity: str
    message: str
    timestamp: datetime
    device_id: int
    resolved_at: datetime | None = None
    resolved_by: int | None = None
