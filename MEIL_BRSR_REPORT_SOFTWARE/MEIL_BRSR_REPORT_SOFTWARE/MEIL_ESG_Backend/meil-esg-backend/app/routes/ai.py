from flask import Blueprint, request, jsonify, g
from app.security.decorators import authenticated
from app.services import ai_service, consolidation_service
from app.utils.errors import ApiError

bp = Blueprint("ai", __name__, url_prefix="/ai")


@bp.post("/chat")
@authenticated
def chat():
    body = request.get_json(force=True) or {}
    message = body.get("message", "")
    if not message.strip():
        raise ApiError("message is required.", 422)
    provider = ai_service.get_provider()
    answer = provider.chat(message, context=body.get("context"))
    return jsonify({"answer": answer})


@bp.post("/forecast")
@authenticated
def forecast():
    body = request.get_json(force=True) or {}
    scope_type = body.get("scopeType", "GROUP")
    scope_id = body.get("scopeId")
    period_ids = body.get("reportingPeriodIds", [])
    if len(period_ids) < 4:
        raise ApiError("Provide at least 4 historical reportingPeriodIds to forecast from.", 422)
    series = []
    for pid in period_ids:
        node = consolidation_service.node_totals(scope_type, scope_id, pid)
        series.append(node["kpi"]["ghg"])
    fc = ai_service.linear_forecast(series, ahead=body.get("ahead", 3))
    narrative = ai_service.get_provider().forecast_narrative(series, fc)
    return jsonify({"history": series, "forecast": fc, "narrative": narrative})


@bp.post("/analyze")
@authenticated
def analyze():
    """Rule-based anomaly scan across submitted-but-not-yet-approved packets in the caller's
    scope — the same "spike/drop vs 6-period average" check used at submit time, surfaced here
    as a standing list the BU Manager/Group Admin can review (critique §31's "rule-based risk
    detection" pattern applied to day-to-day analytics, not just the risk register)."""
    from app.models.submission import EsgSubmission, STATUS_SUBMITTED
    from app.security.permissions import accessible_project_ids
    from app.routes.submissions import _history_avg_lookup
    from app.services.validation_service import validate_submission_values

    allowed = accessible_project_ids(g.current_user)
    q = EsgSubmission.query.filter_by(status=STATUS_SUBMITTED)
    if allowed is not None:
        q = q.filter(EsgSubmission.project_id.in_(allowed or ["__none__"]))
    findings = []
    for sub in q.limit(200).all():
        values = {v.indicator.indicator_code: {"v": v.numeric_value, "ev": None} for v in sub.values}
        result = validate_submission_values(
            sub.principle, values,
            history_avg_lookup=lambda code: _history_avg_lookup(sub.project_id, code, sub.reporting_period_id),
        )
        for w in result["warnings"]:
            if w["kind"] in ("spike", "drop"):
                findings.append({"submissionId": sub.id, "projectId": sub.project_id,
                                  "principle": sub.principle.code, **w})
    return jsonify({"findings": findings})


@bp.post("/document-extract")
@authenticated
def document_extract():
    """Documented extension point (critique §45/§39): wire a real OCR/invoice-parsing model
    here, write the extracted value onto MetricEvidence (via validation_service.compare_evidence),
    and move its verification_status from PENDING to VERIFIED/DISCREPANCY automatically. Returns
    501 until that pipeline exists — it must not silently pretend to have verified anything."""
    raise ApiError("Document extraction is not wired to an OCR provider in this deployment yet.", 501)
