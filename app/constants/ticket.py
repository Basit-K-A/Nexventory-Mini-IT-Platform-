"""
Ticket enums for categories, priorities, and workflow status.
"""

from enum import Enum


class TicketCategory(str, Enum):
    hardware = "Hardware"
    software = "Software"
    network = "Network"
    access_request = "Access Request"
    asset_request = "Asset Request"
    security = "Security"
    other = "Other"


class TicketPriority(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"
    critical = "Critical"


class TicketStatus(str, Enum):
    open = "Open"
    in_progress = "In Progress"
    waiting_for_user = "Waiting for User"
    resolved = "Resolved"
    closed = "Closed"


# Terminal statuses — used for viewer "resolved" views and metrics.
TERMINAL_STATUSES = frozenset({TicketStatus.resolved.value, TicketStatus.closed.value})
