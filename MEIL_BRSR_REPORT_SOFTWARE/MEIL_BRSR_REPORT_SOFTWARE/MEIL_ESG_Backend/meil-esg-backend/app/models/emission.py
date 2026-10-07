from app.extensions import db
from app.models.base import TimestampMixin

SCOPE_1 = "SCOPE_1"
SCOPE_2 = "SCOPE_2"
SCOPE_3 = "SCOPE_3"


class EmissionFactor(db.Model, TimestampMixin):
    """Replaces the frontend's hard-coded `EF = {dieselKgPerL: 2.68, ...}` constant (critique
    §14). Versioned and sourced, so a report can cite exactly which factor set produced a number,
    and an old report recalculated later still matches what was filed at the time (valid_to)."""
    __tablename__ = "emission_factors"
    id = db.Column(db.Integer, primary_key=True)
    activity_type = db.Column(db.String(40), nullable=False)   # DIESEL_L | PETROL_L | GRID_KWH | ...
    scope = db.Column(db.String(10), nullable=False)
    factor_value = db.Column(db.Numeric(12, 6), nullable=False)
    factor_unit = db.Column(db.String(40), nullable=False)      # "kgCO2e/L", "kgCO2e/kWh"
    source = db.Column(db.String(120))                          # "CEA CO2 Baseline Database v19"
    source_version = db.Column(db.String(40))
    gwp_version = db.Column(db.String(20))                      # "AR5", "AR6"
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)
    approved_by_id = db.Column(db.String(36), db.ForeignKey("users.id"))

    def to_dict(self):
        return {"activityType": self.activity_type, "scope": self.scope, "value": float(self.factor_value),
                "unit": self.factor_unit, "source": self.source, "validFrom": self.valid_from.isoformat() if self.valid_from else None}


class EmissionActivity(db.Model, TimestampMixin):
    """A raw activity-data record (e.g. a vendor's reported diesel litres for a period) that
    emission_service.py turns into a calculation. Kept distinct from EsgValue because activity
    data can come from vendors or projects and may be recalculated against a different factor
    set without touching the originally reported quantity."""
    __tablename__ = "emission_activities"
    id = db.Column(db.Integer, primary_key=True)
    vendor_id = db.Column(db.String(36), db.ForeignKey("vendors.id"), nullable=True)
    project_id = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=True)
    reporting_period_id = db.Column(db.String(36), db.ForeignKey("reporting_periods.id"), nullable=False)
    category = db.Column(db.String(40), nullable=False)
    activity_value = db.Column(db.Numeric(18, 4), nullable=False)
    activity_unit = db.Column(db.String(40), nullable=False)


class EmissionCalculation(db.Model, TimestampMixin):
    __tablename__ = "emission_calculations"
    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey("emission_activities.id"), nullable=False)
    factor_id = db.Column(db.Integer, db.ForeignKey("emission_factors.id"), nullable=False)
    method = db.Column(db.String(40), nullable=False, default="ACTIVITY_X_FACTOR")
    calculated_tco2e = db.Column(db.Numeric(18, 4), nullable=False)
    assumptions = db.Column(db.Text)


class Scope3Methodology(db.Model, TimestampMixin):
    """Policy-driven value-chain configuration (critique §29, §51) — one active row per org.
    Nothing about "75% rule" or "mandatory assurance" is hard-coded; this row is what the
    Reports/ValueChain screens read and let the Group Admin edit."""
    __tablename__ = "scope3_methodologies"
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.String(36), db.ForeignKey("organizations.id"), nullable=False)
    applicability = db.Column(db.String(30), nullable=False, default="VOLUNTARY_TOP250")  # VOLUNTARY_TOP250 | MANDATORY | NOT_APPLICABLE
    allocation_method = db.Column(db.String(30), nullable=False, default="REVENUE_SHARE")  # REVENUE_SHARE | SPEND_SHARE | DIRECT
    methodology_note = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {"applicability": self.applicability, "allocationMethod": self.allocation_method, "methodologyNote": self.methodology_note}
