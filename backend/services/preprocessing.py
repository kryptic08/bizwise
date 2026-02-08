"""
Image preprocessing pipeline using OpenCV
"""
import io
import cv2
import numpy as np
from PIL import Image
from typing import Tuple

from core.logging_config import logger


class ImagePreprocessor:
    """Handles image preprocessing for OCR"""
    
    @staticmethod
    def bytes_to_image(image_bytes: bytes) -> np.ndarray:
        """Convert image bytes to OpenCV format"""
        try:
            # Open with PIL first
            pil_image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if needed
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            
            # Convert to numpy array
            image = np.array(pil_image)
            
            # Convert RGB to BGR (OpenCV format)
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            return image
        except Exception as e:
            logger.error(f"Error converting bytes to image: {e}")
            raise ValueError(f"Invalid image format: {e}")
    
    @staticmethod
    def preprocess(image: np.ndarray) -> np.ndarray:
        """
        Apply preprocessing pipeline for better OCR
        
        Steps:
        1. Denoise
        2. Convert to grayscale
        3. Apply adaptive thresholding
        4. Deskew if needed
        """
        try:
            # 1. Denoise
            denoised = cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 15)
            
            # 2. Convert to grayscale
            gray = cv2.cvtColor(denoised, cv2.COLOR_BGR2GRAY)
            
            # 3. Apply adaptive thresholding
            thresh = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            
            # 4. Deskew
            deskewed = ImagePreprocessor.deskew(thresh)
            
            # 5. Increase contrast
            enhanced = ImagePreprocessor.enhance_contrast(deskewed)
            
            return enhanced
            
        except Exception as e:
            logger.warning(f"Preprocessing failed, using original: {e}")
            # Return grayscale of original if preprocessing fails
            return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    @staticmethod
    def deskew(image: np.ndarray) -> np.ndarray:
        """Correct image rotation/skew"""
        try:
            coords = np.column_stack(np.where(image > 0))
            if len(coords) == 0:
                return image
            
            angle = cv2.minAreaRect(coords)[-1]
            
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            
            # Only deskew if angle is significant
            if abs(angle) < 0.5:
                return image
            
            (h, w) = image.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(
                image, M, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE
            )
            
            return rotated
        except Exception as e:
            logger.warning(f"Deskew failed: {e}")
            return image
    
    @staticmethod
    def enhance_contrast(image: np.ndarray) -> np.ndarray:
        """Enhance image contrast using CLAHE"""
        try:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(image)
            return enhanced
        except Exception as e:
            logger.warning(f"Contrast enhancement failed: {e}")
            return image
    
    def process_for_ocr(self, image_bytes: bytes) -> Tuple[np.ndarray, np.ndarray]:
        """
        Complete preprocessing pipeline
        
        Returns:
            Tuple of (original_image, preprocessed_image)
        """
        # Convert bytes to image
        original = self.bytes_to_image(image_bytes)
        
        # Apply preprocessing
        processed = self.preprocess(original)
        
        logger.info(f"Image preprocessed: {original.shape} -> {processed.shape}")
        
        return original, processed
