"""
OCR Service with Tesseract and EasyOCR support
"""
import re
from typing import Dict, List, Tuple, Optional
import numpy as np

from core.logging_config import logger


class OCRService:
    """Handles OCR extraction from images"""
    
    def __init__(self):
        self.tesseract_available = False
        self.easyocr_reader = None
        
        # Try to initialize Tesseract
        try:
            import pytesseract
            # Test if tesseract is installed
            pytesseract.get_tesseract_version()
            self.tesseract_available = True
            self.pytesseract = pytesseract
            logger.info("Tesseract OCR initialized successfully")
        except Exception as e:
            logger.warning(f"Tesseract not available: {e}")
    
    def _init_easyocr(self):
        """Lazy initialization of EasyOCR (slow to load)"""
        if self.easyocr_reader is None:
            try:
                import easyocr
                self.easyocr_reader = easyocr.Reader(['en'], gpu=False)
                logger.info("EasyOCR initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize EasyOCR: {e}")
                raise
    
    def extract_text_tesseract(self, image: np.ndarray) -> Tuple[str, float]:
        """
        Extract text using Tesseract
        
        Returns:
            Tuple of (text, confidence_score)
        """
        if not self.tesseract_available:
            raise RuntimeError("Tesseract is not available")
        
        try:
            # Get detailed data with confidence scores
            data = self.pytesseract.image_to_data(
                image, output_type=self.pytesseract.Output.DICT
            )
            
            # Extract text and calculate average confidence
            texts = []
            confidences = []
            
            for i, conf in enumerate(data['conf']):
                if int(conf) > 0:  # Valid confidence
                    text = data['text'][i].strip()
                    if text:
                        texts.append(text)
                        confidences.append(int(conf))
            
            full_text = ' '.join(texts)
            avg_confidence = sum(confidences) / len(confidences) / 100 if confidences else 0.0
            
            logger.info(f"Tesseract extracted {len(texts)} words (confidence: {avg_confidence:.2f})")
            
            return full_text, avg_confidence
            
        except Exception as e:
            logger.error(f"Tesseract extraction failed: {e}")
            raise
    
    def extract_text_easyocr(self, image: np.ndarray) -> Tuple[str, float]:
        """
        Extract text using EasyOCR
        
        Returns:
            Tuple of (text, confidence_score)
        """
        self._init_easyocr()
        
        try:
            results = self.easyocr_reader.readtext(image)
            
            texts = []
            confidences = []
            
            for (bbox, text, conf) in results:
                texts.append(text)
                confidences.append(conf)
            
            full_text = ' '.join(texts)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            logger.info(f"EasyOCR extracted {len(texts)} words (confidence: {avg_confidence:.2f})")
            
            return full_text, avg_confidence
            
        except Exception as e:
            logger.error(f"EasyOCR extraction failed: {e}")
            raise
    
    def extract_text(self, image: np.ndarray, engine: str = "tesseract") -> Dict[str, any]:
        """
        Extract text using specified OCR engine
        
        Args:
            image: Preprocessed image
            engine: OCR engine to use ('tesseract' or 'easyocr')
        
        Returns:
            Dict with text, confidence, and metadata
        """
        try:
            if engine == "easyocr":
                text, confidence = self.extract_text_easyocr(image)
            else:
                if not self.tesseract_available:
                    logger.warning("Tesseract not available, falling back to EasyOCR")
                    text, confidence = self.extract_text_easyocr(image)
                else:
                    text, confidence = self.extract_text_tesseract(image)
            
            # Clean the text
            cleaned_text = self.clean_text(text)
            
            return {
                "raw_text": cleaned_text,
                "confidence": confidence,
                "engine": engine,
                "word_count": len(cleaned_text.split())
            }
            
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            raise
    
    @staticmethod
    def clean_text(text: str) -> str:
        """Clean and normalize OCR text"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove special characters that are likely OCR errors
        text = re.sub(r'[^\w\s\$\.\,\-\:\(\)\/]', '', text)
        
        return text.strip()
