from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.models.assessment import AssessmentEngagement, AssessmentSample, AssessmentFinding
from app.models.submission import EsgSubmission, STATUS_APPROVED, STATUS_LOCKED
from app.schemas.vendor_risk_assessment import AssessmentOpinionSchema
from app.security.decorators import roles_required, authenticated
from app.services.assessment_service import validate_engagement_payload
from app.utils.errors import ApiError
from app.utils.audit import record

bp = Blueprint("assessment", __name__)


@bp.get("/assessments/workbench")
@roles_required("ASSESSOR", "GROUP_ADMIN", "ESG_MANAGER")
def workbench():
    """Only BU-approved/locked packets whose principle actually has a BRSR-Core-tagged indicator
    appear here — mirrors the frontend's Assessment/Assurance Workbench filter exactly."""
    status_filter = request.args.get("status")
    q = (
        EsgSubmission.query
        .filter(EsgSubmission.status.in_((STATUS_APPROVED, STATUS_LOCKED)))
        .join(EsgSubmission.principle)
    )
    rows = [s for s in q.all() if any(i.core_attribute_id for i in s.principle.indicators)]
    if status_filter:
        rows = [s for s in rows if s.assessment_status == status_filter.upper()]
    return jsonify([
        s.to_dict(include_values=True)
        for s in rows
    ])


@bp.post("/assessments/<submission_id>/status")
@roles_required("ASSESSOR")
def set_sample_status(submission_id):
    sub = EsgSubmission.query.get_or_404(submission_id)
    body = request.get_json(force=True) or {}
    status = body.get("status")
    if status not in ("NOT_STARTED", "IN_REVIEW", "ASSESSED", "ASSURED", "EXCEPTION"):
        raise ApiError("Invalid status.", 422)
    sub.assessment_status = status
    record(f"ASSESSMENT_{status}", "EsgSubmission", sub.submission_code, details=body.get("note", ""))
    db.session.commit()
    return jsonify(sub.to_dict())


@bp.get("/assessments/engagements")
@authenticated
def list_engagements():
    period_id = request.args.get("reportingPeriodId")
    org_id = request.args.get("organizationId")
    q = AssessmentEngagement.query
    if period_id:
        q = q.filter_by(reporting_period_id=period_id)
    if org_id:
        q = q.filter_by(organization_id=org_id)
    return jsonify([e.to_dict() for e in q.all()])


@bp.put("/assessments/engagements/<core_attribute_id>")
@roles_required("ASSESSOR")
def issue_opinion(core_attribute_id):
    body = request.get_json(force=True) or {}
    period_id, org_id = body.get("reportingPeriodId"), body.get("organizationId")
    if not period_id or not org_id:
        raise ApiError("reportingPeriodId and organizationId are required.", 422)
    if org_id in ("meil", "MEIL") or (org_id and len(str(org_id)) != 36):
        from app.models.organization import Organization
        org = Organization.query.filter((Organization.code == org_id) | (Organization.id == org_id)).first()
        if org:
            org_id = org.id
    if period_id and len(str(period_id)) != 36:
        from app.models.period import ReportingPeriod
        rp = ReportingPeriod.query.filter_by(financial_year=period_id, period_type="FINANCIAL_YEAR").first() or ReportingPeriod.query.filter_by(name=period_id).first()
        if rp:
            period_id = rp.id
    data = AssessmentOpinionSchema().load(body)
    validate_engagement_payload(data)   # raises ApiError on independence-rule violation

    row = AssessmentEngagement.query.filter_by(
        reporting_period_id=period_id, organization_id=org_id, core_attribute_id=core_attribute_id
    ).first()
    if row is None:
        row = AssessmentEngagement(reporting_period_id=period_id, organization_id=org_id, core_attribute_id=core_attribute_id)
        db.session.add(row)

    for field, key in (
        ("mode", "mode"), ("status", "status"), ("provider", "provider"), ("providerType", "provider_type"),
        ("standard", "standard"), ("scope", "scope"), ("methodology", "methodology"),
        ("evidenceTested", "evidence_tested"), ("exceptions", "exceptions"),
        ("independenceConfirmed", "independence_confirmed"), ("note", "note"),
    ):
        setattr(row, key, data[field])
    row.issued_by_id = g.current_user.id
    row.issued_at = datetime.now(timezone.utc)

    record(f"{'ASSESSMENT' if row.mode == 'ASSESSMENT' else 'ASSURANCE'}_OPINION", "AssessmentEngagement",
           f"{period_id}:{core_attribute_id}", details=row.status)
    db.session.commit()
    return jsonify(row.to_dict())


@bp.post("/assessments/<engagement_id>/sample")
@roles_required("ASSESSOR")
def add_sample(engagement_id):
    body = request.get_json(force=True) or {}
    sample = AssessmentSample(engagement_id=engagement_id, submission_id=body.get("submissionId"),
                               status=body.get("status", "IN_REVIEW"), note=body.get("note"),
                               reviewed_by_id=g.current_user.id)
    db.session.add(sample)
    db.session.commit()
    return jsonify({"id": sample.id}), 201


@bp.post("/assessments/<engagement_id>/finding")
@roles_required("ASSESSOR")
def add_finding(engagement_id):
    body = request.get_json(force=True) or {}
    if not body.get("description"):
        raise ApiError("description is required.", 422)
    finding = AssessmentFinding(engagement_id=engagement_id, sample_id=body.get("sampleId"),
                                 description=body["description"], severity=body.get("severity", "LOW"))
    db.session.add(finding)
    db.session.commit()
    return jsonify({"id": finding.id}), 201
