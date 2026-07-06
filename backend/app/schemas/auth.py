from datetime import datetime

from pydantic import BaseModel, Field, field_serializer

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
    email: SemoEmailStr


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetRequestResponse(BaseModel):
    message: str
