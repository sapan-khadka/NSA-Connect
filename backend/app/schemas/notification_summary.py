from pydantic import BaseModel, Field


class NotificationSummaryResponse(BaseModel):
    """Role-filtered in-app attention counts for nav badges and the bell menu."""

    members_pending: int = Field(ge=0)
    finance_pending: int = Field(ge=0)
    suggestions_pending: int = Field(ge=0)
    discussions_unread: int = Field(ge=0)
    tasks_overdue: int = Field(ge=0)
    tasks_due_today: int = Field(ge=0)
    attention_total: int = Field(ge=0)
