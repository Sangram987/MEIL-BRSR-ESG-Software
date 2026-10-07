"""
Two jobs: (1) tell the Reports screen whether a scope/period is actually ready to export, with
the specific blocking items named (critique §51's GET /reports/readiness), and (2) assemble the
9 BRSR Core attributes from a consolidation_service.node_totals() result plus the entity-level
Section A/B Core 8 & 9 rows, matching the frontend's CORE_ATTRS structure exactly.
"""
from app.models.brsr import BrsrCoreAttribute, BrsrIndicator
from app.models.disclosure import EntityDisclosure
from app.models.assessment import AssessmentEngagement


SITE_CORE_METRIC_KEYS = {
    "ghg": [("scope1", "tCO2e"), ("scope2", "tCO2e"), ("ghg", "tCO2e"), ("ghgIntensity", "tCO2e/₹ Cr")],
    "water": [("waterWithdrawn", "KL"), ("waterConsumed", "KL"), ("waterDischarged", "KL"), ("waterIntensity", "KL/₹ Cr")],
    "energy": [("energyGJ", "GJ"), ("renewablePct", "%"), ("energyIntensity", "GJ/₹ Cr")],
    "circ": [("waste", "MT"), ("wasteRecoveredPct", "%"), ("wasteIntensity", "MT/₹ Cr")],
    "safety": [("ltifr", "ratio"), ("fatalities", "Count"), ("injuries", "Count"), ("safetySpendPct", "%")],
    "gender": [("femaleWagePct", "%"), ("femalePct", "%")],
    "inclusive": [("msmePct", "%")],
}


def build_core_snapshot(kpi: dict, entity_disclosure: EntityDisclosure | None, engagements: dict):
    """engagements: {core_attribute_id: AssessmentEngagement}"""
    attrs = BrsrCoreAttribute.query.order_by(BrsrCoreAttribute.sequence).all()
    out = []
    for a in attrs:
        if a.id in SITE_CORE_METRIC_KEYS:
            metrics = [{"label": k, "unit": u, "value": kpi.get(k)} for k, u in SITE_CORE_METRIC_KEYS[a.id]]
        elif a.id == "fair" and entity_disclosure and entity_disclosure.core8:
            c8 = entity_disclosure.core8.to_dict()
            metrics = [{"label": k, "unit": "", "value": v} for k, v in c8.items()]
        elif a.id == "open" and entity_disclosure and entity_disclosure.core9:
            c9 = entity_disclosure.core9.to_dict()
            metrics = [{"label": k, "unit": "%", "value": v} for k, v in c9.items()]
        else:
            metrics = []
        eng = engagements.get(a.id)
        out.append({
            "id": a.id, "label": a.label, "entityLevel": a.entity_level, "metrics": metrics,
            "disclosureStatus": eng.status if eng else "PENDING",
            "mode": eng.mode if eng else None,
        })
    return out


def readiness(entity_disclosure, coverage: dict, engagements: dict, core_attr_ids):
    blocking = []
    if entity_disclosure is None:
        blocking.append("Section A & B have not been filled in for this financial year.")
    else:
        if not entity_disclosure.cin:
            blocking.append("Section A: CIN is empty.")
        if not entity_disclosure.director_statement:
            blocking.append("Section B: director's statement is empty.")
        if not entity_disclosure.core8:
            blocking.append("BRSR Core 8 (Fairness): entity-level figures not entered.")
        if not entity_disclosure.core9:
            blocking.append("BRSR Core 9 (Openness): entity-level figures not entered.")

    pending = [cid for cid in core_attr_ids if cid not in engagements or engagements[cid].status == "PENDING"]
    if pending:
        blocking.append(f"{len(pending)} of {len(core_attr_ids)} BRSR Core attributes have no assessment/assurance opinion.")

    open_packets = coverage.get("counts", {}).get("SUBMITTED", 0) + coverage.get("counts", {}).get("CORRECTION_REQUIRED", 0)
    if open_packets:
        blocking.append(f"{open_packets} packets for this period are still awaiting BU approval and are excluded from the totals.")

    section_pct = {
        "sectionA": 100 if entity_disclosure and entity_disclosure.cin else 40,
        "sectionB": 100 if entity_disclosure and entity_disclosure.director_statement else 40,
        "core": round(((len(core_attr_ids) - len(pending)) / len(core_attr_ids)) * 100) if core_attr_ids else 0,
        "dataApproved": coverage.get("approvedPct", 0),
    }
    return {**section_pct, "ready": len(blocking) == 0, "blockingItems": blocking}
