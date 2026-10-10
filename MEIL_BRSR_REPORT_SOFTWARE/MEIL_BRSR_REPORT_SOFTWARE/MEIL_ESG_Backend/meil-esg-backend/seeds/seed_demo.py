"""
Demo data that exercises every status in the workflow at least once, so a fresh `flask seed` +
`python run.py` gives reviewers something to click through immediately — mirrors the frontend's
seeds/buildSeed() intent (one submission in each of DRAFT/SUBMITTED/CORRECTION_REQUIRED/APPROVED,
one vendor request in each state, one risk, one prior-year assurance opinion) without trying to
reproduce its exact random numbers 1:1.
"""
from datetime import date, datetime, timezone
import hashlib
from app.extensions import db
from app.models.user import Role, User, UserRole, UserScope, ALL_ROLES, SCOPE_GROUP, SCOPE_SUBSIDIARY, SCOPE_BUSINESS_UNIT, SCOPE_PROJECT, SCOPE_VENDOR
from app.models.organization import Organization, BusinessUnit, Project
from app.models.period import ReportingPeriod
from app.models.brsr import BrsrPrinciple, BrsrIndicator
from app.models.submission import EsgSubmission, EsgValue, STATUS_DRAFT, STATUS_SUBMITTED, STATUS_CORRECTION_REQUIRED, STATUS_APPROVED
from app.models.review import ReviewAction
from app.models.vendor import Vendor, VendorRequest, VendorValue, VENDOR_REQUEST_REQUESTED, VENDOR_REQUEST_SUBMITTED, VENDOR_REQUEST_ACCEPTED
from app.models.risk import Risk
from app.models.emission import EmissionFactor, Scope3Methodology
from app.models.assessment import AssessmentEngagement
from app.models.disclosure import EntityDisclosure, PolicyCoverage, Core8Fairness, Core9Openness, BusinessActivity, ProductService
from app.models.base import CodeSequence
from app.security.passwords import hash_password

DEMO_PASSWORD = "Password123"

DEMO_USERS = [
    ("r.kumar@meil.in", "Rajesh", "Kumar", "Group ESG Admin", "GROUP_ADMIN"),
    ("p.sharma@meil.in", "Priya", "Sharma", "Subsidiary Head — Infrastructure & Utilities", "SUBSIDIARY_HEAD"),
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
    sub_infra = Organization.query.filter_by(name="MEIL Infrastructure & Utilities").first() or Organization.query.filter_by(type="SUBSIDIARY").first()
    tunnel_bu = BusinessUnit.query.filter_by(code="bu-tunnel").first()
    zojila = Project.query.filter_by(name="Zojila Tunnel Package 1").first()
    vendor = Vendor.query.filter_by(vendor_code="V-103").first()

    scope_for_role = {
        "GROUP_ADMIN": (SCOPE_GROUP, group.id if group else None),
        "SUBSIDIARY_HEAD": (SCOPE_SUBSIDIARY, sub_infra.id if sub_infra else None),
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
        organization_id=group.id,
        financial_year="FY 2026-27",
        cin="U45201TG2006PLC050271",
        entity_name="Megha Engineering & Infrastructures Limited",
        incorporation_year="2006",
        registered_office="Plot No. 1, Balanagar, Hyderabad - 500037, Telangana, India",
        corporate_office="S-2, Technocrat Industrial Estate, Balanagar, Hyderabad - 500037, Telangana, India",
        email="esg@meil.in",
        telephone="+91 40 4433 6700",
        website="https://www.meil.in",
        stock_exchanges="BSE, NSE",
        paid_up_capital=604250000,
        contact_person="Rajesh Kumar, Group ESG Admin",
        boundary_declared="CONSOLIDATED",
        plants_national=3,
        offices_national=38,
        plants_intl=0,
        offices_intl=3,
        markets_national_states=18,
        markets_intl_countries=3,
        exports_pct=4.0,
        customer_types="Central & state government agencies, PSUs, private industrial clients",
        csr_applicable=True,
        csr_turnover=27850000000,
        csr_net_worth=13420000000,
        director_statement="Megha Engineering & Infrastructures Limited (MEIL) is steadfastly committed to sustainable nation-building, decarbonization, top-tier workplace safety, community enrichment, and uncompromising ethical corporate governance across all infrastructure, water, energy, and mobility operations.",
        esg_head="Rajesh Kumar, Group ESG Admin",
        board_committee="Sustainability & Risk Committee",
        external_assessment_done=True,
        external_assessment_agency="BSI Group India / DNV Business Assurance",
        employees_json={"permM": 9800, "permF": 1350, "otherM": 2100, "otherF": 340},
        workers_json={"permM": 31500, "permF": 3600, "otherM": 9200, "otherF": 1100},
        da_employees_json={"permM": 28, "permF": 4, "otherM": 9, "otherF": 1},
        da_workers_json={"permM": 95, "permF": 11, "otherM": 30, "otherF": 4},
        women_board_json={"total": 11, "femaleCount": 2},
        women_kmp_json={"total": 7, "femaleCount": 1},
        turnover_rate_json={
            "cur": {"empM": 11.2, "empF": 13.5, "empT": 11.6, "wkM": 18.4, "wkF": 20.1, "wkT": 18.6},
            "prev": {"empM": 12.0, "empF": 14.2, "empT": 12.4, "wkM": 19.5, "wkF": 21.0, "wkT": 19.7},
            "prev2": {"empM": 13.1, "empF": 15.0, "empT": 13.5, "wkM": 20.8, "wkF": 22.4, "wkT": 21.0},
        },
    )
    db.session.add(ed)
    db.session.flush()

    db.session.add(BusinessActivity(entity_disclosure_id=ed.id, activity="Engineering, Procurement & Construction (EPC)", description="Irrigation, tunnels, roads & bridges", turnover_pct=58.0))
    db.session.add(BusinessActivity(entity_disclosure_id=ed.id, activity="Oil & Gas / Hydrocarbons", description="Refinery EPC, pipelines, city gas distribution", turnover_pct=27.0))
    db.session.add(BusinessActivity(entity_disclosure_id=ed.id, activity="Power & Renewables", description="Thermal, hydro, solar EPC", turnover_pct=15.0))

    db.session.add(ProductService(entity_disclosure_id=ed.id, product="Irrigation & water infrastructure", nic_code="4222", turnover_pct=32.0))
    db.session.add(ProductService(entity_disclosure_id=ed.id, product="Tunnels & underground transit", nic_code="4221", turnover_pct=18.0))
    db.session.add(ProductService(entity_disclosure_id=ed.id, product="Roads & bridges", nic_code="4210", turnover_pct=17.0))
    db.session.add(ProductService(entity_disclosure_id=ed.id, product="Oil & gas pipelines / refinery EPC", nic_code="4220", turnover_pct=27.0))
    db.session.add(ProductService(entity_disclosure_id=ed.id, product="Power generation EPC", nic_code="4220", turnover_pct=6.0))

    db.session.add(Core8Fairness(entity_disclosure_id=ed.id, data_breaches=0, data_breach_ratio_pct=0, accounts_payable_days=48))
    db.session.add(Core9Openness(entity_disclosure_id=ed.id, purch_trading_house_pct=3.4, purch_trading_house_count=12,
                                  purch_top10_pct=28.5, sales_dealer_pct=4.2, sales_dealer_count=15, sales_top10_pct=32.1,
                                  rpt_purchases_pct=1.8, rpt_sales_pct=2.1, rpt_loans_pct=0, rpt_investments_pct=0.5))
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


def seed_verigraph_forensics():
    from app.models.forensics import (
        ExtractedFact, VerificationResult, TrustScore, CapaRecord,
        PhysicalVerification, PHYSICAL_VERIFIED, PHYSICAL_PENDING, PHYSICAL_REJECTED
    )
    from app.models.evidence import Document

    projects = Project.query.limit(10).all()
    if not projects:
        return

    admin = User.query.filter_by(email="r.kumar@meil.in").first()
    admin_id = admin.id if admin else None

    # Realistic vendor & invoice blueprints
    blueprints = [
        {"vendor": "Indian Oil Corporation Limited", "gstin": "36AABCI1234A1Z1", "inv": "IOCL-ZOJ-8841", "qty": 15000.0, "rate": 85.0, "amt": 1275000.0, "status": "VERIFIED", "risk": "LOW", "trust": 94, "phys": PHYSICAL_VERIFIED, "lat": 34.298, "lng": 75.210},
        {"vendor": "Bharat Petroleum Corporation Ltd", "gstin": "36AABCB1234A1Z5", "inv": "BPCL-KAL-9021", "qty": 22000.0, "rate": 86.5, "amt": 1903000.0, "status": "VERIFIED", "risk": "LOW", "trust": 91, "phys": PHYSICAL_VERIFIED, "lat": 18.590, "lng": 79.950},
        {"vendor": "Hindustan Petroleum Corporation Ltd", "gstin": "36AABCH1234A1Z9", "inv": "HPCL-POL-4102", "qty": 18500.0, "rate": 84.0, "amt": 1554000.0, "status": "PARTIALLY_VERIFIED", "risk": "MEDIUM", "trust": 78, "phys": PHYSICAL_PENDING, "lat": 17.250, "lng": 81.650},
        {"vendor": "Tata Power Renewable Energy", "gstin": "27AABCT9988C1Z2", "inv": "TPRE-BLR-3319", "qty": 65000.0, "rate": 7.2, "amt": 468000.0, "status": "VERIFIED", "risk": "LOW", "trust": 96, "phys": PHYSICAL_VERIFIED, "lat": 12.971, "lng": 77.594},
        {"vendor": "Southern Power Distribution Co", "gstin": "36AABCS4455E1Z8", "inv": "TSSPDCL-HYD-710", "qty": 88000.0, "rate": 8.1, "amt": 712800.0, "status": "POTENTIAL_ANOMALY", "risk": "MEDIUM", "trust": 74, "phys": PHYSICAL_PENDING, "lat": 17.385, "lng": 78.486},
        {"vendor": "ABC Fuels Private Limited", "gstin": "36AABCA1234F1Z5", "inv": "INV-4821", "qty": 12500.0, "rate": 95.0, "amt": 1187500.0, "status": "VERIFIED", "risk": "LOW", "trust": 92, "phys": PHYSICAL_VERIFIED, "lat": 26.846, "lng": 80.946},
        {"vendor": "Clean Water Solutions India", "gstin": "29AABCW7788P1Z3", "inv": "CWS-SUR-209", "qty": 4200.0, "rate": 45.0, "amt": 189000.0, "status": "VERIFIED", "risk": "LOW", "trust": 88, "phys": PHYSICAL_VERIFIED, "lat": 21.170, "lng": 72.831},
        {"vendor": "Ramky Enviro Engineers Ltd", "gstin": "36AABCR6622K1Z4", "inv": "RAMKY-WST-118", "qty": 3500.0, "rate": 60.0, "amt": 210000.0, "status": "VERIFIED", "risk": "LOW", "trust": 89, "phys": PHYSICAL_VERIFIED, "lat": 19.076, "lng": 72.877},
        {"vendor": "Global Logistics Corp", "gstin": "27AABCG5544N1Z1", "inv": "GLC-TRN-902", "qty": 9800.0, "rate": 88.0, "amt": 862400.0, "status": "PARTIALLY_VERIFIED", "risk": "MEDIUM", "trust": 76, "phys": PHYSICAL_PENDING, "lat": 28.704, "lng": 77.102},
        {"vendor": "Deccan Fuels Trading", "gstin": "36AABCD3322M1Z0", "inv": "DEC-4491", "qty": 14200.0, "rate": 86.0, "amt": 1221200.0, "status": "VERIFIED", "risk": "LOW", "trust": 90, "phys": PHYSICAL_VERIFIED, "lat": 16.506, "lng": 80.648},
    ]

    for idx, prj in enumerate(projects):
        bp_data = blueprints[idx % len(blueprints)]
        doc_key = f"evidence/demo/{prj.id}_fuel_invoice.pdf"
        doc_hash = hashlib.sha256(f"{prj.id}_{bp_data['inv']}".encode()).hexdigest()

        doc = Document.query.filter_by(sha256=doc_hash).first()
        if not doc:
            doc = Document(
                original_filename=f"{prj.project_code}_Fuel_Invoice_{bp_data['inv']}.pdf",
                storage_key=doc_key,
                mime_type="application/pdf",
                size_bytes=142050,
                sha256=doc_hash,
                uploaded_by_id=admin_id,
            )
            db.session.add(doc)
            db.session.flush()

        # Seed Physical Verification Log
        if PhysicalVerification.query.filter_by(project_id=prj.id).count() == 0:
            db.session.add(PhysicalVerification(
                project_id=prj.id,
                metric_code="diesel_litres",
                status=bp_data["phys"],
                inspector_name="Suresh Naik (EHS Officer)",
                latitude=bp_data["lat"],
                longitude=bp_data["lng"],
                inspection_date=date(2026, 9, 20),
                checklist_results={
                    "meter_seal_intact": True,
                    "storage_calibration_valid": True,
                    "intake_counterfoil_reconciled": True
                },
                notes="Physical meter inspection conducted at site dispensing terminal.",
                evidence_document_id=doc.id,
            ))

        # Seed Extracted Facts
        if ExtractedFact.query.filter_by(document_id=doc.id).count() == 0:
            db.session.add_all([
                ExtractedFact(
                    document_id=doc.id, project_id=prj.id, fact_type="vendor_name", field_name="Vendor Name",
                    raw_value=bp_data["vendor"], text_value=bp_data["vendor"],
                    page_number=1, ocr_confidence=0.98, extraction_confidence=0.98,
                    bounding_box={"x": 0.08, "y": 0.06, "width": 0.42, "height": 0.04},
                ),
                ExtractedFact(
                    document_id=doc.id, project_id=prj.id, fact_type="gstin", field_name="Vendor GSTIN",
                    raw_value=bp_data["gstin"], text_value=bp_data["gstin"],
                    page_number=1, ocr_confidence=0.99, extraction_confidence=0.99,
                    bounding_box={"x": 0.08, "y": 0.11, "width": 0.28, "height": 0.03},
                ),
                ExtractedFact(
                    document_id=doc.id, project_id=prj.id, fact_type="invoice_number", field_name="Invoice Number",
                    raw_value=bp_data["inv"], text_value=bp_data["inv"],
                    page_number=1, ocr_confidence=0.97, extraction_confidence=0.96,
                    bounding_box={"x": 0.65, "y": 0.10, "width": 0.25, "height": 0.03},
                ),
                ExtractedFact(
                    document_id=doc.id, project_id=prj.id, fact_type="diesel_litres", field_name="Diesel Quantity",
                    raw_value=f"{bp_data['qty']:,.0f} Litres", normalized_value=bp_data["qty"], unit="Litres",
                    page_number=1, ocr_confidence=0.97, extraction_confidence=0.96,
                    bounding_box={"x": 0.45, "y": 0.35, "width": 0.20, "height": 0.03},
                ),
                ExtractedFact(
                    document_id=doc.id, project_id=prj.id, fact_type="unit_price", field_name="Unit Rate",
                    raw_value=f"{bp_data['rate']:.2f} INR", normalized_value=bp_data["rate"], unit="INR/Unit",
                    page_number=1, ocr_confidence=0.95, extraction_confidence=0.95,
                    bounding_box={"x": 0.60, "y": 0.35, "width": 0.15, "height": 0.03},
                ),
                ExtractedFact(
                    document_id=doc.id, project_id=prj.id, fact_type="total_amount", field_name="Total Amount",
                    raw_value=f"{bp_data['amt']:,.2f} INR", normalized_value=bp_data["amt"], unit="INR",
                    page_number=1, ocr_confidence=0.98, extraction_confidence=0.97,
                    bounding_box={"x": 0.65, "y": 0.65, "width": 0.25, "height": 0.03},
                ),
            ])

        # Seed Verification Result
        if VerificationResult.query.filter_by(document_id=doc.id).count() == 0:
            db.session.add(VerificationResult(
                document_id=doc.id, project_id=prj.id, metric_code="diesel_litres",
                rule_checks=[{"rule": "MANDATORY_FIELDS", "passed": True}, {"rule": "GSTIN_FORMAT", "passed": True}],
                single_doc_result={"passed": True, "mathValid": True, "gstinValid": True, "flags": []},
                cross_doc_result={"matched": True, "diffPct": 1.2, "status": "CONSISTENT", "comparedWith": "Site Fuel Register & Tanker Slip"},
                temporal_result={"zScore": 0.55, "momChangePct": 3.8, "isSpike": False, "trendStatus": "STABLE"},
                anomaly_result={"isOutlier": False, "anomalyScore": 0.12, "model": "IsolationForest"},
                overall_status=bp_data["status"], risk_level=bp_data["risk"], confidence=0.95,
                explanation="Multi-stage verification passed: internal invoice math verified, site fuel intake consistent, and historical trend stable.",
                recommended_action="Validated under Pre-Assurance Rules for BRSR Review.",
            ))

        # Seed Trust Score
        if TrustScore.query.filter_by(document_id=doc.id).count() == 0:
            phys_score = 20.0 if bp_data["phys"] == PHYSICAL_VERIFIED else (10.0 if bp_data["phys"] == PHYSICAL_PENDING else 0.0)
            db.session.add(TrustScore(
                project_id=prj.id, document_id=doc.id, metric_code="diesel_litres",
                score=bp_data["trust"], category="Verified" if bp_data["trust"] >= 80 else "Partially Verified",
                provenance_score=24.0, verification_score=28.5,
                cross_document_score=23.5, physical_verification_score=phys_score,
                factors_json=[
                    {"name": "Provenance & Chain of Custody", "score": 24.0, "max": 25, "status": "Strong"},
                    {"name": "Document Arithmetic & Tax Rules", "score": 28.5, "max": 30, "status": "Verified"},
                    {"name": "Cross-Document Reconciliation", "score": 23.5, "max": 25, "status": "Consistent"},
                    {"name": "Physical & On-site Verification", "score": phys_score, "max": 20, "status": bp_data["phys"]},
                ],
            ))

    # Seed realistic CAPA records with varying statuses
    capa_specs = [
        ("CAPA-2026-001", projects[0].id, "Minor 3.2% variance between bulk diesel dispenser meter reading and log entry.", "LOW", "Site Fuel Officer (Suresh Naik)", "Recalibrated digital flow meter nozzle on Batching Plant DG Tank 2.", "Added daily shift log cross-check before end-of-day signoff.", date(2026, 10, 15), "RESOLVED", "Nozzle calibration completed. Variance resolved to 0.4%."),
        ("CAPA-2026-002", projects[1].id, "Missing counterfoil signature on subcontractor tanker challan for 12 September.", "MEDIUM", "Store In-charge (Rajesh Varma)", "Retrieved signed weighbridge ticket and gate pass copy from security register.", "Mandated digital gate pass scanning at all vehicle checkpoints.", date(2026, 10, 25), "IN_PROGRESS", "Gate security scanner installed on 4 Oct."),
        ("CAPA-2026-003", projects[2].id, "Temporary power factor drop below 0.90 at secondary tunneling crusher substation.", "HIGH", "Electrical Lead (K. Ramesh)", "Replaced faulty capacitor bank unit on feeder 3.", "Scheduled monthly automated capacitor health diagnostics.", date(2026, 11, 5), "OPEN", "Replacement capacitor units ordered from OEM."),
        ("CAPA-2026-004", projects[3].id, "Water flow meter calibration tag expired at intake sump.", "MEDIUM", "Civil Site Engineer", "Procured NABL-accredited sensor calibration certificate.", "Added quarterly reminder in ERP maintenance schedule.", date(2026, 11, 10), "RESOLVED", "Calibration complete."),
    ]
    for c_code, p_id, finding, sev, owner, ca, pa, d_date, st, comm in capa_specs:
        if not CapaRecord.query.filter_by(capa_code=c_code).first():
            db.session.add(CapaRecord(
                capa_code=c_code, project_id=p_id, finding=finding, severity=sev,
                owner=owner, corrective_action=ca, preventive_action=pa,
                due_date=d_date, status=st, comments=comm
            ))

    db.session.commit()
    print("Seeded VERIGRAPH multi-site evidence documents, physical verifications, extracted facts, trust scores, and CAPA.")


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
    seed_verigraph_forensics()
