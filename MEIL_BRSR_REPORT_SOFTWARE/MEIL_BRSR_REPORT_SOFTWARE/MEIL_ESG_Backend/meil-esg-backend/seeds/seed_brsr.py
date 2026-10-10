"""
This is the authoritative BRSR master the frontend's brsr.js was always a prototype of. Every
indicator_code here matches the frontend's indicator id 1:1 (p6_grid, p3_lti, p5_belowmin, ...) so
a future "point the React app at the API instead of localStorage" migration is a rename-free
swap. Includes the two corrections from the company's round-2 review: `p3_belowmin` moved to P5
(now `p5_belowmin`), and BRSR Core 8/9 modelled as separate entity-level fields rather than one
blended figure (see seed_demo.py's EntityDisclosure.core8/core9 rows, not indicators here, since
8 & 9 are entity-level, not site-level).
"""
from datetime import date
from app.extensions import db
from app.models.brsr import (
    BrsrFrameworkVersion, BrsrSection, BrsrPrinciple, BrsrIndicator, BrsrCoreAttribute,
    Sdg, PrincipleSdgMapping, AGG_SUM, AGG_END_OF_PERIOD, TIER_ESSENTIAL, TIER_LEADERSHIP,
)

SDGS = {
    1: "No Poverty", 3: "Good Health & Well-being", 5: "Gender Equality", 6: "Clean Water & Sanitation",
    7: "Affordable & Clean Energy", 8: "Decent Work & Economic Growth", 9: "Industry, Innovation & Infrastructure",
    10: "Reduced Inequalities", 11: "Sustainable Cities & Communities", 12: "Responsible Consumption & Production",
    13: "Climate Action", 15: "Life on Land", 16: "Peace, Justice & Strong Institutions", 17: "Partnerships for the Goals",
}

CORE_ATTRS = [
    ("ghg", "GHG footprint", False), ("water", "Water footprint", False), ("energy", "Energy footprint", False),
    ("circ", "Embracing circularity", False), ("safety", "Employee wellbeing & safety", False),
    ("gender", "Gender diversity in business", False), ("inclusive", "Inclusive development", False),
    ("fair", "Fairness with customers & suppliers", True), ("open", "Openness of business", True),
]

# (code, label, pillar, sdg_ids, indicators)
# indicator tuple: (code, label, unit, tier, data_type, required, evidence_required, core, agg)
E, L = TIER_ESSENTIAL, TIER_LEADERSHIP
DEC = "DECIMAL"

PRINCIPLES = [
    ("P1", "Ethics & Transparency", "G", [16], [
        ("p1_trained", "Employees & workers trained on ethics / anti-corruption", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p1_corr", "Corruption / bribery complaints received", "Count", E, DEC, True, True, None, AGG_SUM),
        ("p1_fines", "Fines / penalties paid to regulators", "INR", E, DEC, True, True, None, AGG_SUM),
        ("p1_disc", "Disciplinary actions for ethics violations", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p1_whistle", "Whistleblower / vigil mechanism reports filed", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p1_inspect", "Statutory compliance audits passed with zero non-conformities", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p1_vendor_code", "Key vendors / suppliers signed anti-bribery code of conduct", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p1_coi", "Conflict-of-interest complaints", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p1_aware", "Ethics & anti-fraud awareness programmes held", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p1_thirdparty", "Independent third-party governance & integrity audits", "Count", L, DEC, False, True, None, AGG_SUM),
    ]),
    ("P2", "Sustainable Goods & Services", "E", [9, 12], [
        ("p2_input", "Total input materials procured", "Metric Tons", E, DEC, True, True, None, AGG_SUM),
        ("p2_recycled", "Recycled / reused input material", "Metric Tons", E, DEC, False, True, None, AGG_SUM),
        ("p2_green_cement", "Low-carbon / blended cement (PPC/PSC) procured", "Metric Tons", E, DEC, False, True, None, AGG_SUM),
        ("p2_recycled_steel", "Secondary / recycled structural steel procured", "Metric Tons", E, DEC, False, True, None, AGG_SUM),
        ("p2_local_agg", "Coarse & fine aggregates sourced within 50 km", "Metric Tons", E, DEC, False, True, None, AGG_SUM),
        ("p2_env_clear", "Active Environmental Clearances / CTE / CTO maintained", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p2_capex", "Capex on environmental & social improvements", "INR", E, DEC, False, True, None, AGG_SUM),
        ("p2_water_sav", "High-efficiency curing & water-saving techniques deployed", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p2_lca", "Life-cycle / impact assessments conducted", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p2_scrap", "Scrap & material reclaimed at end of use", "Metric Tons", L, DEC, False, True, None, AGG_SUM),
        ("p2_green_trans", "Low-emission / electric heavy equipment deployed", "Count", L, DEC, False, True, None, AGG_SUM),
    ]),
    ("P3", "Employee Wellbeing & Safety", "S", [3, 5, 8], [
        ("p3_pm", "Permanent employees — Male", "Personnel", E, DEC, True, True, None, AGG_END_OF_PERIOD),
        ("p3_pf", "Permanent employees — Female", "Personnel", E, DEC, True, True, None, AGG_END_OF_PERIOD),
        ("p3_cm", "Contract workers — Male", "Personnel", E, DEC, True, True, None, AGG_END_OF_PERIOD),
        ("p3_cf", "Contract workers — Female", "Personnel", E, DEC, True, True, None, AGG_END_OF_PERIOD),
        ("p3_dis", "Differently-abled employees & workers", "Personnel", E, DEC, False, True, None, AGG_END_OF_PERIOD),
        ("p3_hires", "New hires in the month", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p3_exits", "Separations in the month", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p3_manhrs", "Man-hours worked", "Hours", E, DEC, True, True, "safety", AGG_SUM),
        ("p3_lti", "Lost-time injuries (LTI)", "Count", E, DEC, True, True, "safety", AGG_SUM),
        ("p3_rec", "Recordable work-related injuries", "Count", E, DEC, True, True, "safety", AGG_SUM),
        ("p3_fat", "Fatalities", "Count", E, DEC, True, True, "safety", AGG_SUM),
        ("p3_pd", "Permanent disabilities", "Count", E, DEC, False, True, "safety", AGG_SUM),
        ("p3_nearmiss", "Near-miss incidents reported & investigated", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p3_firstaid", "First-aid injury treatments administered", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p3_toolboxtalks", "Daily safety toolbox talks conducted", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p3_safety_audits", "EHS safety inspections & walkthroughs performed", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p3_hstrain", "Workers trained on health & safety", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p3_train_hrs", "Total safety & skill training hours delivered", "Hours", E, DEC, False, True, None, AGG_SUM),
        ("p3_health_camps", "Periodic occupational health checkups completed", "Personnel", E, DEC, False, True, None, AGG_SUM),
        ("p3_ppe_issued", "Full PPE kits inspected and issued", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p3_wellbeing", "Spend on employee wellbeing (health, insurance, accident)", "INR", E, DEC, False, True, "safety", AGG_SUM),
        ("p3_welfare_spend", "Spend on site amenities, drinking water, sanitation & crèches", "INR", E, DEC, False, True, None, AGG_SUM),
        ("p3_wages", "Gross wages paid — total", "INR", E, DEC, True, True, "gender", AGG_SUM),
        ("p3_wagesf", "Gross wages paid — female", "INR", E, DEC, True, True, "gender", AGG_SUM),
        ("p3_life", "Workers covered by life / accident insurance", "Personnel", L, DEC, False, True, None, AGG_END_OF_PERIOD),
        ("p3_leave", "Parental leave availed", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p3_statutory", "Contract workers verified on PF / ESIC statutory roll", "Personnel", L, DEC, False, True, None, AGG_END_OF_PERIOD),
    ]),
    ("P4", "Stakeholder Engagement", "S", [10, 17], [
        ("p4_groups", "Stakeholder groups engaged", "Count", E, DEC, False, True, None, AGG_END_OF_PERIOD),
        ("p4_meet", "Stakeholder consultation meetings held", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p4_local_hires", "Local community members employed at project site", "Personnel", E, DEC, False, True, None, AGG_END_OF_PERIOD),
        ("p4_panchayat", "Gram Panchayat / local authority coordination meetings", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p4_griev", "Community grievances received", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p4_resolved", "Community grievances resolved", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p4_board", "Consultations escalated to management / board", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p4_vuln", "Engagements with vulnerable / marginalised groups", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p4_csr_advisory", "Community advisory / CSR liaison committee meetings", "Count", L, DEC, False, True, None, AGG_SUM),
    ]),
    ("P5", "Human Rights", "S", [5, 8, 10], [
        ("p5_hrtrain", "Employees & workers trained on human rights", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p5_child", "Child-labour complaints", "Count", E, DEC, True, True, None, AGG_SUM),
        ("p5_forced", "Forced-labour complaints", "Count", E, DEC, True, True, None, AGG_SUM),
        ("p5_posh", "Sexual-harassment (POSH) complaints", "Count", E, DEC, True, True, "gender", AGG_SUM),
        ("p5_disc", "Discrimination complaints", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p5_belowmin", "Workers paid below minimum wage", "Count", E, DEC, True, True, None, AGG_SUM),
        ("p5_griev", "Human-rights grievances received (all channels)", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p5_wage_audit", "Independent third-party minimum wage audits completed", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p5_female_fac", "Dedicated female worker sanitation & rest facilities maintained", "Units", E, DEC, False, True, None, AGG_END_OF_PERIOD),
        ("p5_dd", "Human-rights due-diligence assessments (plants / offices)", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p5_vcdd", "Value-chain partners assessed for human-rights risk", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p5_access", "Accessibility upgrades to premises", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p5_corrective", "Corrective actions on human-rights findings", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p5_migrant", "Inter-state migrant worker health & welfare registrations", "Personnel", L, DEC, False, True, None, AGG_SUM),
    ]),
    ("P6", "Environment", "E", [6, 7, 12, 13, 15], [
        ("p6_grid", "Grid electricity purchased", "kWh", E, DEC, True, True, "energy", AGG_SUM),
        ("p6_renew", "Renewable electricity consumed (on-site)", "kWh", E, DEC, False, True, "energy", AGG_SUM),
        ("p6_solar", "On-site Solar Power generated", "kWh", E, DEC, False, True, "energy", AGG_SUM),
        ("p6_dg", "Diesel — stationary DG sets", "Liters", E, DEC, True, True, "ghg", AGG_SUM),
        ("p6_mach", "Diesel — heavy machinery & vehicles", "Liters", E, DEC, True, True, "ghg", AGG_SUM),
        ("p6_petrol", "Petrol — vehicles", "Liters", E, DEC, False, True, "ghg", AGG_SUM),
        ("p6_cng", "CNG / PNG fuel consumed", "Kilograms", E, DEC, False, True, "ghg", AGG_SUM),
        ("p6_biodiesel", "Biofuel / Biodiesel consumed", "Liters", E, DEC, False, True, "ghg", AGG_SUM),
        ("p6_water", "Total freshwater withdrawn", "Kiloliters", E, DEC, True, True, "water", AGG_SUM),
        ("p6_ground", "of which groundwater", "Kiloliters", E, DEC, False, True, "water", AGG_SUM),
        ("p6_third", "of which third-party (municipal / tanker)", "Kiloliters", E, DEC, False, True, "water", AGG_SUM),
        ("p6_surface", "of which surface water (canals / rivers)", "Kiloliters", E, DEC, False, True, "water", AGG_SUM),
        ("p6_disch", "Water discharged", "Kiloliters", E, DEC, False, True, "water", AGG_SUM),
        ("p6_rainwater", "Rainwater harvested & recharged to aquifer", "Kiloliters", E, DEC, False, True, None, AGG_SUM),
        ("p6_etp_effluent", "Effluent treated in ETP / STP", "Kiloliters", E, DEC, False, True, None, AGG_SUM),
        ("p6_haz", "Hazardous waste generated", "Metric Tons", E, DEC, True, True, "circ", AGG_SUM),
        ("p6_nonhaz", "Non-hazardous waste generated (C&D, general)", "Metric Tons", E, DEC, True, True, "circ", AGG_SUM),
        ("p6_recyc", "Waste recycled / reused / recovered", "Metric Tons", E, DEC, False, True, "circ", AGG_SUM),
        ("p6_disp", "Waste disposed (landfill / incineration)", "Metric Tons", E, DEC, False, True, "circ", AGG_SUM),
        ("p6_plastic", "Plastic waste generated", "Metric Tons", E, DEC, False, True, "circ", AGG_SUM),
        ("p6_ewaste", "E-waste generated", "Metric Tons", E, DEC, False, True, "circ", AGG_SUM),
        ("p6_battery_waste", "Used lead-acid & industrial batteries disposed", "Count", E, DEC, False, True, "circ", AGG_SUM),
        ("p6_biomed", "Bio-medical / first-aid clinic waste", "Kilograms", E, DEC, False, True, None, AGG_SUM),
        ("p6_flyash", "Fly ash / GGBS utilized in concrete & backfilling", "Metric Tons", E, DEC, False, True, "circ", AGG_SUM),
        ("p6_topsoil", "Topsoil preserved & stockpiled for rehabilitation", "Cubic Meters", E, DEC, False, True, None, AGG_SUM),
        ("p6_cd_debris", "C&D concrete rubble crushed & repurposed on-site", "Metric Tons", E, DEC, False, True, "circ", AGG_SUM),
        ("p6_incident", "Environmental incidents / chemical spills", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p6_recw", "Water recycled or reused on site", "Kiloliters", L, DEC, False, True, None, AGG_SUM),
        ("p6_s3", "Scope 3 emissions (site-assessed value chain)", "tCO2e", L, DEC, False, True, None, AGG_SUM),
        ("p6_green", "Saplings planted / compensatory afforestation", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p6_tree_survival", "Tree sapling survival rate", "%", L, DEC, False, True, None, AGG_SUM),
        ("p6_nox", "NOx emissions from stacks / heavy equipment", "Metric Tons", L, DEC, False, True, None, AGG_SUM),
        ("p6_pm10", "Ambient Air PM10 average monitoring", "µg/m³", L, DEC, False, True, None, AGG_SUM),
        ("p6_pm25", "Ambient Air PM2.5 average monitoring", "µg/m³", L, DEC, False, True, None, AGG_SUM),
        ("p6_noise_day", "Daytime ambient noise level monitoring", "dB(A)", L, DEC, False, True, None, AGG_SUM),
        ("p6_noise_night", "Nighttime ambient noise level monitoring", "dB(A)", L, DEC, False, True, None, AGG_SUM),
    ]),
    ("P7", "Responsible Public Policy", "G", [16, 17], [
        ("p7_assoc", "Active trade / industry association memberships", "Count", E, DEC, False, True, None, AGG_END_OF_PERIOD),
        ("p7_anti", "Corrective actions on anti-competitive conduct", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p7_consult", "National & state infrastructure policy consultative responses", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p7_adv", "Public-policy positions advocated", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p7_green_council", "Clean energy & green construction council working groups", "Count", L, DEC, False, True, None, AGG_SUM),
    ]),
    ("P8", "Inclusive Growth", "S", [1, 8, 10, 11], [
        ("p8_sia", "Social impact assessments conducted", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p8_rr", "Project-affected families rehabilitated (R&R)", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p8_csr", "CSR spend", "INR", E, DEC, False, True, None, AGG_SUM),
        ("p8_ben", "CSR beneficiaries", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p8_proc", "Total procurement", "INR", E, DEC, True, True, "inclusive", AGG_SUM),
        ("p8_msme", "Direct procurement from MSMEs / small producers", "INR", E, DEC, True, True, "inclusive", AGG_SUM),
        ("p8_india", "Direct procurement sourced within India", "INR", E, DEC, False, True, "inclusive", AGG_SUM),
        ("p8_local", "Procurement from within state / district", "INR", E, DEC, False, True, None, AGG_SUM),
        ("p8_jobsw", "Wages paid to workers in smaller / aspirational towns", "INR", E, DEC, False, True, "inclusive", AGG_SUM),
        ("p8_skill_prog", "Local youth vocational & skill training programmes", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p8_water_infra", "Community drinking water / sanitation facilities built", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p8_health_infra", "Free medical checkup camps organized in project vicinity", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p8_education", "Local government schools / learning centres supported", "Count", L, DEC, False, True, None, AGG_SUM),
    ]),
    ("P9", "Client & Consumer Value", "G", [12, 16], [
        ("p9_comp", "Client / customer complaints received", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p9_res", "Client / customer complaints resolved", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p9_priv", "Data-privacy complaints", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p9_cyber", "Cyber-security incidents", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p9_recall", "Product / service recalls or major rework notices", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p9_advert", "Advertising / marketing complaints", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p9_trade", "Restrictive / unfair trade-practice complaints", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p9_quality_tests", "Concrete compression & quality durability tests passed", "%", E, DEC, False, True, None, AGG_SUM),
        ("p9_safety_ratings", "Authority engineer safety compliance inspection rating", "Count", E, DEC, False, True, None, AGG_SUM),
        ("p9_survey", "Client satisfaction surveys conducted", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p9_esg", "Responsible-delivery / ESG disclosures issued to clients", "Count", L, DEC, False, True, None, AGG_SUM),
        ("p9_green_rating", "Green building / IGBC / GRIHA certification audits passed", "Count", L, DEC, False, True, None, AGG_SUM),
    ]),
]

VENDOR_FIELDS = [
    ("v_turnover", "Total annual revenue", "₹ Cr", True, False),
    ("v_meil", "Revenue from MEIL Group", "₹ Cr", True, False),
    ("v_elec", "Grid electricity consumed", "kWh", True, True),
    ("v_diesel", "Diesel consumed", "Liters", True, True),
    ("v_water", "Water withdrawn", "Kiloliters", False, True),
    ("v_waste", "Waste generated", "Metric Tons", False, False),
    ("v_emp", "Own employees", "Personnel", True, False),
    ("v_contract", "Contract workers", "Personnel", False, False),
    ("v_manhrs", "Man-hours worked", "Hours", True, True),
    ("v_lti", "Lost-time injuries", "Count", True, True),
    ("v_fat", "Fatalities", "Count", True, False),
    ("v_belowmin", "Workers paid below minimum wage", "Count", True, False),
]


def run():
    fw = BrsrFrameworkVersion.query.filter_by(version="2024.1").first()
    if fw is None:
        fw = BrsrFrameworkVersion(version="2024.1", effective_from=date(2024, 7, 1),
                                   description="BRSR Core industry standards (Dec 2024) baseline", status="ACTIVE")
        db.session.add(fw)
        db.session.flush()

    sections = {}
    for code, name, seq in (("A", "General Disclosures", 1), ("B", "Management & Process", 2), ("C", "Principle-wise Performance", 3)):
        s = BrsrSection.query.filter_by(framework_version_id=fw.id, code=code).first()
        if s is None:
            s = BrsrSection(framework_version_id=fw.id, code=code, name=name, sequence=seq)
            db.session.add(s)
            db.session.flush()
        sections[code] = s

    for sdg_id, name in SDGS.items():
        if Sdg.query.get(sdg_id) is None:
            db.session.add(Sdg(id=sdg_id, name=name))

    for attr_id, label, entity_level in CORE_ATTRS:
        if BrsrCoreAttribute.query.get(attr_id) is None:
            db.session.add(BrsrCoreAttribute(id=attr_id, label=label, entity_level=entity_level,
                                              sequence=[c[0] for c in CORE_ATTRS].index(attr_id)))
    db.session.flush()

    for seq, (code, label, pillar, sdg_ids, indicators) in enumerate(PRINCIPLES):
        principle = BrsrPrinciple.query.filter_by(section_id=sections["C"].id, code=code).first()
        if principle is None:
            principle = BrsrPrinciple(section_id=sections["C"].id, code=code, label=label, pillar=pillar, sequence=seq)
            db.session.add(principle)
            db.session.flush()
        for sdg_id in sdg_ids:
            if not PrincipleSdgMapping.query.filter_by(principle_id=principle.id, sdg_id=sdg_id).first():
                db.session.add(PrincipleSdgMapping(principle_id=principle.id, sdg_id=sdg_id))

        for ind_code, ind_label, unit, tier, dtype, required, ev_required, core, agg in indicators:
            existing = BrsrIndicator.query.filter_by(indicator_code=ind_code).first()
            if existing:
                continue
            db.session.add(BrsrIndicator(
                principle_id=principle.id, indicator_code=ind_code, label=ind_label, unit=unit,
                tier=tier, data_type=dtype, required=required, evidence_required=ev_required,
                core_attribute_id=core, aggregation_method=agg, frequency="MONTHLY",
            ))

    db.session.commit()
    print(f"Seeded BRSR framework {fw.version}: {len(PRINCIPLES)} principles, "
          f"{sum(len(p[4]) for p in PRINCIPLES)} indicators, {len(CORE_ATTRS)} Core attributes, {len(SDGS)} SDGs.")
    return fw
