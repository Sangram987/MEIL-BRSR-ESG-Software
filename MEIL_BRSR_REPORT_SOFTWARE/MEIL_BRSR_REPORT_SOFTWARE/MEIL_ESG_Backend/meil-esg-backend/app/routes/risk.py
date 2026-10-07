from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.models.risk import Risk
from app.models.base import CodeSequence
from app.schemas.vendor_risk_assessment import RiskSchema
from app.security.decorators import authenticated, roles_required
from app.services import risk_service
from app.utils.errors import ApiError
from app.utils.audit import record

bp = Blueprint("risk", __name__, url_prefix="/risks")


@bp.get("")
@authenticated
def list_risks():
    q = Risk.query
    status = request.args.get("status")
    if status:
        q = q.filter_by(status=status.upper())
    project_id = request.args.get("projectId")
    if project_id:
        q = q.filter_by(project_id=project_id)
    rows = q.order_by((Risk.probability * Risk.impact).desc()).all()
    return jsonify([r.to_dict() for r in rows])


@bp.post("")
@roles_required("GROUP_ADMIN", "ESG_MANAGER", "BU_MANAGER")
def create_risk():
    data = RiskSchema().load(request.get_json(force=True) or {})
    if data["includeInBrsr"] and not data["rationale"].strip():
        raise ApiError("Rationale is required to include this in the Section A24 disclosure.", 422)
    risk = Risk(
        risk_code=f"RSK-{CodeSequence.next('risk', start=0):02d}",
        organization_id=data["organizationId"], project_id=data["projectId"],
        risk_or_opportunity=data["type"], category=data["category"], title=data["title"],
        rationale=data["rationale"], probability=data["probability"], impact=data["impact"],
        financial_exposure=data["financialExposureCr"], financial_implication=data["financialImplication"],
        time_horizon=data["timeHorizon"], owner_label=data["owner"], mitigation=data["mitigation"],
        linked_indicator_id=data["linkedIndicatorId"], status=data["status"], include_in_brsr=data["includeInBrsr"],
    )
    risk.recompute_score()
    db.session.add(risk)
    record("RISK_CREATED", "Risk", risk.risk_code, details=risk.title)
    db.session.commit()
    return jsonify(risk.to_dict()), 201


@bp.patch("/<risk_id>")
@roles_required("GROUP_ADMIN", "ESG_MANAGER", "BU_MANAGER")
def update_risk(risk_id):
    risk = Risk.query.get_or_404(risk_id)
    data = RiskSchema().load(request.get_json(force=True) or {})
    if data["includeInBrsr"] and not data["rationale"].strip():
        raise ApiError("Rationale is required to include this in the Section A24 disclosure.", 422)
    old = risk.to_dict()
    risk.risk_or_opportunity = data["type"]; risk.category = data["category"]; risk.title = data["title"]
    risk.rationale = data["rationale"]; risk.probability = data["probability"]; risk.impact = data["impact"]
    risk.financial_exposure = data["financialExposureCr"]; risk.financial_implication = data["financialImplication"]
    risk.time_horizon = data["timeHorizon"]; risk.owner_label = data["owner"]; risk.mitigation = data["mitigation"]
    risk.linked_indicator_id = data["linkedIndicatorId"]; risk.status = data["status"]; risk.include_in_brsr = data["includeInBrsr"]
    risk.recompute_score()
    record("RISK_UPDATED", "Risk", risk.risk_code, old_value=old, new_value=risk.to_dict())
    db.session.commit()
    return jsonify(risk.to_dict())


@bp.post("/<risk_id>/reassess")
@roles_required("GROUP_ADMIN", "ESG_MANAGER", "BU_MANAGER")
def reassess_risk(risk_id):
    risk = Risk.query.get_or_404(risk_id)
    body = request.get_json(force=True) or {}
    probability, impact = body.get("probability"), body.get("impact")
    if probability not in (1, 2, 3) or impact not in (1, 2, 3):
        raise ApiError("probability and impact must each be 1, 2 or 3.", 422)
    risk_service.reassess(risk, probability, impact, reason=body.get("reason"), assessed_by_id=g.current_user.id)
    record("RISK_REASSESSED", "Risk", risk.risk_code, details=body.get("reason"))
    db.session.commit()
    return jsonify(risk.to_dict())


@bp.get("/material-issues")
@authenticated
def material_issues():
    """What the frontend's Section A, Q24 panel reads — only risks explicitly flagged
    include_in_brsr=True, keyed to their qualitative (not ₹) financial implication."""
    rows = Risk.query.filter_by(include_in_brsr=True).all()
    return jsonify([r.to_dict() for r in rows])
