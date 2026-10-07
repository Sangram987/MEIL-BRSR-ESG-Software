from flask import jsonify
from marshmallow import ValidationError


class ApiError(Exception):
    """Raise this anywhere in a route/service; app/__init__.py registers a handler that turns it
    into a consistent {"error": {...}} JSON body with the right HTTP status."""
    def __init__(self, message, status_code=400, details=None, code=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details
        self.code = code or "ERROR"

    def to_response(self):
        body = {"error": {"message": self.message, "code": self.code}}
        if self.details:
            body["error"]["details"] = self.details
        return jsonify(body), self.status_code


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(err):
        return err.to_response()

    @app.errorhandler(ValidationError)
    def handle_validation_error(err):
        return jsonify({"error": {"message": "Invalid request.", "code": "VALIDATION_ERROR", "details": err.messages}}), 422

    @app.errorhandler(404)
    def handle_404(err):
        return jsonify({"error": {"message": "Not found.", "code": "NOT_FOUND"}}), 404

    @app.errorhandler(405)
    def handle_405(err):
        return jsonify({"error": {"message": "Method not allowed.", "code": "METHOD_NOT_ALLOWED"}}), 405

    @app.errorhandler(413)
    def handle_413(err):
        return jsonify({"error": {"message": "Upload is too large.", "code": "PAYLOAD_TOO_LARGE"}}), 413

    @app.errorhandler(Exception)
    def handle_unexpected(err):
        app.logger.exception("Unhandled exception")
        if app.debug:
            raise err
        return jsonify({"error": {"message": "Internal server error.", "code": "INTERNAL_ERROR"}}), 500
