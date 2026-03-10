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
        # Optional CNN components (lazy-loaded inside their classes)
        self.cnn_classifier = None
        self.region_detector = None
        self.legacy_scanner = None
        # Initialise CNN components and the legacy receipt scanner (always)
        try:
            from services.cnn_classifier import ReceiptTypeClassifier, ReceiptRegionDetector

            self.cnn_classifier = ReceiptTypeClassifier.get_instance()
            self.region_detector = ReceiptRegionDetector.get_instance()
            logger.info("CNN components initialised (lazy-load)")
        except Exception as e:
            logger.warning(f"CNN components not initialised: {e}")
        # Wire up the legacy receipt_scanner pipeline (TensorFlow-based) if present
        try:
            import receipt_scanner.processor as rs_processor
            # function: process_image_from_bytes(image_bytes, ocr_func=None)
            self.legacy_scanner = rs_processor.process_image_from_bytes
            logger.info("Legacy receipt_scanner pipeline available as OCR path")
        except Exception as e:
            logger.info(f"receipt_scanner not available: {e}")
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
            original, variants = await asyncio.to_thread(
                self.preprocessor.process_for_ocr,
                image_bytes,
            )

            # Optional: use CNN classifier to predict receipt type (informs logging / strategy)
            receipt_type = None
            if self.cnn_classifier is not None:
                try:
                    pred = await asyncio.to_thread(self.cnn_classifier.predict, original)
                    receipt_type = pred.get("label")
                    logger.info(f"CNN receipt type predicted: {receipt_type} (score={pred.get('score')})")
                except Exception as e:
                    logger.warning(f"CNN classifier failed: {e}")

            # 2. OCR – try legacy receipt_scanner pipeline first (if present),
            #    otherwise run region-based OCR if CNN detector is available,
            #    otherwise fall back to multi-variant OCR.
            logger.info(f"Step 2: Running OCR ({ocr_engine}) on {len(variants)} variant(s) …")

            ocr_result = None
            # Option A: legacy receipt_scanner pipeline (may use TF/CRNN internally)
            if self.legacy_scanner is not None:
                try:
                    raw_from_legacy = await asyncio.to_thread(self.legacy_scanner, image_bytes)
                    if raw_from_legacy:
                        ocr_result = {
                            "raw_text": raw_from_legacy,
                            "confidence": 0.6,  # conservative default for legacy pipeline
                            "engine": "receipt_scanner",
                            "word_count": len(raw_from_legacy.split()),
                        }
                        logger.info("Used legacy receipt_scanner pipeline for OCR")
                except Exception as e:
                    logger.warning(f"Legacy receipt_scanner pipeline failed: {e}")

            # Option B: If a region detector is available and loaded, OCR each detected region separately
            if ocr_result is None and self.region_detector is not None and self.region_detector.is_available:
                try:
                    regions = await asyncio.to_thread(self.region_detector.detect, original)
                    ocr_text_parts = []
                    confidences = []
                    word_counts = []

                    for reg in regions:
                        try:
                            x1, y1, x2, y2 = reg.get("bbox", [0, 0, original.shape[1], original.shape[0]])
                            x1 = int(max(0, x1))
                            y1 = int(max(0, y1))
                            x2 = int(min(original.shape[1], x2))
                            y2 = int(min(original.shape[0], y2))
                            crop = original[y1:y2, x1:x2]
                            if crop.size == 0:
                                continue

                            reg_variants = [
                                self.preprocessor.preprocess_printed(crop),
                                self.preprocessor.preprocess_handwritten(crop),
                                self.preprocessor.preprocess_simple(crop),
                            ]

                            part = await asyncio.to_thread(self.ocr_service.extract_text, reg_variants, ocr_engine)
                            ocr_text_parts.append(part.get("raw_text", ""))
                            confidences.append(part.get("confidence", 0.0))
                            word_counts.append(part.get("word_count", 0))
                        except Exception as e:
                            logger.warning(f"OCR failed for region {reg}: {e}")

                    if ocr_text_parts:
                        raw_text = "\n".join(ocr_text_parts)
                        ocr_confidence = sum(confidences) / len(confidences) if confidences else 0.0
                        ocr_word_count = sum(word_counts)
                        ocr_result = {
                            "raw_text": raw_text,
                            "confidence": min(max(ocr_confidence, 0.0), 1.0),
                            "engine": "tesseract",
                            "word_count": ocr_word_count,
                        }
                except Exception as e:
                    logger.warning(f"Region-based OCR failed: {e}")

            # Fallback: run OCR on preprocessed variants (original pipeline)
            if ocr_result is None:
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
            },
            "nlp_engine": "regex-heuristic",
            "bert_ner_enabled": self.nlp_extractor.use_model,
            "bert_ner_loaded": self.nlp_extractor._bert is not None,
            "cnn_enabled": bool(self.cnn_classifier or self.region_detector or self.legacy_scanner),
            "cnn_models": {
                "receipt_type_classifier": bool(self.cnn_classifier and getattr(self.cnn_classifier, "is_available", False)),
                "region_detector": bool(self.region_detector and getattr(self.region_detector, "is_available", False)),
            },
            "legacy_scanner": bool(self.legacy_scanner is not None),
        }
        
