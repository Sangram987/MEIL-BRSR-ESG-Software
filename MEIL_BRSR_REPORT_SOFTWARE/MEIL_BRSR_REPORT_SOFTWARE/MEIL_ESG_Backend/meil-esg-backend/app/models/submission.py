from app.extensions import db
from app.models.base import TimestampMixin, gen_uuid

STATUS_DRAFT = "DRAFT"
STATUS_SUBMITTED = "SUBMITTED"
STATUS_UNDER_REVIEW = "UNDER_REVIEW"
STATUS_CORRECTION_REQUIRED = "CORRECTION_REQUIRED"
STATUS_REJECTED = "REJECTED"
STATUS_APPROVED = "APPROVED"
STATUS_LOCKED = "LOCKED"

OPEN_STATUSES = (STATUS_DRAFT, STATUS_CORRECTION_REQUIRED, STATUS_REJECTED)
EDITABLE_BY_OPERATOR = (STATUS_DRAFT, STATUS_CORRECTION_REQUIRED, STATUS_REJECTED)

ASSESSMENT_NOT_STARTED = "NOT_STARTED"
ASSESSMENT_IN_REVIEW = "IN_REVIEW"
ASSESSMENT_ASSESSED = "ASSESSED"
ASSESSMENT_ASSURED = "ASSURED"
ASSESSMENT_EXCEPTION = "EXCEPTION"


class EsgSubmission(db.Model, TimestampMixin):
    """One packet = one project + one reporting period (month) + one principle — mirrors the
    frontend's SUB-xxxx records exactly, so the migration from localStorage is a straight copy.
    `version` increments every time a locked/approved packet is corrected, and old versions are
    kept (never overwritten) via SubmissionVersion snapshots for audit purposes.
    """
    __tablename__ = "esg_submissions"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    submission_code = db.Column(db.String(30), unique=True, nullable=False)   # "SUB-1001"
    project_id = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=False, index=True)
    reporting_period_id = db.Column(db.String(36), db.ForeignKey("reporting_periods.id"), nullable=False, index=True)
    principle_id = db.Column(db.Integer, db.ForeignKey("brsr_principles.id"), nullable=False)
    status = db.Column(db.String(30), nullable=False, default=STATUS_DRAFT, index=True)
    version = db.Column(db.Integer, nullable=False, default=1)
    entered_by_role = db.Column(db.String(30))               # SITE_OPERATOR | BU_MANAGER (manager-entered flag)
    submitted_by_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    submitted_at = db.Column(db.DateTime(timezone=True))
    reviewed_by_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    reviewed_at = db.Column(db.DateTime(timezone=True))
    review_comment = db.Column(db.Text)
    locked_at = db.Column(db.DateTime(timezone=True))
    assessment_status = db.Column(db.String(20), nullable=False, default=ASSESSMENT_NOT_STARTED)

    project = db.relationship("Project")
    reporting_period = db.relationship("ReportingPeriod")
    principle = db.relationship("BrsrPrinciple")
    values = db.relationship("EsgValue", back_populates="submission", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        db.UniqueConstraint("project_id", "reporting_period_id", "principle_id", name="uq_submission_slot"),
    )

    def is_editable(self):
        return self.status in EDITABLE_BY_OPERATOR

    def to_dict(self, include_values=False):
        out = {
            "id": self.id, "code": self.submission_code, "projectId": self.project_id,
            "reportingPeriodId": self.reporting_period_id, "principleCode": self.principle.code if self.principle else None,
            "status": self.status, "version": self.version, "enteredByRole": self.entered_by_role,
            "submittedAt": self.submitted_at.isoformat() if self.submitted_at else None,
            "reviewedAt": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "reviewComment": self.review_comment, "assessmentStatus": self.assessment_status,
        }
        if include_values:
            out["values"] = {v.indicator.indicator_code: v.to_dict() for v in self.values}
        return out


class EsgValue(db.Model, TimestampMixin):
    """Multiple typed columns (not one JSON blob) so SQL-level validation/aggregation is possible,
    as the company's review explicitly asked for (critique §18)."""
    __tablename__ = "esg_values"
    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.String(36), db.ForeignKey("esg_submissions.id"), nullable=False, index=True)
    indicator_id = db.Column(db.Integer, db.ForeignKey("brsr_indicators.id"), nullable=False, index=True)
    numeric_value = db.Column(db.Numeric(18, 4))
    text_value = db.Column(db.Text)
    boolean_value = db.Column(db.Boolean)
    date_value = db.Column(db.Date)
    json_value = db.Column(db.JSON)
    source_type = db.Column(db.String(20), default="MANUAL")   # MANUAL | IMPORTED | CALCULATED
    calculation_method = db.Column(db.String(120))

    submission = db.relationship("EsgSubmission", back_populates="values")
    indicator = db.relationship("BrsrIndicator")
    evidence_links = db.relationship("MetricEvidence", back_populates="esg_value", cascade="all, delete-orphan")

    __table_args__ = (db.UniqueConstraint("submission_id", "indicator_id", name="uq_submission_indicator"),)

    def value(self):
        if self.numeric_value is not None:
            return float(self.numeric_value)
        if self.boolean_value is not None:
            return self.boolean_value
        if self.date_value is not None:
            return self.date_value.isoformat()
        if self.json_value is not None:
            return self.json_value
        return self.text_value

    def to_dict(self):
     return {
        "id": self.id,
        "value": self.value(),
        "sourceType": self.source_type,
        "evidence": [
            e.document_id
            for e in self.evidence_links
        ],
    }


class SubmissionVersion(db.Model, TimestampMixin):
    """Immutable snapshot taken whenever a submission moves to APPROVED/LOCKED or is corrected
    afterwards, so a previously approved record is never silently overwritten (critique §25)."""
    __tablename__ = "submission_versions"
    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.String(36), db.ForeignKey("esg_submissions.id"), nullable=False, index=True)
    version = db.Column(db.Integer, nullable=False)
    status_at_snapshot = db.Column(db.String(30), nullable=False)
    values_json = db.Column(db.JSON, nullable=False)   # {indicator_code: value, ...} at the time of snapshot
    snapshotted_by_id = db.Column(db.String(36), db.ForeignKey("users.id"))
