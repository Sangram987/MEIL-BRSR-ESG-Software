from tests.conftest import auth_header


def test_operator_cannot_access_a_project_outside_their_scope(client, operator_token):
    """The company's review's central concern: editing an id in the URL must not grant access."""
    resp = client.get("/api/v1/projects", headers=auth_header(operator_token))
    all_ids = {p["id"] for p in resp.get_json()}
    operator_project = resp.get_json()[0] if resp.get_json() else None
    assert operator_project is not None

    # Find a project the operator should NOT see (any project not in their own list, discovered
    # via an admin token so the test doesn't depend on internal id generation order).
    import json
    admin_resp = client.post("/api/v1/auth/login", json={"email": "r.kumar@meil.in", "password": "Password123"})
    admin_token = admin_resp.get_json()["accessToken"]
    all_projects = client.get("/api/v1/projects", headers=auth_header(admin_token)).get_json()
    foreign_project = next(p for p in all_projects if p["id"] not in all_ids)

    resp = client.get(f"/api/v1/projects/{foreign_project['id']}", headers=auth_header(operator_token))
    assert resp.status_code == 403


def test_operator_cannot_approve_a_submission(client, operator_token, manager_token):
    """A Site Operator must never be able to approve their own submission."""
    projects = client.get("/api/v1/projects", headers=auth_header(operator_token)).get_json()
    project = projects[0]
    periods = client.get("/api/v1/reporting-periods?financialYear=FY 2026-27", headers=auth_header(operator_token)).get_json()
    month = next(p for p in periods if p["name"] == "2026-09")

    resp = client.post("/api/v1/submissions", headers=auth_header(operator_token), json={
        "projectId": project["id"], "reportingPeriodId": month["id"], "principleCode": "P7",
        "values": {"p7_assoc": {"v": 2, "ev": ""}}, "submit": True,
    })
    submission_id = resp.get_json()["id"]

    resp = client.post(f"/api/v1/approvals/{submission_id}/approve", headers=auth_header(operator_token), json={})
    assert resp.status_code == 403


def test_vendor_cannot_access_another_vendor(client):
    resp = client.post("/api/v1/auth/register", json={
        "email": "vendorA@example.com", "password": "Password123", "firstName": "Vendor", "role": "VENDOR_USER",
    })
    token_a = resp.get_json()["accessToken"]

    resp = client.get("/api/v1/vendors", headers=auth_header(token_a))
    all_vendors = resp.get_json()
    assert len(all_vendors) >= 2
    other_vendor = all_vendors[-1]

    resp = client.get(f"/api/v1/vendors/{other_vendor['id']}", headers=auth_header(token_a))
    assert resp.status_code == 403


def test_assurance_independence_rule_blocks_internal_auditor(client, app):
    """SEBI's rule, enforced server-side regardless of what the frontend sends."""
    from app.extensions import db
    from app.models.user import User, Role, UserRole, UserScope, SCOPE_GROUP
    from app.models.organization import Organization
    from app.security.passwords import hash_password

    with app.app_context():
        assessor_role = Role.query.filter_by(code="ASSESSOR").first()
        group = Organization.query.filter_by(type="GROUP").first()
        user = User(email="assessor2@example.com", password_hash=hash_password("Password123"),
                    first_name="Assessor", last_name="Two", status="ACTIVE")
        db.session.add(user)
        db.session.flush()
        db.session.add(UserRole(user_id=user.id, role_id=assessor_role.id))
        db.session.add(UserScope(user_id=user.id, scope_type=SCOPE_GROUP, scope_id=group.id))
        db.session.commit()

    from tests.conftest import auth_header as _h
    login = client.post("/api/v1/auth/login", json={"email": "assessor2@example.com", "password": "Password123"})
    token = login.get_json()["accessToken"]

    from app.models.period import ReportingPeriod
    with app.app_context():
        period = ReportingPeriod.query.filter_by(financial_year="FY 2026-27", period_type="FINANCIAL_YEAR").first()
        org = Organization.query.filter_by(type="GROUP").first()
        period_id, org_id = period.id, org.id

    resp = client.put(
        "/api/v1/assessments/engagements/ghg", headers=_h(token),
        json={
            "reportingPeriodId": period_id, "organizationId": org_id,
            "mode": "ASSURANCE", "status": "Reasonable assurance",
            "provider": "Internal Audit Dept", "providerType": "INTERNAL_AUDIT",
            "independenceConfirmed": True,
        },
    )
    assert resp.status_code == 422
    assert resp.get_json()["error"]["code"] == "ASSURANCE_INDEPENDENCE_VIOLATION"
