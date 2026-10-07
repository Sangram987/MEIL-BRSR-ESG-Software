"""
The BRSR master — this is the table the frontend's src/data/brsr.js was always meant to be a
prototype of (see the company's own review, §40-43). Nothing about *what* P1-P9 ask for, which
fields are BRSR Core, or how a value aggregates should live in frontend code or be hard-coded in
Python once this exists: it lives here, versioned by BrsrFrameworkVersion, so a future SEBI
circular is a data migration, not a redeploy.

Aggregation methods (critique §16, §38) are explicit per indicator rather than applied blindly:
  SUM             - flow quantities (electricity, water, waste, counts) -> summed across months/sites
  END_OF_PERIOD   - stock quantities (headcount) -> last value in the period, or averaged across
                    reporting sites for a roll-up, never summed
  RECALCULATE     - ratios/rates (LTIFR, turnover rate, % female) -> recomputed from the summed
                    numerator and denominator, never averaged
  LATEST          - status-like fields (risk score) -> most recent value wins
"""
from app.extensions import db
from app.models.base import TimestampMixin

AGG_SUM = "SUM"
AGG_END_OF_PERIOD = "END_OF_PERIOD"
AGG_RECALCULATE = "RECALCULATE"
AGG_LATEST = "LATEST"

TIER_ESSENTIAL = "ESSENTIAL"
TIER_LEADERSHIP = "LEADERSHIP"

DATA_TYPE_DECIMAL = "DECIMAL"
DATA_TYPE_INTEGER = "INTEGER"
DATA_TYPE_TEXT = "TEXT"
DATA_TYPE_BOOLEAN = "BOOLEAN"
DATA_TYPE_DATE = "DATE"
DATA_TYPE_JSON = "JSON"

LEVEL_SITE = "SITE"
LEVEL_ENTITY = "ENTITY"
LEVEL_VALUE_CHAIN = "VALUE_CHAIN"


class BrsrFrameworkVersion(db.Model, TimestampMixin):
    __tablename__ = "brsr_framework_versions"
    id = db.Column(db.Integer, primary_key=True)
    version = db.Column(db.String(20), unique=True, nullable=False)   # "2024.1"
    effective_from = db.Column(db.Date, nullable=False)
    effective_to = db.Column(db.Date)
    description = db.Column(db.String(255))
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")  # ACTIVE | SUPERSEDED

    sections = db.relationship("BrsrSection", back_populates="framework_version", cascade="all, delete-orphan")


class BrsrSection(db.Model):
    __tablename__ = "brsr_sections"
    id = db.Column(db.Integer, primary_key=True)
    framework_version_id = db.Column(db.Integer, db.ForeignKey("brsr_framework_versions.id"), nullable=False)
    code = db.Column(db.String(10), nullable=False)       # A | B | C | CORE
    name = db.Column(db.String(120), nullable=False)
    sequence = db.Column(db.Integer, nullable=False, default=0)

    framework_version = db.relationship("BrsrFrameworkVersion", back_populates="sections")
    principles = db.relationship("BrsrPrinciple", back_populates="section", cascade="all, delete-orphan")


class BrsrPrinciple(db.Model):
    __tablename__ = "brsr_principles"
    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(db.Integer, db.ForeignKey("brsr_sections.id"), nullable=False)
    code = db.Column(db.String(10), nullable=False)        # P1 .. P9
    label = db.Column(db.String(200), nullable=False)
    pillar = db.Column(db.String(1))                        # E | S | G
    sequence = db.Column(db.Integer, nullable=False, default=0)

    section = db.relationship("BrsrSection", back_populates="principles")
    indicators = db.relationship("BrsrIndicator", back_populates="principle", cascade="all, delete-orphan")
    sdg_links = db.relationship("PrincipleSdgMapping", back_populates="principle", cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "code": self.code, "label": self.label, "pillar": self.pillar,
                "sdgs": [l.sdg_id for l in self.sdg_links]}


class BrsrCoreAttribute(db.Model):
    """The 9 BRSR Core attributes (2023 circular). Attributes flagged entity_level=True (Fairness,
    Openness) are never populated by site roll-up — see BrsrIndicator.reporting_level."""
    __tablename__ = "brsr_core_attributes"
    id = db.Column(db.String(20), primary_key=True)   # 'ghg' | 'water' | ... | 'fair' | 'open'
    label = db.Column(db.String(120), nullable=False)
    sequence = db.Column(db.Integer, nullable=False, default=0)
    entity_level = db.Column(db.Boolean, default=False)


class BrsrIndicator(db.Model, TimestampMixin):
    __tablename__ = "brsr_indicators"
    id = db.Column(db.Integer, primary_key=True)
    principle_id = db.Column(db.Integer, db.ForeignKey("brsr_principles.id"), nullable=True)  # null for Section A/B items
    indicator_code = db.Column(db.String(40), unique=True, nullable=False)   # stable key, e.g. "p6_grid"
    question_code = db.Column(db.String(40))                                 # SEBI Annexure reference, e.g. "C-P6-E-1"
    label = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    tier = db.Column(db.String(20), nullable=False, default=TIER_ESSENTIAL)
    data_type = db.Column(db.String(20), nullable=False, default=DATA_TYPE_DECIMAL)
    unit = db.Column(db.String(40))
    frequency = db.Column(db.String(20), nullable=False, default="MONTHLY")   # MONTHLY | ANNUAL
    aggregation_method = db.Column(db.String(20), nullable=False, default=AGG_SUM)
    required = db.Column(db.Boolean, default=False)
    evidence_required = db.Column(db.Boolean, default=False)
    core_attribute_id = db.Column(db.String(20), db.ForeignKey("brsr_core_attributes.id"), nullable=True)
    reporting_level = db.Column(db.String(20), nullable=False, default=LEVEL_SITE)  # SITE | ENTITY | VALUE_CHAIN
    active = db.Column(db.Boolean, default=True)

    principle = db.relationship("BrsrPrinciple", back_populates="indicators")
    core_attribute = db.relationship("BrsrCoreAttribute")
    validation_rules = db.relationship("BrsrValidationRule", back_populates="indicator", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id, "indicatorCode": self.indicator_code, "questionCode": self.question_code,
            "label": self.label, "tier": self.tier, "dataType": self.data_type, "unit": self.unit,
            "frequency": self.frequency, "aggregationMethod": self.aggregation_method,
            "required": self.required, "evidenceRequired": self.evidence_required,
            "coreAttribute": self.core_attribute_id, "reportingLevel": self.reporting_level,
            "principleCode": self.principle.code if self.principle else None,
        }


class BrsrValidationRule(db.Model):
    """Declarative validation, so new rules are a seed-data row rather than a Python deploy.
    `rule_type` picks the interpreter in services/validation_service.py; `params_json` carries
    its arguments, e.g. {"max_pct_increase": 40} or {"compare_to": "p6_water", "op": "<="}.
    """
    __tablename__ = "brsr_validation_rules"
    id = db.Column(db.Integer, primary_key=True)
    indicator_id = db.Column(db.Integer, db.ForeignKey("brsr_indicators.id"), nullable=False)
    rule_type = db.Column(db.String(40), nullable=False)   # NON_NEGATIVE | SPIKE_CHECK | COMPARE | REQUIRED_IF
    params_json = db.Column(db.JSON, default=dict)
    message = db.Column(db.String(255))
    severity = db.Column(db.String(10), nullable=False, default="ERROR")  # ERROR | WARNING

    indicator = db.relationship("BrsrIndicator", back_populates="validation_rules")


class Sdg(db.Model):
    __tablename__ = "sdgs"
    id = db.Column(db.Integer, primary_key=True)  # 1..17
    name = db.Column(db.String(120), nullable=False)


class PrincipleSdgMapping(db.Model):
    __tablename__ = "principle_sdg_mapping"
    id = db.Column(db.Integer, primary_key=True)
    principle_id = db.Column(db.Integer, db.ForeignKey("brsr_principles.id"), nullable=False)
    sdg_id = db.Column(db.Integer, db.ForeignKey("sdgs.id"), nullable=False)

    principle = db.relationship("BrsrPrinciple", back_populates="sdg_links")
    __table_args__ = (db.UniqueConstraint("principle_id", "sdg_id", name="uq_principle_sdg"),)
