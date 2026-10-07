"""
Deterministic, auditable rules first (the company's review's own recommended starting point —
"start with deterministic rules" before any ML). Each rule either creates a new Risk candidate
(status=OPEN, a human still has to review/triage it — detection never auto-publishes to BRSR) or
is a no-op if a similar open risk already exists for that project.
"""
from app.extensions import db
from app.models.risk import Risk
from app.models.base import CodeSequence
from app.services.formulas import risk_score as _score

RULES = [
    {
        "id": "WATER_SPIKE",
        "category": "Environmental",
        "test": lambda cur, hist: hist.get("p6_water") and cur.get("p6_water", 0) > hist["p6_water"] * 1.30,
        "title": lambda project: f"Potential water stress — {project.name}",
        "rationale": "Water withdrawal is more than 30% above its recent average.",
        "probability": 2, "impact": 2,
    },
    {
        "id": "SAFETY_INCIDENT_SPIKE",
        "category": "Social",
        "test": lambda cur, hist: hist.get("p3_rec") and cur.get("p3_rec", 0) > hist["p3_rec"] * 1.20,
        "title": lambda project: f"Rising safety incidents — {project.name}",
        "rationale": "Recordable injuries are more than 20% above their recent average.",
        "probability": 2, "impact": 3,
    },
    {
        "id": "FATALITY",
        "category": "Social",
        "test": lambda cur, hist: cur.get("p3_fat", 0) > 0,
        "title": lambda project: f"Fatality reported — {project.name}",
        "rationale": "A workplace fatality was reported this period and requires immediate escalation.",
        "probability": 3, "impact": 3,
    },
    {
        "id": "EMISSION_ANOMALY",
        "category": "Environmental",
        "test": lambda cur, hist: hist.get("p6_mach") and cur.get("p6_mach", 0) > hist["p6_mach"] * 1.5,
        "title": lambda project: f"Unusual diesel / machinery fuel use — {project.name}",
        "rationale": "Heavy-machinery diesel consumption is more than 50% above its recent average.",
        "probability": 2, "impact": 2,
    },
]


def run_rules(project, current_totals: dict, historical_avg: dict):
    """Returns a list of risk *candidates* (dicts, not yet persisted) — the caller (a Celery task
    or an admin-triggered endpoint) decides whether to insert them, so detection and creation stay
    separable and testable independently."""
    candidates = []
    for rule in RULES:
        try:
            if rule["test"](current_totals, historical_avg):
                candidates.append({
                    "rule_id": rule["id"], "category": rule["category"],
                    "title": rule["title"](project), "rationale": rule["rationale"],
                    "probability": rule["probability"], "impact": rule["impact"],
                    "project_id": project.id,
                })
        except (TypeError, ZeroDivisionError):
            continue
    return candidates


def create_risk_from_candidate(candidate, mitigation_placeholder="Pending ESG manager review — mitigation plan to be defined."):
    existing = (
        Risk.query
        .filter_by(project_id=candidate["project_id"], status="OPEN")
        .filter(Risk.title == candidate["title"])
        .first()
    )
    if existing:
        return existing, False
    code = f"RSK-{CodeSequence.next('risk', start=0):02d}"
    risk = Risk(
        risk_code=code, project_id=candidate["project_id"], risk_or_opportunity="RISK",
        category=candidate["category"], title=candidate["title"], rationale=candidate["rationale"],
        probability=candidate["probability"], impact=candidate["impact"],
        risk_score=_score(candidate["probability"], candidate["impact"]),
        mitigation=mitigation_placeholder, status="OPEN", include_in_brsr=False,
        owner_label="ESG Manager (auto-detected)",
    )
    db.session.add(risk)
    return risk, True


def reassess(risk: Risk, probability: int, impact: int, reason: str = None, assessed_by_id: str = None):
    from app.models.risk import RiskAssessment
    risk.probability = probability
    risk.impact = impact
    risk.recompute_score()
    db.session.add(RiskAssessment(risk_id=risk.id, probability=probability, impact=impact,
                                   risk_score=risk.risk_score, reason=reason, assessed_by_id=assessed_by_id))
    return risk
