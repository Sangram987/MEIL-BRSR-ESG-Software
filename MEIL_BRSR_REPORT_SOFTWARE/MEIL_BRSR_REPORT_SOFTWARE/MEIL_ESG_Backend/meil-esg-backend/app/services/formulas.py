"""
Pure functions only: no Flask, no SQLAlchemy, no request context. This is deliberate — it means
every formula here can be unit-tested in isolation (see tests/test_formulas.py) and reused from
services/consolidation_service.py, services/emission_service.py, Celery tasks, and the report
engine without any of them importing a web framework.

Ported 1:1 from the frontend's src/lib/consolidate.js `kpis()` so a number computed by the API
matches what the React app showed in the browser during development — same formulas, same
rounding behaviour, just the single source of truth now instead of two.

`t` is a dict of {indicator_code: summed_value_for_the_period} — i.e. the output of
consolidation_service.aggregate(), not raw per-month rows.
"""
from app.services.emission_factors_default import DEFAULT_EF, DEFAULT_ENERGY_GJ


def _div(a, b):
    return (a / b) if b else 0.0


def compute_kpis(t: dict, turnover_cr: float = 0.0, ef: dict = None, energy_gj: dict = None) -> dict:
    ef = ef or DEFAULT_EF
    energy_gj = energy_gj or DEFAULT_ENERGY_GJ
    g = lambda k: float(t.get(k, 0) or 0)  # noqa: E731

    scope1 = ((g("p6_dg") + g("p6_mach")) * ef["dieselKgPerL"] + g("p6_petrol") * ef["petrolKgPerL"]) / 1000.0
    scope2 = (g("p6_grid") * ef["gridKgPerKWh"]) / 1000.0
    scope3 = g("p6_s3")
    ghg = scope1 + scope2

    energy = (
        (g("p6_grid") + g("p6_renew")) * energy_gj["kWh"]
        + (g("p6_dg") + g("p6_mach")) * energy_gj["dieselL"]
        + g("p6_petrol") * energy_gj["petrolL"]
    )
    renew_gj = g("p6_renew") * energy_gj["kWh"]
    renewable_pct = _div(renew_gj, energy) * 100

    water_withdrawn = g("p6_water")
    water_discharged = g("p6_disch")
    water_consumed = max(0.0, water_withdrawn - water_discharged)

    waste = g("p6_haz") + g("p6_nonhaz")
    waste_recovered_pct = _div(g("p6_recyc"), waste) * 100

    headcount = g("p3_pm") + g("p3_pf") + g("p3_cm") + g("p3_cf")
    permanent = g("p3_pm") + g("p3_pf")
    contract = g("p3_cm") + g("p3_cf")
    female_pct = _div(g("p3_pf") + g("p3_cf"), headcount) * 100

    ltifr = _div(g("p3_lti") * 1_000_000, g("p3_manhrs"))
    safety_spend_pct = _div(g("p3_wellbeing"), turnover_cr * 1e7) * 100
    female_wage_pct = _div(g("p3_wagesf"), g("p3_wages")) * 100

    msme_pct = _div(g("p8_msme"), g("p8_proc")) * 100

    return {
        "scope1": scope1, "scope2": scope2, "scope3": scope3, "ghg": ghg,
        "energyGJ": energy, "renewablePct": renewable_pct,
        "waterWithdrawn": water_withdrawn, "waterConsumed": water_consumed, "waterDischarged": water_discharged,
        "waste": waste, "wasteRecoveredPct": waste_recovered_pct,
        "headcount": headcount, "permanent": permanent, "contract": contract, "femalePct": female_pct,
        "ltifr": ltifr, "fatalities": g("p3_fat"), "injuries": g("p3_rec"),
        "safetySpendPct": safety_spend_pct, "femaleWagePct": female_wage_pct, "msmePct": msme_pct,
        "trainedPct": min(100.0, _div(g("p3_hstrain"), headcount) * 100),
        "ghgIntensity": _div(ghg, turnover_cr), "waterIntensity": _div(water_withdrawn, turnover_cr),
        "energyIntensity": _div(energy, turnover_cr), "wasteIntensity": _div(waste, turnover_cr),
        "csr": g("p8_csr"), "complaints": g("p1_corr") + g("p5_child") + g("p5_forced") + g("p5_posh") + g("p5_disc"),
    }


def ltifr(lti: float, man_hours: float) -> float:
    """Standalone formula also used by risk rules and tests — recordable-injury-frequency-rate
    style ratio: NEVER averaged across months, always recomputed from summed numerator/denominator
    (critique §31/§38's point about turnover rate / LTIFR / female % not being AVG()-able)."""
    return _div(lti * 1_000_000, man_hours)


def turnover_rate(separations: float, avg_headcount: float) -> float:
    return _div(separations, avg_headcount) * 100


def vendor_emissions(v: dict, ef: dict = None) -> float:
    ef = ef or DEFAULT_EF
    elec = float(v.get("v_elec", 0) or 0)
    diesel = float(v.get("v_diesel", 0) or 0)
    return (elec * ef["gridKgPerKWh"] + diesel * ef["dieselKgPerL"]) / 1000.0


def vendor_share(v: dict) -> float:
    turnover = float(v.get("v_turnover", 0) or 0)
    meil = float(v.get("v_meil", 0) or 0)
    return min(1.0, meil / turnover) if turnover > 0 else 0.0


def risk_score(probability: int, impact: int) -> int:
    return int(probability) * int(impact)
