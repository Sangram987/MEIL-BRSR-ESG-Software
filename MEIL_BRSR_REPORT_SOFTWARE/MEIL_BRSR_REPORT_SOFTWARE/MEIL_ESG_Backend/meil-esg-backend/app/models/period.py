from app.extensions import db
from app.models.base import TimestampMixin, gen_uuid

PERIOD_MONTH = "MONTH"
PERIOD_FY = "FINANCIAL_YEAR"

STATUS_OPEN = "OPEN"
STATUS_CLOSED = "CLOSED"
STATUS_LOCKED = "LOCKED"


class ReportingPeriod(db.Model, TimestampMixin):
    """Both a financial year ('FY 2026-27') and each of its 12 months are rows here, linked by
    parent_id, so the frontend's "operational month vs annual BRSR year" distinction is a real
    relationship instead of implied by date-string parsing.
    """
    __tablename__ = "reporting_periods"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    financial_year = db.Column(db.String(16), nullable=False, index=True)   # "FY 2026-27"
    period_type = db.Column(db.String(20), nullable=False, default=PERIOD_FY)
    name = db.Column(db.String(40), nullable=False)                        # "FY 2026-27" or "2026-09"
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), nullable=False, default=STATUS_OPEN)
    is_current = db.Column(db.Boolean, default=False)
    parent_id = db.Column(db.String(36), db.ForeignKey("reporting_periods.id"), nullable=True)

    parent = db.relationship("ReportingPeriod", remote_side=[id], backref="months")

    def to_dict(self):
        return {
            "id": self.id, "financialYear": self.financial_year, "periodType": self.period_type,
            "name": self.name, "startDate": self.start_date.isoformat() if self.start_date else None,
            "endDate": self.end_date.isoformat() if self.end_date else None,
            "status": self.status, "isCurrent": self.is_current, "parentId": self.parent_id,
        }
