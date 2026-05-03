"""Environment configuration for the GPU server."""

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from env vars / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=("settings_",),
    )

    storage_dir: Path = Field(default=Path("./storage"), alias="STORAGE_DIR")
    backend_callback_base_url: str = Field(
        default="http://localhost:3001", alias="BACKEND_CALLBACK_BASE_URL"
    )
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    aws_access_key_id: str = Field(alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field(alias="AWS_SECRET_ACCESS_KEY")
    aws_default_region: str = Field(default="eu-central-1", alias="AWS_DEFAULT_REGION")
    s3_bucket: str = Field(alias="S3_BUCKET")

    cookies_path: str | None = Field(default=None, alias="COOKIES_PATH")
    temp_dir: Path = Field(default=Path("/tmp"), alias="TEMP_DIR")
    yolo_model: str = Field(
        default="yolo11n.pt",
        alias="YOLO_MODEL",
        description="Path to YOLO weights file. Use absolute path for production.",
    )
    yolo_confidence: float = Field(
        default=0.3,
        alias="YOLO_CONFIDENCE",
        ge=0.0,
        le=1.0,
    )


settings = Settings()
