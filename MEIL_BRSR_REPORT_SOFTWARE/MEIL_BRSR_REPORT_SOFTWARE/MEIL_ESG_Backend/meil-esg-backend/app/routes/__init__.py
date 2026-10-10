def register_blueprints(app):
    prefix = app.config["API_PREFIX"]

    from app.routes.auth import bp as auth_bp
    from app.routes.organization import bp as organization_bp
    from app.routes.brsr import bp as brsr_bp
    from app.routes.submissions import bp as submissions_bp
    from app.routes.approvals import bp as approvals_bp
    from app.routes.vendors import bp as vendors_bp
    from app.routes.risk import bp as risk_bp
    from app.routes.analytics import bp as analytics_bp
    from app.routes.ai import bp as ai_bp
    from app.routes.assessment import bp as assessment_bp
    from app.routes.reports import bp as reports_bp
    from app.routes.notifications import bp as notifications_bp
    from app.routes.disclosures import bp as disclosures_bp
    from app.routes.evidence import bp as evidence_bp
    from app.routes.verigraph_evidence import bp as verigraph_evidence_bp
    from app.routes.capa import bp as capa_bp

    for bp in (
        auth_bp, organization_bp, brsr_bp, submissions_bp, approvals_bp, vendors_bp, risk_bp,
        analytics_bp, ai_bp, assessment_bp, reports_bp, notifications_bp, disclosures_bp, evidence_bp,
        verigraph_evidence_bp, capa_bp,
    ):
        app.register_blueprint(bp, url_prefix=prefix + bp.url_prefix if bp.url_prefix else prefix)
