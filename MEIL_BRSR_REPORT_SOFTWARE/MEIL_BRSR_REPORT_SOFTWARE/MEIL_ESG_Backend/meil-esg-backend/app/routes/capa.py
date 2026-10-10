"""
VERIGRAPH CAPA (Corrective and Preventive Action) Management Blueprint.
Provides lifecycle endpoints:
  - GET    /capa : List CAPA records (filter by status, severity, project, with scope authorization)
  - POST   /capa : Create manual or automated CAPA record
  - GET    /capa/<id> : View CAPA details
  - PATCH  /capa/<id> : Update corrective actions, preventive actions, status, closure
"""
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.models.forensics import CapaRecord
from app.models.organization import Project
from app.security.decorators import authenticated
from app.security.permissions import user_can_access_project
from app.utils.errors import ApiError
from app.utils.audit import record

bp = Blueprint("capa", __name__, url_prefix="/capa")


@bp.get("")
@authenticated
def list_capa():
    user = g.current_user
    project_id = request.args.get("projectId")
    status = request.args.get("status")
    severity = request.args.get("severity")

    q = CapaRecord.query

    if project_id:
        if not user_can_access_project(user, project_id):
            raise ApiError("You do not have access to this project.", 403)
        q = q.filter_by(project_id=project_id)
    elif getattr(user, "project_id", None):
        # Site Engineer restricted to their assigned site
        q = q.filter_by(project_id=user.project_id)

    if status:
        q = q.filter_by(status=status.upper())
    if severity:
        q = q.filter_by(severity=severity.upper())

    items = q.order_by(CapaRecord.created_at.desc()).all()
    return jsonify([item.to_dict() for item in items])


@bp.post("")
@authenticated
def create_capa():
    user = g.current_user
    body = request.get_json(force=True) or {}

    finding = body.get("finding")
    if not finding:
        raise ApiError("Finding is required.", 422)

    project_id = body.get("projectId") or getattr(user, "project_id", None)
    if not project_id:
        raise ApiError("projectId is required.", 422)

    if not user_can_access_project(user, project_id):
        raise ApiError("You do not have access to this project.", 403)

    capa_code = f"CAPA-{datetime.now().year}-{int(datetime.now().timestamp()) % 10000:04d}"

    capa = CapaRecord(
        capa_code=capa_code,
        project_id=project_id,
        document_id=body.get("documentId"),
        submission_id=body.get("submissionId"),
        finding=finding,
        severity=body.get("severity", "MEDIUM").upper(),
        owner=body.get("owner", getattr(user, "full_name", None) or getattr(user, "name", "Site In-charge")),
        corrective_action=body.get("correctiveAction"),
        preventive_action=body.get("preventiveAction"),
        due_date=datetime.strptime(body["dueDate"], "%Y-%m-%d").date() if body.get("dueDate") else None,
        status="OPEN",
        comments=body.get("comments"),
    )
    db.session.add(capa)
    db.session.flush()

    record("CREATE_CAPA", "CapaRecord", capa.id, details=f"Created CAPA {capa.capa_code}", user=user)
    db.session.commit()
    return jsonify(capa.to_dict()), 201


@bp.get("/<capa_id>")
@authenticated
def get_capa(capa_id):
    user = g.current_user
    capa = CapaRecord.query.get_or_404(capa_id)
    if not user_can_access_project(user, capa.project_id):
        raise ApiError("You do not have access to this project.", 403)
    return jsonify(capa.to_dict())


@bp.patch("/<capa_id>")
@authenticated
def update_capa(capa_id):
    user = g.current_user
    capa = CapaRecord.query.get_or_404(capa_id)
    if not user_can_access_project(user, capa.project_id):
        raise ApiError("You do not have access to this project.", 403)

    body = request.get_json(force=True) or {}

    if "status" in body:
        new_status = body["status"].upper()
        capa.status = new_status
        if new_status in ("RESOLVED", "CLOSED"):
            capa.closure_date = datetime.now(timezone.utc)
            capa.closed_by_id = user.id

    if "correctiveAction" in body:
        capa.corrective_action = body["correctiveAction"]
    if "preventiveAction" in body:
        capa.preventive_action = body["preventiveAction"]
    if "comments" in body:
        capa.comments = body["comments"]
    if "owner" in body:
        capa.owner = body["owner"]

    record("UPDATE_CAPA", "CapaRecord", capa.id, details=f"Updated CAPA {capa.capa_code} status to {capa.status}", user=user)
    db.session.commit()
    return jsonify(capa.to_dict())
