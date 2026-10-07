from app.extensions import db
from app.models.notification import Notification
from app.models.user import User, UserScope, SCOPE_PROJECT, SCOPE_BUSINESS_UNIT, SCOPE_GROUP


def notify_user(user_id, type_, message, title=None, link=None):
    n = Notification(user_id=user_id, type=type_, title=title, message=message, link=link)
    db.session.add(n)
    return n


def notify_project_watchers(project_id, type_, message, link=None, roles=("SITE_OPERATOR",)):
    """Notifies every user whose scope covers this project and who holds one of `roles` — used
    e.g. to tell a Site Operator their submission was approved/sent back."""
    users = (
        User.query.join(UserScope, UserScope.user_id == User.id)
        .filter(UserScope.scope_type == SCOPE_PROJECT, UserScope.scope_id == project_id)
        .all()
    )
    for u in users:
        if u.has_role(*roles):
            notify_user(u.id, type_, message, link=link)


def notify_business_unit(business_unit_id, type_, message, link=None, roles=("BU_MANAGER",)):
    users = (
        User.query.join(UserScope, UserScope.user_id == User.id)
        .filter(UserScope.scope_type == SCOPE_BUSINESS_UNIT, UserScope.scope_id == business_unit_id)
        .all()
    )
    for u in users:
        if u.has_role(*roles):
            notify_user(u.id, type_, message, link=link)


def notify_vendor_users(vendor_id, type_, message, link=None):
    """Notifies every VENDOR_USER account scoped to this vendor."""
    from app.models.user import SCOPE_VENDOR
    users = (
        User.query.join(UserScope, UserScope.user_id == User.id)
        .filter(UserScope.scope_type == SCOPE_VENDOR, UserScope.scope_id == vendor_id)
        .all()
    )
    for u in users:
        if u.has_role("VENDOR_USER"):
            notify_user(u.id, type_, message, link=link)


def notify_group_role(type_, message, link=None, roles=("GROUP_ADMIN", "ESG_MANAGER")):
    users = (
        User.query.join(UserScope, UserScope.user_id == User.id)
        .filter(UserScope.scope_type == SCOPE_GROUP)
        .all()
    )
    for u in users:
        if u.has_role(*roles):
            notify_user(u.id, type_, message, link=link)
