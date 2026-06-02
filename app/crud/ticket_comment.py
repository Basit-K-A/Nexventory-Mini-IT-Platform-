"""CRUD for ticket comments."""

from sqlalchemy.orm import Session

from models.ticket_comment import TicketComment


def list_comments(db: Session, ticket_id: int) -> list[TicketComment]:
    return (
        db.query(TicketComment)
        .filter(TicketComment.ticket_id == ticket_id)
        .order_by(TicketComment.created_at.asc())
        .all()
    )


def create_comment(db: Session, *, ticket_id: int, user_id: int, body: str) -> TicketComment:
    comment = TicketComment(ticket_id=ticket_id, user_id=user_id, body=body)
    db.add(comment)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(comment)
    return comment
