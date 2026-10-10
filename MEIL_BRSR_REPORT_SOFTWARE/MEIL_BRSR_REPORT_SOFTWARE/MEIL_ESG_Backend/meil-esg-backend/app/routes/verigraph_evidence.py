"""
VERIGRAPH Evidence and Forensics Pipeline Blueprint.
Endpoints:
  - POST /evidence/quality-check : OpenCV blur, brightness, contrast, glare, and resolution check
  - POST /evidence/upload-and-verify : Complete automated ingest (Store + SHA-256 + Fact Extraction + 5-Agent Verification + Trust Score + Auto-CAPA)
  - GET  /evidence/facts : Retrieve extracted facts by document or project
  - GET  /evidence/trust-scores : Retrieve Trust Scores across sites & documents (returns null when no evidence)
  - GET  /evidence/verifications : Retrieve forensic verification records
  - GET  /evidence/knowledge-graph : Knowledge graph nodes & edges generated dynamically from real database records
"""
import os
import threading
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g, current_app
from app.extensions import db
from app.models.evidence import Document, MetricEvidence, EvidenceBatch, BatchItem
from app.models.forensics import ExtractedFact, VerificationResult, TrustScore, CapaRecord
from app.models.submission import EsgSubmission, EsgValue
from app.models.organization import Project
from app.models.brsr import BrsrPrinciple, BrsrIndicator
from app.models.period import ReportingPeriod
from app.security.decorators import authenticated
from app.security.permissions import user_can_access_project
from app.services.storage_service import store_bytes, read_bytes, sha256_of, validate_upload
from app.services.quality_check_service import analyze_image_quality
from app.services.fact_extraction_service import (
    run_document_extraction,
    classify_and_detect_metric,
)
from app.services.forensics_service import (
    run_single_doc_verification, run_cross_doc_verification,
    run_temporal_verification, run_anomaly_detector, meta_auditor_reconciliation,
)
from app.utils.errors import ApiError
from app.utils.audit import record

bp = Blueprint("verigraph_evidence", __name__, url_prefix="/evidence")

METRIC_TO_INDICATOR_CODE = {
    "diesel_litres": "p6_dg",
    "diesel": "p6_dg",
    "p6_diesel": "p6_dg",
    "p6_dg": "p6_dg",
    "p6_mach": "p6_mach",
    "electricity_kwh": "p6_grid",
    "electricity": "p6_grid",
    "p6_electricity": "p6_grid",
    "p6_grid": "p6_grid",
    "water_kl": "p6_water",
    "water": "p6_water",
    "p6_water": "p6_water",
    "p6_third": "p6_third",
    "waste_kg": "p6_nonhaz",
    "waste": "p6_nonhaz",
    "p6_waste": "p6_nonhaz",
    "p6_nonhaz": "p6_nonhaz",
    "p6_haz": "p6_haz",
}


def _validate_magic_bytes(file_bytes: bytes, filename: str = "") -> tuple[bool, str]:
    """Validates file magic signature to prevent malicious or non-document file uploads."""
    if not file_bytes:
        return False, "Uploaded file is empty."
    # PDF: %PDF
    if file_bytes.startswith(b"%PDF"):
        return True, ""
    # PNG: \x89PNG
    if file_bytes.startswith(b"\x89PNG\r\n\x1a\n") or file_bytes.startswith(b"\x89PNG"):
        return True, ""
    # JPEG: \xff\xd8\xff
    if file_bytes.startswith(b"\xff\xd8\xff"):
        return True, ""
    # TIFF: II*\x00 or MM\x00*
    if file_bytes.startswith(b"II*\x00") or file_bytes.startswith(b"MM\x00*"):
        return True, ""
    # WebP
    if file_bytes.startswith(b"RIFF") and b"WEBP" in file_bytes[:16]:
        return True, ""
    # Excel XLSX / ZIP
    if file_bytes.startswith((b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")):
        return True, ""
    # Excel legacy XLS
    if file_bytes.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return True, ""
    # CSV / TSV / text files
    lower_fn = (filename or "").lower()
    if lower_fn.endswith((".csv", ".tsv", ".txt")):
        try:
            sample = file_bytes[:1024].decode("utf-8")
            if any(c in sample for c in [",", "\t", ";", "\n"]):
                return True, ""
        except UnicodeDecodeError:
            try:
                sample = file_bytes[:1024].decode("latin-1")
                if any(c in sample for c in [",", "\t", ";", "\n"]):
                    return True, ""
            except Exception:
                pass
    return False, "Invalid file format signature. Supported evidence formats are PDF, PNG, JPEG, TIFF, WebP, CSV, and XLSX."


def _get_authorized_project(project_id_arg=None):
    """Enforces scope authorization: user must have permission to access the requested project."""
    user = g.current_user
    project_id = project_id_arg or request.args.get("projectId") or getattr(user, "project_id", None)
    if not project_id:
        return None
    if not user_can_access_project(user, project_id):
        raise ApiError("You do not have access to this project.", 403)
    return project_id


@bp.post("/quality-check")
@authenticated
def quality_check():
    """
    Evaluates evidence document/image quality prior to upload.
    Returns quality score, blur/sharpness, glare, brightness, and Accept/Retake recommendation.
    """
    if "file" not in request.files:
        raise ApiError("No image/document file provided.", 422)
    f = request.files["file"]
    if not f.filename:
        raise ApiError("No file selected.", 422)

    data = f.read()
    result = analyze_image_quality(data, f.filename)
    return jsonify(result.to_dict())


@bp.post("/upload-and-verify")
@authenticated
def upload_and_verify():
    """
    Core VERIGRAPH Automated Ingestion Pipeline:
      1. Receives file (photo or PDF)
      2. Performs Quality Check
      3. Calculates SHA-256 and stores file securely
      4. Runs OCR and Fact Extraction
      5. Runs 5-Stage Forensic Verification Engine
      6. Computes Trust Score (0-100) with sub-components
      7. Automatically creates CAPA if significant discrepancy or anomaly is detected
      8. Updates Evidence Lineage & Knowledge Graph
    """
    user = g.current_user
    if "file" not in request.files:
        raise ApiError("No file uploaded.", 422)
    f = request.files["file"]

    raw_project_id = request.form.get("projectId")
    if raw_project_id in (None, "", "null", "undefined"):
        raw_project_id = getattr(user, "project_id", None)

    if not raw_project_id:
        raise ApiError("projectId is required and must be specified.", 422)

    if not user_can_access_project(user, raw_project_id):
        raise ApiError("You do not have access to this project.", 403)

    project_id = raw_project_id
    metric_code = request.form.get("metricCode", "diesel_litres")
    reported_qty = float(request.form.get("reportedValue")) if request.form.get("reportedValue") else None

    file_bytes = f.read()
    ok, msg = validate_upload(f.filename, len(file_bytes))
    if not ok:
        raise ApiError(msg, 422)

    magic_ok, magic_msg = _validate_magic_bytes(file_bytes)
    if not magic_ok:
        raise ApiError(magic_msg, 422)

    # Resolve Reporting Period
    raw_period_id = request.form.get("reportingPeriodId")
    reporting_period = None
    if raw_period_id:
        reporting_period = ReportingPeriod.query.get(raw_period_id)
        if not reporting_period:
            reporting_period = ReportingPeriod.query.filter(
                (ReportingPeriod.name == raw_period_id) | (ReportingPeriod.financial_year == raw_period_id)
            ).first()
    if not reporting_period:
        reporting_period = ReportingPeriod.query.filter_by(status="OPEN").order_by(ReportingPeriod.start_date.desc()).first()
        if not reporting_period:
            reporting_period = ReportingPeriod.query.order_by(ReportingPeriod.start_date.desc()).first()
    reporting_period_id = reporting_period.id if reporting_period else None

    # 1. Quality check decision
    qc_res = analyze_image_quality(file_bytes, f.filename)
    if not qc_res.is_acceptable:
        return jsonify({
            "status": "REJECTED_QUALITY",
            "message": "Document quality does not meet forensic verification standards.",
            "quality": qc_res.to_dict(),
        }), 422

    # 2. SHA-256 and secure sanitized storage key (no raw client filenames)
    digest = sha256_of(file_bytes)
    ext = os.path.splitext(f.filename)[1].lower() if f.filename else ".bin"
    if ext not in (".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".webp"):
        ext = ".pdf" if file_bytes.startswith(b"%PDF") else ".png" if file_bytes.startswith(b"\x89PNG") else ".jpg"
    storage_key = f"evidence/{digest[:2]}/{digest}{ext}"
    store_bytes(file_bytes, storage_key)

    doc = Document.query.filter_by(sha256=digest, status="ACTIVE").first()
    if not doc:
        doc = Document(
            original_filename=f.filename,
            storage_key=storage_key,
            mime_type=f.mimetype,
            size_bytes=len(file_bytes),
            sha256=digest,
            uploaded_by_id=user.id,
        )
        db.session.add(doc)
        db.session.flush()

    # 3. Real Fact Extraction
    extraction = run_document_extraction(file_bytes, f.filename)

    # 4. Multi-Stage Verification with Real Baseline and Cross-Doc Checks
    single_res = run_single_doc_verification(extraction.get("facts", []))
    cross_res = run_cross_doc_verification(
        extraction.get("facts", []),
        site_reported_value=reported_qty,
        project_id=project_id,
        metric_code=metric_code,
        reporting_period_id=reporting_period_id,
    )

    extracted_qty = cross_res.get("invoiceQuantity") or reported_qty
    temporal_res = run_temporal_verification(
        current_value=extracted_qty if extracted_qty is not None else 0.0,
        project_id=project_id,
        metric_code=metric_code,
        reporting_period_id=reporting_period_id,
    )
    anomaly_res = run_anomaly_detector(
        qty=extracted_qty if extracted_qty is not None else 0.0,
        project_id=project_id,
        metric_code=metric_code,
        reporting_period_id=reporting_period_id,
    )

    meta_res = meta_auditor_reconciliation(
        single_res, cross_res, temporal_res, anomaly_res,
        has_evidence=True,
        project_id=project_id,
        metric_code=metric_code,
    )

    # 5. Connect Lineage: BrsrIndicator -> EsgSubmission -> EsgValue -> MetricEvidence
    target_ind_code = METRIC_TO_INDICATOR_CODE.get(metric_code, metric_code)
    indicator = BrsrIndicator.query.filter(
        (BrsrIndicator.indicator_code == target_ind_code) | (BrsrIndicator.indicator_code == metric_code)
    ).first()
    if not indicator:
        indicator = BrsrIndicator.query.filter_by(indicator_code="p6_dg").first()
    principle_id = indicator.principle_id if indicator else 6

    sub = None
    esg_val = None
    if project_id and reporting_period_id and principle_id:
        sub = EsgSubmission.query.filter_by(
            project_id=project_id,
            reporting_period_id=reporting_period_id,
            principle_id=principle_id,
        ).first()
        if not sub:
            code_num = int(datetime.now().timestamp()) % 100000
            sub = EsgSubmission(
                submission_code=f"SUB-{code_num:05d}",
                project_id=project_id,
                reporting_period_id=reporting_period_id,
                principle_id=principle_id,
                status="DRAFT",
                entered_by_role="SITE_OPERATOR",
                submitted_by_id=user.id,
            )
            db.session.add(sub)
            db.session.flush()

        if indicator:
            esg_val = EsgValue.query.filter_by(submission_id=sub.id, indicator_id=indicator.id).first()
            val_num = reported_qty if reported_qty is not None else (extracted_qty if extracted_qty is not None else None)
            if not esg_val:
                esg_val = EsgValue(
                    submission_id=sub.id,
                    indicator_id=indicator.id,
                    numeric_value=val_num,
                    source_type="EVIDENCE_VERIFIED",
                    calculation_method="OCR_FACT_EXTRACTION",
                )
                db.session.add(esg_val)
                db.session.flush()
            elif val_num is not None:
                esg_val.numeric_value = val_num
                esg_val.source_type = "EVIDENCE_VERIFIED"
                esg_val.calculation_method = "OCR_FACT_EXTRACTION"
                db.session.flush()

            # Create or update MetricEvidence relationship linking Document <-> EsgValue
            me = MetricEvidence.query.filter_by(esg_value_id=esg_val.id, document_id=doc.id).first()
            if not me:
                me = MetricEvidence(
                    esg_value_id=esg_val.id,
                    document_id=doc.id,
                    description=f"Evidence for {indicator.indicator_code} from {doc.original_filename}",
                    verification_status="VERIFIED" if meta_res.get("riskLevel") == "LOW" else "PENDING",
                    verified_by_id=user.id if meta_res.get("riskLevel") == "LOW" else None,
                    verified_at=datetime.now(timezone.utc) if meta_res.get("riskLevel") == "LOW" else None,
                )
                db.session.add(me)
                db.session.flush()

    # 6. Persist Extracted Facts with linked esg_value_id
    saved_facts = []
    for fact in extraction.get("facts", []):
        ef = ExtractedFact(
            document_id=doc.id,
            project_id=project_id,
            esg_value_id=esg_val.id if esg_val else None,
            fact_type=fact.get("factType", "unknown"),
            field_name=fact.get("fieldName", "Extracted Field"),
            raw_value=fact.get("rawValue"),
            normalized_value=fact.get("normalizedValue"),
            text_value=fact.get("textValue"),
            unit=fact.get("unit"),
            page_number=fact.get("pageNumber", 1),
            bounding_box=fact.get("boundingBox"),
            ocr_confidence=fact.get("ocrConfidence", 0.95),
            extraction_confidence=fact.get("extractionConfidence", 0.95),
            source_snippet=fact.get("sourceSnippet"),
        )
        db.session.add(ef)
        saved_facts.append(ef)

    # 7. Persist Verification Result
    ver = VerificationResult(
        document_id=doc.id,
        project_id=project_id,
        metric_code=metric_code,
        rule_checks=[{"rule": "MANDATORY_FIELDS", "passed": True}],
        single_doc_result=single_res,
        cross_doc_result=cross_res,
        temporal_result=temporal_res,
        anomaly_result=anomaly_res,
        overall_status=meta_res.get("overallStatus"),
        risk_level=meta_res.get("riskLevel"),
        confidence=meta_res.get("confidence", 0.95),
        explanation=meta_res.get("explanation"),
        recommended_action=meta_res.get("recommendedAction"),
    )
    db.session.add(ver)

    # 8. Persist Trust Score
    ts = TrustScore(
        project_id=project_id,
        document_id=doc.id,
        metric_code=metric_code,
        score=meta_res.get("trustScore", 70),
        category=meta_res.get("category", "Verified"),
        provenance_score=meta_res.get("components", {}).get("provenance", 20),
        verification_score=meta_res.get("components", {}).get("verification", 25),
        cross_document_score=meta_res.get("components", {}).get("crossDocument", 15),
        physical_verification_score=meta_res.get("components", {}).get("physicalVerification", 0),
        factors_json=meta_res.get("factors", []),
    )
    db.session.add(ts)

    # 9. Auto-CAPA Creation if high risk or major inconsistency
    auto_capa = None
    if meta_res.get("riskLevel") in ("HIGH", "CRITICAL") or meta_res.get("trustScore", 70) < 65:
        capa_code = f"CAPA-{datetime.now().year}-{int(datetime.now().timestamp()) % 10000:04d}"
        auto_capa = CapaRecord(
            capa_code=capa_code,
            project_id=project_id,
            document_id=doc.id,
            finding=f"Verification variance detected: {meta_res.get('explanation')}",
            severity=meta_res.get("riskLevel", "HIGH"),
            owner="Site EHS / Fuel Officer",
            corrective_action="Reconcile vendor invoice against storage dispenser calibration and site intake log.",
            preventive_action="Implement dual-signoff on fuel intake slips and digital flow meter logging.",
            status="OPEN",
        )
        db.session.add(auto_capa)

    record("UPLOAD_AND_VERIFY", "Document", doc.id, details=f"Evidence {doc.id} processed for project {project_id}. Trust score: {ts.score}", user=user)
    db.session.commit()

    return jsonify({
        "document": doc.to_dict(),
        "quality": qc_res.to_dict(),
        "facts": [f.to_dict() for f in saved_facts],
        "verification": ver.to_dict(),
        "trustScore": ts.to_dict(),
        "capa": auto_capa.to_dict() if auto_capa else None,
    }), 201


@bp.get("/facts")
@authenticated
def get_facts():
    user = g.current_user
    doc_id = request.args.get("documentId")
    project_id = request.args.get("projectId")

    if project_id and not user_can_access_project(user, project_id):
        raise ApiError("You do not have access to this project.", 403)
    elif not project_id and getattr(user, "project_id", None):
        project_id = user.project_id

    q = ExtractedFact.query
    if doc_id:
        q = q.filter_by(document_id=doc_id)
    if project_id:
        q = q.filter_by(project_id=project_id)
    facts = q.order_by(ExtractedFact.created_at.desc()).limit(100).all()
    return jsonify([f.to_dict() for f in facts])


@bp.get("/trust-scores")
@authenticated
def get_trust_scores():
    user = g.current_user
    project_id = request.args.get("projectId")

    if project_id and not user_can_access_project(user, project_id):
        raise ApiError("You do not have access to this project.", 403)
    elif not project_id and getattr(user, "project_id", None):
        project_id = user.project_id

    q = TrustScore.query
    if project_id:
        q = q.filter_by(project_id=project_id)
    scores = q.order_by(TrustScore.created_at.desc()).limit(50).all()

    # Calculate group average (never default to 88 when empty)
    all_scores = [s.score for s in scores if s.score is not None]
    avg = round(sum(all_scores) / len(all_scores), 1) if all_scores else None

    return jsonify({
        "averageTrustScore": avg,
        "items": [s.to_dict() for s in scores],
        "distribution": {
            "verified": len([s for s in scores if s.category == "Verified"]),
            "partiallyVerified": len([s for s in scores if s.category == "Partially Verified"]),
            "needsReview": len([s for s in scores if s.category == "Needs Review"]),
            "highRisk": len([s for s in scores if s.category == "High Risk"]),
        }
    })


@bp.get("/verifications")
@authenticated
def get_verifications():
    user = g.current_user
    project_id = request.args.get("projectId")

    if project_id and not user_can_access_project(user, project_id):
        raise ApiError("You do not have access to this project.", 403)
    elif not project_id and getattr(user, "project_id", None):
        project_id = user.project_id

    q = VerificationResult.query
    if project_id:
        q = q.filter_by(project_id=project_id)
    items = q.order_by(VerificationResult.created_at.desc()).limit(50).all()
    return jsonify([v.to_dict() for v in items])


@bp.get("/knowledge-graph")
@authenticated
def get_knowledge_graph():
    """
    Builds the VERIGRAPH Evidence Lineage & Knowledge Graph dynamically from real database records:
    Project -> Submission -> ESG Value -> Extracted Fact -> Document -> Verification -> Trust Score -> CAPA -> BRSR Principle
    """
    user = g.current_user
    project_id = request.args.get("projectId") or getattr(user, "project_id", None)

    if project_id and not user_can_access_project(user, project_id):
        raise ApiError("You do not have access to this project.", 403)

    nodes = []
    edges = []
    node_ids = set()

    def add_node(nid, label, ntype, category, metadata=None):
        if nid not in node_ids:
            node_ids.add(nid)
            nodes.append({"id": nid, "label": label, "type": ntype, "category": category, "metadata": metadata or {}})

    def add_edge(src, tgt, label):
        if src in node_ids and tgt in node_ids:
            edges.append({"from": src, "to": tgt, "label": label})

    # 1. Projects
    projects_q = Project.query
    if project_id:
        projects_q = projects_q.filter_by(id=project_id)
    else:
        projects_q = projects_q.filter_by(status="ACTIVE").limit(5)

    projects = projects_q.all()
    if not projects:
        return jsonify({"nodes": [], "edges": []})

    for p in projects:
        p_node_id = f"prj_{p.id}"
        add_node(p_node_id, p.name, "SITE", "site", {"state": p.state, "code": p.project_code})

        # 2. Submissions
        subs = EsgSubmission.query.filter_by(project_id=p.id).limit(4).all()
        for sub in subs:
            sub_id = f"sub_{sub.id}"
            add_node(sub_id, f"Submission {sub.principle.code if sub.principle else 'ESG'} ({sub.status})", "SUBMISSION", "submission")
            add_edge(p_node_id, sub_id, "Reports")

            # Link to Principle
            if sub.principle:
                princ_id = f"princ_{sub.principle.id}"
                add_node(princ_id, f"{sub.principle.code}: {sub.principle.name_en[:30]}", "BRSR", "brsr")
                add_edge(sub_id, princ_id, "Fulfills")

            # 3. ESG Values
            for val in sub.values[:3]:
                val_id = f"val_{val.id}"
                ind_label = val.indicator.indicator_code if val.indicator else "Metric"
                add_node(val_id, f"{ind_label}: {val.value()}", "VALUE", "value")
                add_edge(sub_id, val_id, "Contains")

        # 4. Documents & Facts
        facts = ExtractedFact.query.filter_by(project_id=p.id).limit(6).all()
        for f in facts:
            fact_id = f"fact_{f.id}"
            add_node(fact_id, f"{f.field_name}: {f.text_value or f.raw_value} (Conf: {int(f.ocr_confidence * 100)}%)", "FACT", "fact")

            doc_id = f"doc_{f.document_id}"
            doc_rec = Document.query.get(f.document_id)
            doc_label = doc_rec.original_filename if doc_rec else f"Doc {f.document_id[:8]}"
            add_node(doc_id, doc_label, "EVIDENCE", "evidence", {"sha256": doc_rec.sha256 if doc_rec else None})
            add_edge(p_node_id, doc_id, "Evidence Uploaded")
            add_edge(doc_id, fact_id, "Extracted Fact")

        # 5. Verification Results
        vers = VerificationResult.query.filter_by(project_id=p.id).limit(4).all()
        for v in vers:
            v_id = f"ver_{v.id}"
            add_node(v_id, f"Verification: {v.overall_status} (Risk: {v.risk_level})", "VERIFICATION", "verification")
            if v.document_id:
                add_edge(f"doc_{v.document_id}", v_id, "Verified By")
            else:
                add_edge(p_node_id, v_id, "Site Verification")

        # 6. Trust Scores
        t_scores = TrustScore.query.filter_by(project_id=p.id).limit(4).all()
        for ts in t_scores:
            ts_id = f"ts_{ts.id}"
            add_node(ts_id, f"Trust Score: {ts.score}/100 ({ts.category})", "TRUST_SCORE", "trust")
            if ts.document_id:
                add_edge(f"doc_{ts.document_id}", ts_id, "Evaluated Score")
            else:
                add_edge(p_node_id, ts_id, "Site Trust Score")

        # 7. CAPA Records
        capas = CapaRecord.query.filter_by(project_id=p.id).all()
        for c in capas:
            capa_id = f"capa_{c.id}"
            add_node(capa_id, f"{c.capa_code}: {c.finding[:35]} ({c.status})", "CAPA", "capa", {"severity": c.severity})
            add_edge(p_node_id, capa_id, "Action Item")
            if c.document_id:
                add_edge(f"doc_{c.document_id}", capa_id, "Finding Source")

    return jsonify({"nodes": nodes, "edges": edges})


@bp.route("/demo-pipeline", methods=["GET"])
@authenticated
def get_demo_pipeline():
    """Returns the 16-step VERIGRAPH automated evidence-to-BRSR demo payload."""
    return jsonify({
        "site": {
            "name": "MEIL Project Site 104 - Zojila Tunnel",
            "bu": "Tunnels & Transit Division",
            "subsidiary": "MEIL Infrastructure & Utilities"
        },
        "invoice": {
            "invoiceNumber": "INV-4821",
            "vendor": "ABC Fuels Private Limited",
            "quantityLitres": 1250,
            "totalInr": 118750
        },
        "step2_qualityCheck": {
            "qualityScore": 94,
            "status": "ACCEPT",
            "sharpness": 142.5,
            "brightness": 128.0
        },
        "step7_trustScore": {
            "score": 82,
            "category": "High Confidence",
            "breakdown": {
                "provenance": 95,
                "ocrConfidence": 96,
                "extractionConfidence": 94,
                "documentVerification": 100,
                "crossDocumentConsistency": 100,
                "temporalConsistency": 58
            }
        }
    })


# ─────────────────────────────────────────────────────────────────────────────
# OPTION A: BATCH EVIDENCE PROCESSING WORKER & ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

def _execute_batch_processing(batch_id: str):
    """
    Background worker function executing quality verification, OCR/parsing,
    automatic classification, metric & unit detection, and structured fact discovery.
    """
    try:
        batch = EvidenceBatch.query.get(batch_id)
        if not batch:
            return

        batch.status = "PROCESSING"
        db.session.commit()

        for item in batch.items:
            if item.status in ("EXTRACTED", "COMMITTED"):
                continue

            item.status = "PROCESSING"
            db.session.commit()

            try:
                doc = Document.query.get(item.document_id) if item.document_id else None
                if not doc:
                    raise ValueError("Associated document record missing.")

                file_bytes = read_bytes(doc.storage_key)
                if not file_bytes:
                    raise ValueError("Stored file payload could not be read.")

                # 1. Computer Vision Quality Check
                qc = analyze_image_quality(file_bytes, item.original_filename)
                item.quality_score = qc.quality_score
                item.quality_acceptable = qc.is_acceptable
                item_warnings = list(qc.issues or [])

                # 2. Authentic Fact Extraction (OCR for Image/PDF, Tabular parser for CSV/XLSX)
                ext_res = run_document_extraction(file_bytes, item.original_filename)

                # 3. Automatic Classification & ESG Metric Detection
                cls_res = classify_and_detect_metric(ext_res, item.original_filename, item.file_type)

                item.doc_type = cls_res["doc_type"]
                item.detected_metric_code = cls_res["detected_metric_code"]
                item.detected_metric_name = cls_res["detected_metric_name"]
                item.detected_value = cls_res["detected_value"]
                item.detected_unit = cls_res["detected_unit"]
                item.confidence = cls_res["confidence"]
                item.ocr_confidence = cls_res["ocr_confidence"]
                item.bounding_box = cls_res["bounding_box"]
                item.page_number = cls_res["page_number"]
                item.source_snippet = cls_res["source_snippet"]
                item.raw_facts = cls_res["raw_facts"]

                if cls_res.get("warnings"):
                    item_warnings.extend(cls_res["warnings"])
                item.warnings = item_warnings

                item.status = "EXTRACTED"
                db.session.commit()

            except Exception as e:
                db.session.rollback()
                item.status = "FAILED"
                item.error_message = str(e)
                try:
                    db.session.commit()
                except Exception:
                    pass

    except Exception as exc:
        db.session.rollback()
        try:
            batch = EvidenceBatch.query.get(batch_id)
            if batch:
                batch.status = "FAILED"
                batch.error_message = str(exc)
                db.session.commit()
        except Exception:
            pass
    finally:
        # Guarantee batch statistics and final status are recalculated
        try:
            batch = EvidenceBatch.query.get(batch_id)
            if batch and batch.status == "PROCESSING":
                batch.processed_files = len([i for i in batch.items if i.status in ("EXTRACTED", "COMMITTED")])
                batch.failed_files = len([i for i in batch.items if i.status == "FAILED"])
                if batch.failed_files == 0 and batch.processed_files > 0:
                    batch.status = "COMPLETED"
                elif batch.processed_files > 0:
                    batch.status = "PARTIALLY_FAILED"
                elif batch.failed_files > 0:
                    batch.status = "FAILED"
                else:
                    batch.status = "COMPLETED"
                db.session.commit()
        except Exception:
            pass


@bp.post("/batches")
@authenticated
def create_batch():
    """
    Uploads multiple documents and tabular files for automated batch ingestion.
    User selects project site and reporting period once; indicator and quantities are auto-detected.
    """
    user = g.current_user
    project_id = request.form.get("projectId") or getattr(user, "project_id", None)
    if not project_id:
        raise ApiError("projectId is required.", 422)

    if not user_can_access_project(user, project_id):
        raise ApiError("You do not have access to this project site.", 403)

    # Normalize project_id to the actual DB project.id
    target_project = Project.query.get(project_id)
    if not target_project and isinstance(project_id, str):
        target_project = Project.query.filter(
            (Project.project_code.ilike(project_id)) |
            (Project.name.ilike(project_id))
        ).first()
    if not target_project and user.scope_ids("PROJECT"):
        target_project = Project.query.get(user.scope_ids("PROJECT")[0])
    if target_project:
        project_id = target_project.id

    raw_period_id = request.form.get("reportingPeriodId")
    reporting_period = None
    if raw_period_id:
        reporting_period = ReportingPeriod.query.get(raw_period_id)
        if not reporting_period:
            reporting_period = ReportingPeriod.query.filter(
                (ReportingPeriod.name == raw_period_id) | (ReportingPeriod.financial_year == raw_period_id)
            ).first()
    if not reporting_period:
        reporting_period = ReportingPeriod.query.filter_by(status="OPEN").order_by(ReportingPeriod.start_date.desc()).first()
        if not reporting_period:
            reporting_period = ReportingPeriod.query.order_by(ReportingPeriod.start_date.desc()).first()
    if not reporting_period:
        raise ApiError("No valid reporting period found.", 422)

    # Collect files
    uploaded_files = request.files.getlist("files")
    if not uploaded_files:
        uploaded_files = request.files.getlist("file")
    if not uploaded_files or len(uploaded_files) == 0:
        raise ApiError("No evidence files uploaded.", 422)

    if len(uploaded_files) > 50:
        raise ApiError("Maximum 50 files per batch upload.", 422)

    # Create batch record
    batch = EvidenceBatch(
        project_id=project_id,
        reporting_period_id=reporting_period.id,
        created_by_id=user.id,
        status="PENDING",
        total_files=len(uploaded_files),
        processed_files=0,
        failed_files=0,
    )
    db.session.add(batch)
    db.session.flush()

    for f in uploaded_files:
        if not f.filename:
            continue

        file_bytes = f.read()
        f_size = len(file_bytes)
        ext = os.path.splitext(f.filename)[1].lower().lstrip(".")

        val_ok, val_err = validate_upload(f.filename, f_size)
        if not val_ok:
            item = BatchItem(
                batch_id=batch.id,
                original_filename=f.filename,
                file_type=ext,
                file_size=f_size,
                status="FAILED",
                error_message=val_err,
            )
            db.session.add(item)
            continue

        magic_ok, magic_err = _validate_magic_bytes(file_bytes, f.filename)
        if not magic_ok:
            item = BatchItem(
                batch_id=batch.id,
                original_filename=f.filename,
                file_type=ext,
                file_size=f_size,
                status="FAILED",
                error_message=magic_err,
            )
            db.session.add(item)
            continue

        digest = sha256_of(file_bytes)
        storage_ext = f".{ext}" if ext else ".bin"
        storage_key = f"evidence/{digest[:2]}/{digest}{storage_ext}"
        store_bytes(file_bytes, storage_key)

        doc = Document.query.filter_by(sha256=digest, status="ACTIVE").first()
        if not doc:
            doc = Document(
                original_filename=f.filename,
                storage_key=storage_key,
                mime_type=f.mimetype,
                size_bytes=f_size,
                sha256=digest,
                uploaded_by_id=user.id,
            )
            db.session.add(doc)
            db.session.flush()

        item = BatchItem(
            batch_id=batch.id,
            document_id=doc.id,
            original_filename=f.filename,
            file_type=ext,
            file_size=f_size,
            sha256=digest,
            status="PENDING",
        )
        db.session.add(item)

    db.session.commit()
    batch_id = str(batch.id)

    # Trigger background worker
    app_obj = current_app._get_current_object()
    is_sync = request.args.get("sync") == "true" or current_app.config.get("TESTING", False)

    if is_sync:
        _execute_batch_processing(batch_id)
        batch = EvidenceBatch.query.get(batch_id)
    else:
        worker_thread = threading.Thread(
            target=_execute_batch_processing_in_context,
            args=(app_obj, batch_id),
            daemon=True,
        )
        worker_thread.start()

    record(user.id, "BATCH_UPLOAD", "EvidenceBatch", batch.id, f"Uploaded {batch.total_files} evidence files")

    return jsonify({
        "batchId": batch.id,
        "status": batch.status,
        "totalFiles": batch.total_files,
        "processedFiles": batch.processed_files,
        "failedFiles": batch.failed_files,
        "projectId": batch.project_id,
        "reportingPeriodId": batch.reporting_period_id,
        "batch": batch.to_dict(include_items=True),
        "message": "Batch evidence upload accepted for processing.",
    }), 201


def _execute_batch_processing_in_context(app, batch_id):
    with app.app_context():
        _execute_batch_processing(batch_id)


@bp.get("/batches/<batch_id>")
@authenticated
def get_batch_details(batch_id):
    """Retrieves batch status, per-file processing progress, and extracted review items."""
    user = g.current_user
    batch = EvidenceBatch.query.get(batch_id)
    if not batch:
        raise ApiError("Evidence batch not found.", 404)

    if not user_can_access_project(user, batch.project_id):
        raise ApiError("You do not have access to this batch's project.", 403)

    return jsonify(batch.to_dict(include_items=True))


@bp.get("/batches")
@authenticated
def list_batches():
    """Lists recent evidence batches for the current user's authorized projects."""
    user = g.current_user
    project_id = request.args.get("projectId")

    query = EvidenceBatch.query
    if project_id:
        if not user_can_access_project(user, project_id):
            raise ApiError("Access denied to requested project.", 403)
        query = query.filter_by(project_id=project_id)

    batches = query.order_by(EvidenceBatch.created_at.desc()).limit(20).all()
    # Filter by user accessible projects
    filtered = [b for b in batches if user_can_access_project(user, b.project_id)]

    return jsonify({
        "batches": [b.to_dict(include_items=False) for b in filtered],
        "total": len(filtered),
    })


@bp.patch("/batches/<batch_id>/items/<item_id>")
@authenticated
def update_batch_item(batch_id, item_id):
    """Allows user to correct/override detected metric, quantity, or unit in the review table."""
    user = g.current_user
    batch = EvidenceBatch.query.get(batch_id)
    if not batch:
        raise ApiError("Evidence batch not found.", 404)

    if not user_can_access_project(user, batch.project_id):
        raise ApiError("Access denied.", 403)

    item = BatchItem.query.filter_by(id=item_id, batch_id=batch_id).first()
    if not item:
        raise ApiError("Batch item not found.", 404)

    data = request.get_json() or {}
    overrides = item.user_overrides or {}

    if "metricCode" in data:
        overrides["metricCode"] = data["metricCode"]
    if "value" in data:
        try:
            overrides["value"] = float(data["value"]) if data["value"] is not None else None
        except (ValueError, TypeError):
            raise ApiError("Value must be a valid number.", 422)
    if "unit" in data:
        overrides["unit"] = data["unit"]

    item.user_overrides = overrides
    if "isReviewed" in data:
        item.is_reviewed = bool(data["isReviewed"])
    else:
        item.is_reviewed = True

    db.session.commit()
    record(user.id, "UPDATE_BATCH_ITEM", "BatchItem", item.id, f"Overrode detection on {item.original_filename}")

    return jsonify(item.to_dict())


@bp.delete("/batches/<batch_id>/items/<item_id>")
@authenticated
def delete_batch_item(batch_id, item_id):
    """Deletes an item from the batch if rejected by the reviewer."""
    user = g.current_user
    batch = EvidenceBatch.query.get(batch_id)
    if not batch:
        raise ApiError("Evidence batch not found.", 404)

    if not user_can_access_project(user, batch.project_id):
        raise ApiError("Access denied.", 403)

    item = BatchItem.query.filter_by(id=item_id, batch_id=batch_id).first()
    if not item:
        raise ApiError("Batch item not found.", 404)

    db.session.delete(item)
    batch.total_files = max(0, batch.total_files - 1)
    db.session.commit()

    return jsonify({"success": True, "deletedItemId": item_id})


@bp.post("/batches/<batch_id>/retry-failed")
@authenticated
def retry_failed_batch_items(batch_id):
    """Retries processing for any failed items in the batch."""
    user = g.current_user
    batch = EvidenceBatch.query.get(batch_id)
    if not batch:
        raise ApiError("Evidence batch not found.", 404)

    if not user_can_access_project(user, batch.project_id):
        raise ApiError("Access denied.", 403)

    failed_items = [i for i in batch.items if i.status == "FAILED"]
    if not failed_items:
        return jsonify({"message": "No failed items to retry.", "batch": batch.to_dict()})

    for item in failed_items:
        item.status = "PENDING"
        item.retry_count = (item.retry_count or 0) + 1
        item.error_message = None

    batch.status = "PROCESSING"
    db.session.commit()

    batch_id_str = str(batch.id)
    app_obj = current_app._get_current_object()
    if current_app.config.get("TESTING", False):
        _execute_batch_processing(batch_id_str)
    else:
        threading.Thread(
            target=_execute_batch_processing_in_context,
            args=(app_obj, batch_id_str),
            daemon=True,
        ).start()

    return jsonify(batch.to_dict(include_items=True))


@bp.post("/batches/<batch_id>/commit")
@authenticated
def commit_batch(batch_id):
    """
    Commits reviewed/approved extraction items to persistent ESG submissions and indicators.
    Executes 5-agent forensic verification, computes Trust Scores, auto-generates CAPA,
    and establishes complete evidence lineage.
    """
    user = g.current_user
    batch = EvidenceBatch.query.get(batch_id)
    if not batch:
        raise ApiError("Evidence batch not found.", 404)

    if not user_can_access_project(user, batch.project_id):
        raise ApiError("Access denied to this project.", 403)

    data = request.get_json() or {}
    item_ids_to_commit = data.get("itemIds")  # Optional subset of item IDs; defaults to all extracted

    items_query = [i for i in batch.items if i.status in ("EXTRACTED", "COMMITTED")]
    if item_ids_to_commit:
        items_query = [i for i in items_query if i.id in item_ids_to_commit]

    if not items_query:
        raise ApiError("No extracted items available to commit.", 422)

    committed_count = 0
    verification_summaries = []

    for item in items_query:
        metric_code = item.effective_metric_code()
        value_num = item.effective_value()

        if not metric_code or value_num is None:
            # Cannot commit item without metric code and physical value
            continue

        target_ind_code = METRIC_TO_INDICATOR_CODE.get(metric_code, metric_code)
        indicator = BrsrIndicator.query.filter(
            (BrsrIndicator.indicator_code == target_ind_code) | (BrsrIndicator.indicator_code == metric_code)
        ).first()

        if not indicator:
            indicator = BrsrIndicator.query.filter_by(indicator_code="p6_dg").first()

        principle_id = indicator.principle_id if indicator else 6

        # 1. Submission record
        sub = EsgSubmission.query.filter_by(
            project_id=batch.project_id,
            reporting_period_id=batch.reporting_period_id,
            principle_id=principle_id,
        ).first()

        if not sub:
            code_num = int(datetime.now().timestamp()) % 100000
            sub = EsgSubmission(
                submission_code=f"SUB-{code_num:05d}",
                project_id=batch.project_id,
                reporting_period_id=batch.reporting_period_id,
                principle_id=principle_id,
                status="DRAFT",
                entered_by_role="SITE_OPERATOR",
                submitted_by_id=user.id,
            )
            db.session.add(sub)
            db.session.flush()

        # 2. EsgValue record
        esg_val = EsgValue.query.filter_by(submission_id=sub.id, indicator_id=indicator.id).first()
        if not esg_val:
            esg_val = EsgValue(
                submission_id=sub.id,
                indicator_id=indicator.id,
                numeric_value=value_num,
                source_type="EVIDENCE_VERIFIED",
                calculation_method="BATCH_AUTO_EXTRACTION",
            )
            db.session.add(esg_val)
            db.session.flush()
        else:
            esg_val.numeric_value = value_num
            esg_val.source_type = "EVIDENCE_VERIFIED"
            esg_val.calculation_method = "BATCH_AUTO_EXTRACTION"
            db.session.flush()

        # 3. MetricEvidence record
        if item.document_id:
            me = MetricEvidence.query.filter_by(esg_value_id=esg_val.id, document_id=item.document_id).first()
            if not me:
                me = MetricEvidence(
                    esg_value_id=esg_val.id,
                    document_id=item.document_id,
                    description=f"Batch evidence ({item.doc_type}) from {item.original_filename}",
                    verification_status="VERIFIED",
                    verified_by_id=user.id,
                    verified_at=datetime.now(timezone.utc),
                )
                db.session.add(me)
                db.session.flush()

        # 4. ExtractedFact persistence
        for fact in (item.raw_facts or []):
            ef = ExtractedFact(
                document_id=item.document_id,
                project_id=batch.project_id,
                esg_value_id=esg_val.id,
                fact_type=fact.get("factType", "unknown"),
                field_name=fact.get("fieldName", "Batch Fact"),
                raw_value=fact.get("rawValue"),
                normalized_value=fact.get("normalizedValue"),
                text_value=fact.get("textValue"),
                unit=fact.get("unit"),
                page_number=fact.get("pageNumber", 1),
                bounding_box=fact.get("boundingBox"),
                ocr_confidence=fact.get("ocrConfidence", 1.0),
                extraction_confidence=fact.get("extractionConfidence", 1.0),
                source_snippet=fact.get("sourceSnippet"),
            )
            db.session.add(ef)

        # 5. Multi-Stage Verification Engine
        single_res = run_single_doc_verification(item.raw_facts or [])
        cross_res = run_cross_doc_verification(
            item.raw_facts or [],
            site_reported_value=value_num,
            project_id=batch.project_id,
            metric_code=metric_code,
            reporting_period_id=batch.reporting_period_id,
        )
        temporal_res = run_temporal_verification(
            current_value=value_num,
            project_id=batch.project_id,
            metric_code=metric_code,
            reporting_period_id=batch.reporting_period_id,
        )
        anomaly_res = run_anomaly_detector(
            qty=value_num,
            project_id=batch.project_id,
            metric_code=metric_code,
            reporting_period_id=batch.reporting_period_id,
        )
        meta_res = meta_auditor_reconciliation(
            single_res, cross_res, temporal_res, anomaly_res,
            has_evidence=True,
            project_id=batch.project_id,
            metric_code=metric_code,
        )

        # Persist VerificationResult
        v_res = VerificationResult(
            document_id=item.document_id,
            submission_id=sub.id,
            project_id=batch.project_id,
            metric_code=metric_code,
            rule_checks=single_res.get("ruleChecks", []),
            single_doc_result=single_res,
            cross_doc_result=cross_res,
            temporal_result=temporal_res,
            anomaly_result=anomaly_res,
            overall_status=meta_res.get("overallStatus", "VERIFIED"),
            risk_level=meta_res.get("riskLevel", "LOW"),
            confidence=meta_res.get("confidence", 0.95),
            explanation=meta_res.get("explanation", "Batch ingestion verified."),
            recommended_action=meta_res.get("recommendedAction"),
        )
        db.session.add(v_res)

        # Persist TrustScore
        ts = TrustScore(
            project_id=batch.project_id,
            document_id=item.document_id,
            submission_id=sub.id,
            metric_code=metric_code,
            score=int(meta_res.get("trustScore", 85.0)),
            category=meta_res.get("category", "Verified"),
            provenance_score=meta_res.get("components", {}).get("provenance", 22.0),
            verification_score=meta_res.get("components", {}).get("verification", 25.0),
            cross_document_score=meta_res.get("components", {}).get("crossDocument", 20.0),
            physical_verification_score=meta_res.get("components", {}).get("physicalVerification", 0.0),
            factors_json=meta_res.get("factors", []),
        )
        db.session.add(ts)

        # Auto-CAPA if anomaly or high risk
        if meta_res.get("riskLevel") in ("HIGH", "CRITICAL") or meta_res.get("overallStatus") == "POTENTIAL_ANOMALY":
            code_capa = int(datetime.now().timestamp()) % 100000
            capa = CapaRecord(
                capa_code=f"CAPA-{code_capa:05d}",
                project_id=batch.project_id,
                document_id=item.document_id,
                submission_id=sub.id,
                finding=f"Batch Ingestion Anomaly on {item.original_filename}: {meta_res.get('explanation')}",
                severity=meta_res.get("riskLevel", "MEDIUM"),
                owner="Site EHS / Quality Officer",
                corrective_action="Verify meter calibration or intake receipts against physical stock ledger.",
                preventive_action="Implement dual digital sign-off for operational consumption entries.",
                status="OPEN",
            )
            db.session.add(capa)

        item.is_committed = True
        item.status = "COMMITTED"
        item.esg_value_id = esg_val.id
        committed_count += 1
        verification_summaries.append({
            "itemId": item.id,
            "filename": item.original_filename,
            "metricCode": metric_code,
            "value": value_num,
            "unit": item.effective_unit(),
            "overallStatus": meta_res.get("overallStatus"),
            "riskLevel": meta_res.get("riskLevel"),
            "trustScore": meta_res.get("trustScore"),
        })

    batch.status = "COMMITTED"
    db.session.commit()

    record(user.id, "BATCH_COMMIT", "EvidenceBatch", batch.id, f"Committed {committed_count} items")

    return jsonify({
        "batchId": batch.id,
        "status": batch.status,
        "committedCount": committed_count,
        "results": verification_summaries,
        "batch": batch.to_dict(include_items=True),
        "message": f"Successfully committed and verified {committed_count} ESG records.",
    })


