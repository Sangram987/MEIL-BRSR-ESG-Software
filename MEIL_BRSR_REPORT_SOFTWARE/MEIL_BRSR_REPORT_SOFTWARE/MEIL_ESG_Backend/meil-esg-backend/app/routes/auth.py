"""
Demo-friendly but production-shaped: /auth/register lets a new user pick a role and is what the
frontend's Login.jsx "Register" tab should call once it's wired to this API (today it writes to
localStorage with a client-side-hashed password — this is its real backend). In a locked-down
production rollout you would disable self-registration and provision users via an admin-only
POST /users endpoint instead; both can coexist behind a feature flag.
"""
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required, get_jwt_identity, set_refresh_cookies,
    unset_jwt_cookies,
)

from app.extensions import db, limiter
from app.models.user import (
    User, Role, UserRole, UserScope,
    SCOPE_GROUP, SCOPE_SUBSIDIARY, SCOPE_BUSINESS_UNIT, SCOPE_PROJECT, SCOPE_VENDOR,
)
from app.models.organization import Organization
from app.schemas.auth import LoginSchema, RegisterSchema, ChangePasswordSchema
from app.security.passwords import hash_password, verify_password
from app.security.decorators import load_current_user
from app.utils.errors import ApiError
from app.utils.audit import record

bp = Blueprint("auth", __name__, url_prefix="/auth")


@bp.post("/login")
@limiter.limit("10 per minute")
def login():
    data = LoginSchema().load(request.get_json(force=True) or {})
    user = User.query.filter_by(email=data["email"].lower()).first()
    if user is None or not verify_password(data["password"], user.password_hash):
        raise ApiError("Invalid email or password.", 401, code="INVALID_CREDENTIALS")
    if user.status != "ACTIVE":
        raise ApiError("This account is disabled. Contact your Group ESG Admin.", 403)
    user.last_login_at = datetime.now(timezone.utc)
    record("LOGIN", "User", user.id, details=user.email, user=user)
    db.session.commit()
    access = create_access_token(identity=user.id, additional_claims={"roles": user.role_codes()})
    refresh = create_refresh_token(identity=user.id)
    resp = jsonify({"accessToken": access, "user": user.to_public_dict()})
    set_refresh_cookies(resp, refresh)
    return resp


@bp.post("/register")
@limiter.limit("5 per minute")
def register():
    """Self-service registration, scoped automatically: GROUP_ADMIN/ESG_MANAGER/ASSESSOR get a
    GROUP scope (the whole org tree); BU_MANAGER/SITE_OPERATOR are granted scope over the first
    available business unit/project so the demo is usable immediately — a real deployment would
    instead leave new accounts scope-less until an admin assigns them (see PATCH /users/<id>/scopes,
    a documented extension point not built out in this pass)."""
    data = RegisterSchema().load(request.get_json(force=True) or {})
    email = data["email"].lower()
    if User.query.filter_by(email=email).first():
        raise ApiError("An account with this email already exists.", 409, code="EMAIL_TAKEN")

    user = User(email=email, password_hash=hash_password(data["password"]),
                first_name=data["firstName"], last_name=data.get("lastName", ""), status="ACTIVE")
    db.session.add(user)
    db.session.flush()

    role = Role.query.filter_by(code=data["role"]).first()
    if role is None:
        raise ApiError("Unknown role.", 400)
    db.session.add(UserRole(user_id=user.id, role_id=role.id))

    _grant_default_scope(user, data["role"])
    record("USER_CREATED", "User", user.id, details=f"self-registered as {data['role']}", user=user)
    db.session.commit()

    access = create_access_token(identity=user.id, additional_claims={"roles": user.role_codes()})
    refresh = create_refresh_token(identity=user.id)
    resp = jsonify({"accessToken": access, "user": user.to_public_dict()})
    set_refresh_cookies(resp, refresh)
    return resp, 201


def _grant_default_scope(user, role_code):
    from app.models.organization import BusinessUnit, Project
    from app.models.vendor import Vendor
    group = Organization.query.filter_by(type="GROUP").first()
    if role_code in ("GROUP_ADMIN", "ESG_MANAGER", "ASSESSOR", "EXECUTIVE_VIEWER") and group:
        db.session.add(UserScope(user_id=user.id, scope_type=SCOPE_GROUP, scope_id=group.id))
    elif role_code == "SUBSIDIARY_HEAD":
        sub = Organization.query.filter_by(type="SUBSIDIARY").first()
        if sub:
            db.session.add(UserScope(user_id=user.id, scope_type=SCOPE_SUBSIDIARY, scope_id=sub.id))
    elif role_code == "BU_MANAGER":
        bu = BusinessUnit.query.first()
        if bu:
            db.session.add(UserScope(user_id=user.id, scope_type=SCOPE_BUSINESS_UNIT, scope_id=bu.id))
    elif role_code == "SITE_OPERATOR":
        project = Project.query.first()
        if project:
            db.session.add(UserScope(user_id=user.id, scope_type=SCOPE_PROJECT, scope_id=project.id))
    elif role_code == "VENDOR_USER":
        vendor = Vendor.query.first()
        if vendor:
            db.session.add(UserScope(user_id=user.id, scope_type=SCOPE_VENDOR, scope_id=vendor.id))


@bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    user = User.query.get(identity)
    if user is None or user.status != "ACTIVE":
        raise ApiError("Account is not active.", 401)
    access = create_access_token(identity=user.id, additional_claims={"roles": user.role_codes()})
    return jsonify({"accessToken": access})


@bp.post("/logout")
def logout():
    resp = jsonify({"ok": True})
    unset_jwt_cookies(resp)
    return resp


@bp.get("/me")
def me():
    user = load_current_user()
    return jsonify(user.to_public_dict())


@bp.post("/change-password")
def change_password():
    user = load_current_user()
    data = ChangePasswordSchema().load(request.get_json(force=True) or {})
    if not verify_password(data["currentPassword"], user.password_hash):
        raise ApiError("Current password is incorrect.", 400)
    user.password_hash = hash_password(data["newPassword"])
    record("PASSWORD_CHANGED", "User", user.id, user=user)
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/forgot-password")
@limiter.limit("5 per minute")
def forgot_password():
    """Always returns 200 regardless of whether the email exists, to avoid leaking which emails
    are registered. Wires to tasks/notifications.py::send_password_reset_email in production;
    left as a documented no-op here since there's no mail server configured for the demo."""
    return jsonify({"ok": True, "message": "If that email is registered, a reset link has been sent."})


@bp.post("/reset-password")
def reset_password():
    raise ApiError("Password reset requires a mail-server integration — see tasks/notifications.py.", 501)
