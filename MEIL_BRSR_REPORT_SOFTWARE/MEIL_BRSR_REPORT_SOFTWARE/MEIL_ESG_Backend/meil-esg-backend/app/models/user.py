"""
Auth & RBAC models.

A user can hold more than one role (rare but supported), and every role assignment is paired
with a *scope* that limits which part of the Group → Subsidiary → BU → Project hierarchy the
user may act on. This is what stops a Site Operator from reading another project just by editing
an id in the URL (see app/security/permissions.py for the enforcement side).
"""
from app.extensions import db
from app.models.base import TimestampMixin, gen_uuid

# Fixed role codes. Kept as plain strings (not a DB-editable table) because authorization code
# branches on them directly — adding a new role is a deploy, not a runtime config change.
ROLE_GROUP_ADMIN = "GROUP_ADMIN"
ROLE_ESG_MANAGER = "ESG_MANAGER"
ROLE_SUBSIDIARY_HEAD = "SUBSIDIARY_HEAD"
ROLE_BU_MANAGER = "BU_MANAGER"
ROLE_SITE_OPERATOR = "SITE_OPERATOR"
ROLE_VENDOR_USER = "VENDOR_USER"
ROLE_ASSESSOR = "ASSESSOR"
ROLE_EXECUTIVE_VIEWER = "EXECUTIVE_VIEWER"

ALL_ROLES = [
    ROLE_GROUP_ADMIN, ROLE_ESG_MANAGER, ROLE_SUBSIDIARY_HEAD, ROLE_BU_MANAGER, ROLE_SITE_OPERATOR,
    ROLE_VENDOR_USER, ROLE_ASSESSOR, ROLE_EXECUTIVE_VIEWER,
]

# Scope types mirror the org hierarchy plus a special GROUP scope for group-wide roles,
# and a VENDOR scope for vendor-portal users (whose "hierarchy" is their own vendor record).
SCOPE_GROUP = "GROUP"
SCOPE_SUBSIDIARY = "SUBSIDIARY"
SCOPE_BUSINESS_UNIT = "BUSINESS_UNIT"
SCOPE_PROJECT = "PROJECT"
SCOPE_VENDOR = "VENDOR"


class Role(db.Model):
    __tablename__ = "roles"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(40), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(255))


class User(db.Model, TimestampMixin):
    __tablename__ = "users"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    email = db.Column(db.String(190), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False, default="")
    phone = db.Column(db.String(30))
    title = db.Column(db.String(120))
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")  # ACTIVE | DISABLED | INVITED
    last_login_at = db.Column(db.DateTime(timezone=True))

    roles = db.relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    scopes = db.relationship("UserScope", back_populates="user", cascade="all, delete-orphan")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def role_codes(self):
        return [ur.role.code for ur in self.roles]

    def has_role(self, *codes):
        return any(c in codes for c in self.role_codes())

    def scope_ids(self, scope_type):
        return [s.scope_id for s in self.scopes if s.scope_type == scope_type]

    def to_public_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.full_name,
            "firstName": self.first_name,
            "lastName": self.last_name,
            "title": self.title,
            "status": self.status,
            "roles": self.role_codes(),
            "scopes": [{"type": s.scope_type, "id": s.scope_id} for s in self.scopes],
        }


class UserRole(db.Model):
    __tablename__ = "user_roles"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)

    user = db.relationship("User", back_populates="roles")
    role = db.relationship("Role")

    __table_args__ = (db.UniqueConstraint("user_id", "role_id", name="uq_user_role"),)


class UserScope(db.Model):
    """e.g. user=Amit, scope_type=BUSINESS_UNIT, scope_id=<BU.id> -> Amit may act on that BU and
    everything beneath it. A GROUP_ADMIN typically holds one row with scope_type=GROUP."""
    __tablename__ = "user_scopes"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    scope_type = db.Column(db.String(20), nullable=False)
    scope_id = db.Column(db.String(36), nullable=False)  # polymorphic: org id / bu id / project id / vendor id

    user = db.relationship("User", back_populates="scopes")
