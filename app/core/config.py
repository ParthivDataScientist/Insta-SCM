import os
from pydantic_settings import BaseSettings

# Resolve .env from project root (one level above app/)
_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_ENV_PATH = os.path.join(_ROOT_DIR, ".env")


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Insta Exibition SCM"

    # Security
    # Set this in .env to enable API key protection on mutating endpoints.
    # Leave empty to run in open/dev mode.
    API_KEY: str = ""

    # JWT settings
    JWT_SECRET_KEY: str = "super_secret_dev_key_change_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480 # 8 hours

    # CORS — set to your frontend production URL in .env
    ALLOWED_ORIGIN: str = "http://localhost:5173"

    # Database
    DATABASE_URL: str = "sqlite:///./sql_app.db"

    # Carrier Credentials
    FEDEX_CLIENT_ID: str = ""
    FEDEX_CLIENT_SECRET: str = ""
    FEDEX_URL: str = "https://apis.fedex.com"

    UPS_CLIENT_ID: str = ""
    UPS_CLIENT_SECRET: str = ""

    DHL_API_KEY: str = ""
    DHL_API_SECRET: str = ""

    class Config:
        env_file = _ENV_PATH


settings = Settings()
