"""
SQLAlchemy model for device events (alerts, logs, status changes).

device_id links each event to exactly one device.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import relationship

from database import Base


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        # List/filter by device and recency
        Index("ix_events_device_timestamp", "device_id", "timestamp"),
        # Severity dashboards
        Index("ix_events_severity_timestamp", "severity", "timestamp"),
        # Top event types in time window
        Index("ix_events_type_timestamp", "event_type", "timestamp"),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    severity = Column(String(50), nullable=False, index=True)
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    # Resolution is additive/backwards-safe (nullable) so existing rows remain valid.
    resolved_at = Column(DateTime(timezone=True), nullable=True, index=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    device = relationship("Device", back_populates="events")
