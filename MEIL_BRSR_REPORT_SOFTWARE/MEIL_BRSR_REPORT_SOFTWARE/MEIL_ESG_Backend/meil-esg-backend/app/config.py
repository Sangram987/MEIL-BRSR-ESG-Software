"""
Central configuration. Values are read from the environment so the same code runs in
docker-compose, a bare-metal dev box, or a CI pipeline — only the .env file changes.
"""
import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
DEFAULT_SQLITE_PATH = os.path.join(BASE_DIR, "instance", "meil_esg.db").replace("\\", "/")


def _bool(name, default="false"):
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


class Config:
    # --- Core ---
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    API_PREFIX = "/api/v1"

    # --- Database ---
    # Default is a local SQLite file so `python run.py` works with zero external services
    # for a quick demo; set DATABASE_URL to a MySQL DSN for the real deployment, e.g.
    _db_env = os.getenv("DATABASE_URL", "").strip()
    if not _db_env or _db_env.startswith("sqlite:///instance/") or _db_env == "sqlite:///instance/meil_esg.db":
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{DEFAULT_SQLITE_PATH}"
    else:
        SQLALCHEMY_DATABASE_URI = _db_env
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # --- JWT ---
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-me-32-bytes-minimum-key!")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "30")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "30")))
    JWT_TOKEN_LOCATION = ["headers", "cookies"]
    JWT_COOKIE_SECURE = _bool("JWT_COOKIE_SECURE", "false")
    JWT_COOKIE_CSRF_PROTECT = _bool("JWT_COOKIE_CSRF_PROTECT", "false")
    JWT_REFRESH_COOKIE_PATH = "/api/v1/auth/refresh"
    JWT_COOKIE_SAMESITE = "Lax"

    # --- CORS ---
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

    # --- Rate limiting ---
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_DEFAULT = "200 per minute"

    # --- Redis / Celery ---
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
    CELERY_TASK_ALWAYS_EAGER = _bool("CELERY_TASK_ALWAYS_EAGER", "true")  # true = synchronous fallback, no worker needed for the demo

    # --- Object storage (MinIO / S3-compatible) ---
    STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")  # "local" | "minio"
    MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET = os.getenv("MINIO_BUCKET", "meil-esg")
    MINIO_SECURE = _bool("MINIO_SECURE", "false")
    LOCAL_STORAGE_DIR = os.getenv("LOCAL_STORAGE_DIR", os.path.join(BASE_DIR, "instance", "uploads"))
    MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB per request, matches the frontend's evidence-upload limit

    # --- AI provider abstraction ---
    AI_PROVIDER = os.getenv("AI_PROVIDER", "rule_based")  # "rule_based" | "gemini" | "openai"
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

    # --- Password hashing ---
    PASSWORD_HASHER = os.getenv("PASSWORD_HASHER", "argon2")  # "argon2" | "bcrypt"

    # --- Misc ---
    JSON_SORT_KEYS = False


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_COOKIE_CSRF_PROTECT = False
    CELERY_TASK_ALWAYS_EAGER = True
    RATELIMIT_ENABLED = False


class ProductionConfig(Config):
    DEBUG = False
    JWT_COOKIE_SECURE = True


CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(name=None):
    name = name or os.getenv("FLASK_ENV", "development")
    return CONFIG_MAP.get(name, DevelopmentConfig)
