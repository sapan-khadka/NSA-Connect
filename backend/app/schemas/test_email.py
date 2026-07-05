from pydantic import BaseModel, EmailStr, Field


class SendTestEmailRequest(BaseModel):
    to_email: EmailStr = Field(..., max_length=255)
