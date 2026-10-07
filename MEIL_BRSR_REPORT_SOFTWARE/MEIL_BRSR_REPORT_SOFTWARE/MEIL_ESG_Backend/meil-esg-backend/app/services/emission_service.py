"""
Scope 1 and 2 are simple activity x factor lookups against the live `emission_factors` table
(never the hard-coded constant — that constant now only seeds this table's first rows, see
emission_factors_default.py). Scope 3 from vendors is computed per-vendor and explicitly
labelled an internal allocation estimate, per Scope3Methodology.
"""
from datetime import date
from app.models.emission import EmissionFactor, Scope3Methodology
from app.services.formulas import vendor_emissions, vendor_share
from app.services.emission_factors_default import DEFAULT_EF


def active_factor(activity_type, on_date=None):
    on_date = on_date or date.today()
    return (
        EmissionFactor.query
        .filter(EmissionFactor.activity_type == activity_type)
        .filter(EmissionFactor.valid_from <= on_date)
        .filter((EmissionFactor.valid_to.is_(None)) | (EmissionFactor.valid_to >= on_date))
        .order_by(EmissionFactor.valid_from.desc())
        .first()
    )


def factor_set_for(organization_id=None):
    """Builds the {dieselKgPerL, petrolKgPerL, gridKgPerKWh} dict formulas.py expects, from the
    live DB table, falling back to the illustrative defaults for anything not yet configured —
    so a brand-new deployment still produces numbers, but every number a Group Admin has set
    overrides the fallback transparently."""
    mapping = {"DIESEL_L": "dieselKgPerL", "PETROL_L": "petrolKgPerL", "GRID_KWH": "gridKgPerKWh"}
    out = dict(DEFAULT_EF)
    for activity_type, key in mapping.items():
        f = active_factor(activity_type)
        if f:
            out[key] = float(f.factor_value)
    return out


def get_scope3_methodology(organization_id):
    row = Scope3Methodology.query.filter_by(organization_id=organization_id, is_active=True).first()
    if row is None:
        return {"applicability": "VOLUNTARY_TOP250", "allocationMethod": "REVENUE_SHARE",
                "methodologyNote": "Vendor Scope 1+2 emissions allocated to MEIL in proportion to "
                                    "(revenue from MEIL ÷ vendor total revenue). Internal estimate, "
                                    "not a prescribed SEBI calculation rule."}
    return row.to_dict()


def allocate_vendor_scope3(vendor_values: dict, organization_id=None) -> float:
    ef = factor_set_for(organization_id)
    return vendor_emissions(vendor_values, ef) * vendor_share(vendor_values)
