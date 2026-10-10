from flask import Blueprint, request, jsonify, g, send_file
import io

from app.models.base import CodeSequence
from app.models.brsr import BrsrCoreAttribute
from app.models.disclosure import EntityDisclosure
from app.models.assessment import AssessmentEngagement
from app.models.vendor import VendorRequest, VENDOR_REQUEST_ACCEPTED
from app.models.period import ReportingPeriod
from app.security.decorators import authenticated, roles_required
from app.services import consolidation_service, brsr_service, report_service, vendor_service, emission_service
from app.utils.errors import ApiError

bp = Blueprint("reports", __name__, url_prefix="/reports")


def _prev_fy(fy: str) -> str:
    if not fy:
        return "FY 2025-26"
    try:
        parts = str(fy).replace("FY", "").strip().split("-")
        start = int(parts[0])
        return f"FY {start - 1}-{str(start)[-2:]}"
    except (IndexError, ValueError, AttributeError):
        return "FY 2025-26"


def _resolve(scope_type, scope_id, period_id, boundary_mode, include_jv, package, include_value_chain, disclosure_type, organization_id, financial_year):
    from app.models.organization import Organization
    if organization_id in ("meil", "MEIL") or (organization_id and len(str(organization_id)) != 36):
        org = Organization.query.filter((Organization.code == organization_id) | (Organization.id == organization_id)).first()
        if org:
            organization_id = org.id
    if period_id and len(str(period_id)) != 36:
        rp = (ReportingPeriod.query.filter_by(financial_year=period_id, period_type="FINANCIAL_YEAR").first() or
              ReportingPeriod.query.filter_by(name=period_id).first() or
              ReportingPeriod.query.filter_by(financial_year=period_id).first())
        if rp:
            period_id = rp.id

    node = consolidation_service.node_totals(scope_type, scope_id, period_id, boundary_mode, include_jv)
    period = ReportingPeriod.query.get(period_id)
    fy = period.financial_year if period else (financial_year or "FY 2026-27")
    prev_fy = _prev_fy(fy)
    prev_period = ReportingPeriod.query.filter_by(financial_year=prev_fy, period_type="FINANCIAL_YEAR").first()
    prev_node = (consolidation_service.node_totals(scope_type, scope_id, prev_period.id, boundary_mode, include_jv)
                 if prev_period else {"totals": {}, "kpi": {}})

    ed = EntityDisclosure.query.filter_by(organization_id=organization_id, financial_year=fy).first()
    engagements = {e.core_attribute_id: e for e in AssessmentEngagement.query.filter_by(
        reporting_period_id=period_id, organization_id=organization_id).all()}
    core_snapshot = brsr_service.build_core_snapshot(node["kpi"], ed, engagements)

    vc_summary = None
    if include_value_chain:
        accepted = VendorRequest.query.filter_by(status=VENDOR_REQUEST_ACCEPTED).all()
        vc_summary = vendor_service.summarize_accepted(accepted, organization_id)
        vc_summary["methodologyNote"] = emission_service.get_scope3_methodology(organization_id)["methodologyNote"]

    return report_service.build_report_model(
        scope_label=scope_id or scope_type, boundary_label=f"{boundary_mode}{' + JV' if include_jv else ''}",
        package=package, include_value_chain=include_value_chain, disclosure_type=disclosure_type,
        fy=fy, prev_fy=prev_fy, totals=node["totals"], prev_totals=prev_node["totals"],
        kpi=node["kpi"], prev_kpi=prev_node["kpi"], entity_disclosure=ed, core_snapshot=core_snapshot,
        value_chain_summary=vc_summary, turnover_cr=node["turnoverCr"], projects=node["projects"],
        reporting_sites=node["reportingSites"],
    )


@bp.get("/readiness")
@authenticated
def readiness():
    from app.models.organization import Organization
    scope_type = request.args.get("scopeType", "GROUP").upper()
    scope_id = request.args.get("scopeId")
    period_id = request.args.get("reportingPeriodId")
    organization_id = request.args.get("organizationId")
    if organization_id in ("meil", "MEIL") or (organization_id and len(str(organization_id)) != 36):
        org = Organization.query.filter((Organization.code == organization_id) | (Organization.id == organization_id)).first()
        if org:
            organization_id = org.id
    if period_id and len(str(period_id)) != 36:
        rp = (ReportingPeriod.query.filter_by(financial_year=period_id, period_type="FINANCIAL_YEAR").first() or
              ReportingPeriod.query.filter_by(name=period_id).first() or
              ReportingPeriod.query.filter_by(financial_year=period_id).first())
        if rp:
            period_id = rp.id
    if not period_id or not organization_id:
        raise ApiError("reportingPeriodId and organizationId are required.", 422)
    period = ReportingPeriod.query.get(period_id)
    fy = period.financial_year if period else "FY 2026-27"
    ed = EntityDisclosure.query.filter_by(organization_id=organization_id, financial_year=fy).first()
    cov = consolidation_service.coverage(scope_type, scope_id, period_id)
    engagements = {e.core_attribute_id: e for e in AssessmentEngagement.query.filter_by(
        reporting_period_id=period_id, organization_id=organization_id).all()}
    core_ids = [a.id for a in BrsrCoreAttribute.query.all()]
    return jsonify(brsr_service.readiness(ed, cov, engagements, core_ids))


@bp.post("")
@roles_required("GROUP_ADMIN", "ESG_MANAGER", "ASSESSOR", "BU_MANAGER", "EXECUTIVE_VIEWER")
def generate_report():
    """Builds the model and renders every requested format synchronously and returns them
    inline as base64-free download tokens the UI can fetch immediately — this IS the Celery task
    body (tasks/reports.py calls the same _resolve()+render path); with
    CELERY_TASK_ALWAYS_EAGER=true (the default here) it simply runs in-request, so the demo needs
    no running worker, and swapping to a real queue later is a one-line config change."""
    body = request.get_json(force=True) or {}
    required = ("scopeType", "reportingPeriodId", "organizationId")
    if any(not body.get(f) for f in required):
        raise ApiError(f"{', '.join(required)} are required.", 422)

    from app.models.organization import Organization
    org_id = body["organizationId"]
    if org_id in ("meil", "MEIL") or (org_id and len(str(org_id)) != 36):
        org = Organization.query.filter((Organization.code == org_id) | (Organization.id == org_id)).first()
        if org:
            org_id = org.id
    period_id = body["reportingPeriodId"]
    if period_id and len(str(period_id)) != 36:
        rp = (ReportingPeriod.query.filter_by(financial_year=period_id, period_type="FINANCIAL_YEAR").first() or
              ReportingPeriod.query.filter_by(name=period_id).first() or
              ReportingPeriod.query.filter_by(financial_year=period_id).first())
        if rp:
            period_id = rp.id

    model = _resolve(
        scope_type=body["scopeType"].upper(), scope_id=body.get("scopeId"),
        period_id=period_id, boundary_mode=body.get("boundaryMode", "CONSOLIDATED").upper(),
        include_jv=bool(body.get("includeJv", False)), package=body.get("package", "COMPREHENSIVE").upper(),
        include_value_chain=bool(body.get("includeValueChain", True)),
        disclosure_type=body.get("disclosureType", "ASSURANCE").upper(),
        organization_id=org_id, financial_year=body.get("financialYear"),
    )

    formats = body.get("formats", ["PDF", "CSV", "JSON", "XML"])
    code = f"RPT-{CodeSequence.next('report', start=1000)}"
    files = {}

    from app.services.brsr_pdf_service import generate_company_brsr_pdf, build_audit_ready_zip
    from app.models.forensics import CapaRecord, TrustScore

    capas = [c.to_dict() for c in CapaRecord.query.order_by(CapaRecord.created_at.desc()).limit(10).all()]
    all_scores = [s.score for s in TrustScore.query.all()]
    avg_score = int(sum(all_scores) / len(all_scores)) if all_scores else None
    trust_summary = {"averageTrustScore": avg_score}

    # Generate company format BRSR PDF
    pdf_bytes = generate_company_brsr_pdf(model, trust_summary=trust_summary, capa_summary=capas)

    if "PDF" in formats:
        files["PDF"] = pdf_bytes
    if "XLSX" in formats:
        files["XLSX"] = report_service.to_xlsx(model)
    if "CSV" in formats:
        files["CSV"] = report_service.to_csv(model).encode("utf-8")
    if "JSON" in formats:
        files["JSON"] = report_service.to_json(model).encode("utf-8")
    if "XML" in formats:
        files["XML"] = report_service.to_xml(model).encode("utf-8")

    # Generate full audit-ready ZIP package
    zip_bytes = build_audit_ready_zip(code, pdf_bytes, model)
    files["ZIP"] = zip_bytes

    from app.services.storage_service import store_bytes, sha256_of
    from app.models.report import Report, ReportFile, REPORT_STATUS_READY
    from app.extensions import db

    report = Report(
        report_code=code, report_type="BRSR_DRAFT", organization_id=org_id,
        scope_type=body["scopeType"].upper(), scope_id=body.get("scopeId"), reporting_period_id=period_id,
        boundary_mode=body.get("boundaryMode", "CONSOLIDATED").upper(), include_jv=bool(body.get("includeJv", False)),
        package=body.get("package", "COMPREHENSIVE").upper(), include_value_chain=bool(body.get("includeValueChain", True)),
        disclosure_type=body.get("disclosureType", "ASSURANCE").upper(), status=REPORT_STATUS_READY,
        created_by_id=g.current_user.id,
    )
    db.session.add(report)
    db.session.flush()
    for fmt, data in files.items():
        key = f"reports/{report.id}/{fmt.lower()}"
        store_bytes(data, key)
        db.session.add(ReportFile(report_id=report.id, format=fmt, storage_key=key,
                                   filename=f"{code}.{fmt.lower()}", sha256=sha256_of(data)))
    db.session.commit()
    return jsonify(report.to_dict()), 201


@bp.get("/preview")
@authenticated
def preview_report():
    """Returns structured report preview payload without generating files."""
    scope_type = request.args.get("scopeType", "GROUP").upper()
    scope_id = request.args.get("scopeId")
    period_id = request.args.get("reportingPeriodId")
    org_id = request.args.get("organizationId", "meil")

    from app.models.organization import Organization
    if org_id in ("meil", "MEIL") or (org_id and len(str(org_id)) != 36):
        org = Organization.query.filter((Organization.code == org_id) | (Organization.id == org_id)).first()
        if org:
            org_id = org.id
    if period_id and len(str(period_id)) != 36:
        rp = (ReportingPeriod.query.filter_by(financial_year=period_id, period_type="FINANCIAL_YEAR").first() or
              ReportingPeriod.query.filter_by(name=period_id).first() or
              ReportingPeriod.query.filter_by(financial_year=period_id).first())
        if rp:
            period_id = rp.id

    model = _resolve(
        scope_type=scope_type, scope_id=scope_id, period_id=period_id,
        boundary_mode="CONSOLIDATED", include_jv=False, package="COMPREHENSIVE",
        include_value_chain=True, disclosure_type="ASSURANCE", organization_id=org_id,
        financial_year="FY 2026-27",
    )
    return jsonify(model)


@bp.get("")
@authenticated
def list_reports():
    from app.models.report import Report
    return jsonify([r.to_dict() for r in Report.query.order_by(Report.created_at.desc()).limit(50).all()])


@bp.get("/<report_id>")
@authenticated
def get_report(report_id):
    from app.models.report import Report
    return jsonify(Report.query.get_or_404(report_id).to_dict())


@bp.get("/<report_id>/download")
@authenticated
def download_report(report_id):
    from app.models.report import Report
    from app.services.storage_service import read_bytes
    report = Report.query.get_or_404(report_id)
    fmt = request.args.get("format", "PDF").upper()
    file_row = next((f for f in report.files if f.format == fmt), None)
    if file_row is None:
        raise ApiError(f"No {fmt} file was generated for this report.", 404)
    data = read_bytes(file_row.storage_key)
    mimetypes = {
        "PDF": "application/pdf",
        "XLSX": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "CSV": "text/csv",
        "JSON": "application/json",
        "XML": "application/xml",
        "ZIP": "application/zip",
    }
    return send_file(io.BytesIO(data), mimetype=mimetypes.get(fmt, "application/octet-stream"),
                      as_attachment=True, download_name=file_row.filename)


@bp.get("/<report_id>/package")
@authenticated
def download_package(report_id):
    """Direct route for downloading the audit-ready ZIP package."""
    from app.models.report import Report
    from app.services.storage_service import read_bytes
    report = Report.query.get_or_404(report_id)
    file_row = next((f for f in report.files if f.format == "ZIP"), None)
    if file_row is None:
        raise ApiError("No audit-ready ZIP package available for this report.", 404)
    data = read_bytes(file_row.storage_key)
    return send_file(io.BytesIO(data), mimetype="application/zip", as_attachment=True, download_name=file_row.filename)

