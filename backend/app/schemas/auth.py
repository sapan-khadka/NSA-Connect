from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_serializer, field_validator

from app.core.validators import SemoEmailStr


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: datetime
    refresh_expires_at: datetime

    @field_serializer("expires_at", "refresh_expires_at")
    def serialize_expiry(self, value: datetime) -> str:
        return value.isoformat()


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.lower().strip()


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetRequestResponse(BaseModel):
    message: str


class EmailVerificationConfirmRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)


class EmailVerificationRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.lower().strip()


class EmailVerificationResponse(BaseModel):
    message: str
