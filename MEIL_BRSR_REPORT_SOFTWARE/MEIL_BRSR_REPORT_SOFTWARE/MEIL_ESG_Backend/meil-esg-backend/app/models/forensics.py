"""
VERIGRAPH ESG Forensics, Trust Score, Fact Extraction, and CAPA Models.
Extends the relational persistence layer with:
  1. ExtractedFact - Document OCR/Text facts with bounding boxes and confidence.
  2. VerificationResult - Multi-stage forensic results (Rule, Single, Cross, Temporal, Anomaly, Meta-Auditor).
  3. TrustScore - 0-100 Trust Score with sub-component scores (Provenance, Verification, Consistency, Physical).
  4. CapaRecord - Corrective and Preventive Action records with lifecycle management.
  5. PhysicalVerification - Physical / GPS / site audit verification logs.
"""
from datetime import datetime, timezone
from app.extensions import db
from app.models.base import TimestampMixin, gen_uuid

# Verification result classifications (Explainable, never auto-fraud)
RISK_VERIFIED = "VERIFIED"
RISK_PARTIALLY_VERIFIED = "PARTIALLY_VERIFIED"
RISK_POTENTIAL_ANOMALY = "POTENTIAL_ANOMALY"
RISK_POTENTIAL_INCONSISTENCY = "POTENTIAL_INCONSISTENCY"
RISK_EVIDENCE_RISK = "EVIDENCE_RISK"
RISK_REVIEW_REQUIRED = "REVIEW_REQUIRED"
RISK_HIGH_RISK = "HIGH_RISK"

# Physical verification status
PHYSICAL_NOT_VERIFIED = "NOT_VERIFIED"
PHYSICAL_PENDING = "PENDING"
PHYSICAL_VERIFIED = "VERIFIED"
PHYSICAL_REJECTED = "REJECTED"

# CAPA Statuses
CAPA_OPEN = "OPEN"
CAPA_IN_PROGRESS = "IN_PROGRESS"
CAPA_PENDING_REVIEW = "PENDING_REVIEW"
CAPA_RESOLVED = "RESOLVED"
CAPA_ESCALATED = "ESCALATED"
CAPA_CLOSED = "CLOSED"


class ExtractedFact(db.Model, TimestampMixin):
    """
    Structured fact extracted from an evidence document (Invoice, meter slip, weighbridge ticket, etc.).
    Preserves exact provenance: document_id, page_number, bounding_box, OCR confidence, extraction confidence.
    """
    __tablename__ = "extracted_facts"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=False, index=True)
    project_id = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=True, index=True)
    fact_type = db.Column(db.String(50), nullable=False, index=True)  # e.g., 'invoice_number', 'vendor_name', 'gstin', 'quantity', 'unit_price', 'total_amount', 'kwh', 'water_kl'
    field_name = db.Column(db.String(80), nullable=False)
    raw_value = db.Column(db.Text, nullable=True)
    normalized_value = db.Column(db.Numeric(18, 4), nullable=True)
    text_value = db.Column(db.String(255), nullable=True)
    unit = db.Column(db.String(30), nullable=True)
    page_number = db.Column(db.Integer, default=1)
    bounding_box = db.Column(db.JSON, nullable=True)  # {x: 0.1, y: 0.2, width: 0.3, height: 0.05}
    ocr_confidence = db.Column(db.Float, default=1.0)
    extraction_confidence = db.Column(db.Float, default=1.0)
    source_snippet = db.Column(db.Text, nullable=True)
    esg_value_id = db.Column(db.Integer, db.ForeignKey("esg_values.id"), nullable=True, index=True)

    document = db.relationship("Document", backref=db.backref("extracted_facts", cascade="all, delete-orphan"))
    project = db.relationship("Project")
    esg_value = db.relationship("EsgValue", backref=db.backref("extracted_facts", lazy="selectin"))

    def to_dict(self):
        return {
            "id": self.id,
            "documentId": self.document_id,
            "projectId": self.project_id,
            "esgValueId": self.esg_value_id,
            "factType": self.fact_type,
            "fieldName": self.field_name,
            "rawValue": self.raw_value,
            "normalizedValue": float(self.normalized_value) if self.normalized_value is not None else None,
            "textValue": self.text_value,
            "unit": self.unit,
            "pageNumber": self.page_number,
            "boundingBox": self.bounding_box,
            "ocrConfidence": round(self.ocr_confidence, 2) if self.ocr_confidence else 1.0,
            "extractionConfidence": round(self.extraction_confidence, 2) if self.extraction_confidence else 1.0,
            "sourceSnippet": self.source_snippet,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class VerificationResult(db.Model, TimestampMixin):
    """
    Multi-stage verification outcome record linking Document/Submission/Project to
    forensic verification stages:
      - single_document (arithmetic, GSTIN, required fields)
      - cross_document (invoice vs site fuel consumption / meter slip)
      - temporal (month-over-month, historical baseline, rolling average)
      - anomaly (IsolationForest outlier score)
      - meta_auditor (reconciliation & explainable synthesis)
    """
    __tablename__ = "verification_results"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=True, index=True)
    submission_id = db.Column(db.String(36), db.ForeignKey("esg_submissions.id"), nullable=True, index=True)
    project_id = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=True, index=True)
    metric_code = db.Column(db.String(50), nullable=True, index=True)  # e.g., 'p6_diesel', 'diesel_litres'

    # Multi-agent stages results
    rule_checks = db.Column(db.JSON, nullable=True)         # [{rule: 'ARITHMETIC_CHECK', passed: True, detail: '...'}]
    single_doc_result = db.Column(db.JSON, nullable=True)   # {passed: True, math_valid: True, gstin_valid: True, flags: []}
    cross_doc_result = db.Column(db.JSON, nullable=True)    # {matched: True, diff_pct: 1.2, compared_with: 'SITE_LOG'}
    temporal_result = db.Column(db.JSON, nullable=True)     # {z_score: 0.4, mom_pct: 5.2, baseline_dev: 'NORMAL'}
    anomaly_result = db.Column(db.JSON, nullable=True)      # {is_outlier: False, anomaly_score: 0.12, model: 'IsolationForest'}

    # Meta-Auditor reconciled synthesis
    overall_status = db.Column(db.String(40), nullable=False, default=RISK_VERIFIED)
    risk_level = db.Column(db.String(20), nullable=False, default="LOW")  # LOW | MEDIUM | HIGH | CRITICAL
    confidence = db.Column(db.Float, default=0.95)
    explanation = db.Column(db.Text, nullable=False)
    recommended_action = db.Column(db.String(255), nullable=True)
    reviewed_by_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    reviewer_notes = db.Column(db.Text, nullable=True)

    document = db.relationship("Document", backref=db.backref("verifications", cascade="all, delete-orphan"))
    submission = db.relationship("EsgSubmission")
    project = db.relationship("Project")
    reviewed_by = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "documentId": self.document_id,
            "submissionId": self.submission_id,
            "projectId": self.project_id,
            "metricCode": self.metric_code,
            "ruleChecks": self.rule_checks or [],
            "singleDocResult": self.single_doc_result or {},
            "crossDocResult": self.cross_doc_result or {},
            "temporalResult": self.temporal_result or {},
            "anomalyResult": self.anomaly_result or {},
            "overallStatus": self.overall_status,
            "riskLevel": self.risk_level,
            "confidence": round(self.confidence, 2) if self.confidence else 0.95,
            "explanation": self.explanation,
            "recommendedAction": self.recommended_action,
            "reviewedById": self.reviewed_by_id,
            "reviewedAt": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "reviewerNotes": self.reviewer_notes,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class TrustScore(db.Model, TimestampMixin):
    """
    Configurable Trust Score (0-100) with granular component scores:
      - Provenance (Source integrity, photo/bill, digital chain-of-custody) (0-25)
      - Verification (Single-doc arithmetic, GSTIN, math check) (0-30)
      - Cross-document consistency (Log vs bill vs procurement) (0-25)
      - Physical verification / GPS / site-inspection factor (0-20)
    """
    __tablename__ = "trust_scores"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    project_id = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=False, index=True)
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=True, index=True)
    submission_id = db.Column(db.String(36), db.ForeignKey("esg_submissions.id"), nullable=True, index=True)
    metric_code = db.Column(db.String(50), nullable=True)

    score = db.Column(db.Integer, nullable=False, default=85)  # 0 to 100
    category = db.Column(db.String(30), nullable=False, default="Verified")  # Verified | Partially Verified | Needs Review | High Risk

    provenance_score = db.Column(db.Float, default=22.5)       # Max 25
    verification_score = db.Column(db.Float, default=27.0)     # Max 30
    cross_document_score = db.Column(db.Float, default=22.0)   # Max 25
    physical_verification_score = db.Column(db.Float, default=15.0)  # Max 20

    factors_json = db.Column(db.JSON, nullable=True)  # Detailed score breakdown & explanations

    project = db.relationship("Project")
    document = db.relationship("Document")
    submission = db.relationship("EsgSubmission")

    def to_dict(self):
        return {
            "id": self.id,
            "projectId": self.project_id,
            "documentId": self.document_id,
            "submissionId": self.submission_id,
            "metricCode": self.metric_code,
            "score": self.score,
            "category": self.category,
            "components": {
                "provenance": round(self.provenance_score, 1),
                "verification": round(self.verification_score, 1),
                "crossDocument": round(self.cross_document_score, 1),
                "physicalVerification": round(self.physical_verification_score, 1),
            },
            "factors": self.factors_json or [],
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class CapaRecord(db.Model, TimestampMixin):
    """
    Corrective and Preventive Action (CAPA) tracking record.
    Triggered when verification or audit detects anomalies or discrepancies.
    """
    __tablename__ = "capa_records"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    capa_code = db.Column(db.String(30), unique=True, nullable=False)  # "CAPA-2026-001"
    project_id = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=False, index=True)
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=True)
    submission_id = db.Column(db.String(36), db.ForeignKey("esg_submissions.id"), nullable=True)

    finding = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), nullable=False, default="MEDIUM")  # LOW | MEDIUM | HIGH | CRITICAL
    owner = db.Column(db.String(120), nullable=False, default="Site In-charge")
    corrective_action = db.Column(db.Text, nullable=True)
    preventive_action = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(30), nullable=False, default=CAPA_OPEN)  # OPEN | IN_PROGRESS | PENDING_REVIEW | RESOLVED | ESCALATED | CLOSED
    comments = db.Column(db.Text, nullable=True)
    attachments_json = db.Column(db.JSON, nullable=True)
    closure_date = db.Column(db.DateTime(timezone=True), nullable=True)
    closed_by_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)

    project = db.relationship("Project")
    document = db.relationship("Document")
    submission = db.relationship("EsgSubmission")
    closed_by = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "capaCode": self.capa_code,
            "projectId": self.project_id,
            "projectName": self.project.name if self.project else None,
            "documentId": self.document_id,
            "submissionId": self.submission_id,
            "finding": self.finding,
            "severity": self.severity,
            "owner": self.owner,
            "correctiveAction": self.corrective_action,
            "preventiveAction": self.preventive_action,
            "dueDate": self.due_date.isoformat() if self.due_date else None,
            "status": self.status,
            "comments": self.comments,
            "attachments": self.attachments_json or [],
            "closureDate": self.closure_date.isoformat() if self.closure_date else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class PhysicalVerification(db.Model, TimestampMixin):
    """
    Physical inspection / GPS / mobile checklist verification log.
    Allows linking on-site physical proof (generator meter photo, water meter tag) to reported ESG figures.
    """
    __tablename__ = "physical_verifications"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    project_id = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=False, index=True)
    metric_code = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), nullable=False, default=PHYSICAL_NOT_VERIFIED)  # NOT_VERIFIED | PENDING | VERIFIED | REJECTED
    inspector_name = db.Column(db.String(120), nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    inspection_date = db.Column(db.Date, nullable=True)
    checklist_results = db.Column(db.JSON, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    evidence_document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=True)

    project = db.relationship("Project")
    evidence_document = db.relationship("Document")

    def to_dict(self):
        return {
            "id": self.id,
            "projectId": self.project_id,
            "metricCode": self.metric_code,
            "status": self.status,
            "inspectorName": self.inspector_name,
            "coordinates": {"lat": self.latitude, "lng": self.longitude} if self.latitude and self.longitude else None,
            "inspectionDate": self.inspection_date.isoformat() if self.inspection_date else None,
            "checklistResults": self.checklist_results or {},
            "notes": self.notes,
            "evidenceDocumentId": self.evidence_document_id,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
