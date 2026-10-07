from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.models.vendor import Vendor, VendorRequest, VendorValue, VendorReview, VENDOR_REQUEST_REQUESTED, VENDOR_REQUEST_SUBMITTED, VENDOR_REQUEST_CORRECTION_REQUIRED, VENDOR_REQUEST_ACCEPTED
from app.models.emission import Scope3Methodology
from app.schemas.vendor_risk_assessment import VendorRequestCreateSchema, VendorSubmitSchema, VendorReviewSchema
from app.security.decorators import roles_required, authenticated, vendor_scope_required
from app.security.permissions import user_can_access_vendor
from app.services import vendor_service, notification_service, emission_service
from app.utils.errors import ApiError
from app.utils.audit import record

bp = Blueprint("vendors", __name__)


@bp.get("/vendors")
@authenticated
def list_vendors():
    return jsonify([v.to_dict() for v in Vendor.query.order_by(Vendor.legal_name).all()])


@bp.post("/vendors")
@roles_required("GROUP_ADMIN", "ESG_MANAGER")
def create_vendor():
    body = request.get_json(force=True) or {}
    if not body.get("name"):
        raise ApiError("name is required.", 422)
    from app.models.base import CodeSequence
    vendor = Vendor(vendor_code=f"V-{CodeSequence.next('vendor', start=100)}", legal_name=body["name"],
                     category=body.get("category"), email=body.get("email"), phone=body.get("phone"))
    db.session.add(vendor)
    record("VENDOR_ADDED", "Vendor", vendor.vendor_code, details=body["name"])
    db.session.commit()
    return jsonify(vendor.to_dict()), 201


@bp.get("/vendors/<vendor_id>")
@authenticated
@vendor_scope_required(("vendor_id",))
def get_vendor(vendor_id):
    return jsonify(Vendor.query.get_or_404(vendor_id).to_dict())


@bp.get("/vendor-requests")
@authenticated
def list_vendor_requests():
    user = g.current_user
    q = VendorRequest.query
    vendor_id = request.args.get("vendorId")
    if vendor_id:
        if not user_can_access_vendor(user, vendor_id):
            raise ApiError("You do not have access to this vendor.", 403)
        q = q.filter_by(vendor_id=vendor_id)
    elif user.has_role("VENDOR_USER"):
        allowed = user.scope_ids("VENDOR")
        q = q.filter(VendorRequest.vendor_id.in_(allowed or ["__none__"]))
    status = request.args.get("status")
    if status:
        q = q.filter_by(status=status.upper())
    rows = q.order_by(VendorRequest.created_at.desc()).all()
    return jsonify([r.to_dict(include_values=True) for r in rows])


@bp.post("/vendor-requests")
@roles_required("GROUP_ADMIN", "ESG_MANAGER")
def create_vendor_requests():
    data = VendorRequestCreateSchema().load(request.get_json(force=True) or {})
    created = []
    for vendor_id in data["vendorIds"]:
        vendor = Vendor.query.get(vendor_id)
        if vendor is None:
            continue
        req = VendorRequest(
            request_code=vendor_service.next_request_code(), vendor_id=vendor_id,
            reporting_period_id=data["reportingPeriodId"], requester_id=g.current_user.id,
            due_date=data["dueDate"], message=data["message"], status=VENDOR_REQUEST_REQUESTED,
        )
        db.session.add(req)
        created.append(req)
    db.session.flush()
    for req in created:
        notification_service.notify_vendor_users(
            req.vendor_id, "VENDOR_REQUEST", f"MEIL requested your ESG data. Due {req.due_date}.", link="/vendor/submit",
        )
        record("VENDOR_REQUEST", "VendorRequest", req.request_code, details=f"{req.vendor_id} due {req.due_date}")
    db.session.commit()
    return jsonify([r.to_dict() for r in created]), 201


@bp.post("/vendor-requests/<request_id>/submit")
@roles_required("VENDOR_USER")
def submit_vendor_request(request_id):
    req = VendorRequest.query.get_or_404(request_id)
    if not user_can_access_vendor(g.current_user, req.vendor_id):
        raise ApiError("You do not have access to this request.", 403)
    if req.status not in (VENDOR_REQUEST_REQUESTED, VENDOR_REQUEST_CORRECTION_REQUIRED):
        raise ApiError(f"This request is {req.status.lower()} and cannot be edited.", 409)
    data = VendorSubmitSchema().load(request.get_json(force=True) or {})

    existing = {v.field_code: v for v in req.values}
    for code, raw in data["values"].items():
        val = existing.get(code) or VendorValue(request_id=req.id, field_code=code)
        try:
            val.numeric_value = float(raw) if raw not in (None, "") else None
        except (TypeError, ValueError):
            val.numeric_value = None
        val.evidence_document_id = data["evidence"].get(code)
        db.session.add(val)

    req.status = VENDOR_REQUEST_SUBMITTED
    record("VENDOR_SUBMITTED", "VendorRequest", req.request_code)
    notification_service.notify_group_role("ASSESSMENT", f"Vendor submitted ESG data for {req.request_code}.",
                                            link="/auditor/vendors", roles=("ASSESSOR",))
    db.session.commit()
    return jsonify(req.to_dict(include_values=True))


@bp.post("/vendor-requests/<request_id>/review")
@roles_required("ASSESSOR", "GROUP_ADMIN", "ESG_MANAGER")
def review_vendor_request(request_id):
    req = VendorRequest.query.get_or_404(request_id)
    data = VendorReviewSchema().load(request.get_json(force=True) or {})
    if data["decision"] == "CORRECTION_REQUIRED" and not data["comment"].strip():
        raise ApiError("A comment is required when requesting a correction.", 422)
    req.status = VENDOR_REQUEST_ACCEPTED if data["decision"] == "ACCEPT" else VENDOR_REQUEST_CORRECTION_REQUIRED
    req.review_comment = data["comment"]
    db.session.add(VendorReview(request_id=req.id, reviewer_id=g.current_user.id,
                                 decision=data["decision"], comment=data["comment"]))
    record("VENDOR_" + data["decision"], "VendorRequest", req.request_code, details=data["comment"])
    notification_service.notify_vendor_users(
        req.vendor_id, "VENDOR_REQUEST",
        "Your ESG data was accepted." if data["decision"] == "ACCEPT" else f"Correction requested: {data['comment']}",
        link="/vendor/submit",
    )
    db.session.commit()
    return jsonify(req.to_dict())


@bp.get("/value-chain/config")
@authenticated
def get_value_chain_config():
    org_id = request.args.get("organizationId")
    return jsonify(emission_service.get_scope3_methodology(org_id))


@bp.put("/value-chain/config")
@roles_required("GROUP_ADMIN", "ESG_MANAGER")
def update_value_chain_config():
    body = request.get_json(force=True) or {}
    org_id = body.get("organizationId")
    row = Scope3Methodology.query.filter_by(organization_id=org_id, is_active=True).first()
    if row is None:
        row = Scope3Methodology(organization_id=org_id)
        db.session.add(row)
    for field, key in (("applicability", "applicability"), ("allocationMethod", "allocation_method"), ("methodologyNote", "methodology_note")):
        if field in body:
            setattr(row, key, body[field])
    record("VALUE_CHAIN_CONFIG_UPDATED", "Scope3Methodology", org_id or "default", details=str(body))
    db.session.commit()
    return jsonify(row.to_dict())


@bp.get("/value-chain/summary")
@authenticated
def value_chain_summary():
    org_id = request.args.get("organizationId")
    accepted = VendorRequest.query.filter_by(status=VENDOR_REQUEST_ACCEPTED).all()
    return jsonify(vendor_service.summarize_accepted(accepted, org_id))
