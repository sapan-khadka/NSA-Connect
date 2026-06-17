from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = (
        "postgresql://postgres:postgres@localhost:5433/nsa_connect"
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
