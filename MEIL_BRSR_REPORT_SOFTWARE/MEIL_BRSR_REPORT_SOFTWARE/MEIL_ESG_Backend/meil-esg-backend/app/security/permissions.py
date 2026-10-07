"""
This is the module the company's review was most insistent on: "A Site Operator must never be
able to access another project by modifying an ID in the URL." Every route that takes a
project_id / organization_id / vendor_id in the path or payload should call one of these
functions before touching the database row, not just check the user's role.

The hierarchy is Organization(GROUP) -> Organization(SUBSIDIARY) -> BusinessUnit -> Project, so
"does this user's scope cover project X" means: walk up from X's business_unit.organization_id
through Organization.parent_id and see if any ancestor (or X's own BU, or X itself) is in the
user's granted scopes.
"""
from app.models.organization import Organization, BusinessUnit, Project
from app.models.user import SCOPE_GROUP, SCOPE_SUBSIDIARY, SCOPE_BUSINESS_UNIT, SCOPE_PROJECT, SCOPE_VENDOR


def _org_ancestor_ids(org_id):
    """Return [org_id, parent_id, grandparent_id, ...] up to the group root."""
    ids = []
    node = Organization.query.get(org_id)
    while node is not None:
        ids.append(node.id)
        node = Organization.query.get(node.parent_id) if node.parent_id else None
    return ids


def user_can_access_project(user, project_id):
    if user.has_role("GROUP_ADMIN", "ESG_MANAGER", "ASSESSOR", "EXECUTIVE_VIEWER"):
        # Group-wide roles still need *a* GROUP or SUBSIDIARY scope grant to prove they're
        # provisioned for this tenant — we don't treat "has the role" alone as "sees everything".
        if user.scope_ids(SCOPE_GROUP):
            return True
    project = Project.query.get(project_id)
    if project is None:
        return False
    if project.id in user.scope_ids(SCOPE_PROJECT):
        return True
    if project.business_unit_id in user.scope_ids(SCOPE_BUSINESS_UNIT):
        return True
    org_chain = _org_ancestor_ids(project.business_unit.organization_id)
    if set(org_chain) & set(user.scope_ids(SCOPE_SUBSIDIARY)):
        return True
    if user.scope_ids(SCOPE_GROUP):
        return True
    return False


def user_can_access_business_unit(user, business_unit_id):
    if user.scope_ids(SCOPE_GROUP):
        return True
    if business_unit_id in user.scope_ids(SCOPE_BUSINESS_UNIT):
        return True
    bu = BusinessUnit.query.get(business_unit_id)
    if bu is None:
        return False
    org_chain = _org_ancestor_ids(bu.organization_id)
    return bool(set(org_chain) & set(user.scope_ids(SCOPE_SUBSIDIARY)))


def user_can_access_organization(user, organization_id):
    if user.scope_ids(SCOPE_GROUP):
        return True
    org_chain = _org_ancestor_ids(organization_id)
    return bool(set(org_chain) & set(user.scope_ids(SCOPE_SUBSIDIARY)))


def user_can_access_vendor(user, vendor_id):
    if user.has_role("GROUP_ADMIN", "ESG_MANAGER", "ASSESSOR") and user.scope_ids(SCOPE_GROUP):
        return True
    return vendor_id in user.scope_ids(SCOPE_VENDOR)


def accessible_project_ids(user):
    """Used by list endpoints (GET /projects, GET /submissions, dashboards) to pre-filter a
    query instead of fetching everything and filtering in Python."""
    if user.scope_ids(SCOPE_GROUP):
        return None  # None == "no filter needed, sees everything"
    ids = set(user.scope_ids(SCOPE_PROJECT))
    bu_ids = set(user.scope_ids(SCOPE_BUSINESS_UNIT))
    for bu_id in bu_ids:
        ids.update(p.id for p in Project.query.filter_by(business_unit_id=bu_id).all())
    for sub_id in user.scope_ids(SCOPE_SUBSIDIARY):
        sub_ids = _descendant_org_ids(sub_id)
        for bu in BusinessUnit.query.filter(BusinessUnit.organization_id.in_(sub_ids)).all():
            ids.update(p.id for p in Project.query.filter_by(business_unit_id=bu.id).all())
    return list(ids)


def _descendant_org_ids(org_id):
    ids = [org_id]
    children = Organization.query.filter_by(parent_id=org_id).all()
    for c in children:
        ids.extend(_descendant_org_ids(c.id))
    return ids
