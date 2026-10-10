from app.extensions import db
from app.models.base import TimestampMixin, gen_uuid

VERIFICATION_PENDING = "PENDING"
VERIFICATION_VERIFIED = "VERIFIED"
VERIFICATION_DISCREPANCY = "DISCREPANCY"


class Document(db.Model, TimestampMixin):
    """Metadata only — the actual bytes live in object storage (MinIO/S3, or the local-disk
    fallback in dev; see services/storage_service.py). `sha256` gives traceability and lets the
    API detect if a file is re-uploaded unchanged."""
    __tablename__ = "documents"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    original_filename = db.Column(db.String(255), nullable=False)
    storage_key = db.Column(db.String(500), nullable=False)
    mime_type = db.Column(db.String(120))
    size_bytes = db.Column(db.Integer)
    sha256 = db.Column(db.String(64), index=True)
    uploaded_by_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")  # ACTIVE | DELETED

    def to_dict(self):
        return {
            "id": self.id, "filename": self.original_filename, "mimeType": self.mime_type,
            "sizeBytes": self.size_bytes, "sha256": self.sha256,
            "uploadedAt": self.created_at.isoformat() if self.created_at else None,
        }


class MetricEvidence(db.Model, TimestampMixin):
    """Links one evidence document to one reported value. verification_status is set by a
    reviewer (manually today; extraction-assisted comparison is a documented extension point in
    services/validation_service.py::compare_evidence)."""
    __tablename__ = "metric_evidence"
    id = db.Column(db.Integer, primary_key=True)
    esg_value_id = db.Column(db.Integer, db.ForeignKey("esg_values.id"), nullable=False)
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=False)
    description = db.Column(db.String(255))
    verification_status = db.Column(db.String(20), nullable=False, default=VERIFICATION_PENDING)
    verified_by_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    verified_at = db.Column(db.DateTime(timezone=True))

    esg_value = db.relationship("EsgValue", back_populates="evidence_links")
    document = db.relationship("Document")


BATCH_PENDING = "PENDING"
BATCH_PROCESSING = "PROCESSING"
BATCH_COMPLETED = "COMPLETED"
BATCH_PARTIALLY_FAILED = "PARTIALLY_FAILED"
BATCH_FAILED = "FAILED"
BATCH_COMMITTED = "COMMITTED"

ITEM_PENDING = "PENDING"
ITEM_PROCESSING = "PROCESSING"
ITEM_EXTRACTED = "EXTRACTED"
ITEM_FAILED = "FAILED"
ITEM_COMMITTED = "COMMITTED"


class EvidenceBatch(db.Model, TimestampMixin):
    """Represents a multi-file batch upload session bound to a project site and reporting period."""
    __tablename__ = "evidence_batches"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    project_id = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=False, index=True)
    reporting_period_id = db.Column(db.String(36), db.ForeignKey("reporting_periods.id"), nullable=False, index=True)
    created_by_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(30), nullable=False, default=BATCH_PENDING)
    total_files = db.Column(db.Integer, default=0)
    processed_files = db.Column(db.Integer, default=0)
    failed_files = db.Column(db.Integer, default=0)
    error_message = db.Column(db.Text, nullable=True)

    project = db.relationship("Project")
    reporting_period = db.relationship("ReportingPeriod")
    created_by = db.relationship("User")
    items = db.relationship("BatchItem", back_populates="batch", cascade="all, delete-orphan", order_by="BatchItem.created_at")

    def to_dict(self, include_items=True):
        res = {
            "id": self.id,
            "projectId": self.project_id,
            "projectName": self.project.name if self.project else None,
            "reportingPeriodId": self.reporting_period_id,
            "reportingPeriodName": self.reporting_period.name if self.reporting_period else None,
            "financialYear": self.reporting_period.financial_year if self.reporting_period else None,
            "createdById": self.created_by_id,
            "status": self.status,
            "totalFiles": self.total_files,
            "processedFiles": self.processed_files,
            "failedFiles": self.failed_files,
            "errorMessage": self.error_message,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_items:
            res["items"] = [item.to_dict() for item in self.items]
        return res


class BatchItem(db.Model, TimestampMixin):
    """Represents an individual document/table in a batch, with OCR, auto-classification, and extracted facts."""
    __tablename__ = "batch_items"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    batch_id = db.Column(db.String(36), db.ForeignKey("evidence_batches.id"), nullable=False, index=True)
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=True, index=True)
    original_filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50))
    file_size = db.Column(db.Integer)
    sha256 = db.Column(db.String(64), index=True)
    status = db.Column(db.String(30), nullable=False, default=ITEM_PENDING)
    error_message = db.Column(db.Text, nullable=True)
    retry_count = db.Column(db.Integer, default=0)

    # Classification & extraction results
    doc_type = db.Column(db.String(60), default="UNKNOWN")
    detected_metric_code = db.Column(db.String(60), nullable=True)
    detected_metric_name = db.Column(db.String(120), nullable=True)
    detected_value = db.Column(db.Numeric(18, 4), nullable=True)
    detected_unit = db.Column(db.String(30), nullable=True)
    confidence = db.Column(db.Float, default=0.0)
    ocr_confidence = db.Column(db.Float, default=0.0)
    quality_score = db.Column(db.Float, nullable=True)
    quality_acceptable = db.Column(db.Boolean, default=True)
    warnings = db.Column(db.JSON, nullable=True)
    bounding_box = db.Column(db.JSON, nullable=True)
    page_number = db.Column(db.Integer, default=1)
    source_snippet = db.Column(db.Text, nullable=True)
    raw_facts = db.Column(db.JSON, nullable=True)
    user_overrides = db.Column(db.JSON, nullable=True)
    is_reviewed = db.Column(db.Boolean, default=False)
    is_committed = db.Column(db.Boolean, default=False)
    esg_value_id = db.Column(db.Integer, db.ForeignKey("esg_values.id"), nullable=True)

    batch = db.relationship("EvidenceBatch", back_populates="items")
    document = db.relationship("Document")
    esg_value = db.relationship("EsgValue")

    def effective_metric_code(self):
        if self.user_overrides and "metricCode" in self.user_overrides:
            return self.user_overrides["metricCode"]
        return self.detected_metric_code

    def effective_value(self):
        if self.user_overrides and "value" in self.user_overrides:
            val = self.user_overrides["value"]
            return float(val) if val is not None else None
        return float(self.detected_value) if self.detected_value is not None else None

    def effective_unit(self):
        if self.user_overrides and "unit" in self.user_overrides:
            return self.user_overrides["unit"]
        return self.detected_unit

    def to_dict(self):
        return {
            "id": self.id,
            "batchId": self.batch_id,
            "documentId": self.document_id,
            "originalFilename": self.original_filename,
            "fileType": self.file_type,
            "fileSize": self.file_size,
            "sha256": self.sha256,
            "status": self.status,
            "errorMessage": self.error_message,
            "retryCount": self.retry_count,
            "docType": self.doc_type,
            "detectedMetricCode": self.detected_metric_code,
            "detectedMetricName": self.detected_metric_name,
            "detectedValue": float(self.detected_value) if self.detected_value is not None else None,
            "detectedUnit": self.detected_unit,
            "effectiveMetricCode": self.effective_metric_code(),
            "effectiveValue": self.effective_value(),
            "effectiveUnit": self.effective_unit(),
            "confidence": round(self.confidence, 2) if self.confidence else 0.0,
            "ocrConfidence": round(self.ocr_confidence, 2) if self.ocr_confidence else 0.0,
            "qualityScore": round(self.quality_score, 1) if self.quality_score is not None else None,
            "qualityAcceptable": self.quality_acceptable,
            "warnings": self.warnings or [],
            "boundingBox": self.bounding_box,
            "pageNumber": self.page_number,
            "sourceSnippet": self.source_snippet,
            "rawFacts": self.raw_facts or [],
            "userOverrides": self.user_overrides,
            "isReviewed": self.is_reviewed,
            "isCommitted": self.is_committed,
            "esgValueId": self.esg_value_id,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }

