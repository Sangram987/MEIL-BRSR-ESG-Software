from marshmallow import Schema, fields, validate


class ValueCellSchema(Schema):
    v = fields.Raw(allow_none=True)
    ev = fields.Str(load_default="", allow_none=True)   # evidence document id, if already uploaded


class SaveSubmissionSchema(Schema):
    projectId = fields.Str(required=True)
    reportingPeriodId = fields.Str(required=True)
    principleCode = fields.Str(required=True, validate=validate.OneOf([f"P{i}" for i in range(1, 10)]))
    values = fields.Dict(keys=fields.Str(), values=fields.Nested(ValueCellSchema), required=True)
    submit = fields.Bool(load_default=False)


class ReviewSubmissionSchema(Schema):
    decision = fields.Str(required=True, validate=validate.OneOf([
        "APPROVE", "VERIFY", "BU_VERIFY", "SUB_VERIFY", "SUBSIDIARY_VERIFY", "REJECT", "REQUEST_CORRECTION"
    ]))
    comment = fields.Str(load_default="")
    checklist = fields.Dict(load_default=dict)
