from flask import Blueprint, request, jsonify
from app.models.organization import Project
from app.models.period import ReportingPeriod
from app.security.decorators import authenticated
from app.services import consolidation_service
from app.utils.errors import ApiError

bp = Blueprint("analytics", __name__, url_prefix="/analytics")


def _scope_args():
    scope_type = request.args.get("scopeType", "GROUP").upper()
    scope_id = request.args.get("scopeId")
    period_id = request.args.get("reportingPeriodId")
    boundary_mode = request.args.get("boundaryMode", "CONSOLIDATED").upper()
    include_jv = request.args.get("includeJv", "false").lower() == "true"
    if not period_id:
        raise ApiError("reportingPeriodId is required.", 422)
    return scope_type, scope_id, period_id, boundary_mode, include_jv


@bp.get("/summary")
@authenticated
def summary():
    scope_type, scope_id, period_id, boundary_mode, include_jv = _scope_args()
    node = consolidation_service.node_totals(scope_type, scope_id, period_id, boundary_mode, include_jv)
    cov = consolidation_service.coverage(scope_type, scope_id, period_id, boundary_mode, include_jv)
    k = node["kpi"]
    return jsonify({
        "projects": {"total": node["projects"], "reporting": node["reportingSites"]},
        "emissions": {"scope1": k["scope1"], "scope2": k["scope2"], "scope3": k["scope3"], "total": k["ghg"]},
        "water": {"withdrawal": k["waterWithdrawn"], "consumption": k["waterConsumed"]},
        "waste": {"generated": k["waste"], "recycledPct": k["wasteRecoveredPct"]},
        "workforce": {"headcount": k["headcount"], "femalePct": k["femalePct"]},
        "safety": {"ltifr": k["ltifr"], "fatalities": k["fatalities"]},
        "coverage": cov,
    })


@bp.get("/emissions")
@authenticated
def emissions():
    scope_type, scope_id, period_id, boundary_mode, include_jv = _scope_args()
    node = consolidation_service.node_totals(scope_type, scope_id, period_id, boundary_mode, include_jv)
    k = node["kpi"]
    return jsonify({"scope1": k["scope1"], "scope2": k["scope2"], "scope3": k["scope3"],
                     "total": k["ghg"], "intensity": k["ghgIntensity"]})


@bp.get("/energy")
@authenticated
def energy():
    scope_type, scope_id, period_id, boundary_mode, include_jv = _scope_args()
    node = consolidation_service.node_totals(scope_type, scope_id, period_id, boundary_mode, include_jv)
    k = node["kpi"]
    return jsonify({"totalGJ": k["energyGJ"], "renewablePct": k["renewablePct"], "intensity": k["energyIntensity"]})


@bp.get("/water")
@authenticated
def water():
    scope_type, scope_id, period_id, boundary_mode, include_jv = _scope_args()
    node = consolidation_service.node_totals(scope_type, scope_id, period_id, boundary_mode, include_jv)
    k = node["kpi"]
    return jsonify({"withdrawn": k["waterWithdrawn"], "consumed": k["waterConsumed"],
                     "discharged": k["waterDischarged"], "intensity": k["waterIntensity"]})


@bp.get("/waste")
@authenticated
def waste():
    scope_type, scope_id, period_id, boundary_mode, include_jv = _scope_args()
    node = consolidation_service.node_totals(scope_type, scope_id, period_id, boundary_mode, include_jv)
    k = node["kpi"]
    return jsonify({"generated": k["waste"], "recoveredPct": k["wasteRecoveredPct"], "intensity": k["wasteIntensity"]})


@bp.get("/safety")
@authenticated
def safety():
    scope_type, scope_id, period_id, boundary_mode, include_jv = _scope_args()
    node = consolidation_service.node_totals(scope_type, scope_id, period_id, boundary_mode, include_jv)
    k = node["kpi"]
    return jsonify({"ltifr": k["ltifr"], "fatalities": k["fatalities"], "injuries": k["injuries"],
                     "safetySpendPct": k["safetySpendPct"]})


@bp.get("/workforce")
@authenticated
def workforce():
    scope_type, scope_id, period_id, boundary_mode, include_jv = _scope_args()
    node = consolidation_service.node_totals(scope_type, scope_id, period_id, boundary_mode, include_jv)
    k = node["kpi"]
    return jsonify({"headcount": k["headcount"], "permanent": k["permanent"], "contract": k["contract"],
                     "femalePct": k["femalePct"], "femaleWagePct": k["femaleWagePct"]})


@bp.get("/compliance")
@authenticated
def compliance():
    scope_type, scope_id, period_id, boundary_mode, include_jv = _scope_args()
    node = consolidation_service.node_totals(scope_type, scope_id, period_id, boundary_mode, include_jv)
    k = node["kpi"]
    return jsonify({"complaints": k["complaints"], "csr": k["csr"], "msmePct": k["msmePct"]})


@bp.get("/map")
@authenticated
def map_points():
    scope_type, scope_id = request.args.get("scopeType", "GROUP").upper(), request.args.get("scopeId")
    q = Project.query
    if scope_type == "BUSINESS_UNIT" and scope_id:
        q = q.filter_by(business_unit_id=scope_id)
    projects = q.all()
    return jsonify([
        {"id": p.id, "name": p.name, "lat": p.latitude, "lng": p.longitude, "state": p.state, "isLive": p.is_live}
        for p in projects if p.latitude and p.longitude
    ])


@bp.get("/consolidation")
@authenticated
def consolidation():
    scope_type, scope_id, period_id, boundary_mode, include_jv = _scope_args()
    node = consolidation_service.node_totals(scope_type, scope_id, period_id, boundary_mode, include_jv)
    children = consolidation_service.rollup_children(scope_type, scope_id, period_id, boundary_mode, include_jv)
    return jsonify({"node": node, "children": children})
