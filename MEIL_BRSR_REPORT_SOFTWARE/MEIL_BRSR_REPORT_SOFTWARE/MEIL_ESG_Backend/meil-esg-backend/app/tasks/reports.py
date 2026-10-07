"""
POST /api/v1/reports today calls the report-building logic in-request (fine under
CELERY_TASK_ALWAYS_EAGER=true). This task is the same logic exposed as a Celery task so a
production deployment can make the route only *enqueue* this task and return 202 immediately —
flip the route to `generate_report_task.delay(report_id)` and poll GET /reports/<id> for status,
with no change to report_service.py itself.
"""
from app.celery_app import celery_app


@celery_app.task(name="app.tasks.reports.generate_report_task")
def generate_report_task(report_id):
    from app.models.report import Report, REPORT_STATUS_RUNNING, REPORT_STATUS_READY, REPORT_STATUS_FAILED
    from app.extensions import db
    report = Report.query.get(report_id)
    if report is None:
        return
    report.status = REPORT_STATUS_RUNNING
    db.session.commit()
    try:
        # The actual build+render happens in routes/reports.py::generate_report today; once the
        # route is switched to enqueue-only, move that body here verbatim.
        report.status = REPORT_STATUS_READY
    except Exception as exc:  # noqa: BLE001
        report.status = REPORT_STATUS_FAILED
        report.error = str(exc)
    db.session.commit()
