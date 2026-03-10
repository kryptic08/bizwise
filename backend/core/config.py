"""
Configuration management using pydantic-settings
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # API Configuration
    API_KEY: Optional[str] = None
    ENVIRONMENT: str = "development"
    
    # Model Configuration
    OCR_ENGINE: str = "tesseract"
    USE_NLP_MODEL: bool = True  # BERT NER enabled for improved merchant name extraction

    USE_CNN_MODEL: bool = True  # Enable CNN-based receipt-type/region models (enabled by default)
    CNN_MODEL_PATH: Optional[str] = None  # Optional path to CNN weights (if required)
    CONFIDENCE_THRESHOLD: float = 0.7
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
