"""
SEBI's rule (surfaced in the frontend's Opinions screen already): an internal auditor of the
listed entity or group cannot provide *assurance* (they can still do an internal *assessment*).
This function is the single place that rule is enforced — route handlers call it before saving,
so the rule can't be bypassed by a future endpoint that forgets to re-check the UI's logic.
"""
from app.utils.errors import ApiError

INTERNAL_AUDIT_PROVIDER_TYPES = {"INTERNAL_AUDIT", "Internal audit (assessment only — cannot provide assurance)"}


def validate_engagement_payload(payload: dict):
    mode = payload.get("mode")
    provider_type = payload.get("providerType", "")
    if mode == "ASSURANCE" and provider_type in INTERNAL_AUDIT_PROVIDER_TYPES:
        raise ApiError(
            "SEBI does not allow an internal auditor to provide assurance — "
            "switch mode to Assessment or change the provider type.",
            422, code="ASSURANCE_INDEPENDENCE_VIOLATION",
        )
    if not payload.get("independenceConfirmed"):
        raise ApiError(
            "Confirm the provider independence / no-conflict declaration before recording an opinion.",
            422, code="INDEPENDENCE_NOT_CONFIRMED",
        )
    if mode not in ("ASSESSMENT", "ASSURANCE"):
        raise ApiError("mode must be ASSESSMENT or ASSURANCE.", 422)
    return True
