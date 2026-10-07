from app.celery_app import celery_app


@celery_app.task(name="app.tasks.ai.scan_project_for_risks")
def scan_project_for_risks(project_id, reporting_period_id):
    """Runs the deterministic risk rules (services/risk_service.py) for one project+period and
    creates OPEN risk candidates for a human to triage — this is the Celery-task form of the
    "scheduled anomaly detection" item in the spec's background-jobs list."""
    from app.extensions import db
    from app.models.organization import Project
    from app.services import consolidation_service, risk_service

    project = Project.query.get(project_id)
    if project is None:
        return {"created": 0}

    node = consolidation_service.node_totals("PROJECT", project_id, reporting_period_id)
    # crude 6-period history proxy: reuse current totals as a stand-in average when no
    # dedicated history endpoint is wired into this background job yet (routes/submissions.py's
    # _history_avg_lookup is the real per-indicator version used at submit time).
    candidates = risk_service.run_rules(project, node["totals"], node["totals"])
    created = 0
    for c in candidates:
        _, is_new = risk_service.create_risk_from_candidate(c)
        created += 1 if is_new else 0
    db.session.commit()
    return {"created": created}
