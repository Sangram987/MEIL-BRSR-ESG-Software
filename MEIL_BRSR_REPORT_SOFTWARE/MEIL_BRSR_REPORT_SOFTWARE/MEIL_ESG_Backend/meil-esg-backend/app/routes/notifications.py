from datetime import datetime, timezone
from flask import Blueprint, jsonify, g
from app.extensions import db
from app.models.notification import Notification
from app.security.decorators import authenticated

bp = Blueprint("notifications", __name__, url_prefix="/notifications")


@bp.get("")
@authenticated
def list_notifications():
    rows = Notification.query.filter_by(user_id=g.current_user.id).order_by(Notification.created_at.desc()).limit(50).all()
    return jsonify([n.to_dict() for n in rows])


@bp.post("/mark-read")
@authenticated
def mark_all_read():
    Notification.query.filter_by(user_id=g.current_user.id, read_at=None).update({"read_at": datetime.now(timezone.utc)})
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/<int:notification_id>/read")
@authenticated
def mark_one_read(notification_id):
    n = Notification.query.filter_by(id=notification_id, user_id=g.current_user.id).first_or_404()
    n.read_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(n.to_dict())
