from app.extensions import db
from app.models.base import TimestampMixin, gen_uuid

ORG_TYPE_GROUP = "GROUP"
ORG_TYPE_SUBSIDIARY = "SUBSIDIARY"
ORG_TYPE_ASSOCIATE = "ASSOCIATE"
ORG_TYPE_JOINT_VENTURE = "JOINT_VENTURE"
ORG_TYPE_OTHER = "OTHER"

REL_PARENT = "PARENT"            # the reporting entity itself
REL_SUBSIDIARY = "SUBSIDIARY"
REL_JOINT_VENTURE = "JOINT_VENTURE"
REL_ASSOCIATE = "ASSOCIATE"


class Organization(db.Model, TimestampMixin):
    """A node in Group → Subsidiary chain. The Group itself is a row with type=GROUP and
    parent_id=None; everything else points at its parent."""
    __tablename__ = "organizations"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    code = db.Column(db.String(40), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(20), nullable=False, default=ORG_TYPE_SUBSIDIARY)
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")
    parent_id = db.Column(db.String(36), db.ForeignKey("organizations.id"), nullable=True)

    parent = db.relationship("Organization", remote_side=[id], backref="children")
    business_units = db.relationship("BusinessUnit", back_populates="organization", cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "code": self.code, "name": self.name, "type": self.type, "status": self.status, "parentId": self.parent_id}


class OrganizationRelationship(db.Model, TimestampMixin):
    """Formal SEBI Annexure-I relationship table (Section A, Q21): who owns how much of whom,
    and whether that entity is in scope for BR initiatives / the reporting boundary. This is
    deliberately separate from the simple parent_id tree above, because ownership % and
    relationship_type can change over time (effective_from / effective_to) independent of where
    the entity sits in the org chart used for data roll-up.
    """
    __tablename__ = "organization_relationships"
    id = db.Column(db.Integer, primary_key=True)
    parent_org_id = db.Column(db.String(36), db.ForeignKey("organizations.id"), nullable=False)
    child_org_id = db.Column(db.String(36), db.ForeignKey("organizations.id"), nullable=False)
    relationship_type = db.Column(db.String(20), nullable=False, default=REL_SUBSIDIARY)
    ownership_percentage = db.Column(db.Numeric(5, 2))
    participates_in_br_initiatives = db.Column(db.Boolean, default=True)
    effective_from = db.Column(db.Date)
    effective_to = db.Column(db.Date)

    parent_org = db.relationship("Organization", foreign_keys=[parent_org_id])
    child_org = db.relationship("Organization", foreign_keys=[child_org_id])


class BusinessUnit(db.Model, TimestampMixin):
    __tablename__ = "business_units"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    code = db.Column(db.String(40), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    organization_id = db.Column(db.String(36), db.ForeignKey("organizations.id"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")

    organization = db.relationship("Organization", back_populates="business_units")
    projects = db.relationship("Project", back_populates="business_unit", cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "code": self.code, "name": self.name, "organizationId": self.organization_id, "status": self.status}


class Project(db.Model, TimestampMixin):
    __tablename__ = "projects"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    project_code = db.Column(db.String(40), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    business_unit_id = db.Column(db.String(36), db.ForeignKey("business_units.id"), nullable=False)
    state = db.Column(db.String(120))
    country = db.Column(db.String(80), default="India")
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    turnover_cr = db.Column(db.Numeric(14, 2), default=0)       # ₹ crore, annualised — denominator for intensity KPIs
    currency = db.Column(db.String(8), default="INR")
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")  # ACTIVE | CLOSED
    is_live = db.Column(db.Boolean, default=True)                # feeds a BU manager's active queue
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)

    business_unit = db.relationship("BusinessUnit", back_populates="projects")

    def to_dict(self):
        return {
            "id": self.id, "projectCode": self.project_code, "name": self.name,
            "businessUnitId": self.business_unit_id, "state": self.state, "country": self.country,
            "latitude": self.latitude, "longitude": self.longitude,
            "turnoverCr": float(self.turnover_cr or 0), "status": self.status, "isLive": self.is_live,
        }
