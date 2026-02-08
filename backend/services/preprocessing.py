"""
Image preprocessing pipeline using OpenCV
Optimised for both printed thermal receipts and handwritten notes.
"""
import io
import cv2
import numpy as np
from PIL import Image, ImageOps
from typing import Tuple, List

from core.logging_config import logger


class ImagePreprocessor:
    """Handles image preprocessing for OCR – multi-strategy for best results."""

    # ------------------------------------------------------------------ #
    #  Byte → OpenCV image
    # ------------------------------------------------------------------ #
    @staticmethod
    def bytes_to_image(image_bytes: bytes) -> np.ndarray:
        """Convert raw image bytes to a BGR OpenCV ndarray."""
        try:
            pil_image = Image.open(io.BytesIO(image_bytes))

            # Fix EXIF orientation (phone cameras)
            pil_image = ImageOps.exif_transpose(pil_image) or pil_image

            if pil_image.mode != "RGB":
                pil_image = pil_image.convert("RGB")

            image = np.array(pil_image)
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            return image
        except Exception as e:
            logger.error(f"Error converting bytes to image: {e}")
            raise ValueError(f"Invalid image format: {e}")

    # ------------------------------------------------------------------ #
    #  Resize to sane dimensions
    # ------------------------------------------------------------------ #
    @staticmethod
    def resize_for_ocr(image: np.ndarray, max_width: int = 2000) -> np.ndarray:
        """
        Resize so longest side ≤ max_width while keeping aspect ratio.
        Upscale tiny images for better OCR on handwriting.
        """
        h, w = image.shape[:2]

        # Up-scale tiny receipt photos
        if max(h, w) < 800:
            scale = 1600 / max(h, w)
            image = cv2.resize(image, None, fx=scale, fy=scale,
                               interpolation=cv2.INTER_CUBIC)
            h, w = image.shape[:2]

        if w > max_width:
            scale = max_width / w
            image = cv2.resize(image, None, fx=scale, fy=scale,
                               interpolation=cv2.INTER_AREA)
        return image

    # ------------------------------------------------------------------ #
    #  Deskew (Hough-line based – more robust than minAreaRect)
    # ------------------------------------------------------------------ #
    @staticmethod
    def deskew(image: np.ndarray) -> np.ndarray:
        """Correct rotation by detecting dominant text-line angle."""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            lines = cv2.HoughLinesP(
                edges, 1, np.pi / 180,
                threshold=100, minLineLength=60,
                maxLineGap=10,
            )
            if lines is None or len(lines) == 0:
                return image

            angles = []
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
                if abs(angle) < 30:  # only near-horizontal lines
                    angles.append(angle)

            if not angles:
                return image

            median_angle = float(np.median(angles))
            if abs(median_angle) < 0.3:
                return image

            (h, w) = image.shape[:2]
            M = cv2.getRotationMatrix2D((w // 2, h // 2), median_angle, 1.0)
            rotated = cv2.warpAffine(
                image, M, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            )
            logger.info(f"Deskewed image by {median_angle:.1f}°")
            return rotated
        except Exception as e:
            logger.warning(f"Deskew failed: {e}")
            return image

    # ------------------------------------------------------------------ #
    #  Individual enhancement helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def enhance_contrast(gray: np.ndarray) -> np.ndarray:
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        return clahe.apply(gray)

    @staticmethod
    def sharpen(gray: np.ndarray) -> np.ndarray:
        kernel = np.array([[-1, -1, -1],
                           [-1,  9, -1],
                           [-1, -1, -1]], dtype=np.float32)
        return cv2.filter2D(gray, -1, kernel)

    # ------------------------------------------------------------------ #
    #  Strategy A – works best on printed thermal receipts
    # ------------------------------------------------------------------ #
    @staticmethod
    def preprocess_printed(image: np.ndarray) -> np.ndarray:
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            # Fast denoise for receipts (faster than colored NLM)
            gray = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
            gray = ImagePreprocessor.enhance_contrast(gray)
            gray = cv2.GaussianBlur(gray, (3, 3), 0)
            thresh = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY, 31, 15,
            )
            return thresh
        except Exception as e:
            logger.warning(f"preprocess_printed failed: {e}")
            return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # ------------------------------------------------------------------ #
    #  Strategy B – works best on handwritten / pen receipts
    # ------------------------------------------------------------------ #
    @staticmethod
    def preprocess_handwritten(image: np.ndarray) -> np.ndarray:
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            # Bilateral filter preserves edges (ink strokes)
            gray = cv2.bilateralFilter(gray, 7, 50, 50)
            gray = ImagePreprocessor.enhance_contrast(gray)
            gray = ImagePreprocessor.sharpen(gray)
            # Otsu binarization works better for handwriting
            _, thresh = cv2.threshold(
                gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
            )
            return thresh
        except Exception as e:
            logger.warning(f"preprocess_handwritten failed: {e}")
            return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # ------------------------------------------------------------------ #
    #  Strategy C – grayscale + CLAHE only (good for photos in low light)
    # ------------------------------------------------------------------ #
    @staticmethod
    def preprocess_simple(image: np.ndarray) -> np.ndarray:
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            gray = ImagePreprocessor.enhance_contrast(gray)
            return gray
        except Exception:
            return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # ------------------------------------------------------------------ #
    #  Public API – returns all variants the OCR layer can pick from
    # ------------------------------------------------------------------ #
    def process_for_ocr(
        self, image_bytes: bytes
    ) -> Tuple[np.ndarray, List[np.ndarray]]:
        """
        Full preprocessing pipeline.

        Returns
        -------
        original : BGR image
        variants : list of grayscale images preprocessed with different
                   strategies. The OCR layer runs each one and keeps the
                   result with the highest confidence.
        """
        original = self.bytes_to_image(image_bytes)
        original = self.resize_for_ocr(original)

        # Deskew on the colour image before splitting into strategies
        deskewed_bgr = self.deskew(original)

        variants = [
            self.preprocess_printed(deskewed_bgr),
            self.preprocess_handwritten(deskewed_bgr),
            self.preprocess_simple(deskewed_bgr),
        ]

        logger.info(
            f"Image preprocessed: {original.shape} → "
            f"{len(variants)} variants generated"
        )
        return original, variants
