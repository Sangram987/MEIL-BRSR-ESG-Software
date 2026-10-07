from app.celery_app import celery_app


@celery_app.task(name="app.tasks.scheduled.nightly_analytics")
def nightly_analytics():
    """Registered in celery_app.py's beat_schedule. In a full build this would: recompute and
    cache dashboard aggregates, run the risk rule-scan (app.tasks.ai.scan_project_for_risks) over
    every active project, flag vendors whose request is overdue, and queue reminder
    notifications for sites with incomplete data for the open period — each of those is already
    implemented as its own function (risk_service.run_rules, notification_service.*) and just
    needs looping over the active project/vendor list here."""
    from app.models.organization import Project
    from app.models.period import ReportingPeriod
    period = ReportingPeriod.query.filter_by(is_current=True).first()
    if period is None:
        return {"scanned": 0}
    from app.tasks.ai import scan_project_for_risks
    count = 0
    for project in Project.query.filter_by(status="ACTIVE").all():
        scan_project_for_risks.delay(project.id, period.id)
        count += 1
    return {"scanned": count}
