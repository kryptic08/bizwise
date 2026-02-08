"""
Main receipt processor – orchestrates preprocessing, OCR, and NLP extraction.
"""
from typing import Dict
import asyncio

from services.preprocessing import ImagePreprocessor
from services.ocr import OCRService
from services.extraction import NLPExtractor
from core.config import settings
from core.logging_config import logger


class ReceiptProcessor:
    """Coordinates preprocessing → OCR → extraction pipeline."""

    def __init__(self):
        logger.info("Initialising Receipt Processor …")
        self.preprocessor = ImagePreprocessor()
        self.ocr_service = OCRService()
        self.nlp_extractor = NLPExtractor(use_model=settings.USE_NLP_MODEL)
        logger.info("Receipt Processor ready")

    async def process_receipt(
        self,
        image_bytes: bytes,
        ocr_engine: str = "tesseract",
        confidence_threshold: float = 0.7,
    ) -> Dict:
        try:
            # 1. Preprocessing – returns (original, [variant1, variant2, …])
            logger.info("Step 1: Preprocessing image …")
            _original, variants = await asyncio.to_thread(
                self.preprocessor.process_for_ocr,
                image_bytes,
            )

            # 2. OCR on all variants – best result auto-selected
            logger.info(f"Step 2: Running OCR ({ocr_engine}) on {len(variants)} variant(s) …")
            ocr_result = await asyncio.to_thread(
                self.ocr_service.extract_text,
                variants,
                ocr_engine,
            )

            raw_text = ocr_result["raw_text"]
            ocr_confidence = ocr_result["confidence"]
            logger.info(
                f"OCR done: {ocr_result['word_count']} words, "
                f"confidence {ocr_confidence:.2f}, engine={ocr_result['engine']}"
            )

            # 3. NLP extraction
            logger.info("Step 3: Extracting structured data …")
            extracted = await asyncio.to_thread(
                self.nlp_extractor.extract,
                raw_text,
                ocr_confidence,
            )

            # 4. Assemble final result
            result = {
                "merchant_name": extracted.get("merchant_name"),
                "receipt_date": extracted.get("receipt_date"),
                "total_amount": extracted.get("total_amount"),
                "tax_amount": extracted.get("tax_amount"),
                "line_items": extracted.get("line_items", []),
                "raw_text": raw_text,
                "confidence_score": extracted.get("confidence_score", ocr_confidence),
            }

            if result["confidence_score"] < confidence_threshold:
                logger.warning(
                    f"Low confidence: {result['confidence_score']:.2f} "
                    f"< threshold {confidence_threshold}"
                )

            logger.info(
                f"Done – {len(result['line_items'])} items, "
                f"total=${result['total_amount']}, "
                f"confidence={result['confidence_score']:.2f}"
            )
            return result

        except Exception as e:
            logger.error(f"Receipt processing error: {e}")
            raise

    def get_model_info(self) -> Dict:
        return {
            "preprocessor": "OpenCV (multi-strategy)",
            "ocr_available": {
                "tesseract": self.ocr_service.tesseract_available,
                "easyocr": self.ocr_service.easyocr_reader is not None,
            },
            "nlp_model_enabled": self.nlp_extractor.use_model,
            "nlp_model_loaded": self.nlp_extractor.model is not None,
        }
