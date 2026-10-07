"""
These are the same illustrative constants the frontend shipped with — moved here so there is
exactly one Python-side default, used to (a) seed the `emission_factors` DB table on first run,
and (b) as a fallback if a factor lookup misses. The *authoritative* values for a real deployment
belong in the `emission_factors` table (see models/emission.py), approved and versioned by the
Group ESG team — never hard-coded in application code permanently (critique §14).
"""
DEFAULT_EF = {
    "dieselKgPerL": 2.68,
    "petrolKgPerL": 2.31,
    "gridKgPerKWh": 0.71,
}

DEFAULT_ENERGY_GJ = {
    "kWh": 0.0036,
    "dieselL": 0.0359,
    "petrolL": 0.0322,
}
