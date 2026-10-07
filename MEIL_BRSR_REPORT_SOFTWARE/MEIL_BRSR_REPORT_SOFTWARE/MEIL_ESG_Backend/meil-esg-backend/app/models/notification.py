from app.extensions import db
from app.models.base import TimestampMixin


class Notification(db.Model, TimestampMixin):
    __tablename__ = "notifications"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    type = db.Column(db.String(40), nullable=False)   # SUBMISSION | CORRECTION | APPROVAL | VENDOR_REQUEST | RISK | REPORT | DEADLINE
    title = db.Column(db.String(200))
    message = db.Column(db.String(500), nullable=False)
    link = db.Column(db.String(255))
    read_at = db.Column(db.DateTime(timezone=True))

    def to_dict(self):
        return {
            "id": self.id, "type": self.type, "title": self.title, "message": self.message,
            "link": self.link, "read": self.read_at is not None,
            "at": self.created_at.isoformat() if self.created_at else None,
        }
