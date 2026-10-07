import os
from flask import Flask
from app.config import get_config
from app.extensions import db, migrate, jwt, cors, limiter
from app.utils.errors import register_error_handlers


def create_app(env=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(get_config(env))
    os.makedirs(app.instance_path, exist_ok=True)
    os.makedirs(app.config["LOCAL_STORAGE_DIR"], exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}}, supports_credentials=True)
    limiter.init_app(app)

    register_error_handlers(app)
    _register_jwt_handlers(app)

    from app.routes import register_blueprints
    register_blueprints(app)

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    return app


def _register_jwt_handlers(app):
    """flask-jwt-extended raises its own responses for missing/expired/invalid tokens rather than
    going through Flask's generic errorhandler(401) — these callbacks are the correct hook so
    every auth failure returns the same {"error": {...}} shape the rest of the API uses."""
    from flask import jsonify

    @jwt.unauthorized_loader
    def missing_token(reason):
        return jsonify({"error": {"message": "Authentication required.", "code": "UNAUTHORIZED", "details": reason}}), 401

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return jsonify({"error": {"message": "Invalid authentication token.", "code": "INVALID_TOKEN", "details": reason}}), 401

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return jsonify({"error": {"message": "Session expired — please sign in again.", "code": "TOKEN_EXPIRED"}}), 401
