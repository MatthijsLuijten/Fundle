from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite+pysqlite:///./fundle.db"
    cors_origins: str = "http://localhost:3000"
    demo_mode: bool = False
    debug_fresh_session: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()


def get_settings() -> Settings:
    """Read .env again (dev config sync does not reload module-level `settings`)."""
    return Settings()
