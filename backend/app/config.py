from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/sa_lender"
    llm_api_key: str = ""
    llm_model: str = "claude-sonnet-4-20250514"
    max_file_size_mb: int = 20
    upload_dir: str = "/tmp/sa-lender-uploads"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
