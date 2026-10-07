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
