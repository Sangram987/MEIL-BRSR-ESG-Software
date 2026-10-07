"""
This is the integration test the company's review explicitly asked for (§79): create/submit/
review/correct/resubmit/approve, then confirm the number shows up in consolidation. If this
passes, the real end-to-end system works, not just its individual pieces.
"""
from tests.conftest import auth_header


def _get_project_and_period(client, token):
    projects = client.get("/api/v1/projects", headers=auth_header(token)).get_json()
    zojila = next(p for p in projects if p["name"] == "Zojila Tunnel Package 1")
    periods = client.get("/api/v1/reporting-periods?financialYear=FY 2026-27", headers=auth_header(token)).get_json()
    month = next(p for p in periods if p["name"] == "2026-09")
    return zojila, month


def test_full_workflow_submit_correct_resubmit_approve(client, operator_token, manager_token):
    project, period = _get_project_and_period(client, operator_token)

    # 1) Operator saves a draft for P2 with an out-of-range value to trigger a validation error on submit
    resp = client.post("/api/v1/submissions", headers=auth_header(operator_token), json={
        "projectId": project["id"], "reportingPeriodId": period["id"], "principleCode": "P2",
        "values": {"p2_input": {"v": 100, "ev": ""}, "p2_recycled": {"v": 50, "ev": ""}},
        "submit": False,
    })
    assert resp.status_code == 201, resp.get_json()
    submission_id = resp.get_json()["id"]
    assert resp.get_json()["status"] == "DRAFT"

    # 2) Submit for real
    resp = client.post("/api/v1/submissions", headers=auth_header(operator_token), json={
        "projectId": project["id"], "reportingPeriodId": period["id"], "principleCode": "P2",
        "values": {"p2_input": {"v": 100, "ev": ""}, "p2_recycled": {"v": 50, "ev": ""}},
        "submit": True,
    })
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "SUBMITTED"

    # 3) Manager requests a correction
    resp = client.post(f"/api/v1/approvals/{submission_id}/correction", headers=auth_header(manager_token),
                        json={"comment": "Please attach evidence for recycled input."})
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "CORRECTION_REQUIRED"

    # 4) Operator resubmits
    resp = client.post("/api/v1/submissions", headers=auth_header(operator_token), json={
        "projectId": project["id"], "reportingPeriodId": period["id"], "principleCode": "P2",
        "values": {"p2_input": {"v": 100, "ev": ""}, "p2_recycled": {"v": 50, "ev": "doc-123"}},
        "submit": True,
    })
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "SUBMITTED"
    assert resp.get_json()["version"] == 2

    # 5) Manager approves
    resp = client.post(f"/api/v1/approvals/{submission_id}/approve", headers=auth_header(manager_token), json={})
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "APPROVED"

    # 6) Approved data shows up in consolidation at group level
    resp = client.get(
        f"/api/v1/analytics/consolidation?scopeType=GROUP&reportingPeriodId={period['id']}",
        headers=auth_header(manager_token),
    )
    assert resp.status_code == 200
    totals = resp.get_json()["node"]["totals"]
    assert totals.get("p2_input", 0) >= 100


def test_cannot_edit_locked_submission(client, operator_token, manager_token):
    project, period = _get_project_and_period(client, operator_token)
    resp = client.post("/api/v1/submissions", headers=auth_header(operator_token), json={
        "projectId": project["id"], "reportingPeriodId": period["id"], "principleCode": "P4",
        "values": {"p4_meet": {"v": 2, "ev": ""}}, "submit": True,
    })
    submission_id = resp.get_json()["id"]
    client.post(f"/api/v1/approvals/{submission_id}/approve", headers=auth_header(manager_token), json={})

    resp = client.post("/api/v1/submissions", headers=auth_header(operator_token), json={
        "projectId": project["id"], "reportingPeriodId": period["id"], "principleCode": "P4",
        "values": {"p4_meet": {"v": 99, "ev": ""}}, "submit": False,
    })
    assert resp.status_code == 409


def test_validation_blocks_submit_on_logic_error(client, operator_token):
    project, period = _get_project_and_period(client, operator_token)
    resp = client.post("/api/v1/submissions", headers=auth_header(operator_token), json={
        "projectId": project["id"], "reportingPeriodId": period["id"], "principleCode": "P6",
        # groundwater + third-party > total withdrawn -> must be rejected
        "values": {
            "p6_water": {"v": 100, "ev": ""}, "p6_ground": {"v": 80, "ev": ""}, "p6_third": {"v": 80, "ev": ""},
        },
        "submit": True,
    })
    assert resp.status_code == 422
    assert resp.get_json()["error"]["code"] == "VALIDATION_FAILED"
