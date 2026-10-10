from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.models.base import CodeSequence
from app.models.submission import (
    EsgSubmission, EsgValue, SubmissionVersion, STATUS_DRAFT, STATUS_SUBMITTED,
    STATUS_BU_VERIFIED, STATUS_CORRECTION_REQUIRED, STATUS_REJECTED,
)
from app.models.brsr import BrsrPrinciple, BrsrIndicator
from app.models.organization import Project
from app.schemas.submission import SaveSubmissionSchema
from app.security.decorators import authenticated, project_scope_required
from app.security.permissions import user_can_access_project
from app.services.validation_service import validate_submission_values
from app.services import consolidation_service, notification_service
from app.utils.errors import ApiError
from app.utils.audit import record
from app.utils.pagination import paginate

bp = Blueprint("submissions", __name__, url_prefix="/submissions")


def _history_avg_lookup(project_id, indicator_code, before_period_id):
    """6-period trailing average, same spirit as the frontend's calc.historyAvg(). Kept simple:
    looks at the 6 most recently *approved* submissions for this project+indicator regardless of
    calendar gaps, which is good enough for a spike/drop warning and avoids a month-arithmetic
    dependency on how reporting_periods are named."""
    from app.models.submission import STATUS_APPROVED, STATUS_LOCKED
    rows = (
        EsgValue.query.join(EsgSubmission)
        .join(BrsrIndicator)
        .filter(EsgSubmission.project_id == project_id)
        .filter(BrsrIndicator.indicator_code == indicator_code)
        .filter(EsgSubmission.status.in_((STATUS_APPROVED, STATUS_LOCKED)))
        .order_by(EsgSubmission.submitted_at.desc())
        .limit(6)
        .all()
    )
    vals = [float(r.numeric_value) for r in rows if r.numeric_value is not None]
    return (sum(vals) / len(vals), len(vals)) if vals else (None, 0)


@bp.get("")
@authenticated
def list_submissions():
    from app.models.period import ReportingPeriod
    project_id = request.args.get("projectId")
    status = request.args.get("status")
    period_id = request.args.get("reportingPeriodId")
    q = EsgSubmission.query
    if project_id:
        if not user_can_access_project(g.current_user, project_id):
            raise ApiError("You do not have access to this project.", 403)
        q = q.filter_by(project_id=project_id)
    else:
        from app.security.permissions import accessible_project_ids
        allowed = accessible_project_ids(g.current_user)
        if allowed is not None:
            q = q.filter(EsgSubmission.project_id.in_(allowed or ["__none__"]))
    if status:
        q = q.filter_by(status=status.upper())
    if period_id:
        period_row = ReportingPeriod.query.get(period_id) or ReportingPeriod.query.filter_by(name=period_id).first()
        period_db_id = period_row.id if period_row else period_id
        q = q.filter_by(reporting_period_id=period_db_id)
    items, meta = paginate(q.order_by(EsgSubmission.updated_at.desc()))
    return jsonify({"items": [s.to_dict() for s in items], "meta": meta})


@bp.get("/<submission_id>")
@authenticated
def get_submission(submission_id):
    from app.models.review import ReviewAction
    sub = EsgSubmission.query.get_or_404(submission_id)
    if not user_can_access_project(g.current_user, sub.project_id):
        raise ApiError("You do not have access to this submission.", 403)
    out = sub.to_dict(include_values=True)
    reviews = ReviewAction.query.filter_by(submission_id=sub.id).order_by(ReviewAction.created_at).all()
    out["history"] = [r.to_dict() for r in reviews]
    return jsonify(out)


@bp.post("")
@project_scope_required(("projectId",))
def save_submission():
    from app.models.period import ReportingPeriod
    user = g.current_user
    data = SaveSubmissionSchema().load(request.get_json(force=True) or {})
    project = Project.query.get(data["projectId"])
    if project is None:
        raise ApiError("Unknown project.", 404)
    principle = BrsrPrinciple.query.filter_by(code=data["principleCode"]).first()
    if principle is None:
        raise ApiError("Unknown principle.", 404)

    raw_period = data["reportingPeriodId"]
    period_row = ReportingPeriod.query.get(raw_period) or ReportingPeriod.query.filter_by(name=raw_period).first()
    if period_row is None:
        raise ApiError(f"Unknown reporting period: {raw_period}", 404)
    period_id = period_row.id

    sub = EsgSubmission.query.filter_by(
        project_id=project.id, reporting_period_id=period_id, principle_id=principle.id
    ).first()
    if sub and not sub.is_editable():
        raise ApiError(f"This packet is already {sub.status.lower()} and cannot be edited here.", 409)

    is_new = sub is None
    if is_new:
        sub = EsgSubmission(
            submission_code=f"SUB-{CodeSequence.next('submission')}",
            project_id=project.id, reporting_period_id=period_id, principle_id=principle.id,
            status=STATUS_DRAFT, entered_by_role=user.role_codes()[0] if user.role_codes() else None,
        )
        db.session.add(sub)
        db.session.flush()

    indicators_by_code = {i.indicator_code: i for i in principle.indicators}
    validation = validate_submission_values(
        principle, data["values"],
        history_avg_lookup=lambda code: _history_avg_lookup(project.id, code, period_id),
    )
    if data["submit"] and validation["errors"]:
        raise ApiError("Fix the flagged errors before submitting.", 422, details=validation["errors"], code="VALIDATION_FAILED")

    existing_values = {v.indicator_id: v for v in sub.values}
    for code, cell in data["values"].items():
        ind = indicators_by_code.get(code)
        if ind is None:
            continue
        val = existing_values.get(ind.id) or EsgValue(submission_id=sub.id, indicator_id=ind.id)
        raw = cell.get("v")
        if raw is None or raw == "":
            val.numeric_value = None
        else:
            try:
                val.numeric_value = float(raw)
            except (TypeError, ValueError):
                val.text_value = str(raw)
        db.session.add(val)

    was_correction = sub.status in (STATUS_CORRECTION_REQUIRED, STATUS_REJECTED)
    if data["submit"]:
        sub.status = STATUS_SUBMITTED
        sub.submitted_by_id = user.id
        sub.submitted_at = datetime.now(timezone.utc)
        sub.version = (sub.version or 1) + (1 if was_correction else 0)
        action = "RESUBMITTED" if was_correction else "SUBMITTED"
        record(action, "EsgSubmission", sub.submission_code, details=f"{project.name} · {principle.code}")
        notification_service.notify_business_unit(
            project.business_unit_id, "SUBMISSION",
            f"{project.name}: {principle.code} {'re-submitted' if was_correction else 'submitted'} for review.",
            link=f"/manager/approvals",
        )
    else:
        sub.status = sub.status if sub.status != STATUS_DRAFT else STATUS_DRAFT
        record("DRAFT_SAVED", "EsgSubmission", sub.submission_code, details=f"{project.name} · {principle.code}")

    db.session.commit()
    out = sub.to_dict(include_values=True)
    out["validation"] = validation
    return jsonify(out), 201 if is_new else 200
