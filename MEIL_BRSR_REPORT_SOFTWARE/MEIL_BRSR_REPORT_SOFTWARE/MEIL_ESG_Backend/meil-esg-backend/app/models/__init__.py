"""
Import every model module here so that:
  1. `db.metadata` has every table when Flask-Migrate autogenerates a migration, and
  2. other modules can simply `from app.models import User, Project, ...`
"""
from app.models.base import CodeSequence  # noqa: F401
from app.models.user import User, Role, UserRole, UserScope  # noqa: F401
from app.models.organization import Organization, OrganizationRelationship, BusinessUnit, Project  # noqa: F401
from app.models.period import ReportingPeriod  # noqa: F401
from app.models.brsr import (  # noqa: F401
    BrsrFrameworkVersion, BrsrSection, BrsrPrinciple, BrsrCoreAttribute,
    BrsrIndicator, BrsrValidationRule, Sdg, PrincipleSdgMapping,
)
from app.models.submission import EsgSubmission, EsgValue, SubmissionVersion  # noqa: F401
from app.models.evidence import Document, MetricEvidence, EvidenceBatch, BatchItem  # noqa: F401
from app.models.review import ReviewAction  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
from app.models.vendor import Vendor, VendorProjectLink, VendorRequest, VendorValue, VendorReview  # noqa: F401
from app.models.emission import EmissionFactor, EmissionActivity, EmissionCalculation, Scope3Methodology  # noqa: F401
from app.models.risk import Risk, RiskAssessment, RiskAction  # noqa: F401
from app.models.assessment import AssessmentEngagement, AssessmentSample, AssessmentFinding  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.report import Report, ReportFile  # noqa: F401
from app.models.disclosure import (  # noqa: F401
    EntityDisclosure, BusinessActivity, ProductService, PolicyCoverage,
    Commitment, GovernanceReview, Core8Fairness, Core9Openness,
)
from app.models.forensics import (  # noqa: F401
    ExtractedFact, VerificationResult, TrustScore, CapaRecord, PhysicalVerification,
)
