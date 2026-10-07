from app.models.base import CodeSequence
from app.services.emission_service import allocate_vendor_scope3


def next_request_code():
    return f"VR-{CodeSequence.next('vendor_request', start=2100)}"


def summarize_accepted(requests, organization_id=None):
    """requests: list[VendorRequest] already filtered to status=ACCEPTED."""
    total = 0.0
    for r in requests:
        values = {v.field_code: float(v.numeric_value) for v in r.values if v.numeric_value is not None}
        total += allocate_vendor_scope3(values, organization_id)
    return {"acceptedVendors": len(requests), "scope3Allocated": total}
