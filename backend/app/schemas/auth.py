from datetime import datetime

from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: datetime
    refresh_expires_at: datetime


class RefreshTokenRequest(BaseModel):
    refresh_token: str
