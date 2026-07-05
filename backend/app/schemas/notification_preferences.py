from pydantic import BaseModel, model_validator


class NotificationPreferencesResponse(BaseModel):
    event_reminders: bool
    rsvp_nudges: bool
    task_reminders: bool


class NotificationPreferencesUpdateRequest(BaseModel):
    event_reminders: bool | None = None
    rsvp_nudges: bool | None = None
    task_reminders: bool | None = None

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "NotificationPreferencesUpdateRequest":
        if (
            self.event_reminders is None
            and self.rsvp_nudges is None
            and self.task_reminders is None
        ):
            raise ValueError("At least one preference must be provided")
        return self
