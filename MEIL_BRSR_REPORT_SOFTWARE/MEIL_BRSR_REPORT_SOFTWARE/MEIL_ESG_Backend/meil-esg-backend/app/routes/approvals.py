from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.models.submission import (
    EsgSubmission, STATUS_SUBMITTED, STATUS_APPROVED, STATUS_REJECTED, STATUS_CORRECTION_REQUIRED, STATUS_LOCKED,
)
from app.models.review import ReviewAction, ACTION_APPROVE, ACTION_REJECT, ACTION_REQUEST_CORRECTION
from app.models.organization import Project
from app.schemas.submission import ReviewSubmissionSchema
from app.security.decorators import roles_required
from app.security.permissions import user_can_access_project
from app.services import notification_service
from app.utils.errors import ApiError
from app.utils.audit import record
from app.utils.pagination import paginate

bp = Blueprint("approvals", __name__, url_prefix="/approvals")

DECISION_MAP = {
    "APPROVE": (STATUS_APPROVED, ACTION_APPROVE, "APPROVED"),
    "REJECT": (STATUS_REJECTED, ACTION_REJECT, "REJECTED"),
    "REQUEST_CORRECTION": (STATUS_CORRECTION_REQUIRED, ACTION_REQUEST_CORRECTION, "CORRECTION REQUESTED"),
}


@bp.get("")
@roles_required("BU_MANAGER", "GROUP_ADMIN", "ESG_MANAGER")
def queue():
    """Pending-review queue, scoped to the manager's business unit(s) automatically."""
    from app.security.permissions import accessible_project_ids
    allowed = accessible_project_ids(g.current_user)
    q = EsgSubmission.query.filter_by(status=STATUS_SUBMITTED)
    if allowed is not None:
        q = q.filter(EsgSubmission.project_id.in_(allowed or ["__none__"]))
    items, meta = paginate(q.order_by(EsgSubmission.submitted_at.asc()))
    return jsonify({"items": [s.to_dict() for s in items], "meta": meta})


@bp.get("/<submission_id>")
@roles_required("BU_MANAGER", "GROUP_ADMIN", "ESG_MANAGER", "ASSESSOR")
def detail(submission_id):
    sub = EsgSubmission.query.get_or_404(submission_id)
    if not user_can_access_project(g.current_user, sub.project_id):
        raise ApiError("You do not have access to this submission.", 403)
    out = sub.to_dict(include_values=True)
    out["reviews"] = [r.to_dict() for r in ReviewAction.query.filter_by(submission_id=sub.id).all()]
    return jsonify(out)


@bp.post("/<submission_id>/approve")
@roles_required("BU_MANAGER", "GROUP_ADMIN", "ESG_MANAGER")
def approve(submission_id):
    return _decide(submission_id, "APPROVE")


@bp.post("/<submission_id>/correction")
@roles_required("BU_MANAGER", "GROUP_ADMIN", "ESG_MANAGER")
def request_correction(submission_id):
    return _decide(submission_id, "REQUEST_CORRECTION")


@bp.post("/<submission_id>/reject")
@roles_required("BU_MANAGER", "GROUP_ADMIN", "ESG_MANAGER")
def reject(submission_id):
    return _decide(submission_id, "REJECT")


def _decide(submission_id, decision):
    """Single transactional path for all three decisions (critique §22's pseudocode: update
    submission + insert review + insert audit log + notify, one commit, rollback together)."""
    sub = EsgSubmission.query.get_or_404(submission_id)
    user = g.current_user
    if not user_can_access_project(user, sub.project_id):
        raise ApiError("You do not have access to this submission.", 403)
    if sub.status != STATUS_SUBMITTED:
        raise ApiError(f"This packet is {sub.status.lower()}, not awaiting review.", 409)

    payload = {"decision": decision, **(request.get_json(silent=True) or {})}
    data = ReviewSubmissionSchema().load(payload)
    if decision != "APPROVE" and not data["comment"].strip():
        raise ApiError("A comment is required when requesting a correction or rejecting.", 422)

    new_status, action, label = DECISION_MAP[decision]
    sub.status = new_status
    sub.reviewed_by_id = user.id
    sub.reviewed_at = datetime.now(timezone.utc)
    sub.review_comment = data["comment"]
    if new_status == STATUS_APPROVED:
        sub.locked_at = datetime.now(timezone.utc)

    db.session.add(ReviewAction(submission_id=sub.id, reviewer_id=user.id, action=action,
                                 comment=data["comment"], checklist_json=data["checklist"]))
    project = Project.query.get(sub.project_id)
    record(label.replace(" ", "_"), "EsgSubmission", sub.submission_code,
           details=f"{project.name if project else ''} · {sub.principle.code}", old_value=None, new_value=None)

    notification_service.notify_project_watchers(
        sub.project_id, "APPROVAL" if new_status == STATUS_APPROVED else "CORRECTION",
        f"{sub.principle.code} for this period was {label.lower()}{': ' + data['comment'] if data['comment'] else '.'}",
        link="/operator/data-entry?principle=" + sub.principle.code,
    )
    if new_status == STATUS_APPROVED:
        notification_service.notify_group_role(
            "ASSESSMENT", f"{project.name if project else ''} {sub.principle.code} approved and ready for sampling.",
            link="/auditor", roles=("ASSESSOR",),
        )
    db.session.commit()
    return jsonify(sub.to_dict())
