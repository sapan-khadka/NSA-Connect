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
            "instead of the real recipient (dev/testing only). Leave unset in production."
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
