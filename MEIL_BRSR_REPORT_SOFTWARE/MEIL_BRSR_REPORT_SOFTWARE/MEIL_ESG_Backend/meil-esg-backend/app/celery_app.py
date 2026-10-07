"""
Factory for the Celery app, bound to the same Flask app config so tasks can use
`with flask_app.app_context():` to touch the database. Run with:

  celery -A app.celery_app.celery_app worker --loglevel=info
  celery -A app.celery_app.celery_app beat --loglevel=info      # for scheduled jobs

With CELERY_TASK_ALWAYS_EAGER=true (the default in .env.example), tasks execute synchronously in
the calling process — no worker needed to try the demo end-to-end.
"""
from celery import Celery
from app import create_app


def make_celery(flask_app=None):
    flask_app = flask_app or create_app()
    celery_app = Celery(
        flask_app.import_name,
        broker=flask_app.config["CELERY_BROKER_URL"],
        backend=flask_app.config["CELERY_RESULT_BACKEND"],
    )
    celery_app.conf.update(
        task_always_eager=flask_app.config["CELERY_TASK_ALWAYS_EAGER"],
        task_eager_propagates=True,
        beat_schedule={
            "nightly-analytics": {
                "task": "app.tasks.scheduled.nightly_analytics",
                "schedule": 24 * 60 * 60,  # once a day; swap for crontab(hour=2) with real Celery Beat
            },
        },
    )

    class ContextTask(celery_app.Task):
        def __call__(self, *args, **kwargs):
            with flask_app.app_context():
                return self.run(*args, **kwargs)

    celery_app.Task = ContextTask
    flask_app.extensions["celery"] = celery_app
    return celery_app


flask_app = create_app()
celery_app = make_celery(flask_app)

# Import task modules so they register with this celery_app instance.
from app.tasks import reports, ai, notifications, scheduled  # noqa: E402,F401
