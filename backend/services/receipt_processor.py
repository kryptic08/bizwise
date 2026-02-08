"""
Main receipt processor - orchestrates preprocessing, OCR, and extraction
"""
from typing import Dict
import asyncio
from functools import lru_cache

from services.preprocessing import ImagePreprocessor
from services.ocr import OCRService
from services.extraction import NLPExtractor
from core.config import settings
from core.logging_config import logger


class ReceiptProcessor:
    """Main processor that coordinates all services"""
    
    def __init__(self):
        """Initialize all services"""
        logger.info("Initializing Receipt Processor...")
        
        self.preprocessor = ImagePreprocessor()
        self.ocr_service = OCRService()
        self.nlp_extractor = NLPExtractor(use_model=settings.USE_NLP_MODEL)
        
        logger.info("Receipt Processor initialized successfully")
    
    async def process_receipt(
        self,
        image_bytes: bytes,
        ocr_engine: str = "tesseract",
        confidence_threshold: float = 0.7
    ) -> Dict:
        """
        Process receipt image through complete pipeline
        
        Args:
            image_bytes: Raw image bytes
            ocr_engine: OCR engine to use
            confidence_threshold: Minimum confidence threshold
        
        Returns:
            Structured receipt data
        """
        try:
            # 1. Preprocessing
            logger.info("Step 1: Preprocessing image...")
            original, preprocessed = await asyncio.to_thread(
                self.preprocessor.process_for_ocr,
                image_bytes
            )
            
            # 2. OCR
            logger.info(f"Step 2: Running OCR ({ocr_engine})...")
            ocr_result = await asyncio.to_thread(
                self.ocr_service.extract_text,
                preprocessed,
                ocr_engine
            )
            
            raw_text = ocr_result["raw_text"]
            ocr_confidence = ocr_result["confidence"]
            
            logger.info(f"OCR completed: {ocr_result['word_count']} words, confidence: {ocr_confidence:.2f}")
            
            # 3. NLP Extraction
            logger.info("Step 3: Extracting structured data...")
            extracted_data = await asyncio.to_thread(
                self.nlp_extractor.extract,
                raw_text,
                ocr_confidence
            )
            
            # 4. Combine results
            result = {
                "merchant_name": extracted_data.get("merchant_name"),
                "receipt_date": extracted_data.get("receipt_date"),
                "total_amount": extracted_data.get("total_amount"),
                "tax_amount": extracted_data.get("tax_amount"),
                "line_items": extracted_data.get("line_items", []),
                "raw_text": raw_text,
                "confidence_score": extracted_data.get("confidence_score", ocr_confidence)
            }
            
            # Check confidence threshold
            if result["confidence_score"] < confidence_threshold:
                logger.warning(
                    f"Low confidence: {result['confidence_score']:.2f} < {confidence_threshold}"
                )
            
            logger.info(
                f"Processing complete: {len(result['line_items'])} items, "
                f"total: ${result['total_amount']}, confidence: {result['confidence_score']:.2f}"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error in receipt processing pipeline: {e}")
            raise
    
    def get_model_info(self) -> Dict:
        """Get information about loaded models and services"""
        return {
            "preprocessor": "OpenCV",
            "ocr_available": {
                "tesseract": self.ocr_service.tesseract_available,
                "easyocr": self.ocr_service.easyocr_reader is not None
            },
            "nlp_model_enabled": self.nlp_extractor.use_model,
            "nlp_model_loaded": self.nlp_extractor.model is not None
        }
