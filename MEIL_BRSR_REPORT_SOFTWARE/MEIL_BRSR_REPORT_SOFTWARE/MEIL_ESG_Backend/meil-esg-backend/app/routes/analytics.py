from flask import Blueprint, request, jsonify
from app.models.organization import Project
from app.models.period import ReportingPeriod
from app.models.submission import EsgSubmission, EsgValue
from app.models.brsr import BrsrIndicator
from app.security.decorators import authenticated
from app.services import consolidation_service
from app.utils.errors import ApiError

bp = Blueprint("analytics", __name__, url_prefix="/analytics")


def _scope_args():
    scope_type = request.args.get("scopeType", "GROUP").upper()
    scope_id = request.args.get("scopeId") or request.args.get("organizationId")
    period_id = request.args.get("reportingPeriodId")
    boundary_mode = request.args.get("boundaryMode", "CONSOLIDATED").upper()
    include_jv = request.args.get("includeJv", "false").lower() == "true"
    if not period_id:
        fy = request.args.get("financialYear")
        if fy:
            p = ReportingPeriod.query.filter_by(financial_year=fy, period_type="FINANCIAL_YEAR").first()
            if not p:
                p = ReportingPeriod.query.filter(ReportingPeriod.financial_year.like(f"%{fy}%")).first()
            if p:
                period_id = p.id
        if not period_id:
            p = ReportingPeriod.query.filter_by(period_type="FINANCIAL_YEAR").order_by(ReportingPeriod.start_date.desc()).first()
            if p:
                period_id = p.id
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


# =========================================================================
# MISSING ENDPOINTS REQUIRED BY FRONTEND:
#   1. GET /analytics/coverage
#   2. GET /analytics/financial-year
#   3. GET /analytics/kpi-rollup
#   4. GET /analytics/trends
# =========================================================================

@bp.get("/coverage")
@authenticated
def get_coverage():
    """Returns submission coverage statistics for a reporting period."""
    scope_type, scope_id, period_id, boundary_mode, include_jv = _scope_args()
    cov = consolidation_service.coverage(scope_type, scope_id, period_id, boundary_mode, include_jv)
    counts = cov.get("counts", {})
    approved = counts.get("APPROVED", 0) + counts.get("LOCKED", 0)
    return jsonify({
        "coverage": cov.get("approvedPct", 0),
        "total": cov.get("expected", 0),
        "submitted": approved,
        "counts": counts,
        "projects": cov.get("projects", 0),
    })


@bp.get("/financial-year")
@authenticated
def get_financial_year():
    """Aggregates ESG summary for a requested financial year."""
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
        "turnoverCr": node.get("turnoverCr", 0),
        "totals": node.get("totals", {}),
    })


@bp.get("/kpi-rollup")
@authenticated
def get_kpi_rollup():
    """Rolls up a specific KPI or metric across business units and subsidiaries."""
    kpi_code = request.args.get("kpiCode", "energyGJ")
    scope_type, scope_id, period_id, boundary_mode, include_jv = _scope_args()
    node = consolidation_service.node_totals(scope_type, scope_id, period_id, boundary_mode, include_jv)
    children = consolidation_service.rollup_children(scope_type, scope_id, period_id, boundary_mode, include_jv)

    kpi_val = node["kpi"].get(kpi_code) or node["totals"].get(kpi_code, 0)
    children_breakdown = [
        {
            "id": c.get("id"),
            "name": c.get("name"),
            "level": c.get("level"),
            "value": c.get("kpi", {}).get(kpi_code) or c.get("totals", {}).get(kpi_code, 0),
        }
        for c in children
    ]

    return jsonify({
        "kpiCode": kpi_code,
        "value": kpi_val,
        "projects": node.get("projects", 0),
        "reportingSites": node.get("reportingSites", 0),
        "breakdown": children_breakdown,
    })


@bp.get("/trends")
@authenticated
def get_trends():
    """Returns historical multi-period trend data for a specified indicator code."""
    indicator_code = request.args.get("indicatorCode", "p6_diesel")
    scope_type = request.args.get("scopeType", "GROUP").upper()
    scope_id = request.args.get("scopeId")

    # Fetch last 6 reporting periods
    periods = ReportingPeriod.query.order_by(ReportingPeriod.start_date.asc()).limit(6).all()
    trends = []

    for p in periods:
        try:
            node = consolidation_service.node_totals(scope_type, scope_id, p.id)
            val = node["totals"].get(indicator_code) or node["kpi"].get(indicator_code, 0)
            trends.append({
                "period": p.name or p.financial_year,
                "periodId": p.id,
                "value": round(float(val), 2) if isinstance(val, (int, float)) else 0.0,
                "reportingSites": node.get("reportingSites", 0),
            })
        except Exception:
            trends.append({
                "period": p.name or p.financial_year,
                "periodId": p.id,
                "value": 0.0,
                "reportingSites": 0,
            })

    return jsonify({
        "indicatorCode": indicator_code,
        "trends": trends,
    })
