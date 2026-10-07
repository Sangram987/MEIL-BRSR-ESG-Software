"""
Section A (general disclosures) and Section B (policies & governance) are entity-level — filled
once per organization per financial year by the Group ESG Admin, never rolled up from sites. The
repeating-group fields that SEBI's Annexure I asks for as a free-form table (e.g. "markets
served", "turnover rate 3-year trend") are kept as JSON on EntityDisclosure rather than being
split into their own tables: they have no independent lifecycle of their own (you don't review or
approve a single row of the turnover-rate table), so a table-per-field would add migration
overhead without adding any real query or integrity benefit. Fields that genuinely are their own
entities with add/remove semantics — business activities, products, per-principle policy
coverage, commitments, governance review — get real tables.
"""
from app.extensions import db
from app.models.base import TimestampMixin, gen_uuid


class EntityDisclosure(db.Model, TimestampMixin):
    __tablename__ = "entity_disclosures"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    organization_id = db.Column(db.String(36), db.ForeignKey("organizations.id"), nullable=False)
    financial_year = db.Column(db.String(16), nullable=False)

    # --- Section A: entity details ---
    cin = db.Column(db.String(30))
    entity_name = db.Column(db.String(200))
    incorporation_year = db.Column(db.String(10))
    registered_office = db.Column(db.String(255))
    corporate_office = db.Column(db.String(255))
    email = db.Column(db.String(190))
    telephone = db.Column(db.String(30))
    website = db.Column(db.String(255))
    stock_exchanges = db.Column(db.String(120))
    paid_up_capital = db.Column(db.Numeric(18, 2))
    contact_person = db.Column(db.String(120))
    boundary_declared = db.Column(db.String(20), default="CONSOLIDATED")

    # --- Operations & markets ---
    plants_national = db.Column(db.Integer, default=0)
    offices_national = db.Column(db.Integer, default=0)
    plants_intl = db.Column(db.Integer, default=0)
    offices_intl = db.Column(db.Integer, default=0)
    markets_national_states = db.Column(db.Integer, default=0)
    markets_intl_countries = db.Column(db.Integer, default=0)
    exports_pct = db.Column(db.Numeric(6, 2), default=0)
    customer_types = db.Column(db.String(255))

    # --- Workforce repeating groups (JSON; see module docstring) ---
    employees_json = db.Column(db.JSON, default=dict)          # {permM,permF,otherM,otherF}
    workers_json = db.Column(db.JSON, default=dict)
    da_employees_json = db.Column(db.JSON, default=dict)       # differently-abled
    da_workers_json = db.Column(db.JSON, default=dict)
    women_board_json = db.Column(db.JSON, default=dict)        # {total, femaleCount}
    women_kmp_json = db.Column(db.JSON, default=dict)
    turnover_rate_json = db.Column(db.JSON, default=dict)      # {cur:{...}, prev:{...}, prev2:{...}}
    stakeholder_complaints_json = db.Column(db.JSON, default=dict)  # {groupName: {...}}

    # --- CSR ---
    csr_applicable = db.Column(db.Boolean, default=True)
    csr_turnover = db.Column(db.Numeric(18, 2))
    csr_net_worth = db.Column(db.Numeric(18, 2))

    # --- Section B governance ---
    director_statement = db.Column(db.Text)
    esg_head = db.Column(db.String(150))
    board_committee = db.Column(db.String(150))
    external_assessment_done = db.Column(db.Boolean, default=False)
    external_assessment_agency = db.Column(db.String(200))

    business_activities = db.relationship("BusinessActivity", cascade="all, delete-orphan")
    products_services = db.relationship("ProductService", cascade="all, delete-orphan")
    policy_coverage = db.relationship("PolicyCoverage", cascade="all, delete-orphan")
    governance_reviews = db.relationship("GovernanceReview", cascade="all, delete-orphan")
    core8 = db.relationship("Core8Fairness", uselist=False, cascade="all, delete-orphan")
    core9 = db.relationship("Core9Openness", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (db.UniqueConstraint("organization_id", "financial_year", name="uq_entity_disclosure_fy"),)


class BusinessActivity(db.Model):
    __tablename__ = "business_activities"
    id = db.Column(db.Integer, primary_key=True)
    entity_disclosure_id = db.Column(db.String(36), db.ForeignKey("entity_disclosures.id"), nullable=False)
    activity = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(255))
    turnover_pct = db.Column(db.Numeric(6, 2))


class ProductService(db.Model):
    __tablename__ = "products_services"
    id = db.Column(db.Integer, primary_key=True)
    entity_disclosure_id = db.Column(db.String(36), db.ForeignKey("entity_disclosures.id"), nullable=False)
    product = db.Column(db.String(200), nullable=False)
    nic_code = db.Column(db.String(20))
    turnover_pct = db.Column(db.Numeric(6, 2))


class PolicyCoverage(db.Model, TimestampMixin):
    __tablename__ = "policy_coverage"
    id = db.Column(db.Integer, primary_key=True)
    entity_disclosure_id = db.Column(db.String(36), db.ForeignKey("entity_disclosures.id"), nullable=False)
    principle_id = db.Column(db.Integer, db.ForeignKey("brsr_principles.id"), nullable=False)
    has_policy = db.Column(db.Boolean, default=True)
    board_approved = db.Column(db.Boolean, default=True)
    translated_to_procedure = db.Column(db.Boolean, default=True)
    extends_to_value_chain = db.Column(db.Boolean, default=False)
    codes_certifications = db.Column(db.String(255))
    policy_link = db.Column(db.String(255))
    not_covered_reason = db.Column(db.String(255))

    commitments = db.relationship("Commitment", cascade="all, delete-orphan")
    __table_args__ = (db.UniqueConstraint("entity_disclosure_id", "principle_id", name="uq_policy_principle"),)


class Commitment(db.Model):
    """Goals & targets (Q5-Q6): baseline -> current -> status, one or more rows per principle."""
    __tablename__ = "commitments"
    id = db.Column(db.Integer, primary_key=True)
    policy_coverage_id = db.Column(db.Integer, db.ForeignKey("policy_coverage.id"), nullable=False)
    target = db.Column(db.String(255))
    baseline = db.Column(db.String(120))
    current_performance = db.Column(db.String(120))
    status = db.Column(db.String(120))


class GovernanceReview(db.Model):
    __tablename__ = "governance_reviews"
    id = db.Column(db.Integer, primary_key=True)
    entity_disclosure_id = db.Column(db.String(36), db.ForeignKey("entity_disclosures.id"), nullable=False)
    principle_id = db.Column(db.Integer, db.ForeignKey("brsr_principles.id"), nullable=False)
    reviewed_by = db.Column(db.String(60), default="Committee of the Board")
    frequency = db.Column(db.String(30), default="Quarterly")
    __table_args__ = (db.UniqueConstraint("entity_disclosure_id", "principle_id", name="uq_review_principle"),)


class Core8Fairness(db.Model):
    __tablename__ = "core8_fairness"
    id = db.Column(db.Integer, primary_key=True)
    entity_disclosure_id = db.Column(db.String(36), db.ForeignKey("entity_disclosures.id"), nullable=False, unique=True)
    data_breaches = db.Column(db.Integer, default=0)
    data_breach_ratio_pct = db.Column(db.Numeric(6, 2), default=0)
    accounts_payable_days = db.Column(db.Numeric(8, 2))

    def to_dict(self):
        return {"dataBreaches": self.data_breaches, "dataBreachRatio": float(self.data_breach_ratio_pct or 0),
                "payablesDays": float(self.accounts_payable_days) if self.accounts_payable_days is not None else None}


class Core9Openness(db.Model):
    __tablename__ = "core9_openness"
    id = db.Column(db.Integer, primary_key=True)
    entity_disclosure_id = db.Column(db.String(36), db.ForeignKey("entity_disclosures.id"), nullable=False, unique=True)
    purch_trading_house_pct = db.Column(db.Numeric(6, 2))
    purch_trading_house_count = db.Column(db.Integer)
    purch_top10_pct = db.Column(db.Numeric(6, 2))
    sales_dealer_pct = db.Column(db.Numeric(6, 2))
    sales_dealer_count = db.Column(db.Integer)
    sales_top10_pct = db.Column(db.Numeric(6, 2))
    rpt_purchases_pct = db.Column(db.Numeric(6, 2))
    rpt_sales_pct = db.Column(db.Numeric(6, 2))
    rpt_loans_pct = db.Column(db.Numeric(6, 2))
    rpt_investments_pct = db.Column(db.Numeric(6, 2))

    def to_dict(self):
        return {c.name: (float(v) if isinstance(v, (int, float)) else v)
                for c, v in ((c, getattr(self, c.name)) for c in self.__table__.columns) if c.name not in ("id", "entity_disclosure_id")}
