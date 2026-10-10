from flask import Blueprint, jsonify, request
from app.models.brsr import BrsrFrameworkVersion, BrsrPrinciple, BrsrIndicator, BrsrCoreAttribute, Sdg
from app.security.decorators import authenticated

bp = Blueprint("brsr", __name__, url_prefix="/brsr")


@bp.get("/frameworks")
@authenticated
def frameworks():
    rows = BrsrFrameworkVersion.query.order_by(BrsrFrameworkVersion.effective_from.desc()).all()
    return jsonify([{"id": f.id, "version": f.version, "status": f.status,
                      "effectiveFrom": f.effective_from.isoformat() if f.effective_from else None} for f in rows])


@bp.get("/principles")
@authenticated
def principles():
    rows = BrsrPrinciple.query.order_by(BrsrPrinciple.sequence).all()
    return jsonify([p.to_dict() for p in rows])


@bp.get("/indicators")
@authenticated
def indicators():
    principle_code = request.args.get("principle") or request.args.get("principleCode")
    q = BrsrIndicator.query.filter_by(active=True)
    if principle_code:
        q = q.join(BrsrPrinciple).filter(BrsrPrinciple.code == principle_code)
    tier = request.args.get("tier")
    if tier:
        q = q.filter(BrsrIndicator.tier == tier.upper())
    return jsonify([i.to_dict() for i in q.all()])


@bp.get("/indicators/<int:indicator_id>")
@authenticated
def indicator_detail(indicator_id):
    ind = BrsrIndicator.query.get_or_404(indicator_id)
    return jsonify(ind.to_dict())


@bp.get("/core")
@authenticated
def core_attributes():
    rows = BrsrCoreAttribute.query.order_by(BrsrCoreAttribute.sequence).all()
    return jsonify([{"id": a.id, "label": a.label, "entityLevel": a.entity_level} for a in rows])


@bp.get("/sdg-mapping")
@authenticated
def sdg_mapping():
    principles = BrsrPrinciple.query.order_by(BrsrPrinciple.sequence).all()
    sdgs = {s.id: s.name for s in Sdg.query.all()}
    return jsonify([{"principle": p.code, "label": p.label, "sdgs": [{"id": s, "name": sdgs.get(s)} for s in [l.sdg_id for l in p.sdg_links]]} for p in principles])
