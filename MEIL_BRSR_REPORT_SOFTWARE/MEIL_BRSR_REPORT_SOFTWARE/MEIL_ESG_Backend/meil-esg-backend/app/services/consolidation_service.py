"""
The roll-up engine. Mirrors the frontend's lib/consolidate.js, but reads from the database
instead of a client-side seed, and applies each indicator's `aggregation_method` instead of
assuming SUM for everything (critique §16/§38 — headcount is END_OF_PERIOD/averaged across
reporting sites, never summed; rates are RECALCULATE'd from summed numerator+denominator).
"""
from collections import defaultdict
from app.extensions import db
from app.models.organization import Organization, BusinessUnit, Project
from app.models.period import ReportingPeriod
from app.models.submission import EsgSubmission, EsgValue, STATUS_APPROVED, STATUS_LOCKED
from app.models.brsr import BrsrIndicator, AGG_SUM, AGG_END_OF_PERIOD, AGG_RECALCULATE
from app.services.formulas import compute_kpis

APPROVED_STATUSES = (STATUS_APPROVED, STATUS_LOCKED)


def boundary_ok(org: Organization, mode: str, include_jv: bool) -> bool:
    """mode: 'STANDALONE' | 'CONSOLIDATED'. Mirrors the frontend's boundaryOk()."""
    if org is None:
        return False
    if mode == "STANDALONE":
        return org.type == "GROUP"
    if org.type == "JOINT_VENTURE":
        return include_jv
    return True


def _projects_in_scope(scope_type, scope_id, boundary_mode="CONSOLIDATED", include_jv=False):
    q = Project.query.join(BusinessUnit, Project.business_unit_id == BusinessUnit.id)
    if scope_type == "PROJECT":
        q = q.filter(Project.id == scope_id)
    elif scope_type == "BUSINESS_UNIT":
        q = q.filter(Project.business_unit_id == scope_id)
    elif scope_type == "SUBSIDIARY":
        descendant_ids = _descendant_org_ids(scope_id)
        q = q.filter(BusinessUnit.organization_id.in_(descendant_ids))
    # GROUP: no extra filter, every project is in scope before the boundary check below

    projects = q.all()
    out = []
    for p in projects:
        org = p.business_unit.organization
        if boundary_ok(org, boundary_mode, include_jv):
            out.append(p)
    return out


def _descendant_org_ids(org_id):
    ids = [org_id]
    for child in Organization.query.filter_by(parent_id=org_id).all():
        ids.extend(_descendant_org_ids(child.id))
    return ids


def aggregate(project_ids, reporting_period_id, principle_codes=None):
    """Returns {indicator_code: aggregated_value} for APPROVED/LOCKED submissions belonging to
    the given projects + reporting period (a single FY or month row — caller decides which)."""
    if not project_ids:
        return {}, {"reportingSites": 0, "projects": 0}

    q = (
        EsgSubmission.query
        .filter(EsgSubmission.project_id.in_(project_ids))
        .filter(EsgSubmission.reporting_period_id == reporting_period_id)
        .filter(EsgSubmission.status.in_(APPROVED_STATUSES))
    )
    submissions = q.all()
    if principle_codes:
        submissions = [s for s in submissions if s.principle.code in principle_codes]

    sums = defaultdict(float)
    counts = defaultdict(int)
    reporting_projects = set()

    for sub in submissions:
        reporting_projects.add(sub.project_id)
        for val in sub.values:
            code = val.indicator.indicator_code
            v = val.value()
            if isinstance(v, (int, float)):
                sums[code] += v
                counts[code] += 1

    totals = {}
    indicators = {i.indicator_code: i for i in BrsrIndicator.query.all()}
    for code, total in sums.items():
        ind = indicators.get(code)
        method = ind.aggregation_method if ind else AGG_SUM
        if method == AGG_END_OF_PERIOD:
            totals[code] = total / counts[code] if counts[code] else 0.0
        else:  # SUM and RECALCULATE both start from the raw sum; RECALCULATE ratios are derived in formulas.py
            totals[code] = total

    meta = {"reportingSites": len(reporting_projects), "projects": len(project_ids)}
    return totals, meta


def node_totals(scope_type, scope_id, reporting_period_id, boundary_mode="CONSOLIDATED", include_jv=False, turnover_lookup=None):
    projects = _projects_in_scope(scope_type, scope_id, boundary_mode, include_jv)
    project_ids = [p.id for p in projects]
    totals, meta = aggregate(project_ids, reporting_period_id)
    turnover_cr = sum(float(p.turnover_cr or 0) for p in projects)
    kpi = compute_kpis(totals, turnover_cr=turnover_cr)
    return {"totals": totals, "kpi": kpi, "turnoverCr": turnover_cr, **meta}


def rollup_children(scope_type, scope_id, reporting_period_id, boundary_mode="CONSOLIDATED", include_jv=False):
    """One level of drill-down for the Consolidation screen: Group -> its subsidiaries,
    Subsidiary -> its BUs, BU -> its projects."""
    rows = []
    if scope_type == "GROUP":
        for org in Organization.query.filter(Organization.type != "GROUP", Organization.parent_id.isnot(None)).all():
            if org.parent.type != "GROUP":
                continue
            node = node_totals("SUBSIDIARY", org.id, reporting_period_id, boundary_mode, include_jv)
            rows.append({"id": org.id, "name": org.name, "level": "SUBSIDIARY",
                         "excluded": not boundary_ok(org, boundary_mode, include_jv), **node})
    elif scope_type == "SUBSIDIARY":
        for bu in BusinessUnit.query.filter_by(organization_id=scope_id).all():
            node = node_totals("BUSINESS_UNIT", bu.id, reporting_period_id, boundary_mode, include_jv)
            rows.append({"id": bu.id, "name": bu.name, "level": "BUSINESS_UNIT", "excluded": False, **node})
    elif scope_type == "BUSINESS_UNIT":
        for p in Project.query.filter_by(business_unit_id=scope_id).all():
            node = node_totals("PROJECT", p.id, reporting_period_id, boundary_mode, include_jv)
            rows.append({"id": p.id, "name": p.name, "level": "PROJECT", "excluded": False, **node})
    return rows


def coverage(scope_type, scope_id, reporting_period_id, boundary_mode="CONSOLIDATED", include_jv=False, total_principles=9):
    projects = _projects_in_scope(scope_type, scope_id, boundary_mode, include_jv)
    project_ids = [p.id for p in projects]
    counts = defaultdict(int)
    if project_ids:
        subs = (EsgSubmission.query
                .filter(EsgSubmission.project_id.in_(project_ids))
                .filter(EsgSubmission.reporting_period_id == reporting_period_id).all())
        seen = {(s.project_id, s.principle_id) for s in subs}
        for s in subs:
            counts[s.status] += 1
        counts["NONE"] = len(project_ids) * total_principles - len(seen)
    expected = len(project_ids) * total_principles
    approved = counts.get(STATUS_APPROVED, 0) + counts.get(STATUS_LOCKED, 0)
    pct = round((approved / expected) * 100) if expected else 0
    return {"counts": dict(counts), "expected": expected, "approvedPct": pct, "projects": len(project_ids)}
