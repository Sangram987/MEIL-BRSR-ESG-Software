"""
Three decorators cover everything the review asked for:

  @jwt_required()                -> from flask_jwt_extended, "is this request authenticated"
  @roles_required(ROLE_A, ROLE_B) -> "is the authenticated user one of these roles"
  @project_scope_required()       -> "does the authenticated user's scope actually cover the
                                       project_id in this request" (path arg, query arg, or JSON body)

Combine them in that order: authenticate, then authorize role, then authorize scope.
"""
from functools import wraps
from flask import request, g
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from app.models.user import User
from app.security.permissions import (
    user_can_access_project, user_can_access_business_unit, user_can_access_organization, user_can_access_vendor,
)
from app.utils.errors import ApiError


def load_current_user():
    verify_jwt_in_request()
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if user is None or user.status != "ACTIVE":
        raise ApiError("Account is not active.", 401)
    g.current_user = user
    return user


def roles_required(*role_codes):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = load_current_user()
            if not user.has_role(*role_codes):
                raise ApiError("You do not have permission to perform this action.", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def authenticated(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        load_current_user()
        return fn(*args, **kwargs)
    return wrapper


def _flatten(items):
    out = []
    for item in items:
        if isinstance(item, (list, tuple, set)):
            out.extend(_flatten(item))
        elif item:
            out.append(item)
    return out


def _find_id(*names):
    for name in _flatten(names):
        val = request.view_args.get(name) if request.view_args else None
        if val:
            return val
        val = request.args.get(name)
        if val:
            return val
        body = request.get_json(silent=True) or {}
        if isinstance(body, dict) and body.get(name):
            return body.get(name)
    return None


def project_scope_required(*param_names):
    names = param_names or ("project_id", "projectId")
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = getattr(g, "current_user", None) or load_current_user()
            project_id = _find_id(*names)
            if project_id and not user_can_access_project(user, project_id):
                raise ApiError("You do not have access to this project.", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def business_unit_scope_required(*param_names):
    names = param_names or ("business_unit_id", "businessUnitId")
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = getattr(g, "current_user", None) or load_current_user()
            bu_id = _find_id(*names)
            if bu_id and not user_can_access_business_unit(user, bu_id):
                raise ApiError("You do not have access to this business unit.", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def organization_scope_required(*param_names):
    names = param_names or ("organization_id", "organizationId")
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = getattr(g, "current_user", None) or load_current_user()
            org_id = _find_id(*names)
            if org_id and not user_can_access_organization(user, org_id):
                raise ApiError("You do not have access to this organization.", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def vendor_scope_required(*param_names):
    names = param_names or ("vendor_id", "vendorId")
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = getattr(g, "current_user", None) or load_current_user()
            vendor_id = _find_id(*names)
            if vendor_id and not user_can_access_vendor(user, vendor_id):
                raise ApiError("You do not have access to this vendor.", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator
