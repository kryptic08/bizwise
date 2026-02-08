"""
Logging configuration
"""
import logging
import sys
from pythonjsonlogger import jsonlogger

from core.config import settings


def setup_logger():
    """Configure application logger"""
    logger = logging.getLogger("receipt_processor")
    logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))
    
    # Console handler
    handler = logging.StreamHandler(sys.stdout)
    
    if settings.ENVIRONMENT == "production":
        # JSON formatter for production
        formatter = jsonlogger.JsonFormatter(
            "%(asctime)s %(name)s %(levelname)s %(message)s"
        )
    else:
        # Simple formatter for development
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
    
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    return logger


logger = setup_logger()
