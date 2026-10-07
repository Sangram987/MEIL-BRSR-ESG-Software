from flask import Blueprint, request, jsonify, g, send_file
import io
from app.extensions import db
from app.models.evidence import Document, MetricEvidence
from app.models.submission import EsgValue
from app.security.decorators import authenticated
from app.services.storage_service import store_bytes, read_bytes, sha256_of, validate_upload
from app.utils.errors import ApiError

bp = Blueprint("evidence", __name__, url_prefix="/documents")


@bp.post("")
@authenticated
def upload_document():
    if "file" not in request.files:
        raise ApiError("No file part in the request.", 422)
    f = request.files["file"]
    if not f.filename:
        raise ApiError("No file selected.", 422)
    data = f.read()
    ok, msg = validate_upload(f.filename, len(data))
    if not ok:
        raise ApiError(msg, 422, code="INVALID_FILE")

    digest = sha256_of(data)
    existing = Document.query.filter_by(sha256=digest, status="ACTIVE").first()
    if existing:
        return jsonify(existing.to_dict())  # identical file already on record — no duplicate upload

    key = f"evidence/{digest[:2]}/{digest}_{f.filename}"
    store_bytes(data, key)
    doc = Document(original_filename=f.filename, storage_key=key, mime_type=f.mimetype,
                    size_bytes=len(data), sha256=digest, uploaded_by_id=g.current_user.id)
    db.session.add(doc)
    db.session.commit()
    return jsonify(doc.to_dict()), 201


@bp.get("/<document_id>")
@authenticated
def download_document(document_id):
    doc = Document.query.get_or_404(document_id)
    data = read_bytes(doc.storage_key)
    return send_file(io.BytesIO(data), mimetype=doc.mime_type or "application/octet-stream",
                      as_attachment=True, download_name=doc.original_filename)


@bp.post("/<document_id>/link")
@authenticated
def link_to_value(document_id):
    """Attaches an already-uploaded document to a specific reported value. Two-step upload (file
    first, link second) lets the frontend show an upload progress state before the value is even
    saved, matching the existing React form's UX."""
    body = request.get_json(force=True) or {}
    esg_value_id = body.get("esgValueId")
    value = EsgValue.query.get(esg_value_id) if esg_value_id else None
    if value is None:
        raise ApiError("esgValueId must reference an existing value.", 422)
    link = MetricEvidence(esg_value_id=value.id, document_id=document_id, description=body.get("description"))
    db.session.add(link)
    db.session.commit()
    return jsonify({"id": link.id, "documentId": document_id, "esgValueId": value.id}), 201
