"""
Two layers, matching the frontend's validate.js behaviour exactly but data-driven now:

  1. Per-indicator rules (BrsrValidationRule rows: NON_NEGATIVE, REQUIRED, SPIKE_CHECK, EVIDENCE_REQUIRED)
  2. Cross-field logic rules for a principle (COMPARE: e.g. groundwater + third-party <= total withdrawn)

Both return the same shape the frontend expects: {"errors": [...], "warnings": [...]}, each item
{"indicatorCode": ..., "message": ..., "kind": ...}, so this can be rendered by the same kind of
UI the React app already has once it talks to this API instead of localStorage.
"""
from app.models.brsr import BrsrValidationRule


def _num(values, code):
    v = values.get(code)
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def validate_submission_values(principle, values: dict, history_avg_lookup=None):
    """
    principle: BrsrPrinciple (with .indicators loaded)
    values: {indicator_code: {"v": <value>, "ev": <evidence filename/doc id or ''>}}
    history_avg_lookup: optional fn(indicator_code) -> (avg, n) for spike/drop warnings
    """
    errors, warnings = [], []

    for ind in principle.indicators:
        code = ind.indicator_code
        cell = values.get(code) or {}
        v = _num({code: cell.get("v")}, code)

        if v is not None and v < 0:
            errors.append({"indicatorCode": code, "message": "Must be a non-negative number.", "kind": "range"})
        if ind.tier == "ESSENTIAL" and ind.required and v is None:
            errors.append({"indicatorCode": code, "message": "Required — enter 0 if nothing to report.", "kind": "required"})
        if v is not None and v > 0 and ind.evidence_required and not cell.get("ev"):
            warnings.append({"indicatorCode": code, "message": "Evidence not attached — BRSR Core data must be supported.", "kind": "evidence"})

        if v is not None and ind.data_type == "DECIMAL" and history_avg_lookup:
            avg, n = history_avg_lookup(code)
            if avg and n and n >= 3 and avg > 0:
                delta_pct = ((v - avg) / avg) * 100
                if delta_pct > 40:
                    warnings.append({"indicatorCode": code, "message": f"+{delta_pct:.0f}% vs 6-month average — please confirm.", "kind": "spike"})
                elif delta_pct < -60:
                    warnings.append({"indicatorCode": code, "message": f"{delta_pct:.0f}% vs 6-month average — please confirm.", "kind": "drop"})

        # declarative rules seeded in brsr_validation_rules
        for rule in ind.validation_rules:
            _apply_rule(rule, code, v, values, errors, warnings)

    _apply_principle_logic(principle.code, values, errors, warnings)
    return {"errors": errors, "warnings": warnings}


def _apply_rule(rule, code, v, values, errors, warnings):
    bucket = errors if rule.severity == "ERROR" else warnings
    params = rule.params_json or {}
    if rule.rule_type == "COMPARE" and v is not None:
        other = _num(values, params.get("compareTo"))
        if other is None:
            return
        op = params.get("op", "<=")
        ok = {"<=": v <= other * 1.001, "<": v < other, ">=": v >= other, ">": v > other}.get(op, True)
        if not ok:
            bucket.append({"indicatorCode": code, "message": rule.message or f"{code} fails comparison {op} {params.get('compareTo')}.", "kind": "logic"})


def _apply_principle_logic(principle_code, values, errors, warnings):
    """A handful of cross-field checks that genuinely need two+ values at once — kept here (not
    in the declarative rule table) because they reference multiple indicators by name and are
    principle-specific, mirroring validate.js's `if (principle === 'P6') {...}` blocks 1:1."""
    def V(code):
        return _num(values, code) or 0

    if principle_code == "P6":
        if V("p6_ground") + V("p6_third") > V("p6_water") * 1.001:
            errors.append({"indicatorCode": "p6_water", "message": "Groundwater + third-party cannot exceed total withdrawn.", "kind": "logic"})
        if V("p6_recyc") + V("p6_disp") > (V("p6_haz") + V("p6_nonhaz")) * 1.05:
            errors.append({"indicatorCode": "p6_recyc", "message": "Recycled + disposed waste exceeds waste generated.", "kind": "logic"})
        if V("p6_disch") > V("p6_water") * 1.001:
            errors.append({"indicatorCode": "p6_disch", "message": "Discharge cannot exceed water withdrawn.", "kind": "logic"})
    elif principle_code == "P3":
        if V("p3_wagesf") > V("p3_wages"):
            errors.append({"indicatorCode": "p3_wagesf", "message": "Female wages cannot exceed total wages.", "kind": "logic"})
        if V("p3_lti") > V("p3_rec"):
            errors.append({"indicatorCode": "p3_lti", "message": "LTIs cannot exceed recordable injuries.", "kind": "logic"})
        if V("p3_fat") > 0:
            warnings.append({"indicatorCode": "p3_fat", "message": "Fatality reported — escalate to Group HSE immediately.", "kind": "critical"})
    elif principle_code == "P2":
        if V("p2_recycled") > V("p2_input"):
            errors.append({"indicatorCode": "p2_recycled", "message": "Recycled material exceeds total input material.", "kind": "logic"})
    elif principle_code == "P8":
        if V("p8_msme") > V("p8_proc"):
            errors.append({"indicatorCode": "p8_msme", "message": "MSME procurement exceeds total procurement.", "kind": "logic"})
        if V("p8_local") > V("p8_proc"):
            errors.append({"indicatorCode": "p8_local", "message": "Local procurement exceeds total procurement.", "kind": "logic"})


def compare_evidence(reported_value: float, extracted_value: float, tolerance_pct: float = 0.5):
    """Documented extension point (critique §45): once a document-extraction AI task populates
    an extracted value for an evidence file, call this to flag VERIFIED vs DISCREPANCY instead of
    leaving every evidence row at PENDING forever. Not wired to a real OCR pipeline yet —
    services/ai_service.py::extract_evidence_data() is the hook where that would plug in."""
    if extracted_value is None:
        return "PENDING"
    if reported_value == 0 and extracted_value == 0:
        return "VERIFIED"
    diff_pct = abs(reported_value - extracted_value) / max(abs(reported_value), 1e-9) * 100
    return "VERIFIED" if diff_pct <= tolerance_pct else "DISCREPANCY"
