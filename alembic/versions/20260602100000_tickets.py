"""
Create tickets + ticket_comments and migrate legacy events.

Revision ID: 20260602100000
Revises: 20260528120000

Idempotent: tables may already exist from API startup (Base.metadata.create_all).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "20260602100000"
down_revision: Union[str, None] = "20260528120000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector():
    return inspect(op.get_bind())


def _has_table(name: str) -> bool:
    return name in _inspector().get_table_names()


def _has_index(table: str, index_name: str) -> bool:
    return any(ix["name"] == index_name for ix in _inspector().get_indexes(table))


def _create_index_if_missing(index_name: str, table: str, columns: list[str], *, unique: bool = False) -> None:
    if not _has_index(table, index_name):
        op.create_index(index_name, table, columns, unique=unique)


def upgrade() -> None:
    if not _has_table("tickets"):
        op.create_table(
            "tickets",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("ticket_number", sa.String(length=20), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("category", sa.String(length=50), nullable=False),
            sa.Column("priority", sa.String(length=20), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="Open"),
            sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("assigned_to", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("resolution_notes", sa.Text(), nullable=True),
            sa.Column("legacy_event_id", sa.Integer(), sa.ForeignKey("events.id"), nullable=True),
        )

    _create_index_if_missing("ix_tickets_ticket_number", "tickets", ["ticket_number"], unique=True)
    _create_index_if_missing("ix_tickets_status_updated", "tickets", ["status", "updated_at"])
    _create_index_if_missing("ix_tickets_priority_status", "tickets", ["priority", "status"])
    _create_index_if_missing("ix_tickets_assigned_status", "tickets", ["assigned_to", "status"])
    _create_index_if_missing("ix_tickets_created_by_status", "tickets", ["created_by", "status"])

    if not _has_table("ticket_comments"):
        op.create_table(
            "ticket_comments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "ticket_id",
                sa.Integer(),
                sa.ForeignKey("tickets.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )

    _create_index_if_missing("ix_ticket_comments_ticket_id", "ticket_comments", ["ticket_id"])

    # Migrate existing events into tickets (idempotent via legacy_event_id).
    op.execute(
        sa.text(
            """
            INSERT INTO tickets (
                ticket_number, title, description, category, priority, status,
                created_by, assigned_to, created_at, updated_at, resolution_notes, legacy_event_id
            )
            SELECT
                'TKT-' || LPAD(e.id::text, 6, '0'),
                LEFT(e.event_type, 255),
                e.message,
                'Other',
                CASE LOWER(e.severity)
                    WHEN 'critical' THEN 'Critical'
                    WHEN 'high' THEN 'High'
                    WHEN 'medium' THEN 'Medium'
                    WHEN 'warning' THEN 'Medium'
                    ELSE 'Low'
                END,
                CASE WHEN e.resolved_at IS NOT NULL THEN 'Resolved' ELSE 'Open' END,
                COALESCE(e.resolved_by, (SELECT MIN(u.id) FROM users u)),
                e.resolved_by,
                e.timestamp,
                COALESCE(e.resolved_at, e.timestamp),
                NULL,
                e.id
            FROM events e
            WHERE NOT EXISTS (
                SELECT 1 FROM tickets t WHERE t.legacy_event_id = e.id
            )
            """
        )
    )


def downgrade() -> None:
    if _has_table("ticket_comments"):
        if _has_index("ticket_comments", "ix_ticket_comments_ticket_id"):
            op.drop_index("ix_ticket_comments_ticket_id", table_name="ticket_comments")
        op.drop_table("ticket_comments")

    if _has_table("tickets"):
        for idx in (
            "ix_tickets_created_by_status",
            "ix_tickets_assigned_status",
            "ix_tickets_priority_status",
            "ix_tickets_status_updated",
            "ix_tickets_ticket_number",
        ):
            if _has_index("tickets", idx):
                op.drop_index(idx, table_name="tickets")
        op.drop_table("tickets")
