from app.celery_app import celery_app


@celery_app.task(name="app.tasks.notifications.send_email")
def send_email(to_address, subject, body):
    """No SMTP server is configured for this demo deployment — this task exists so routes can
    already call `send_email.delay(...)` without blocking the request, and swapping in a real
    mail provider (SES, SendGrid, in-house SMTP) later only means filling in this function body,
    not touching any route or service that calls it."""
    import logging
    logging.getLogger("meil_esg.mail").info("Would send email to %s: %s", to_address, subject)
    return {"sent": False, "reason": "No mail backend configured in this deployment."}


@celery_app.task(name="app.tasks.notifications.send_password_reset_email")
def send_password_reset_email(user_id):
    return send_email.run("(withheld)", "Reset your MEIL ESG Hub password", "See app/tasks/notifications.py")
