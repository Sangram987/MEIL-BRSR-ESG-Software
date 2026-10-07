from app.extensions import db
from app.models.base import TimestampMixin, gen_uuid

VENDOR_REQUEST_REQUESTED = "REQUESTED"
VENDOR_REQUEST_SUBMITTED = "SUBMITTED"
VENDOR_REQUEST_CORRECTION_REQUIRED = "CORRECTION_REQUIRED"
VENDOR_REQUEST_ACCEPTED = "ACCEPTED"


class Vendor(db.Model, TimestampMixin):
    __tablename__ = "vendors"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    vendor_code = db.Column(db.String(30), unique=True, nullable=False)
    legal_name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(80))
    contact_name = db.Column(db.String(120))
    email = db.Column(db.String(190))
    phone = db.Column(db.String(30))
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")
    risk_level = db.Column(db.String(10), default="LOW")   # LOW | MEDIUM | HIGH, set by analytics

    def to_dict(self):
        return {"id": self.id, "code": self.vendor_code, "name": self.legal_name, "category": self.category,
                "status": self.status, "riskLevel": self.risk_level}


class VendorProjectLink(db.Model):
    """Which MEIL projects a vendor actually supplies, used to scope a vendor-portal user's
    visibility and to attribute their Scope 3 contribution to the right part of the hierarchy."""
    __tablename__ = "vendor_project_links"
    id = db.Column(db.Integer, primary_key=True)
    vendor_id = db.Column(db.String(36), db.ForeignKey("vendors.id"), nullable=False)
    project_id = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=False)
    __table_args__ = (db.UniqueConstraint("vendor_id", "project_id", name="uq_vendor_project"),)


class VendorRequest(db.Model, TimestampMixin):
    __tablename__ = "vendor_requests"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    request_code = db.Column(db.String(30), unique=True, nullable=False)   # "VR-2101"
    vendor_id = db.Column(db.String(36), db.ForeignKey("vendors.id"), nullable=False, index=True)
    reporting_period_id = db.Column(db.String(36), db.ForeignKey("reporting_periods.id"), nullable=False)
    requester_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    due_date = db.Column(db.Date)
    message = db.Column(db.Text)
    status = db.Column(db.String(30), nullable=False, default=VENDOR_REQUEST_REQUESTED)
    review_comment = db.Column(db.Text)

    vendor = db.relationship("Vendor")
    values = db.relationship("VendorValue", back_populates="request", cascade="all, delete-orphan")

    def to_dict(self, include_values=False):
        out = {
            "id": self.id, "code": self.request_code, "vendorId": self.vendor_id,
            "reportingPeriodId": self.reporting_period_id, "dueDate": self.due_date.isoformat() if self.due_date else None,
            "status": self.status, "reviewComment": self.review_comment,
        }
        if include_values:
            out["values"] = {
             v.field_code:
            float(v.numeric_value)
            if v.numeric_value is not None
            else None
            for v in self.values
        }

        out["evidence"] = {
         v.field_code:
            v.evidence_document_id
         for v in self.values
         if v.evidence_document_id
        }
        return out


class VendorValue(db.Model, TimestampMixin):
    """Vendor questionnaire answers — a small fixed field set (see seeds/seed_brsr.py VENDOR_FIELDS),
    kept separate from BrsrIndicator because vendors answer a simplified version of BRSR Core,
    not the full site questionnaire."""
    __tablename__ = "vendor_values"
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.String(36), db.ForeignKey("vendor_requests.id"), nullable=False)
    field_code = db.Column(db.String(40), nullable=False)
    numeric_value = db.Column(db.Numeric(18, 4))
    evidence_document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=True)

    request = db.relationship("VendorRequest", back_populates="values")
    __table_args__ = (db.UniqueConstraint("request_id", "field_code", name="uq_vendor_value"),)


class VendorReview(db.Model, TimestampMixin):
    __tablename__ = "vendor_reviews"
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.String(36), db.ForeignKey("vendor_requests.id"), nullable=False)
    reviewer_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    decision = db.Column(db.String(30), nullable=False)    # ACCEPT | CORRECTION_REQUIRED
    comment = db.Column(db.Text)
