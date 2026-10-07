from app.extensions import db
from app.models.base import TimestampMixin, gen_uuid

MODE_ASSESSMENT = "ASSESSMENT"
MODE_ASSURANCE = "ASSURANCE"

INTERNAL_AUDIT_PROVIDER_TYPE = "INTERNAL_AUDIT"


class AssessmentEngagement(db.Model, TimestampMixin):
    """One row per BRSR Core attribute per financial year. `mode` is ASSESSMENT or ASSURANCE —
    SEBI allows either, so the schema never hard-codes "assurance" as the only option. The
    independence rule (an internal auditor cannot provide assurance) is enforced in
    services/assessment_service.py before this row is allowed to be saved with mode=ASSURANCE."""
    __tablename__ = "assessment_engagements"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    reporting_period_id = db.Column(db.String(36), db.ForeignKey("reporting_periods.id"), nullable=False)
    organization_id = db.Column(db.String(36), db.ForeignKey("organizations.id"), nullable=False)
    core_attribute_id = db.Column(db.String(20), db.ForeignKey("brsr_core_attributes.id"), nullable=False)
    mode = db.Column(db.String(20), nullable=False, default=MODE_ASSURANCE)
    status = db.Column(db.String(30), nullable=False, default="PENDING")  # PENDING | IN_REVIEW | <conclusion>
    provider = db.Column(db.String(200))
    provider_type = db.Column(db.String(60))
    standard = db.Column(db.String(80))                  # ISAE 3000 | SSAE 2000 | BRSR Core industry standard | Other
    scope = db.Column(db.String(255))
    methodology = db.Column(db.Text)
    evidence_tested = db.Column(db.Text)
    exceptions = db.Column(db.Text)
    independence_confirmed = db.Column(db.Boolean, default=False)
    note = db.Column(db.Text)
    issued_by_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    issued_at = db.Column(db.DateTime(timezone=True))

    __table_args__ = (db.UniqueConstraint("reporting_period_id", "organization_id", "core_attribute_id", name="uq_engagement_slot"),)

    def to_dict(self):
        return {
            "coreAttribute": self.core_attribute_id, "mode": self.mode, "status": self.status,
            "provider": self.provider, "providerType": self.provider_type, "standard": self.standard,
            "scope": self.scope, "methodology": self.methodology, "evidenceTested": self.evidence_tested,
            "exceptions": self.exceptions, "independenceConfirmed": self.independence_confirmed,
            "note": self.note, "issuedAt": self.issued_at.isoformat() if self.issued_at else None,
        }


class AssessmentSample(db.Model, TimestampMixin):
    """Which approved submissions a reviewer sampled as part of an engagement, and the per-sample
    conclusion — this is what drives the Assessment/Assurance Workbench's packet-level statuses
    (NOT_STARTED / IN_REVIEW / ASSESSED / ASSURED / EXCEPTION)."""
    __tablename__ = "assessment_samples"
    id = db.Column(db.Integer, primary_key=True)
    engagement_id = db.Column(db.String(36), db.ForeignKey("assessment_engagements.id"), nullable=False)
    submission_id = db.Column(db.String(36), db.ForeignKey("esg_submissions.id"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="IN_REVIEW")
    note = db.Column(db.Text)
    reviewed_by_id = db.Column(db.String(36), db.ForeignKey("users.id"))


class AssessmentFinding(db.Model, TimestampMixin):
    __tablename__ = "assessment_findings"
    id = db.Column(db.Integer, primary_key=True)
    engagement_id = db.Column(db.String(36), db.ForeignKey("assessment_engagements.id"), nullable=False)
    sample_id = db.Column(db.Integer, db.ForeignKey("assessment_samples.id"), nullable=True)
    description = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(10), nullable=False, default="LOW")  # LOW | MEDIUM | HIGH
