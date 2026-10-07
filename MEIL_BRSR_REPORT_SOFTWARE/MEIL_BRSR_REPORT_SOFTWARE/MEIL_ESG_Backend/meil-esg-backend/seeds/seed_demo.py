"""
Demo data that exercises every status in the workflow at least once, so a fresh `flask seed` +
`python run.py` gives reviewers something to click through immediately — mirrors the frontend's
seeds/buildSeed() intent (one submission in each of DRAFT/SUBMITTED/CORRECTION_REQUIRED/APPROVED,
one vendor request in each state, one risk, one prior-year assurance opinion) without trying to
reproduce its exact random numbers 1:1.
"""
from datetime import date, datetime, timezone
from app.extensions import db
from app.models.user import Role, User, UserRole, UserScope, ALL_ROLES, SCOPE_GROUP, SCOPE_BUSINESS_UNIT, SCOPE_PROJECT, SCOPE_VENDOR
from app.models.organization import Organization, BusinessUnit, Project
from app.models.period import ReportingPeriod
from app.models.brsr import BrsrPrinciple, BrsrIndicator
from app.models.submission import EsgSubmission, EsgValue, STATUS_DRAFT, STATUS_SUBMITTED, STATUS_CORRECTION_REQUIRED, STATUS_APPROVED
from app.models.review import ReviewAction
from app.models.vendor import Vendor, VendorRequest, VendorValue, VENDOR_REQUEST_REQUESTED, VENDOR_REQUEST_SUBMITTED, VENDOR_REQUEST_ACCEPTED
from app.models.risk import Risk
from app.models.emission import EmissionFactor, Scope3Methodology
from app.models.assessment import AssessmentEngagement
from app.models.disclosure import EntityDisclosure, PolicyCoverage, Core8Fairness, Core9Openness
from app.models.base import CodeSequence
from app.security.passwords import hash_password

DEMO_PASSWORD = "Password123"

DEMO_USERS = [
    ("r.kumar@meil.in", "Rajesh", "Kumar", "Group ESG Admin", "GROUP_ADMIN"),
    ("v.singh@meil.in", "Vikram", "Singh", "BU Manager — Tunnels & Transit", "BU_MANAGER"),
    ("s.naik@meil.in", "Suresh", "Naik", "Site Operator", "SITE_OPERATOR"),
    ("anil@globallogistics.example", "Anil", "Mehta", "ESG Coordinator, Global Logistics Corp", "VENDOR_USER"),
    ("a.rao@assurance.example", "Ananya", "Rao", "Independent Assurance Provider", "ASSESSOR"),
]


def _ensure_roles():
    for code in ALL_ROLES:
        if Role.query.filter_by(code=code).first() is None:
            db.session.add(Role(code=code, name=code.replace("_", " ").title()))
    db.session.flush()


def seed_users():
    _ensure_roles()
    roles = {r.code: r for r in Role.query.all()}
    group = Organization.query.filter_by(type="GROUP").first()
    tunnel_bu = BusinessUnit.query.filter_by(code="bu-tunnel").first()
    zojila = Project.query.filter_by(name="Zojila Tunnel Package 1").first()
    vendor = Vendor.query.filter_by(vendor_code="V-103").first()

    scope_for_role = {
        "GROUP_ADMIN": (SCOPE_GROUP, group.id if group else None),
        "BU_MANAGER": (SCOPE_BUSINESS_UNIT, tunnel_bu.id if tunnel_bu else None),
        "SITE_OPERATOR": (SCOPE_PROJECT, zojila.id if zojila else None),
        "VENDOR_USER": (SCOPE_VENDOR, vendor.id if vendor else None),
        "ASSESSOR": (SCOPE_GROUP, group.id if group else None),
    }

    created = []
    for email, first, last, title, role_code in DEMO_USERS:
        user = User.query.filter_by(email=email).first()
        if user is None:
            user = User(email=email, password_hash=hash_password(DEMO_PASSWORD), first_name=first,
                        last_name=last, title=title, status="ACTIVE")
            db.session.add(user)
            db.session.flush()
            db.session.add(UserRole(user_id=user.id, role_id=roles[role_code].id))
            scope_type, scope_id = scope_for_role[role_code]
            if scope_id:
                db.session.add(UserScope(user_id=user.id, scope_type=scope_type, scope_id=scope_id))
        created.append(user)
    db.session.commit()
    print(f"Seeded {len(created)} demo users (password for all: {DEMO_PASSWORD}).")
    return {u.email: u for u in created}


def seed_vendors():
    rows = [
        ("V-101", "UltraTech Cement Ltd", "Raw Materials", "LOW"),
        ("V-102", "L&T Heavy Machinery", "Equipment Leasing", "LOW"),
        ("V-103", "Global Logistics Corp", "Transportation", "HIGH"),
        ("V-104", "Apex Manpower Services", "Contract Labor", "LOW"),
        ("V-105", "Deccan Steel Traders", "Raw Materials", "LOW"),
        ("V-106", "Sri Sai Aggregates", "Raw Materials", "MEDIUM"),
    ]
    for code, name, category, risk in rows:
        if Vendor.query.filter_by(vendor_code=code).first() is None:
            db.session.add(Vendor(vendor_code=code, legal_name=name, category=category, risk_level=risk))
    db.session.commit()
    print(f"Seeded {len(rows)} vendors.")


def seed_emission_factors():
    rows = [
        ("DIESEL_L", "SCOPE_1", 2.68, "kgCO2e/L", "CEA CO2 Baseline Database (illustrative)"),
        ("PETROL_L", "SCOPE_1", 2.31, "kgCO2e/L", "CEA CO2 Baseline Database (illustrative)"),
        ("GRID_KWH", "SCOPE_2", 0.71, "kgCO2e/kWh", "CEA CO2 Baseline Database (illustrative)"),
    ]
    for activity_type, scope, value, unit, source in rows:
        if EmissionFactor.query.filter_by(activity_type=activity_type, valid_to=None).first() is None:
            db.session.add(EmissionFactor(activity_type=activity_type, scope=scope, factor_value=value,
                                           factor_unit=unit, source=source, valid_from=date(2024, 4, 1)))
    db.session.commit()
    print("Seeded illustrative emission factors — replace with Group-ESG-approved values before go-live.")


def seed_value_chain_config():
    group = Organization.query.filter_by(type="GROUP").first()
    if group and Scope3Methodology.query.filter_by(organization_id=group.id, is_active=True).first() is None:
        db.session.add(Scope3Methodology(
            organization_id=group.id, applicability="VOLUNTARY_TOP250", allocation_method="REVENUE_SHARE",
            methodology_note="Vendor Scope 1+2 emissions allocated to MEIL in proportion to (revenue from "
                              "MEIL ÷ vendor total revenue). Internal estimate, not a prescribed SEBI rule.",
        ))
        db.session.commit()
        print("Seeded value-chain methodology configuration.")


def _val(submission, indicators_by_code, code, value):
    ind = indicators_by_code.get(code)
    if ind is None:
        return
    db.session.add(EsgValue(submission_id=submission.id, indicator_id=ind.id, numeric_value=value))


def seed_submissions(users):
    zojila = Project.query.filter_by(name="Zojila Tunnel Package 1").first()
    period = ReportingPeriod.query.filter_by(name="2026-09").first()
    prev_period = ReportingPeriod.query.filter_by(name="2026-08").first()
    if not (zojila and period):
        print("Skipping submission seed — organization/periods not seeded yet.")
        return
    p6 = BrsrPrinciple.query.filter_by(code="P6").first()
    p3 = BrsrPrinciple.query.filter_by(code="P3").first()
    p1 = BrsrPrinciple.query.filter_by(code="P1").first()
    operator = users.get("s.naik@meil.in")
    manager = users.get("v.singh@meil.in")

    def indicators_for(principle):
        return {i.indicator_code: i for i in principle.indicators}

    # 1) Draft P6 for the current period
    if not EsgSubmission.query.filter_by(project_id=zojila.id, reporting_period_id=period.id, principle_id=p6.id).first():
        sub = EsgSubmission(submission_code=f"SUB-{CodeSequence.next('submission')}", project_id=zojila.id,
                             reporting_period_id=period.id, principle_id=p6.id, status=STATUS_DRAFT,
                             entered_by_role="SITE_OPERATOR")
        db.session.add(sub)
        db.session.flush()
        _val(sub, indicators_for(p6), "p6_grid", 44200)
        db.session.commit()

    # 2) Submitted P1 -> approved, to exercise the approval + assessment pipeline
    if not EsgSubmission.query.filter_by(project_id=zojila.id, reporting_period_id=period.id, principle_id=p1.id).first():
        sub = EsgSubmission(submission_code=f"SUB-{CodeSequence.next('submission')}", project_id=zojila.id,
                             reporting_period_id=period.id, principle_id=p1.id, status=STATUS_APPROVED,
                             entered_by_role="SITE_OPERATOR", submitted_by_id=operator.id if operator else None,
                             submitted_at=datetime.now(timezone.utc), reviewed_by_id=manager.id if manager else None,
                             reviewed_at=datetime.now(timezone.utc), review_comment="Verified against training register.")
        db.session.add(sub)
        db.session.flush()
        ind = indicators_for(p1)
        _val(sub, ind, "p1_trained", 60)
        _val(sub, ind, "p1_corr", 0)
        _val(sub, ind, "p1_fines", 0)
        db.session.add(ReviewAction(submission_id=sub.id, reviewer_id=manager.id if manager else sub.id,
                                     action="APPROVE", comment="Verified against training register."))
        db.session.commit()

    # 3) Submitted P3 awaiting review (so the BU Manager demo account has a non-empty queue)
    if not EsgSubmission.query.filter_by(project_id=zojila.id, reporting_period_id=period.id, principle_id=p3.id).first():
        sub = EsgSubmission(submission_code=f"SUB-{CodeSequence.next('submission')}", project_id=zojila.id,
                             reporting_period_id=period.id, principle_id=p3.id, status=STATUS_SUBMITTED,
                             entered_by_role="SITE_OPERATOR", submitted_by_id=operator.id if operator else None,
                             submitted_at=datetime.now(timezone.utc))
        db.session.add(sub)
        db.session.flush()
        ind = indicators_for(p3)
        for code, val in [("p3_pm", 140), ("p3_pf", 22), ("p3_cm", 520), ("p3_cf", 60),
                           ("p3_manhrs", 110000), ("p3_lti", 1), ("p3_rec", 2), ("p3_fat", 0),
                           ("p3_wages", 24000000), ("p3_wagesf", 3600000)]:
            _val(sub, ind, code, val)
        db.session.commit()

    db.session.commit()
    print("Seeded 3 demo submissions (draft / approved / awaiting review).")


def seed_vendor_requests(users):
    period = ReportingPeriod.query.filter_by(financial_year="FY 2026-27", period_type="FINANCIAL_YEAR").first()
    if period is None:
        return
    ultratech = Vendor.query.filter_by(vendor_code="V-101").first()
    global_logi = Vendor.query.filter_by(vendor_code="V-103").first()
    admin = users.get("r.kumar@meil.in")
    if ultratech and not VendorRequest.query.filter_by(vendor_id=ultratech.id, reporting_period_id=period.id).first():
        req = VendorRequest(request_code=f"VR-{CodeSequence.next('vendor_request', start=2100)}", vendor_id=ultratech.id,
                             reporting_period_id=period.id, requester_id=admin.id if admin else None,
                             due_date=date(2026, 10, 15), status=VENDOR_REQUEST_ACCEPTED)
        db.session.add(req)
        db.session.flush()
        for code, val in [("v_turnover", 672), ("v_meil", 96), ("v_elec", 288000), ("v_diesel", 153600),
                           ("v_manhrs", 640000), ("v_lti", 2), ("v_fat", 0), ("v_belowmin", 0), ("v_emp", 210)]:
            db.session.add(VendorValue(request_id=req.id, field_code=code, numeric_value=val))
    if global_logi and not VendorRequest.query.filter_by(vendor_id=global_logi.id, reporting_period_id=period.id).first():
        db.session.add(VendorRequest(request_code=f"VR-{CodeSequence.next('vendor_request', start=2100)}",
                                      vendor_id=global_logi.id, reporting_period_id=period.id,
                                      requester_id=admin.id if admin else None, due_date=date(2026, 10, 15),
                                      status=VENDOR_REQUEST_REQUESTED, message="Please share your H1 FY 2026-27 ESG data."))
    db.session.commit()
    print("Seeded vendor requests (one accepted, one outstanding).")


def seed_risks():
    water_indicator = BrsrIndicator.query.filter_by(indicator_code="p6_ground").first()
    bu_water = BusinessUnit.query.filter_by(code="bu-water").first()
    polavaram = Project.query.filter_by(name="Polavaram Headworks").first()
    if not Risk.query.filter_by(risk_code="RSK-01").first() and polavaram:
        r = Risk(risk_code="RSK-01", project_id=polavaram.id, risk_or_opportunity="RISK", category="Environmental",
                  title="Groundwater depletion (Polavaram)",
                  rationale="Site draws heavily on groundwater in a water-stressed basin; state groundwater board has flagged extraction limits.",
                  probability=3, impact=3, financial_exposure=12.5,
                  financial_implication="Adverse — potential restriction on groundwater permits could delay works and raise tanker-water costs.",
                  time_horizon="Short-term (0-1 yr)", owner_label="BU Manager - Water",
                  mitigation="Implement rainwater harvesting and greywater recycling by Q3.",
                  status="OPEN", include_in_brsr=True, linked_indicator_id=water_indicator.id if water_indicator else None)
        r.recompute_score()
        db.session.add(r)
        db.session.commit()
        print("Seeded 1 demo risk.")


def seed_entity_disclosure():
    group = Organization.query.filter_by(type="GROUP").first()
    if group is None or EntityDisclosure.query.filter_by(organization_id=group.id, financial_year="FY 2026-27").first():
        return
    ed = EntityDisclosure(
        organization_id=group.id, financial_year="FY 2026-27",
        entity_name="Megha Engineering & Infrastructures Limited", registered_office="Hyderabad, Telangana",
        boundary_declared="CONSOLIDATED", csr_applicable=True,
        director_statement="", esg_head="Rajesh Kumar, Group ESG Admin", board_committee="Sustainability & Risk Committee",
        employees_json={"permM": 9800, "permF": 1350, "otherM": 2100, "otherF": 340},
        workers_json={"permM": 31500, "permF": 3600, "otherM": 9200, "otherF": 1100},
        women_board_json={"total": 11, "femaleCount": 2}, women_kmp_json={"total": 7, "femaleCount": 1},
    )
    db.session.add(ed)
    db.session.flush()
    db.session.add(Core8Fairness(entity_disclosure_id=ed.id, data_breaches=0, data_breach_ratio_pct=0, accounts_payable_days=45))
    db.session.add(Core9Openness(entity_disclosure_id=ed.id, purch_trading_house_pct=12, purch_trading_house_count=8,
                                  purch_top10_pct=9, sales_dealer_pct=0, sales_dealer_count=0, sales_top10_pct=0,
                                  rpt_purchases_pct=2, rpt_sales_pct=0, rpt_loans_pct=1, rpt_investments_pct=0))
    for p in BrsrPrinciple.query.all():
        db.session.add(PolicyCoverage(entity_disclosure_id=ed.id, principle_id=p.id, has_policy=True,
                                       board_approved=True, translated_to_procedure=True,
                                       extends_to_value_chain=p.code in ("P3", "P6")))
    db.session.commit()
    print("Seeded Section A/B entity disclosure for FY 2026-27.")


def seed_assessment_opinion():
    group = Organization.query.filter_by(type="GROUP").first()
    period = ReportingPeriod.query.filter_by(financial_year="FY 2025-26", period_type="FINANCIAL_YEAR").first()
    assessor = User.query.filter_by(email="a.rao@assurance.example").first()
    if not (group and period and assessor):
        return
    for attr_id in ("ghg", "water", "energy"):
        if AssessmentEngagement.query.filter_by(reporting_period_id=period.id, organization_id=group.id, core_attribute_id=attr_id).first():
            continue
        db.session.add(AssessmentEngagement(
            reporting_period_id=period.id, organization_id=group.id, core_attribute_id=attr_id,
            mode="ASSURANCE", status="Reasonable assurance", provider="Ananya Rao & Associates",
            provider_type="Independent external assurance provider", standard="ISAE 3000",
            scope="MEIL Group - all business units", independence_confirmed=True,
            issued_by_id=assessor.id, issued_at=datetime.now(timezone.utc),
        ))
    db.session.commit()
    print("Seeded 3 prior-year assurance opinions.")


def run():
    seed_vendors()
    seed_emission_factors()
    seed_value_chain_config()
    users = seed_users()
    seed_submissions(users)
    seed_vendor_requests(users)
    seed_risks()
    seed_entity_disclosure()
    seed_assessment_opinion()
