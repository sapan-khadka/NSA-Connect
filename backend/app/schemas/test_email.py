from pydantic import BaseModel, EmailStr, Field


class SendTestEmailRequest(BaseModel):
    to_email: EmailStr | None = Field(default=None, max_length=255)


class SendTestEmailResponse(BaseModel):
    success: bool
    message: str
    email_id: str | None = None
