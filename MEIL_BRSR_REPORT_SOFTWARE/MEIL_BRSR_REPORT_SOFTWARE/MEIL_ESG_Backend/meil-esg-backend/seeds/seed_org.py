"""
Deterministic generator — same seed every run, same shape as the frontend's buildOrg(): 5
subsidiaries -> 10 business units -> 250 projects, with a handful of named flagship projects and
the rest auto-named "<State> – <project type> <n>". Re-running seeds/run_seed.py is idempotent:
existing rows (matched by code) are left alone.
"""
from datetime import date
from app.extensions import db
from app.models.organization import Organization, OrganizationRelationship, BusinessUnit, Project
from app.models.period import ReportingPeriod

STATES = [
    ("Telangana", 17.9, 79.6), ("Andhra Pradesh", 16.0, 80.0), ("Maharashtra", 19.7, 75.7), ("Gujarat", 22.3, 71.7),
    ("Rajasthan", 26.5, 73.8), ("Madhya Pradesh", 23.5, 78.5), ("Uttar Pradesh", 26.8, 80.9), ("Karnataka", 14.6, 75.7),
    ("Tamil Nadu", 11.1, 78.6), ("Odisha", 20.5, 84.4), ("Jammu & Kashmir", 33.9, 75.0), ("Uttarakhand", 30.1, 79.3),
    ("Himachal Pradesh", 31.9, 77.2), ("Assam", 26.4, 92.9), ("Bihar", 25.6, 85.6), ("West Bengal", 23.0, 87.9),
    ("Chhattisgarh", 21.3, 81.8), ("Punjab", 31.0, 75.3),
]
OVERSEAS = [("Mongolia", 47.9, 106.9), ("Bhutan", 27.4, 90.4), ("Kenya", -0.5, 37.5)]

SUBS = [
    ("sub-infra", "MEIL Infrastructure & Utilities", "PARENT", 100),
    ("sub-hydro", "MEIL Hydrocarbons & Energy", "PARENT", 100),
    ("sub-power", "MEIL Power & Renewables", "SUBSIDIARY", 100),
    ("sub-mob", "MEIL Mobility & Manufacturing", "SUBSIDIARY", 76),
    ("sub-intl", "MEIL International (Overseas)", "JOINT_VENTURE", 51),
]
BUS = [
    ("bu-water", "sub-infra", "Water & Irrigation Division", 55, ["Lift Irrigation Scheme", "Canal Package", "Reservoir Works", "Pump House Complex", "Drinking Water Grid"]),
    ("bu-tunnel", "sub-infra", "Tunnels & Transit Division", 35, ["Twin-Tube Tunnel", "Metro Underground Section", "Rail Tunnel Package", "Highway Tunnel"]),
    ("bu-road", "sub-infra", "Roads & Bridges Division", 40, ["Highway Widening", "Expressway Package", "Bridge & Flyover", "Bypass Corridor"]),
    ("bu-refine", "sub-hydro", "Refinery EPC Unit", 12, ["Refinery Unit Package", "Process Plant Block"]),
    ("bu-pipe", "sub-hydro", "Pipelines & Gas Distribution", 30, ["Gas Pipeline Spread", "City Gas Distribution Zone", "CNG Station Cluster"]),
    ("bu-thermal", "sub-power", "Thermal & Hydro Power", 20, ["Thermal Balance-of-Plant", "Hydro Powerhouse Package"]),
    ("bu-solar", "sub-power", "Solar & Green Energy", 28, ["Solar Park Block", "Wind-Solar Hybrid Site", "Transmission Line Package"]),
    ("bu-ev", "sub-mob", "EV & Bus Manufacturing", 8, ["Bus Assembly Line", "Battery Pack Unit"]),
    ("bu-ind", "sub-mob", "Industrial Systems", 12, ["Plant Automation Package", "Fabrication Yard"]),
    ("bu-intl", "sub-intl", "Overseas Infrastructure", 10, ["Overseas Civil Package", "Overseas Plant Package"]),
]
NAMED = {
    "bu-water": [("Kaleshwaram Lift Irrigation", "Telangana", 18.81, 79.82), ("Polavaram Headworks", "Andhra Pradesh", 17.25, 81.65), ("Sitarama Lift Canal", "Telangana", 17.3, 80.6)],
    "bu-tunnel": [("Zojila Tunnel Package 1", "Jammu & Kashmir", 34.27, 75.45), ("Char Dham Railway Tunnel", "Uttarakhand", 30.3, 78.5)],
    "bu-refine": [("Mongolia Refinery Project Site", "Mongolia", 47.9, 106.9), ("Barmer Field Processing Station", "Rajasthan", 25.75, 71.38)],
}


class Rng:
    """Tiny deterministic PRNG (mulberry32 port) so project coordinates/names are reproducible
    across backend runs without needing numpy — matches the spirit of the frontend's seed."""
    def __init__(self, seed):
        self.a = seed & 0xFFFFFFFF

    def next(self):
        self.a = (self.a + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.a
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


def run():
    rng = Rng(20260928)
    group = Organization.query.filter_by(code="MEIL").first()
    if group is None:
        group = Organization(code="MEIL", name="Megha Engineering & Infrastructures Limited", type="GROUP")
        db.session.add(group)
        db.session.flush()

    sub_rows = {}
    for code, name, relation, ownership in SUBS:
        org = Organization.query.filter_by(code=code).first()
        if org is None:
            org = Organization(code=code, name=name, type=relation if relation != "PARENT" else "SUBSIDIARY", parent_id=group.id)
            db.session.add(org)
            db.session.flush()
            db.session.add(OrganizationRelationship(parent_org_id=group.id, child_org_id=org.id,
                                                      relationship_type=relation, ownership_percentage=ownership,
                                                      effective_from=date(2020, 4, 1)))
        sub_rows[code] = org

    bu_rows = {}
    for code, sub_code, name, n, types in BUS:
        bu = BusinessUnit.query.filter_by(code=code).first()
        if bu is None:
            bu = BusinessUnit(code=code, name=name, organization_id=sub_rows[sub_code].id)
            db.session.add(bu)
            db.session.flush()
        bu_rows[code] = bu

    project_count = Project.query.count()
    if project_count >= 200:
        print(f"Organization already seeded ({project_count} projects) — skipping project generation.")
        db.session.commit()
        return group

    seq = 1
    for code, sub_code, name, n, types in BUS:
        bu = bu_rows[code]
        rows = list(NAMED.get(code, []))
        k = 1
        overseas = code == "bu-intl"
        pool = OVERSEAS if overseas else STATES
        while len(rows) < n:
            state, lat, lng = pool[int(rng.next() * len(pool))]
            ptype = types[int(rng.next() * len(types))]
            jitter_lat = lat + (rng.next() - 0.5) * 2.2
            jitter_lng = lng + (rng.next() - 0.5) * 2.2
            rows.append((f"{state} – {ptype} {k}", state, jitter_lat, jitter_lng))
            k += 1
        for name_, state, lat, lng in rows:
            scale = 0.35 + rng.next() * 2.4
            country = next((o[0] for o in OVERSEAS if o[0] == state), "India")
            db.session.add(Project(
                project_code=f"PRJ-{seq:03d}", name=name_, business_unit_id=bu.id, state=state, country=country,
                latitude=round(lat, 3), longitude=round(lng, 3), turnover_cr=round(90 * scale, 1),
                is_live=(code == "bu-tunnel" and seq <= 5), status="ACTIVE",
            ))
            seq += 1

    db.session.commit()
    print(f"Seeded organization: 1 group, {len(SUBS)} subsidiaries, {len(BUS)} business units, {seq - 1} projects.")
    return group


def seed_reporting_periods():
    import calendar
    created = 0
    for fy_start in (2024, 2025, 2026):
        fy_label = f"FY {fy_start}-{str(fy_start + 1)[2:]}"
        fy_row = ReportingPeriod.query.filter_by(financial_year=fy_label, period_type="FINANCIAL_YEAR").first()
        if fy_row is None:
            fy_row = ReportingPeriod(
                financial_year=fy_label, period_type="FINANCIAL_YEAR", name=fy_label,
                start_date=date(fy_start, 4, 1), end_date=date(fy_start + 1, 3, 31),
                status="OPEN" if fy_start == 2026 else "CLOSED", is_current=(fy_start == 2026),
            )
            db.session.add(fy_row)
            db.session.flush()
            created += 1
        for i in range(12):
            month = (3 + i) % 12 + 1
            year = fy_start + (1 if 3 + i >= 12 else 0)
            name = f"{year}-{month:02d}"
            if ReportingPeriod.query.filter_by(name=name, period_type="MONTH").first():
                continue
            last_day = calendar.monthrange(year, month)[1]
            is_current = (fy_start == 2026 and name == "2026-09")
            db.session.add(ReportingPeriod(
                financial_year=fy_label, period_type="MONTH", name=name,
                start_date=date(year, month, 1), end_date=date(year, month, last_day),
                status="OPEN" if is_current else ("CLOSED" if name < "2026-09" else "OPEN"),
                is_current=is_current, parent_id=fy_row.id,
            ))
            created += 1
    db.session.commit()
    print(f"Seeded {created} reporting periods (FY 2024-25 .. FY 2026-27).")
