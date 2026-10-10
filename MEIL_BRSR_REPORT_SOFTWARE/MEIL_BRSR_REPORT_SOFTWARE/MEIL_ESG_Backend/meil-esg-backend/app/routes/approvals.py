from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.models.submission import (
    EsgSubmission, STATUS_SUBMITTED, STATUS_BU_VERIFIED, STATUS_SUBSIDIARY_VERIFIED,
    STATUS_APPROVED, STATUS_REJECTED, STATUS_CORRECTION_REQUIRED, STATUS_LOCKED,
)
from app.models.review import (
    ReviewAction, ACTION_BU_VERIFY, ACTION_SUBSIDIARY_VERIFY, ACTION_ADMIN_APPROVE,
    ACTION_APPROVE, ACTION_REJECT, ACTION_REQUEST_CORRECTION,
)
from app.models.organization import Project
from app.schemas.submission import ReviewSubmissionSchema
from app.security.decorators import roles_required
from app.security.permissions import user_can_access_project
from app.services import notification_service
from app.utils.errors import ApiError
from app.utils.audit import record
from app.utils.pagination import paginate

bp = Blueprint("approvals", __name__, url_prefix="/approvals")

APPROVAL_ROLES = ("BU_MANAGER", "SUBSIDIARY_HEAD", "GROUP_ADMIN", "ESG_MANAGER")


@bp.get("")
@roles_required(*APPROVAL_ROLES)
def queue():
    """Hierarchy-aware review queue:
    - BU Managers see submissions in STATUS_SUBMITTED (awaiting BU verification) for their scope.
    - Subsidiaries see submissions in STATUS_BU_VERIFIED (awaiting Subsidiary verification).
    - Admins see submissions in STATUS_SUBSIDIARY_VERIFIED (awaiting Admin final approval).
    - Can filter by ?status=SUBMITTED or ?status=BU_VERIFIED or ?status=SUBSIDIARY_VERIFIED or ?status=all.
    """
    from app.security.permissions import accessible_project_ids
    allowed = accessible_project_ids(g.current_user)
    status_param = request.args.get("status")

    q = EsgSubmission.query
    if allowed is not None:
        q = q.filter(EsgSubmission.project_id.in_(allowed or ["__none__"]))

    if status_param and status_param.lower() != "all":
        q = q.filter_by(status=status_param.upper())
    elif not status_param:
        is_admin = g.current_user.has_role("GROUP_ADMIN", "ESG_MANAGER")
        is_sub_head = g.current_user.has_role("SUBSIDIARY_HEAD")
        is_bu_mgr = g.current_user.has_role("BU_MANAGER")
        if is_admin and not is_sub_head and not is_bu_mgr:
            q = q.filter_by(status=STATUS_SUBSIDIARY_VERIFIED)
        elif is_sub_head and not is_admin:
            q = q.filter_by(status=STATUS_BU_VERIFIED)
        elif is_bu_mgr and not is_admin:
            q = q.filter_by(status=STATUS_SUBMITTED)
        else:
            q = q.filter(EsgSubmission.status.in_((STATUS_SUBMITTED, STATUS_BU_VERIFIED, STATUS_SUBSIDIARY_VERIFIED)))

    items, meta = paginate(q.order_by(EsgSubmission.submitted_at.asc()))
    return jsonify({"items": [s.to_dict() for s in items], "meta": meta})


@bp.get("/pending/count")
@roles_required(*APPROVAL_ROLES)
def pending_count():
    from app.security.permissions import accessible_project_ids
    allowed = accessible_project_ids(g.current_user)
    status_param = request.args.get("status")

    q = EsgSubmission.query
    if allowed is not None:
        q = q.filter(EsgSubmission.project_id.in_(allowed or ["__none__"]))

    if status_param and status_param.lower() != "all":
        q = q.filter_by(status=status_param.upper())
    else:
        is_admin = g.current_user.has_role("GROUP_ADMIN", "ESG_MANAGER")
        is_sub_head = g.current_user.has_role("SUBSIDIARY_HEAD")
        is_bu_mgr = g.current_user.has_role("BU_MANAGER")
        if is_admin and not is_sub_head and not is_bu_mgr:
            q = q.filter_by(status=STATUS_SUBSIDIARY_VERIFIED)
        elif is_sub_head and not is_admin:
            q = q.filter_by(status=STATUS_BU_VERIFIED)
        elif is_bu_mgr and not is_admin:
            q = q.filter_by(status=STATUS_SUBMITTED)
        else:
            q = q.filter(EsgSubmission.status.in_((STATUS_SUBMITTED, STATUS_BU_VERIFIED, STATUS_SUBSIDIARY_VERIFIED)))

    return jsonify({"count": q.count()})


@bp.get("/<submission_id>")
@roles_required(*APPROVAL_ROLES, "ASSESSOR")
def detail(submission_id):
    sub = EsgSubmission.query.get_or_404(submission_id)
    if not user_can_access_project(g.current_user, sub.project_id):
        raise ApiError("You do not have access to this submission.", 403)
    out = sub.to_dict(include_values=True)
    out["reviews"] = [r.to_dict() for r in ReviewAction.query.filter_by(submission_id=sub.id).all()]
    return jsonify(out)


@bp.post("/<submission_id>/verify")
@roles_required(*APPROVAL_ROLES)
def verify(submission_id):
    """Hierarchical verification step:
    - If SUBMITTED: BU Manager verifies -> BU_VERIFIED (forwarded to Subsidiary).
    - If BU_VERIFIED: Subsidiary verifies -> SUBSIDIARY_VERIFIED (forwarded to Admin).
    """
    return _decide(submission_id, "VERIFY")


@bp.post("/<submission_id>/verify-subsidiary")
@roles_required("SUBSIDIARY_HEAD", "GROUP_ADMIN", "ESG_MANAGER")
def verify_subsidiary(submission_id):
    """Subsidiary verification step: marks BU_VERIFIED -> SUBSIDIARY_VERIFIED."""
    return _decide(submission_id, "SUBSIDIARY_VERIFY")


@bp.post("/<submission_id>/approve")
@roles_required(*APPROVAL_ROLES)
def approve(submission_id):
    """Final Admin approval on SUBSIDIARY_VERIFIED packets -> APPROVED & locked.
    Enforces strict hierarchy: Site Operator -> BU Manager -> Subsidiary -> Admin.
    """
    return _decide(submission_id, "APPROVE")


@bp.post("/<submission_id>/correction")
@roles_required(*APPROVAL_ROLES)
def request_correction(submission_id):
    return _decide(submission_id, "REQUEST_CORRECTION")


@bp.post("/<submission_id>/reject")
@roles_required(*APPROVAL_ROLES)
def reject(submission_id):
    return _decide(submission_id, "REJECT")


def _decide(submission_id, decision):
    sub = EsgSubmission.query.get_or_404(submission_id)
    user = g.current_user
    if not user_can_access_project(user, sub.project_id):
        raise ApiError("You do not have access to this submission.", 403)

    payload = {"decision": decision, **(request.get_json(silent=True) or {})}
    data = ReviewSubmissionSchema().load(payload)
    comment = data.get("comment", "").strip()

    is_admin = user.has_role("GROUP_ADMIN", "ESG_MANAGER")
    is_sub_head = user.has_role("SUBSIDIARY_HEAD")
    is_bu_mgr = user.has_role("BU_MANAGER")

    if decision in ("CORRECTION", "REQUEST_CORRECTION"):
        if not comment:
            raise ApiError("A comment is required when requesting a correction.", 422)
        if sub.status not in (STATUS_SUBMITTED, STATUS_BU_VERIFIED, STATUS_SUBSIDIARY_VERIFIED):
            raise ApiError(f"This packet is {sub.status.lower()} and cannot have correction requested.", 409)

        sub.status = STATUS_CORRECTION_REQUIRED
        sub.reviewed_by_id = user.id
        sub.reviewed_at = datetime.now(timezone.utc)
        sub.review_comment = comment

        db.session.add(ReviewAction(
            submission_id=sub.id, reviewer_id=user.id, action=ACTION_REQUEST_CORRECTION,
            comment=comment, checklist_json=data.get("checklist") or {},
        ))
        project = Project.query.get(sub.project_id)
        record("CORRECTION_REQUESTED", "EsgSubmission", sub.submission_code,
               details=f"{project.name if project else ''} · {sub.principle.code}")

        notification_service.notify_project_watchers(
            sub.project_id, "CORRECTION",
            f"{sub.principle.code} for this period had correction requested: {comment}",
            link="/operator/data-entry?principle=" + sub.principle.code,
        )
        if (is_admin or is_sub_head) and project:
            notification_service.notify_business_unit(
                project.business_unit_id, "CORRECTION",
                f"{project.name}: {sub.principle.code} correction requested by upper governance: {comment}",
                link="/review",
            )
        db.session.commit()
        return jsonify(sub.to_dict())

    elif decision == "REJECT":
        if not comment:
            raise ApiError("A comment is required when rejecting.", 422)
        if sub.status not in (STATUS_SUBMITTED, STATUS_BU_VERIFIED, STATUS_SUBSIDIARY_VERIFIED):
            raise ApiError(f"This packet is {sub.status.lower()} and cannot be rejected.", 409)

        sub.status = STATUS_REJECTED
        sub.reviewed_by_id = user.id
        sub.reviewed_at = datetime.now(timezone.utc)
        sub.review_comment = comment

        db.session.add(ReviewAction(
            submission_id=sub.id, reviewer_id=user.id, action=ACTION_REJECT,
            comment=comment, checklist_json=data.get("checklist") or {},
        ))
        project = Project.query.get(sub.project_id)
        record("REJECTED", "EsgSubmission", sub.submission_code,
               details=f"{project.name if project else ''} · {sub.principle.code}")

        notification_service.notify_project_watchers(
            sub.project_id, "REJECTION",
            f"{sub.principle.code} for this period was rejected: {comment}",
            link="/operator/data-entry?principle=" + sub.principle.code,
        )
        if (is_admin or is_sub_head) and project:
            notification_service.notify_business_unit(
                project.business_unit_id, "REJECTION",
                f"{project.name}: {sub.principle.code} was rejected: {comment}",
                link="/review",
            )
        db.session.commit()
        return jsonify(sub.to_dict())

    elif decision in ("VERIFY", "BU_VERIFY", "SUB_VERIFY", "SUBSIDIARY_VERIFY", "APPROVE"):
        # Complete 4-tier hierarchy: Site Operator -> BU Manager -> Subsidiary -> Group Admin
        if sub.status == STATUS_SUBMITTED:
            # Stage 1 -> Stage 2: BU Manager verification
            if (is_admin or is_sub_head) and not is_bu_mgr and decision not in ("VERIFY", "BU_VERIFY"):
                raise ApiError(
                    "Hierarchy violation: This submission has not yet been verified by the BU Manager. "
                    "Data must flow from Site Operator -> BU Manager -> Subsidiary -> Admin. Direct approval is blocked.",
                    400
                )

            sub.status = STATUS_BU_VERIFIED
            sub.reviewed_by_id = user.id
            sub.reviewed_at = datetime.now(timezone.utc)
            sub.review_comment = comment or "Verified by BU Manager."

            db.session.add(ReviewAction(
                submission_id=sub.id, reviewer_id=user.id, action=ACTION_BU_VERIFY,
                comment=comment or "Verified by BU Manager. Forwarded to Subsidiary for review.",
                checklist_json=data.get("checklist") or {},
            ))
            project = Project.query.get(sub.project_id)
            record("BU_VERIFIED", "EsgSubmission", sub.submission_code,
                   details=f"{project.name if project else ''} · {sub.principle.code}")

            # Notify Subsidiary & Admin that BU Manager has verified and it's ready for Subsidiary review
            notification_service.notify_group_role(
                "BU_VERIFIED",
                f"{project.name if project else ''}: {sub.principle.code} verified by BU Manager, awaiting Subsidiary verification.",
                link="/subsidiary",
                roles=("SUBSIDIARY_HEAD", "GROUP_ADMIN", "ESG_MANAGER"),
            )
            # Notify Site Operator
            notification_service.notify_project_watchers(
                sub.project_id, "BU_VERIFIED",
                f"{sub.principle.code} verified by BU Manager and forwarded to Subsidiary.",
                link="/operator/data-entry?principle=" + sub.principle.code,
            )
            db.session.commit()
            return jsonify(sub.to_dict())

        elif sub.status == STATUS_BU_VERIFIED:
            # Stage 2 -> Stage 3: Subsidiary verification
            if decision == "APPROVE":
                raise ApiError(
                    "Hierarchy violation: This submission has been verified by the BU Manager, "
                    "but has not yet been reviewed and verified by the Subsidiary. "
                    "Data must flow: BU Manager -> Subsidiary -> Admin. Direct Admin approval is blocked.",
                    400
                )

            sub.status = STATUS_SUBSIDIARY_VERIFIED
            sub.reviewed_by_id = user.id
            sub.reviewed_at = datetime.now(timezone.utc)
            sub.review_comment = comment or "Verified by Subsidiary Officer."

            db.session.add(ReviewAction(
                submission_id=sub.id, reviewer_id=user.id, action=ACTION_SUBSIDIARY_VERIFY,
                comment=comment or "Verified by Subsidiary Officer. Forwarded to Group Admin for final sign-off.",
                checklist_json=data.get("checklist") or {},
            ))
            project = Project.query.get(sub.project_id)
            record("SUBSIDIARY_VERIFIED", "EsgSubmission", sub.submission_code,
                   details=f"{project.name if project else ''} · {sub.principle.code}")

            # Notify Group Admin that Subsidiary has verified and it is ready for final Admin sign-off
            notification_service.notify_group_role(
                "SUBSIDIARY_VERIFIED",
                f"{project.name if project else ''}: {sub.principle.code} verified by Subsidiary, awaiting final Admin approval.",
                link="/admin/approvals",
                roles=("GROUP_ADMIN", "ESG_MANAGER"),
            )
            # Notify BU and Site Operator
            if project:
                notification_service.notify_business_unit(
                    project.business_unit_id, "SUBSIDIARY_VERIFIED",
                    f"{project.name}: {sub.principle.code} verified by Subsidiary and forwarded to Admin.",
                    link="/review",
                )
            notification_service.notify_project_watchers(
                sub.project_id, "SUBSIDIARY_VERIFIED",
                f"{sub.principle.code} verified by Subsidiary and forwarded to Admin.",
                link="/operator/data-entry?principle=" + sub.principle.code,
            )
            db.session.commit()
            return jsonify(sub.to_dict())

        elif sub.status == STATUS_SUBSIDIARY_VERIFIED:
            # Stage 3 -> Stage 4: Admin Final Approval & Locking
            if not is_admin:
                raise ApiError(
                    "Hierarchy permission: This submission was verified by the Subsidiary. "
                    "Final approval must be granted by the Group Admin / ESG Manager.",
                    403
                )

            sub.status = STATUS_APPROVED
            sub.locked_at = datetime.now(timezone.utc)
            sub.reviewed_by_id = user.id
            sub.reviewed_at = datetime.now(timezone.utc)
            sub.review_comment = comment or "Final approved by Group Admin."

            db.session.add(ReviewAction(
                submission_id=sub.id, reviewer_id=user.id, action=ACTION_ADMIN_APPROVE,
                comment=comment or "Final approved and locked by Group Admin.",
                checklist_json=data.get("checklist") or {},
            ))
            project = Project.query.get(sub.project_id)
            record("APPROVED", "EsgSubmission", sub.submission_code,
                   details=f"{project.name if project else ''} · {sub.principle.code}")

            notification_service.notify_project_watchers(
                sub.project_id, "APPROVAL",
                f"{sub.principle.code} has received final Admin approval and is locked.",
                link="/operator/data-entry?principle=" + sub.principle.code,
            )
            if project:
                notification_service.notify_business_unit(
                    project.business_unit_id, "APPROVAL",
                    f"{project.name}: {sub.principle.code} received final Admin approval and is locked.",
                    link="/review",
                )
            notification_service.notify_group_role(
                "ASSESSMENT",
                f"{project.name if project else ''} {sub.principle.code} approved and ready for sampling.",
                link="/auditor",
                roles=("ASSESSOR",),
            )
            db.session.commit()
            return jsonify(sub.to_dict())

        else:
            raise ApiError(f"This packet is {sub.status.lower()}, not awaiting verification or approval.", 409)

    else:
        raise ApiError(f"Unknown decision: {decision}", 400)
