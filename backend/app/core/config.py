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
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    RATE_LIMIT_STORAGE_URI: str = Field(
        default="",
        description="Redis URI for rate limits; defaults to REDIS_URL when empty",
    )
    RATE_LIMIT_TRUST_PROXY_HEADERS: bool = Field(
        default=False,
        description=(
            "Trust X-Forwarded-For for client IP only behind a trusted reverse proxy"
        ),
    )
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_LOGIN_IP_MAX: int = 10
    RATE_LIMIT_LOGIN_IP_WINDOW_SECONDS: int = 60
    RATE_LIMIT_LOGIN_ACCOUNT_FAILURES_MAX: int = 10
    RATE_LIMIT_LOGIN_ACCOUNT_FAILURES_WINDOW_SECONDS: int = 900
    RATE_LIMIT_REGISTER_IP_MAX: int = 5
    RATE_LIMIT_REGISTER_IP_WINDOW_SECONDS: int = 3600
    RATE_LIMIT_CHANGE_PASSWORD_MAX: int = 5
    RATE_LIMIT_CHANGE_PASSWORD_WINDOW_SECONDS: int = 900
    RATE_LIMIT_GUEST_CHECKIN_EVENT_IP_MAX: int = 5
    RATE_LIMIT_GUEST_CHECKIN_EVENT_IP_WINDOW_SECONDS: int = 3600
    RATE_LIMIT_GUEST_CHECKIN_GLOBAL_IP_MAX: int = 30
    RATE_LIMIT_GUEST_CHECKIN_GLOBAL_IP_WINDOW_SECONDS: int = 60
    RATE_LIMIT_GLOBAL_MAX: int = Field(
        default=300,
        description=(
            "Max API requests per window per authenticated user (or IP). "
            "Sized for SPA page loads with parallel fetches and inbox polling; "
            "stricter limits still apply to auth and other sensitive endpoints."
        ),
    )
    RATE_LIMIT_GLOBAL_WINDOW_SECONDS: int = 60
    RATE_LIMIT_PASSWORD_RESET_EMAIL_MAX: int = 3
    RATE_LIMIT_PASSWORD_RESET_EMAIL_WINDOW_SECONDS: int = 3600
    RATE_LIMIT_PASSWORD_RESET_IP_MAX: int = 10
    RATE_LIMIT_PASSWORD_RESET_IP_WINDOW_SECONDS: int = 3600
    RATE_LIMIT_RECEIPT_SCAN_MAX: int = 10
    RATE_LIMIT_RECEIPT_SCAN_WINDOW_SECONDS: int = 3600

    PASSWORD_RESET_EXPIRE_MINUTES: int = 45

    DEFAULT_UNIVERSITY_SLUG: str = "semo"
    DEFAULT_UNIVERSITY_NAME: str = "Southeast Missouri State University"
    DEFAULT_UNIVERSITY_EMAIL_DOMAIN: str = "semo.edu"
    DEFAULT_ORGANIZATION_SLUG: str = "nsa"
    DEFAULT_ORGANIZATION_NAME: str = "Nepalese Student Association"

    EMAIL_ENABLED: bool = False
    EMAIL_FROM: str = "NSA Connect <noreply@semo.edu>"
    FRONTEND_URL: str = Field(
        default="http://localhost:5173",
        description="Public URL of the NSA Connect web app for links in emails",
    )
    SENDGRID_API_KEY: str = Field(
        default="",
        description="SendGrid API key for transactional email",
    )
    RESEND_API_KEY: str = Field(
        default="",
        description="Resend API key for notification emails",
    )
    RESEND_FROM_EMAIL: str = Field(
        default="NSA Connect <onboarding@resend.dev>",
        description="From address for Resend notification emails",
    )
    EMAIL_TEST_OVERRIDE_RECIPIENT: str = Field(
        default="",
        description=(
            "When set, all Resend notification emails are delivered to this address "
            "instead of the real recipient (dev/testing only). "
            "Leave unset in production."
        ),
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
    CLOUDINARY_EVENT_PHOTOS_FOLDER: str = Field(
        default="nsa-connect/event-photos",
        description="Cloudinary folder for event photo archive uploads",
    )
    CLOUDINARY_MEMBER_DOCUMENTS_FOLDER: str = Field(
        default="nsa-connect/member-documents",
        description="Cloudinary folder for member document uploads",
    )
    DEV_UPLOAD_BASE_URL: str = Field(
        default="http://127.0.0.1:8000",
        description=(
            "Base URL for resolving local dev upload paths during server-side fetches"
        ),
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

    CONSTITUTION_CHUNK_SIZE_TOKENS: int = Field(
        default=800,
        ge=1,
        description="Target token count per constitution chunk for retrieval",
    )
    CONSTITUTION_CHUNK_OVERLAP_TOKENS: int = Field(
        default=200,
        ge=0,
        description="Token overlap between adjacent constitution chunks",
    )

    OPENAI_API_KEY: str = Field(
        default="",
        description="OpenAI API key for constitution embedding generation",
    )
    EMBEDDING_MODEL: str = Field(
        default="text-embedding-3-small",
        description="OpenAI embedding model for pgvector storage",
    )
    OPENAI_VISION_MODEL: str = Field(
        default="gpt-4o-mini",
        description="OpenAI vision model for finance receipt scanning",
    )
    CONSTITUTION_SEARCH_DEFAULT_LIMIT: int = Field(
        default=5,
        ge=1,
        le=20,
        description=(
            "Default number of constitution chunks returned for semantic search"
        ),
    )
    AI_CHAT_RAG_CHUNK_LIMIT: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Constitution chunks injected into AI chat RAG context",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def rate_limit_storage_uri(self) -> str:
        return self.RATE_LIMIT_STORAGE_URI or self.REDIS_URL


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_frontend_url() -> str:
    """Return FRONTEND_URL, preferring live process env then a fresh Settings read.

    Avoids stale values from the module-level cached `settings` object when
    backend/.env changes on disk (Docker volume mount) without a process restart.
    """
    import os

    from_env = os.environ.get("FRONTEND_URL", "").strip()
    if from_env:
        return from_env.rstrip("/")
    return Settings().FRONTEND_URL.rstrip("/")


settings = get_settings()
