from marshmallow import Schema, fields, validate


class VendorRequestCreateSchema(Schema):
    vendorIds = fields.List(fields.Str(), required=True, validate=validate.Length(min=1))
    reportingPeriodId = fields.Str(required=True)
    dueDate = fields.Date(required=True)
    message = fields.Str(load_default="")


class VendorSubmitSchema(Schema):
    values = fields.Dict(keys=fields.Str(), values=fields.Raw(), required=True)
    evidence = fields.Dict(keys=fields.Str(), values=fields.Str(allow_none=True), load_default=dict)


class VendorReviewSchema(Schema):
    decision = fields.Str(required=True, validate=validate.OneOf(["ACCEPT", "CORRECTION_REQUIRED"]))
    comment = fields.Str(load_default="")


class RiskSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    type = fields.Str(load_default="RISK", validate=validate.OneOf(["RISK", "OPPORTUNITY"]))
    category = fields.Str(required=True, validate=validate.OneOf(["Environmental", "Social", "Governance"]))
    rationale = fields.Str(load_default="")
    probability = fields.Int(required=True, validate=validate.Range(min=1, max=3))
    impact = fields.Int(required=True, validate=validate.Range(min=1, max=3))
    financialExposureCr = fields.Float(load_default=0)
    financialImplication = fields.Str(load_default="")
    timeHorizon = fields.Str(load_default="")
    owner = fields.Str(load_default="")
    mitigation = fields.Str(required=True, validate=validate.Length(min=1))
    linkedIndicatorId = fields.Int(allow_none=True, load_default=None)
    projectId = fields.Str(allow_none=True, load_default=None)
    organizationId = fields.Str(allow_none=True, load_default=None)
    status = fields.Str(load_default="OPEN", validate=validate.OneOf(["OPEN", "MITIGATING", "MONITORING", "CLOSED"]))
    includeInBrsr = fields.Bool(load_default=False)


class AssessmentOpinionSchema(Schema):
    mode = fields.Str(required=True, validate=validate.OneOf(["ASSESSMENT", "ASSURANCE"]))
    status = fields.Str(required=True)
    provider = fields.Str(load_default="")
    providerType = fields.Str(load_default="")
    standard = fields.Str(load_default="")
    scope = fields.Str(load_default="")
    methodology = fields.Str(load_default="")
    evidenceTested = fields.Str(load_default="")
    exceptions = fields.Str(load_default="")
    independenceConfirmed = fields.Bool(required=True)
    note = fields.Str(load_default="")
