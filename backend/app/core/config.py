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

    CLOUDINARY_CLOUD_NAME: str = Field(
        default="",
        description="Cloudinary cloud name for receipt uploads",
    )
    CLOUDINARY_API_KEY: str = Field(
        default="",
        description="Cloudinary API key for receipt uploads",
    )
    CLOUDINARY_API_SECRET: str = Field(
        default="",
        description="Cloudinary API secret for receipt uploads",
    )
    CLOUDINARY_RECEIPTS_FOLDER: str = Field(
        default="nsa-connect/finance-receipts",
        description="Cloudinary folder for uploaded finance receipts",
    )

    AI_ENABLED: bool = False
    ANTHROPIC_API_KEY: str = Field(
        default="",
        description="Anthropic API key for AI features",
    )
    ANTHROPIC_MODEL: str = Field(
        default="claude-sonnet-4-20250514",
        description="Default Anthropic model for app-wide AI calls",
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
