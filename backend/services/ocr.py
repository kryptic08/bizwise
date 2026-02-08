"""
OCR Service – Tesseract-only, multi-variant scoring.

Runs OCR on every preprocessing variant produced by the image pipeline
and keeps the result with the highest confidence, so the system
self-selects the best pre-processing for printed vs. handwritten input.

EasyOCR / PyTorch removed to fit within Render free-tier 512 MB RAM.
"""
import re
from typing import Dict, List, Tuple
import numpy as np

from core.logging_config import logger


class OCRService:
    """Handles OCR extraction from images using Tesseract."""

    def __init__(self):
        self.tesseract_available = False
        self.pytesseract = None

        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            self.tesseract_available = True
            self.pytesseract = pytesseract
            logger.info("Tesseract OCR initialised successfully")
        except Exception as e:
            logger.warning(f"Tesseract not available: {e}")

    # -------------------------------------------------------------- #
    #  Tesseract – receipt-optimised PSM + OEM
    # -------------------------------------------------------------- #
    def _run_tesseract(self, image: np.ndarray, config: str) -> Tuple[str, float, int]:
        """Run Tesseract with receipt-friendly config and return (text, conf, words)."""
        if not self.tesseract_available:
            raise RuntimeError("Tesseract is not available")

        data = self.pytesseract.image_to_data(
            image,
            output_type=self.pytesseract.Output.DICT,
            config=config,
        )

        lines: Dict[int, List[str]] = {}
        confidences: List[int] = []

        for i, conf_val in enumerate(data["conf"]):
            conf_int = int(conf_val)
            if conf_int > 0:
                word = data["text"][i].strip()
                if word:
                    block = data["block_num"][i]
                    line = data["line_num"][i]
                    key = (block, line)
                    lines.setdefault(key, []).append(word)
                    confidences.append(conf_int)

        full_text = "\n".join(
            " ".join(words) for _, words in sorted(lines.items())
        )
        avg_conf = (sum(confidences) / len(confidences) / 100) if confidences else 0.0
        return full_text, avg_conf, len(confidences)

    # -------------------------------------------------------------- #
    #  Public API – multi-variant scoring
    # -------------------------------------------------------------- #
    def extract_text(
        self,
        images: "np.ndarray | List[np.ndarray]",
        engine: str = "tesseract",
    ) -> Dict:
        """
        Run Tesseract on one or more image variants and return the best.

        Parameters
        ----------
        images : single ndarray or list of ndarrays
        engine : str  (only ``"tesseract"`` supported on free tier)

        Returns
        -------
        dict with ``raw_text``, ``confidence``, ``engine``, ``word_count``
        """
        if isinstance(images, np.ndarray):
            variants = [images]
        else:
            variants = images

        best_text = ""
        best_conf = -1.0

        # Primary OCR configs (try fast config first, fallback only when needed)
        primary_config = r"--oem 3 --psm 6 -c preserve_interword_spaces=1"
        fallback_config = r"--oem 3 --psm 4 -c preserve_interword_spaces=1"

        for idx, img in enumerate(variants):
            try:
                text, conf, word_hits = self._run_tesseract(img, primary_config)
                word_count = len(text.split())
                logger.info(
                    f"  variant {idx}: {word_count} words, "
                    f"confidence {conf:.2f}"
                )

                # If result looks weak, try a different page segmentation
                if conf < 0.45 or word_count < 8:
                    alt_text, alt_conf, _ = self._run_tesseract(
                        img, fallback_config
                    )
                    alt_words = len(alt_text.split())
                    alt_score = alt_conf * (1.0 + min(alt_words / 100, 1.0))
                    score = conf * (1.0 + min(word_count / 100, 1.0))
                    if alt_score > score:
                        text, conf, word_count = alt_text, alt_conf, alt_words

                score = conf * (1.0 + min(word_count / 100, 1.0))
                if score > best_conf:
                    best_conf = score
                    best_text = text

                # Early exit if we already have a strong result
                if conf >= 0.80 and word_count >= 20:
                    logger.info("  early-stop: high-confidence OCR")
                    break
            except Exception as e:
                logger.warning(f"  variant {idx} failed: {e}")

        cleaned = self.clean_text(best_text)

        logger.info(
            f"OCR best result: {len(cleaned.split())} words, "
            f"confidence {best_conf:.2f}"
        )

        return {
            "raw_text": cleaned,
            "raw_text_with_lines": best_text,
            "confidence": min(max(best_conf, 0.0), 1.0),
            "engine": "tesseract",
            "word_count": len(cleaned.split()),
        }

    # -------------------------------------------------------------- #
    #  Text cleaning
    # -------------------------------------------------------------- #
    @staticmethod
    def clean_text(text: str) -> str:
        """Normalise OCR text while preserving structure."""
        lines = text.split("\n")
        cleaned_lines = []
        for line in lines:
            line = re.sub(r"[ \t]+", " ", line).strip()
            if line:
                cleaned_lines.append(line)
        return "\n".join(cleaned_lines)
