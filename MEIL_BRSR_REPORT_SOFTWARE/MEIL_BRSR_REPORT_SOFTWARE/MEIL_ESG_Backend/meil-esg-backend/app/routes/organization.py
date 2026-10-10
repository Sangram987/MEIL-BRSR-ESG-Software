from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.models.organization import Organization, OrganizationRelationship, BusinessUnit, Project
from app.models.period import ReportingPeriod
from app.models.base import CodeSequence
from app.security.decorators import roles_required, authenticated, organization_scope_required
from app.security.permissions import accessible_project_ids
from app.utils.errors import ApiError
from app.utils.audit import record

bp = Blueprint("organization", __name__)


@bp.get("/organizations/hierarchy")
@bp.get("/organizations/tree")
@authenticated
def org_tree():
    group = Organization.query.filter_by(type="GROUP").first()
    if group is None:
        return jsonify({"group": None, "subsidiaries": []})

    def sub_dict(org):
        relationship = OrganizationRelationship.query.filter_by(
            child_org_id=org.id
        ).first()

        return {
            **org.to_dict(),
            "relationshipType": relationship.relationship_type if relationship else None,
            "ownershipPercentage": float(relationship.ownership_percentage) if relationship and relationship.ownership_percentage is not None else None,
            "participatesInBrInitiatives": relationship.participates_in_br_initiatives if relationship else True,
            "businessUnits": [
                {
                    **bu.to_dict(),
                    "projects": [p.to_dict() for p in bu.projects],
                }
                for bu in org.business_units
            ],
        }

    subs = Organization.query.filter(Organization.parent_id == group.id).all()
    return jsonify({"group": group.to_dict(), "subsidiaries": [sub_dict(s) for s in subs]})


@bp.post("/organizations")
@roles_required("GROUP_ADMIN", "ESG_MANAGER")
def create_organization():
    body = request.get_json(force=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        raise ApiError("name is required.", 422)
    parent_id = body.get("parentId")
    code = body.get("code") or f"ORG-{CodeSequence.next('organization')}"
    org = Organization(code=code, name=name, type=body.get("type", "SUBSIDIARY"), parent_id=parent_id)
    db.session.add(org)
    db.session.flush()
    if parent_id:
        db.session.add(OrganizationRelationship(
            parent_org_id=parent_id, child_org_id=org.id,
            relationship_type=body.get("relationshipType", "SUBSIDIARY"),
            ownership_percentage=body.get("ownershipPercentage", 100),
        ))
    record("ENTITY_ADDED", "Organization", org.id, details=name)
    db.session.commit()
    return jsonify(org.to_dict()), 201


@bp.patch("/organizations/<organization_id>")
@roles_required("GROUP_ADMIN", "ESG_MANAGER")
@organization_scope_required(("organization_id",))
def update_organization(organization_id):
    org = Organization.query.get_or_404(organization_id)
    body = request.get_json(force=True) or {}
    old = org.to_dict()
    for field in ("name", "status", "type"):
        if field in body:
            setattr(org, field, body[field])
    if "relationshipType" in body:
        rel = OrganizationRelationship.query.filter_by(child_org_id=org.id).first()
        if rel:
            rel.relationship_type = body["relationshipType"]
    record("BOUNDARY_UPDATED", "Organization", org.id, old_value=old, new_value=org.to_dict())
    db.session.commit()
    return jsonify(org.to_dict())


@bp.get("/business-units")
@authenticated
def list_business_units():
    org_id = request.args.get("organizationId")
    q = BusinessUnit.query
    if org_id:
        q = q.filter_by(organization_id=org_id)
    return jsonify([b.to_dict() for b in q.all()])


@bp.post("/business-units")
@roles_required("GROUP_ADMIN", "ESG_MANAGER")
def create_business_unit():
    body = request.get_json(force=True) or {}
    if not body.get("name") or not body.get("organizationId"):
        raise ApiError("name and organizationId are required.", 422)
    bu = BusinessUnit(code=body.get("code") or f"BU-{CodeSequence.next('business_unit')}",
                       name=body["name"], organization_id=body["organizationId"])
    db.session.add(bu)
    record("ENTITY_ADDED", "BusinessUnit", bu.code, details=body["name"])
    db.session.commit()
    return jsonify(bu.to_dict()), 201


@bp.get("/projects")
@authenticated
def list_projects():
    user = g.current_user
    allowed = accessible_project_ids(user)
    q = Project.query
    bu_id = request.args.get("businessUnitId")
    if bu_id:
        q = q.filter_by(business_unit_id=bu_id)
    if allowed is not None:
        q = q.filter(Project.id.in_(allowed or ["__none__"]))
    return jsonify([p.to_dict() for p in q.all()])


@bp.get("/projects/<project_id>")
@authenticated
def get_project(project_id):
    from app.security.permissions import user_can_access_project
    if not user_can_access_project(g.current_user, project_id):
        raise ApiError("You do not have access to this project.", 403)
    project = Project.query.get_or_404(project_id)
    return jsonify(project.to_dict())


@bp.post("/projects")
@roles_required("GROUP_ADMIN", "ESG_MANAGER")
def create_project():
    body = request.get_json(force=True) or {}
    if not body.get("name") or not body.get("businessUnitId"):
        raise ApiError("name and businessUnitId are required.", 422)
    project = Project(
        project_code=body.get("projectCode") or f"PRJ-{CodeSequence.next('project')}",
        name=body["name"], business_unit_id=body["businessUnitId"], state=body.get("state"),
        country=body.get("country", "India"), latitude=body.get("latitude"), longitude=body.get("longitude"),
        turnover_cr=body.get("turnoverCr", 0),
    )
    db.session.add(project)
    record("ENTITY_ADDED", "Project", project.project_code, details=body["name"])
    db.session.commit()
    return jsonify(project.to_dict()), 201


@bp.patch("/projects/<project_id>")
@roles_required("GROUP_ADMIN", "ESG_MANAGER", "BU_MANAGER")
def update_project(project_id):
    from app.security.permissions import user_can_access_project
    if not user_can_access_project(g.current_user, project_id):
        raise ApiError("You do not have access to this project.", 403)
    project = Project.query.get_or_404(project_id)
    body = request.get_json(force=True) or {}
    old = project.to_dict()
    for field in ("name", "state", "status", "turnoverCr", "isLive"):
        key = {"turnoverCr": "turnover_cr", "isLive": "is_live"}.get(field, field)
        if field in body:
            setattr(project, key, body[field])
    record("PROJECT_UPDATED", "Project", project.id, old_value=old, new_value=project.to_dict())
    db.session.commit()
    return jsonify(project.to_dict())


@bp.get("/reporting-periods")
@authenticated
def list_reporting_periods():
    fy = request.args.get("financialYear")
    q = ReportingPeriod.query
    if fy:
        q = q.filter_by(financial_year=fy)
    return jsonify([p.to_dict() for p in q.order_by(ReportingPeriod.start_date).all()])
