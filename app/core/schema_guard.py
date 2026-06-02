"""
Lightweight schema reconciliation for additive column drift.

SQLAlchemy's ``Base.metadata.create_all()`` creates *missing tables* but never
alters existing ones. When a column is added to a model after a table already
exists (e.g. ``devices.department`` / ``devices.created_at``), older databases
end up missing that column and every query fails with UndefinedColumn.

This guard adds known-missing columns idempotently at startup. It is intentionally
minimal — for anything beyond additive columns use the Alembic migrations.
PostgreSQL only; other dialects rely on create_all for fresh tables.
"""

from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# table -> {column_name: "DDL type and default"} for additive, backwards-safe columns.
_COLUMN_ADDITIONS: dict[str, dict[str, str]] = {
    "devices": {
        "department": "VARCHAR(100)",
        "created_at": "TIMESTAMPTZ DEFAULT NOW()",
    },
    "events": {
        "resolved_at": "TIMESTAMPTZ",
        "resolved_by": "INTEGER",
    },
}


def ensure_schema(engine: Engine) -> None:
    """Add any known-missing additive columns to existing tables (PostgreSQL only)."""
    if engine.dialect.name != "postgresql":
        return

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table, columns in _COLUMN_ADDITIONS.items():
        if table not in existing_tables:
            # Brand-new table — create_all() already built it with all columns.
            continue

        present = {col["name"] for col in inspector.get_columns(table)}
        missing = {name: ddl for name, ddl in columns.items() if name not in present}
        if not missing:
            continue

        with engine.begin() as conn:
            for name, ddl in missing.items():
                logger.warning(
                    "Schema drift detected: adding missing column %s.%s", table, name
                )
                conn.execute(
                    text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {name} {ddl}")
                )
        logger.info("Reconciled %d column(s) on table %s", len(missing), table)
        try:
            from services.cache import invalidate_inventory

            invalidate_inventory()
            logger.info("Invalidated inventory list caches after schema reconciliation")
        except Exception:
            logger.exception("Failed to invalidate caches after schema reconciliation")
