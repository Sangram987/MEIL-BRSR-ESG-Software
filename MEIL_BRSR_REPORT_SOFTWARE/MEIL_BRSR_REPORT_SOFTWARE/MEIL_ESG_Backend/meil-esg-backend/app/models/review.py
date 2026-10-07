from app.extensions import db
from app.models.base import TimestampMixin

ACTION_APPROVE = "APPROVE"
ACTION_REJECT = "REJECT"
ACTION_REQUEST_CORRECTION = "REQUEST_CORRECTION"


class ReviewAction(db.Model, TimestampMixin):
    """Every BU-manager (or assessor) decision on a submission, with the checklist they ticked
    through — this is the full history a packet's "Review trail" renders from."""
    __tablename__ = "review_actions"
    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.String(36), db.ForeignKey("esg_submissions.id"), nullable=False, index=True)
    reviewer_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    action = db.Column(db.String(30), nullable=False)
    comment = db.Column(db.Text)
    checklist_json = db.Column(db.JSON, default=dict)

    reviewer = db.relationship("User")

    def to_dict(self):
        return {
            "action": self.action, "comment": self.comment, "checklist": self.checklist_json,
            "reviewer": self.reviewer.full_name if self.reviewer else None,
            "at": self.created_at.isoformat() if self.created_at else None,
        }
