"""Application settings loaded from environment variables / .env file."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- General ---
    PROJECT_NAME: str = "Dynamic Form Builder API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"

    # --- Security / JWT ---
    SECRET_KEY: str = "change-this-secret-key-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Database ---
    DATABASE_URL: str = "mysql+pymysql://formbuilder:formbuilder@localhost:3306/form_builder?charset=utf8mb4"
    DB_ECHO: bool = False

    # --- Celery / Redis ---
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # --- CORS (comma separated) ---
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    # --- Storage ---
    STORAGE_DIR: str = str(BASE_DIR / "storage")
    MAX_UPLOAD_SIZE_MB: int = 10
    DEFAULT_ALLOWED_EXTENSIONS: str = "pdf,doc,docx,xls,xlsx,csv,txt,png,jpg,jpeg,gif,webp,zip"
    EXPORT_RETENTION_HOURS: int = 24

    # --- Seed admin ---
    FIRST_ADMIN_EMAIL: str = "admin@formbuilder.com"
    FIRST_ADMIN_PASSWORD: str = "Admin@123"
    FIRST_ADMIN_NAME: str = "System Administrator"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def default_allowed_extensions(self) -> list[str]:
        return [e.strip().lower().lstrip(".") for e in self.DEFAULT_ALLOWED_EXTENSIONS.split(",") if e.strip()]

    @property
    def upload_dir(self) -> Path:
        return Path(self.STORAGE_DIR) / "uploads"

    @property
    def export_dir(self) -> Path:
        return Path(self.STORAGE_DIR) / "exports"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
