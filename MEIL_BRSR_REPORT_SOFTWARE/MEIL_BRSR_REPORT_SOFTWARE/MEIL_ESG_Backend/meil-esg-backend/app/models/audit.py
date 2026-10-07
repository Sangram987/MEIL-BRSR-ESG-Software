from app.extensions import db
from app.models.base import TimestampMixin


class AuditLog(db.Model, TimestampMixin):
    """Append-only. Written by app/utils/audit.py::record() from inside the same transaction as
    the change it documents, so an action and its log entry always commit or roll back together."""
    __tablename__ = "audit_logs"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    action = db.Column(db.String(60), nullable=False, index=True)
    entity_type = db.Column(db.String(60), nullable=False)
    entity_id = db.Column(db.String(60), nullable=False, index=True)
    details = db.Column(db.Text)
    old_value_json = db.Column(db.JSON)
    new_value_json = db.Column(db.JSON)
    ip_address = db.Column(db.String(64))
    user_agent = db.Column(db.String(255))

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id, "user": self.user.full_name if self.user else "System",
            "action": self.action, "entityType": self.entity_type, "entityId": self.entity_id,
            "details": self.details, "at": self.created_at.isoformat() if self.created_at else None,
        }
