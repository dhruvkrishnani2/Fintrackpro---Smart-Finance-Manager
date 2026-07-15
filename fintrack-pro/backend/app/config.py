from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://fintrack:fintrack@localhost:5432/fintrack_pro"
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60
    mfa_temp_token_expire_minutes: int = 5
    mfa_issuer_name: str = "FinTrack Pro"
    algorithm: str = "HS256"
    cors_origins: str = "http://localhost:5173"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    google_client_id: str = "1000527489380-iphc8jukk3noqr4dg627ls090gstssls.apps.googleusercontent.com"

    class Config:
        env_file = ".env"

    @property
    def cors_origin_list(self):
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
