import io
import json
import pytest
from PIL import Image, ImageDraw
import pandas as pd
from app.models.evidence import EvidenceBatch, BatchItem, Document, MetricEvidence
from app.models.submission import EsgSubmission, EsgValue
from app.models.forensics import VerificationResult, TrustScore
from app.models.organization import Project
from app.models.period import ReportingPeriod
from tests.conftest import auth_header


def _create_sample_fuel_invoice_image():
    """Generates an in-memory PNG invoice with clear text lines."""
    img = Image.new("RGB", (900, 700), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((50, 40), "Bharat Petroleum Corporation Ltd", fill=(0, 0, 0))
    draw.text((50, 90), "GSTIN: 36AABCB1234A1Z5", fill=(0, 0, 0))
    draw.text((50, 140), "Invoice No: BPCL-2026-9921", fill=(0, 0, 0))
    draw.text((50, 190), "Diesel Qty: 4500 Litres", fill=(0, 0, 0))
    draw.text((50, 240), "Rate: 90.00 INR/Ltr", fill=(0, 0, 0))
    draw.text((50, 290), "Total Amount: 405000 INR", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _create_sample_csv_log():
    """Generates an in-memory CSV dataset with ESG energy & fuel rows."""
    df = pd.DataFrame({
        "Date": ["2026-09-01", "2026-09-02", "2026-09-03"],
        "DG_Set_Diesel_Litres": [1200.0, 1500.0, 1800.0],
        "Fuel_Cost_INR": [108000.0, 135000.0, 162000.0],
        "Grid_Electricity_kWh": [3200.0, 3100.0, 3400.0]
    })
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    return buf.getvalue()


def _get_project_and_period(client, token):
    projects = client.get("/api/v1/projects", headers=auth_header(token)).get_json()
    zojila = next(p for p in projects if "Zojila" in p["name"])
    periods = client.get("/api/v1/reporting-periods?financialYear=FY 2026-27", headers=auth_header(token)).get_json()
    month = next(p for p in periods if p["name"] == "2026-09")
    return zojila, month


def test_batch_creation_and_auto_detection(client, operator_token, app):
    """Verifies Option A batch upload with multi-file ingest, OCR, and classification."""
    project, period = _get_project_and_period(client, operator_token)
    project_id = project["id"]
    period_id = period["id"]

    img_bytes = _create_sample_fuel_invoice_image()
    csv_bytes = _create_sample_csv_log()

    data = {
        "projectId": project_id,
        "reportingPeriodId": period_id,
        "files": [
            (io.BytesIO(img_bytes), "bpcl_fuel_invoice.png"),
            (io.BytesIO(csv_bytes), "dg_energy_september.csv"),
        ]
    }

    # Upload batch with sync processing in test environment
    res = client.post(
        "/api/v1/evidence/batches?sync=true",
        headers=auth_header(operator_token),
        data=data,
        content_type="multipart/form-data"
    )
    assert res.status_code == 201, res.get_json()
    batch_res = res.get_json()
    batch_id = batch_res["batchId"]
    assert batch_res["totalFiles"] == 2
    assert batch_res["status"] in ("COMPLETED", "PROCESSING")

    # Fetch batch details
    res_details = client.get(
        f"/api/v1/evidence/batches/{batch_id}",
        headers=auth_header(operator_token)
    )
    assert res_details.status_code == 200
    details = res_details.get_json()
    assert details["id"] == batch_id
    assert len(details["items"]) == 2

    # Check fuel invoice classification & fact extraction
    img_item = next(i for i in details["items"] if "bpcl" in i["originalFilename"])
    assert img_item["status"] == "EXTRACTED"
    assert img_item["docType"] == "FUEL_INVOICE"
    assert img_item["detectedMetricCode"] in ("p6_dg", "p6_mach")
    assert img_item["detectedUnit"] == "Litres"
    # Never confuse financial INR amount with physical volume!
    assert img_item["detectedValue"] == 4500.0
    assert img_item["effectiveValue"] == 4500.0
    assert img_item["qualityAcceptable"] is True
    assert img_item["confidence"] >= 0.8

    # Check CSV tabular log extraction
    csv_item = next(i for i in details["items"] if "energy" in i["originalFilename"])
    assert csv_item["status"] == "EXTRACTED"
    assert csv_item["effectiveValue"] > 0


def test_batch_file_validation_error_handling(client, operator_token, app):
    """Verifies that invalid or corrupted files fail individually without failing the entire batch."""
    project, period = _get_project_and_period(client, operator_token)
    project_id = project["id"]
    period_id = period["id"]

    img_bytes = _create_sample_fuel_invoice_image()
    corrupt_bytes = b"NOT_A_VALID_DOCUMENT_SIGNATURE_BINARY_GARBAGE"

    data = {
        "projectId": project_id,
        "reportingPeriodId": period_id,
        "files": [
            (io.BytesIO(img_bytes), "valid_invoice.png"),
            (io.BytesIO(corrupt_bytes), "corrupt_file.pdf"),
            (io.BytesIO(b""), "empty_file.png"),
        ]
    }

    res = client.post(
        "/api/v1/evidence/batches?sync=true",
        headers=auth_header(operator_token),
        data=data,
        content_type="multipart/form-data"
    )
    assert res.status_code == 201
    batch_res = res.get_json()
    items = batch_res["batch"]["items"]
    assert len(items) == 3

    valid_item = next(i for i in items if i["originalFilename"] == "valid_invoice.png")
    corrupt_item = next(i for i in items if i["originalFilename"] == "corrupt_file.pdf")
    empty_item = next(i for i in items if i["originalFilename"] == "empty_file.png")

    assert valid_item["status"] in ("EXTRACTED", "PENDING", "PROCESSING")
    assert corrupt_item["status"] == "FAILED"
    assert empty_item["status"] == "FAILED"


def test_batch_item_user_override_and_delete(client, operator_token, app):
    """Verifies that reviewers can edit detected metrics/values and delete items in the review table."""
    project, period = _get_project_and_period(client, operator_token)
    project_id = project["id"]
    period_id = period["id"]

    img_bytes = _create_sample_fuel_invoice_image()
    res = client.post(
        "/api/v1/evidence/batches?sync=true",
        headers=auth_header(operator_token),
        data={
            "projectId": project_id,
            "reportingPeriodId": period_id,
            "files": [(io.BytesIO(img_bytes), "sample.png")]
        },
        content_type="multipart/form-data"
    )
    assert res.status_code == 201
    batch_id = res.get_json()["batchId"]
    item_id = res.get_json()["batch"]["items"][0]["id"]

    # User overrides detected quantity from 4500 to 4600 and changes metric to p6_mach
    patch_res = client.patch(
        f"/api/v1/evidence/batches/{batch_id}/items/{item_id}",
        headers=auth_header(operator_token),
        json={
            "metricCode": "p6_mach",
            "value": 4600.0,
            "unit": "Litres",
            "isReviewed": True
        }
    )
    assert patch_res.status_code == 200
    patched = patch_res.get_json()
    assert patched["effectiveMetricCode"] == "p6_mach"
    assert patched["effectiveValue"] == 4600.0
    assert patched["isReviewed"] is True

    # User deletes an item
    del_res = client.delete(
        f"/api/v1/evidence/batches/{batch_id}/items/{item_id}",
        headers=auth_header(operator_token)
    )
    assert del_res.status_code == 200
    assert del_res.get_json()["success"] is True


def test_batch_commit_persists_to_db_and_runs_forensics(client, operator_token, app):
    """Verifies that committing a batch creates real EsgValue, MetricEvidence, and VerificationResult records."""
    project, period = _get_project_and_period(client, operator_token)
    project_id = project["id"]
    period_id = period["id"]

    img_bytes = _create_sample_fuel_invoice_image()
    res = client.post(
        "/api/v1/evidence/batches?sync=true",
        headers=auth_header(operator_token),
        data={
            "projectId": project_id,
            "reportingPeriodId": period_id,
            "files": [(io.BytesIO(img_bytes), "final_commit_invoice.png")]
        },
        content_type="multipart/form-data"
    )
    assert res.status_code == 201
    batch_id = res.get_json()["batchId"]

    # Commit batch
    commit_res = client.post(
        f"/api/v1/evidence/batches/{batch_id}/commit",
        headers=auth_header(operator_token),
        json={}
    )
    assert commit_res.status_code == 200
    commit_data = commit_res.get_json()
    assert commit_data["committedCount"] >= 1
    assert commit_data["status"] == "COMMITTED"

    # Verify persisted DB records
    with app.app_context():
        batch = EvidenceBatch.query.get(batch_id)
        assert batch.status == "COMMITTED"
        item = batch.items[0]
        assert item.is_committed is True
        assert item.esg_value_id is not None

        # Verify EsgValue exists
        esg_val = EsgValue.query.get(item.esg_value_id)
        assert esg_val is not None
        assert float(esg_val.numeric_value) == 4500.0
        assert esg_val.source_type == "EVIDENCE_VERIFIED"

        # Verify MetricEvidence linked
        me = MetricEvidence.query.filter_by(esg_value_id=esg_val.id).first()
        assert me is not None
        assert me.document_id == item.document_id

        # Verify VerificationResult created
        v_res = VerificationResult.query.filter_by(document_id=item.document_id).first()
        assert v_res is not None
        assert v_res.overall_status in ("VERIFIED", "POTENTIAL_ANOMALY", "REVIEW_REQUIRED")

        # Verify TrustScore created
        ts = TrustScore.query.filter_by(document_id=item.document_id).first()
        assert ts is not None
        assert 0 <= ts.score <= 100


def test_batch_upload_unauthorized_project_forbidden(client, operator_token, app):
    """Verifies that operators cannot create a batch for project sites outside their scope."""
    img_bytes = _create_sample_fuel_invoice_image()
    res = client.post(
        "/api/v1/evidence/batches?sync=true",
        headers=auth_header(operator_token),
        data={
            "projectId": "non-existent-or-forbidden-project-999",
            "files": [(io.BytesIO(img_bytes), "unauthorized.png")]
        },
        content_type="multipart/form-data"
    )
    assert res.status_code in (403, 422)
