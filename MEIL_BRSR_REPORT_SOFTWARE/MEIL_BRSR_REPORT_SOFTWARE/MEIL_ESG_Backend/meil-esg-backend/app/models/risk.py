from app.extensions import db
from app.models.base import TimestampMixin, gen_uuid

RISK_TYPE_RISK = "RISK"
RISK_TYPE_OPPORTUNITY = "OPPORTUNITY"


class Risk(db.Model, TimestampMixin):
    """Management register. `financial_exposure` (₹ Cr) is an internal figure only — it is
    deliberately never read by the report engine's Section A24 output; `financial_implication`
    (qualitative text) is what actually appears in the BRSR disclosure, matching the company's
    specific correction that BRSR's financial-implications field is not a forward-looking number.
    """
    __tablename__ = "risks"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    risk_code = db.Column(db.String(20), unique=True, nullable=False)   # "RSK-01"
    organization_id = db.Column(db.String(36), db.ForeignKey("organizations.id"), nullable=True)
    project_id = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=True)
    risk_or_opportunity = db.Column(db.String(20), nullable=False, default=RISK_TYPE_RISK)
    category = db.Column(db.String(20), nullable=False)   # Environmental | Social | Governance
    title = db.Column(db.String(255), nullable=False)
    rationale = db.Column(db.Text)
    probability = db.Column(db.Integer, nullable=False, default=2)   # 1-3 (Low/Med/High)
    impact = db.Column(db.Integer, nullable=False, default=2)
    risk_score = db.Column(db.Integer, nullable=False, default=4)    # probability * impact, kept in sync
    financial_exposure = db.Column(db.Numeric(14, 2), default=0)     # ₹ Cr — INTERNAL MANAGEMENT FIGURE ONLY
    financial_implication = db.Column(db.Text)                       # qualitative — this is what BRSR A24 shows
    time_horizon = db.Column(db.String(30))
    owner_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    owner_label = db.Column(db.String(120))    # free-text fallback when no user account exists yet
    mitigation = db.Column(db.Text, nullable=False)
    linked_indicator_id = db.Column(db.Integer, db.ForeignKey("brsr_indicators.id"), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="OPEN")  # OPEN | MITIGATING | MONITORING | CLOSED
    include_in_brsr = db.Column(db.Boolean, default=False)             # surfaces in Section A, Q24

    def recompute_score(self):
        self.risk_score = (self.probability or 0) * (self.impact or 0)

    def to_dict(self):
        return {
            "id": self.id, "code": self.risk_code, "type": self.risk_or_opportunity, "category": self.category,
            "title": self.title, "rationale": self.rationale, "probability": self.probability, "impact": self.impact,
            "riskScore": self.risk_score, "financialExposureCr": float(self.financial_exposure or 0),
            "financialImplication": self.financial_implication, "timeHorizon": self.time_horizon,
            "owner": self.owner_label, "mitigation": self.mitigation, "status": self.status,
            "includeInBrsr": self.include_in_brsr,
        }


class RiskAssessment(db.Model, TimestampMixin):
    """History of re-scoring, so a risk's probability/impact trend over time is auditable."""
    __tablename__ = "risk_assessments"
    id = db.Column(db.Integer, primary_key=True)
    risk_id = db.Column(db.String(36), db.ForeignKey("risks.id"), nullable=False)
    probability = db.Column(db.Integer, nullable=False)
    impact = db.Column(db.Integer, nullable=False)
    risk_score = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.Text)
    assessed_by_id = db.Column(db.String(36), db.ForeignKey("users.id"))


class RiskAction(db.Model, TimestampMixin):
    __tablename__ = "risk_actions"
    id = db.Column(db.Integer, primary_key=True)
    risk_id = db.Column(db.String(36), db.ForeignKey("risks.id"), nullable=False)
    action = db.Column(db.String(255), nullable=False)
    owner_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    due_date = db.Column(db.Date)
    status = db.Column(db.String(20), nullable=False, default="OPEN")
    progress = db.Column(db.Integer, default=0)
    completed_at = db.Column(db.DateTime(timezone=True))
