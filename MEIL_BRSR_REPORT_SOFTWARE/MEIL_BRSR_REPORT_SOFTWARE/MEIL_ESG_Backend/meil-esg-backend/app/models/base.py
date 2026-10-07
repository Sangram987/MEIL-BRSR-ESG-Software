import uuid
from datetime import datetime, timezone
from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


def gen_uuid():
    return str(uuid.uuid4())


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class CodeSequence(db.Model):
    """Persistent counter used to mint human-readable codes like SUB-1000, VR-2100, RSK-05,
    without relying on autoincrement IDs (which differ across DB engines) for display purposes."""
    __tablename__ = "code_sequences"
    name = db.Column(db.String(40), primary_key=True)
    value = db.Column(db.Integer, nullable=False, default=0)

    @classmethod
    def next(cls, name, start=1000):
        row = cls.query.get(name)
        if row is None:
            row = cls(name=name, value=start)
            db.session.add(row)
        row.value += 1
        db.session.flush()
        return row.value
