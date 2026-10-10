import io
import pytest
from PIL import Image, ImageDraw
from app.services.fact_extraction_service import run_document_extraction
from app.services.forensics_service import (
    run_single_doc_verification, run_cross_doc_verification,
    run_temporal_verification, run_anomaly_detector, meta_auditor_reconciliation
)
from app.models.organization import Project
from app.models.user import User
from flask_jwt_extended import create_access_token


def test_real_ocr_extraction_on_image():
    # Generate image with real text
    img = Image.new('RGB', (800, 600), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((50, 50), 'Indian Oil Corporation Limited', fill=(0, 0, 0))
    draw.text((50, 100), 'GSTIN: 36AABCB1234A1Z5', fill=(0, 0, 0))
    draw.text((50, 150), 'Invoice No: IOCL-2026-9812', fill=(0, 0, 0))
    draw.text((50, 200), 'Diesel Qty: 4500 Litres', fill=(0, 0, 0))
    draw.text((50, 250), 'Total Amount: 405000 INR', fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format='PNG')

    res = run_document_extraction(buf.getvalue(), 'invoice.png')
    assert res['totalPages'] == 1
    assert len(res['facts']) >= 3
    fact_types = {f['factType'] for f in res['facts']}
    assert 'gstin' in fact_types
    assert 'invoice_number' in fact_types
    assert 'diesel_litres' in fact_types

    # Ensure no bounding box is hardcoded
    for f in res['facts']:
        assert 'boundingBox' in f
        assert f['boundingBox']['width'] > 0


def test_cross_doc_verification_not_enough_evidence():
    facts = [{'factType': 'diesel_litres', 'normalizedValue': 5000.0}]
    # No site reported value provided
    res = run_cross_doc_verification(facts, site_reported_value=None)
    assert res['matched'] is False
    assert res['status'] == 'NOT_ENOUGH_EVIDENCE'


def test_temporal_verification_real_baseline(app):
    with app.app_context():
        # Passing real history array
        res = run_temporal_verification(10000.0, historical_values=[9500.0, 9800.0, 10200.0, 9900.0])
        assert res['hasHistory'] is True
        assert res['trendStatus'] == 'STABLE'

        # Insufficient history
        res_no_hist = run_temporal_verification(10000.0, historical_values=[])
        assert res_no_hist['hasHistory'] is False
        assert res_no_hist['trendStatus'] == 'INSUFFICIENT_BASELINE'


def test_physical_verification_zero_when_unverified(app):
    with app.app_context():
        s_res = {'passed': True}
        c_res = {'status': 'CONSISTENT', 'diffPct': 1.0}
        t_res = {'isSpike': False}
        a_res = {'isOutlier': False}
        res = meta_auditor_reconciliation(
            s_res, c_res, t_res, a_res,
            has_evidence=True, physical_status='NOT_VERIFIED'
        )
        assert res['components']['physicalVerification'] == 0.0
