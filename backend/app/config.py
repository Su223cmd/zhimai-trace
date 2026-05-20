from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./cognitive_diagnosis.db"
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"
    REDIS_URL: str = "redis://localhost:6379/0"
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    LLM_PROVIDER: str = "zhipu"
    ZHIPU_API_KEY: str = ""
    ZHIPU_BASE_URL: str = "https://api.z.ai/api/paas/v4"
    UPLOAD_DIR: str = "./uploads"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8000"

    class Config:
        env_file = ".env"


settings = Settings()
