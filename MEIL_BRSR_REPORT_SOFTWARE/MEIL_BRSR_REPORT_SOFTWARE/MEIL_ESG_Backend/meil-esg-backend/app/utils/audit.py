from flask import request, g
from app.extensions import db
from app.models.audit import AuditLog


def record(action, entity_type, entity_id, details=None, old_value=None, new_value=None, user=None):
    """Adds an AuditLog row to the current session WITHOUT committing — the caller's own
    db.session.commit() (at the end of the request's business-logic transaction) persists the
    audit entry atomically with the change it describes, per the company's review (§26, §57):
    an approval and its audit trail must commit or roll back together, never one without the other.
    """
    actor = user or getattr(g, "current_user", None)
    log = AuditLog(
        user_id=actor.id if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        details=details,
        old_value_json=old_value,
        new_value_json=new_value,
        ip_address=request.remote_addr if request else None,
        user_agent=request.headers.get("User-Agent", "")[:255] if request else None,
    )
    db.session.add(log)
    return log
