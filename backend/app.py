"""
BizWise Receipt Processing API
FastAPI microservice for OCR and NLP extraction of receipt data
"""
import time
import traceback
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from schemas import ReceiptResponse, ErrorResponse, HealthResponse
from services.receipt_processor import ReceiptProcessor
from core.config import settings
from core.logging_config import logger


# Global processor instance
processor: Optional[ReceiptProcessor] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize models on startup, cleanup on shutdown"""
    global processor
    logger.info("Starting up Receipt Processing API...")
    
    try:
        processor = ReceiptProcessor()
        logger.info("Models loaded successfully")
    except Exception as e:
        logger.error(f"Failed to initialize processor: {e}")
        raise
    
    yield
    
    logger.info("Shutting down Receipt Processing API...")


# Initialize FastAPI app
app = FastAPI(
    title="BizWise Receipt Processing API",
    description="OCR and NLP extraction for receipt images",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)


# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your React Native app domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API Key Authentication
async def verify_api_key(x_api_key: str = Header(None)):
    """Verify API key from header"""
    if settings.API_KEY and x_api_key != settings.API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key"
        )
    return x_api_key


@app.get("/", response_model=dict)
async def root():
    """Root endpoint"""
    return {
        "service": "BizWise Receipt Processing API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs" if settings.ENVIRONMENT == "development" else "disabled"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for monitoring"""
    return HealthResponse(
        status="healthy",
        environment=settings.ENVIRONMENT,
        ocr_engine=settings.OCR_ENGINE,
        nlp_enabled=settings.USE_NLP_MODEL
    )


@app.post(
    "/api/v1/receipt/process",
    response_model=ReceiptResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse}
    }
)
async def process_receipt(
    file: UploadFile = File(...),
    ocr_engine: Optional[str] = None,
    confidence_threshold: Optional[float] = None,
    api_key: str = Depends(verify_api_key)
):
    """
    Process a receipt image and extract structured data
    
    Args:
        file: Receipt image file (JPEG, PNG, etc.)
        ocr_engine: OCR engine to use (tesseract or easyocr)
        confidence_threshold: Minimum confidence score (0.0-1.0)
    
    Returns:
        Structured receipt data with merchant, date, total, line items, etc.
    """
    start_time = time.time()
    
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="File must be an image (JPEG, PNG, etc.)"
            )
        
        # Read image file
        image_bytes = await file.read()
        
        if len(image_bytes) == 0:
            raise HTTPException(
                status_code=400,
                detail="Empty file received"
            )
        
        logger.info(f"Processing receipt image: {file.filename} ({len(image_bytes)} bytes)")
        
        # Process the receipt
        result = await processor.process_receipt(
            image_bytes=image_bytes,
            ocr_engine=ocr_engine or settings.OCR_ENGINE,
            confidence_threshold=confidence_threshold or settings.CONFIDENCE_THRESHOLD
        )
        
        processing_time = int((time.time() - start_time) * 1000)
        
        logger.info(
            f"Receipt processed successfully in {processing_time}ms "
            f"(confidence: {result.get('confidence_score', 0):.2f})"
        )
        
        return ReceiptResponse(
            success=True,
            data=result,
            processing_time_ms=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        processing_time = int((time.time() - start_time) * 1000)
        error_msg = str(e)
        logger.error(f"Error processing receipt: {error_msg}\n{traceback.format_exc()}")
        
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": error_msg,
                "processing_time_ms": processing_time
            }
        )


@app.get("/api/v1/models/info")
async def model_info(api_key: str = Depends(verify_api_key)):
    """Get information about loaded models"""
    if processor:
        return processor.get_model_info()
    return {"error": "Processor not initialized"}


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower()
    )
