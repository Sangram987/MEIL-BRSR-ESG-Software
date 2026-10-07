from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.disclosure import (
    EntityDisclosure, BusinessActivity, ProductService, PolicyCoverage, Commitment,
    GovernanceReview, Core8Fairness, Core9Openness,
)
from app.models.brsr import BrsrPrinciple
from app.security.decorators import roles_required, authenticated
from app.utils.errors import ApiError
from app.utils.audit import record

bp = Blueprint("disclosures", __name__, url_prefix="/disclosures")

SIMPLE_FIELDS = [
    "cin", "entity_name", "incorporation_year", "registered_office", "corporate_office", "email",
    "telephone", "website", "stock_exchanges", "paid_up_capital", "contact_person", "boundary_declared",
    "plants_national", "offices_national", "plants_intl", "offices_intl", "markets_national_states",
    "markets_intl_countries", "exports_pct", "customer_types", "csr_applicable", "csr_turnover",
    "csr_net_worth", "director_statement", "esg_head", "board_committee",
    "external_assessment_done", "external_assessment_agency",
]
JSON_FIELDS = [
    "employees", "workers", "da_employees", "da_workers", "women_board", "women_kmp",
    "turnover_rate", "stakeholder_complaints",
]


def _to_dict(ed: EntityDisclosure):
    out = {_camel(f): getattr(ed, f) for f in SIMPLE_FIELDS}
    for f in JSON_FIELDS:
        out[_camel(f)] = getattr(ed, f + "_json") or {}
    out["businessActivities"] = [{"activity": a.activity, "description": a.description, "turnoverPct": float(a.turnover_pct or 0)} for a in ed.business_activities]
    out["productsServices"] = [{"product": p.product, "nic": p.nic_code, "turnoverPct": float(p.turnover_pct or 0)} for p in ed.products_services]
    out["policies"] = {
        pc.principle.code: {
            "hasPolicy": pc.has_policy, "boardApproved": pc.board_approved,
            "translatedToProcedure": pc.translated_to_procedure, "extendsToValueChain": pc.extends_to_value_chain,
            "codes": pc.codes_certifications, "link": pc.policy_link, "notCoveredReason": pc.not_covered_reason,
            "targets": [{"target": c.target, "baseline": c.baseline, "current": c.current_performance, "status": c.status} for c in pc.commitments],
        } for pc in ed.policy_coverage
    }
    out["governanceReview"] = {gr.principle.code: {"by": gr.reviewed_by, "frequency": gr.frequency} for gr in ed.governance_reviews}
    out["core8"] = ed.core8.to_dict() if ed.core8 else {}
    out["core9"] = ed.core9.to_dict() if ed.core9 else {}
    return out


def _camel(snake):
    parts = snake.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


@bp.get("")
@authenticated
def get_disclosure():
    org_id = request.args.get("organizationId")
    fy = request.args.get("financialYear")
    if not org_id or not fy:
        raise ApiError("organizationId and financialYear are required.", 422)
    ed = EntityDisclosure.query.filter_by(organization_id=org_id, financial_year=fy).first()
    if ed is None:
        return jsonify(None)
    return jsonify(_to_dict(ed))


@bp.put("")
@roles_required("GROUP_ADMIN", "ESG_MANAGER")
def save_disclosure():
    body = request.get_json(force=True) or {}
    org_id, fy = body.get("organizationId"), body.get("financialYear")
    if not org_id or not fy:
        raise ApiError("organizationId and financialYear are required.", 422)

    ed = EntityDisclosure.query.filter_by(organization_id=org_id, financial_year=fy).first()
    is_new = ed is None
    if is_new:
        ed = EntityDisclosure(organization_id=org_id, financial_year=fy)
        db.session.add(ed)

    for f in SIMPLE_FIELDS:
        key = _camel(f)
        if key in body:
            setattr(ed, f, body[key])
    for f in JSON_FIELDS:
        key = _camel(f)
        if key in body:
            setattr(ed, f + "_json", body[key])

    db.session.flush()

    if "businessActivities" in body:
        BusinessActivity.query.filter_by(entity_disclosure_id=ed.id).delete()
        for row in body["businessActivities"]:
            db.session.add(BusinessActivity(entity_disclosure_id=ed.id, activity=row.get("activity", ""),
                                             description=row.get("description"), turnover_pct=row.get("turnoverPct") or 0))

    if "productsServices" in body:
        ProductService.query.filter_by(entity_disclosure_id=ed.id).delete()
        for row in body["productsServices"]:
            db.session.add(ProductService(entity_disclosure_id=ed.id, product=row.get("product", ""),
                                           nic_code=row.get("nic"), turnover_pct=row.get("turnoverPct") or 0))

    if "policies" in body:
        principles_by_code = {p.code: p for p in BrsrPrinciple.query.all()}
        existing = {pc.principle_id: pc for pc in ed.policy_coverage}
        for code, row in body["policies"].items():
            principle = principles_by_code.get(code)
            if principle is None:
                continue
            pc = existing.get(principle.id)
            if pc is None:
                pc = PolicyCoverage(entity_disclosure_id=ed.id, principle_id=principle.id)
                db.session.add(pc)
                db.session.flush()
            pc.has_policy = row.get("hasPolicy", True)
            pc.board_approved = row.get("boardApproved", True)
            pc.translated_to_procedure = row.get("translatedToProcedure", True)
            pc.extends_to_value_chain = row.get("extendsToValueChain", False)
            pc.codes_certifications = row.get("codes")
            pc.policy_link = row.get("link")
            pc.not_covered_reason = row.get("notCoveredReason")
            Commitment.query.filter_by(policy_coverage_id=pc.id).delete()
            for t in row.get("targets", []):
                db.session.add(Commitment(policy_coverage_id=pc.id, target=t.get("target"), baseline=t.get("baseline"),
                                           current_performance=t.get("current"), status=t.get("status")))

    if "governanceReview" in body:
        principles_by_code = {p.code: p for p in BrsrPrinciple.query.all()}
        existing = {gr.principle_id: gr for gr in ed.governance_reviews}
        for code, row in body["governanceReview"].items():
            principle = principles_by_code.get(code)
            if principle is None:
                continue
            gr = existing.get(principle.id)
            if gr is None:
                gr = GovernanceReview(entity_disclosure_id=ed.id, principle_id=principle.id)
                db.session.add(gr)
            gr.reviewed_by = row.get("by", "Committee of the Board")
            gr.frequency = row.get("frequency", "Quarterly")

    if "core8" in body:
        c8 = ed.core8 or Core8Fairness(entity_disclosure_id=ed.id)
        c8.data_breaches = body["core8"].get("dataBreaches", 0)
        c8.data_breach_ratio_pct = body["core8"].get("dataBreachRatio", 0)
        c8.accounts_payable_days = body["core8"].get("payablesDays")
        db.session.add(c8)

    if "core9" in body:
        c9 = ed.core9 or Core9Openness(entity_disclosure_id=ed.id)
        for key in ("purchTradingHousePct", "purchTradingHouseCount", "purchTop10Pct", "salesDealerPct",
                    "salesDealerCount", "salesTop10Pct", "rptPurchasesPct", "rptSalesPct", "rptLoansPct", "rptInvestmentsPct"):
            snake = "".join(["_" + c.lower() if c.isupper() else c for c in key]).lstrip("_")
            if key in body["core9"]:
                setattr(c9, snake, body["core9"][key])
        db.session.add(c9)

    record("DISCLOSURES_SAVED", "EntityDisclosure", f"{org_id}:{fy}", details="Section A/B updated")
    db.session.commit()
    return jsonify(_to_dict(ed)), 201 if is_new else 200
