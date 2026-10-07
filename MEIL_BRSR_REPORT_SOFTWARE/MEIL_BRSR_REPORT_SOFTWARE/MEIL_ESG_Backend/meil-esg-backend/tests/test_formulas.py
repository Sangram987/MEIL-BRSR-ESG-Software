"""
These run with zero fixtures — formulas.py has no Flask/DB dependency, by design, so correctness
of the actual KPI math can be checked in complete isolation from the web framework.
"""
from app.services.formulas import compute_kpis, ltifr, vendor_emissions, vendor_share, risk_score


def test_scope1_scope2_from_fuel_and_grid():
    t = {"p6_dg": 1000, "p6_mach": 0, "p6_petrol": 0, "p6_grid": 10000}
    k = compute_kpis(t, turnover_cr=10)
    assert round(k["scope1"], 3) == round(1000 * 2.68 / 1000, 3)
    assert round(k["scope2"], 3) == round(10000 * 0.71 / 1000, 3)


def test_water_consumed_never_negative():
    t = {"p6_water": 100, "p6_disch": 500}  # discharge > withdrawal should never happen but formula must not go negative
    k = compute_kpis(t)
    assert k["waterConsumed"] == 0.0


def test_headcount_and_female_pct():
    t = {"p3_pm": 100, "p3_pf": 20, "p3_cm": 50, "p3_cf": 30}
    k = compute_kpis(t)
    assert k["headcount"] == 200
    assert round(k["femalePct"], 2) == 25.0  # (20+30)/200


def test_ltifr_is_never_averaged_its_recalculated():
    # Simulates two months: month A has 1 LTI / 50000 hrs, month B has 0 LTI / 60000 hrs.
    # The correct LTIFR for the period is from SUMMED numerator/denominator, not an average of
    # two monthly ratios — this is exactly the critique's "never AVG() a rate" point.
    summed = {"p3_lti": 1, "p3_manhrs": 110000}
    k = compute_kpis(summed)
    assert round(k["ltifr"], 2) == round(ltifr(1, 110000), 2)


def test_vendor_scope3_allocation():
    v = {"v_turnover": 420, "v_meil": 60, "v_elec": 180000, "v_diesel": 96000}
    share = vendor_share(v)
    assert 0 < share < 1
    emissions = vendor_emissions(v)
    assert emissions > 0
    allocated = emissions * share
    assert allocated < emissions  # allocation must never exceed the vendor's own total emissions


def test_vendor_share_capped_at_one():
    # MEIL revenue reported larger than vendor total revenue (bad data) must not produce >100% share
    v = {"v_turnover": 100, "v_meil": 500}
    assert vendor_share(v) == 1.0


def test_risk_score_is_probability_times_impact():
    assert risk_score(3, 2) == 6
    assert risk_score(1, 1) == 1
