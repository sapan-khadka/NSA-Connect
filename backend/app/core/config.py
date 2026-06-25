from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "NSA Connect API"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False

    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5433/nsa_connect",
        description="PostgreSQL connection string",
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection string",
    )

    SECRET_KEY: str = Field(
        default="dev-only-secret-change-me-before-production-deploy",
        description="Secret key for signing JWT tokens",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    EMAIL_ENABLED: bool = False
    EMAIL_FROM: str = "NSA Connect <noreply@semo.edu>"
    SENDGRID_API_KEY: str = Field(
        default="",
        description="SendGrid API key for transactional email",
    )

    PREP_TASK_DUE_SOON_DAYS: int = Field(
        default=3,
        description="Days ahead to scan for incomplete prep tasks due soon",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
