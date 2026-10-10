import uuid
from datetime import datetime, timezone
from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


def gen_uuid():
    return str(uuid.uuid4())


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class CodeSequence(db.Model):
    """Persistent counter used to mint human-readable codes like SUB-1000, VR-2100, RSK-05,
    without relying on autoincrement IDs (which differ across DB engines) for display purposes."""
    __tablename__ = "code_sequences"
    name = db.Column(db.String(40), primary_key=True)
    value = db.Column(db.Integer, nullable=False, default=0)

    @classmethod
    def next(cls, name, start=1000):
        row = db.session.get(cls, name)
        if row is None:
            calculated_start = start
            try:
                if name == "risk":
                    from app.models.risk import Risk
                    risks = Risk.query.all()
                    nums = [int(r.risk_code.split("-")[1]) for r in risks if r.risk_code and "-" in r.risk_code and r.risk_code.split("-")[1].isdigit()]
                    if nums:
                        calculated_start = max(nums)
                elif name == "vendor":
                    from app.models.vendor import Vendor
                    vendors = Vendor.query.all()
                    nums = [int(v.vendor_code.split("-")[1]) for v in vendors if v.vendor_code and "-" in v.vendor_code and v.vendor_code.split("-")[1].isdigit()]
                    if nums:
                        calculated_start = max(nums)
                elif name == "report":
                    from app.models.report import Report
                    reports = Report.query.all()
                    nums = [int(r.report_code.split("-")[1]) for r in reports if r.report_code and "-" in r.report_code and r.report_code.split("-")[1].isdigit()]
                    if nums:
                        calculated_start = max(nums)
                elif name == "organization":
                    from app.models.organization import Organization
                    orgs = Organization.query.all()
                    nums = [int(o.code.split("-")[1]) for o in orgs if o.code and "-" in o.code and o.code.split("-")[1].isdigit()]
                    if nums:
                        calculated_start = max(nums)
            except Exception:
                calculated_start = start
            row = cls(name=name, value=calculated_start)
            db.session.add(row)
        row.value += 1
        db.session.flush()
        return row.value
