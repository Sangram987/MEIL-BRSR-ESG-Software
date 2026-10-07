"""
Single shared instances of every Flask extension, created here (unbound) and attached to the
app inside create_app(). Importing from this module instead of re-instantiating avoids circular
imports between models/routes/services.
"""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
limiter = Limiter(key_func=get_remote_address)
