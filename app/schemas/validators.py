"""
Reusable Pydantic validators and enums for input hardening.
"""

import re
from enum import Enum

from pydantic import field_validator

# RFC 1123-ish hostname: letters, digits, hyphens, dots (and underscores for Windows-style hostnames);
# no leading/trailing hyphen
HOSTNAME_PATTERN = re.compile(
    r"^(?=.{1,255}$)(?!-)[A-Za-z0-9_](?:[A-Za-z0-9_\-]{0,61}[A-Za-z0-9_])?(?:\.(?!-)[A-Za-z0-9_](?:[A-Za-z0-9_\-]{0,61}[A-Za-z0-9_])?)*$"
)


class DeviceStatus(str, Enum):
    active = "active"
    online = "online"
    offline = "offline"
    maintenance = "maintenance"
    inactive = "inactive"


class EventSeverity(str, Enum):
    low = "low"
    info = "info"
    medium = "medium"
    warning = "warning"
    high = "high"
    critical = "critical"


def validate_hostname(value: str) -> str:
    if not HOSTNAME_PATTERN.match(value):
        raise ValueError(
            "hostname must be 1–255 characters, alphanumeric with hyphens/dots/underscores"
        )
    return value


def validate_ip_address(value: str) -> str:
    """Accept IPv4 or IPv6 string forms."""
    from ipaddress import ip_address

    try:
        ip_address(value)
    except ValueError as exc:
        raise ValueError("ip_address must be a valid IPv4 or IPv6 address") from exc
    return value
