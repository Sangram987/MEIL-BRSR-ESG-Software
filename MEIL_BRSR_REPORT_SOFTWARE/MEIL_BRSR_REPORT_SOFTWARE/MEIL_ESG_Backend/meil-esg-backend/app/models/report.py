from app.extensions import db
from app.models.base import TimestampMixin, gen_uuid

REPORT_STATUS_QUEUED = "QUEUED"
REPORT_STATUS_RUNNING = "RUNNING"
REPORT_STATUS_READY = "READY"
REPORT_STATUS_FAILED = "FAILED"


class Report(db.Model, TimestampMixin):
    """One row per "Generate report" click. Heavy report generation runs via Celery
    (tasks/reports.py) so the API returns immediately with a job id; the frontend polls
    GET /reports/<id> until status=READY. In the single-process dev fallback
    (CELERY_TASK_ALWAYS_EAGER=true) the task still runs, just synchronously in-request."""
    __tablename__ = "reports"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    report_code = db.Column(db.String(30), unique=True, nullable=False)
    report_type = db.Column(db.String(30), nullable=False, default="BRSR_DRAFT")
    framework_version_id = db.Column(db.Integer, db.ForeignKey("brsr_framework_versions.id"))
    organization_id = db.Column(db.String(36), db.ForeignKey("organizations.id"))
    scope_type = db.Column(db.String(20), nullable=False, default="GROUP")  # GROUP | SUBSIDIARY | BUSINESS_UNIT | PROJECT
    scope_id = db.Column(db.String(36))
    reporting_period_id = db.Column(db.String(36), db.ForeignKey("reporting_periods.id"), nullable=False)
    boundary_mode = db.Column(db.String(20), nullable=False, default="CONSOLIDATED")
    include_jv = db.Column(db.Boolean, default=False)
    package = db.Column(db.String(20), nullable=False, default="COMPREHENSIVE")   # COMPREHENSIVE | CORE
    include_value_chain = db.Column(db.Boolean, default=True)
    disclosure_type = db.Column(db.String(20), nullable=False, default="ASSURANCE")  # ASSESSMENT | ASSURANCE | NONE
    status = db.Column(db.String(20), nullable=False, default=REPORT_STATUS_QUEUED)
    error = db.Column(db.Text)
    created_by_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    completed_at = db.Column(db.DateTime(timezone=True))

    files = db.relationship("ReportFile", back_populates="report", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id, "code": self.report_code, "type": self.report_type, "status": self.status,
            "package": self.package, "scopeType": self.scope_type, "scopeId": self.scope_id,
            "boundaryMode": self.boundary_mode, "includeJv": self.include_jv,
            "includeValueChain": self.include_value_chain, "disclosureType": self.disclosure_type,
            "error": self.error, "files": [f.to_dict() for f in self.files],
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class ReportFile(db.Model, TimestampMixin):
    __tablename__ = "report_files"
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.String(36), db.ForeignKey("reports.id"), nullable=False)
    format = db.Column(db.String(10), nullable=False)   # PDF | XLSX | CSV | JSON | XML
    storage_key = db.Column(db.String(500), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    sha256 = db.Column(db.String(64))

    report = db.relationship("Report", back_populates="files")

    def to_dict(self):
        return {"format": self.format, "filename": self.filename}
