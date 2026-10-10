from marshmallow import Schema, fields, validate


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=1))


class RegisterSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=8))
    firstName = fields.Str(required=True, validate=validate.Length(min=1, max=80))
    lastName = fields.Str(load_default="")
    role = fields.Str(required=True, validate=validate.OneOf([
        "GROUP_ADMIN", "ESG_MANAGER", "SUBSIDIARY_HEAD", "BU_MANAGER", "SITE_OPERATOR", "VENDOR_USER", "ASSESSOR", "EXECUTIVE_VIEWER",
    ]))


class ChangePasswordSchema(Schema):
    currentPassword = fields.Str(required=True)
    newPassword = fields.Str(required=True, validate=validate.Length(min=8))


class ForgotPasswordSchema(Schema):
    email = fields.Email(required=True)


class ResetPasswordSchema(Schema):
    token = fields.Str(required=True)
    newPassword = fields.Str(required=True, validate=validate.Length(min=8))
