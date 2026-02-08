"""
OCR Service – Tesseract and EasyOCR with multi-variant scoring.

Runs OCR on every preprocessing variant produced by the image pipeline
and keeps the result with the highest confidence, so the system
self-selects the best pre-processing for printed vs. handwritten input.
"""
import re
from typing import Dict, List, Tuple
import numpy as np

from core.logging_config import logger


class OCRService:
    """Handles OCR extraction from images."""

    def __init__(self):
        self.tesseract_available = False
        self.easyocr_reader = None
        self.pytesseract = None

        # Try to initialise Tesseract
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            self.tesseract_available = True
            self.pytesseract = pytesseract
            logger.info("Tesseract OCR initialised successfully")
        except Exception as e:
            logger.warning(f"Tesseract not available: {e}")

    # -------------------------------------------------------------- #
    #  Lazy EasyOCR init (heavy – only when needed)
    # -------------------------------------------------------------- #
    def _init_easyocr(self):
        if self.easyocr_reader is None:
            try:
                import easyocr
                self.easyocr_reader = easyocr.Reader(
                    ["en"], gpu=False, verbose=False
                )
                logger.info("EasyOCR initialised successfully")
            except Exception as e:
                logger.error(f"Failed to initialise EasyOCR: {e}")
                raise

    # -------------------------------------------------------------- #
    #  Tesseract – receipt-optimised PSM + OEM
    # -------------------------------------------------------------- #
    def _run_tesseract(self, image: np.ndarray) -> Tuple[str, float]:
        """Run Tesseract with receipt-friendly config and return (text, conf)."""
        if not self.tesseract_available:
            raise RuntimeError("Tesseract is not available")

        # PSM 6 = uniform block of text (typical receipt)
        # OEM 3 = default (LSTM + legacy)
        custom_config = r"--oem 3 --psm 6"

        data = self.pytesseract.image_to_data(
            image,
            output_type=self.pytesseract.Output.DICT,
            config=custom_config,
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

        # Reconstruct text preserving line breaks
        full_text = "\n".join(
            " ".join(words) for _, words in sorted(lines.items())
        )
        avg_conf = (sum(confidences) / len(confidences) / 100) if confidences else 0.0

        return full_text, avg_conf

    # -------------------------------------------------------------- #
    #  EasyOCR
    # -------------------------------------------------------------- #
    def _run_easyocr(self, image: np.ndarray) -> Tuple[str, float]:
        self._init_easyocr()
        results = self.easyocr_reader.readtext(image, paragraph=False)

        texts: List[str] = []
        confs: List[float] = []
        for _bbox, text, conf in results:
            texts.append(text)
            confs.append(conf)

        full_text = "\n".join(texts)
        avg_conf = (sum(confs) / len(confs)) if confs else 0.0
        return full_text, avg_conf

    # -------------------------------------------------------------- #
    #  Run a single engine on one image variant
    # -------------------------------------------------------------- #
    def _run_single(
        self, image: np.ndarray, engine: str
    ) -> Tuple[str, float]:
        if engine == "easyocr":
            return self._run_easyocr(image)
        if self.tesseract_available:
            return self._run_tesseract(image)
        # fallback
        return self._run_easyocr(image)

    # -------------------------------------------------------------- #
    #  Public API – multi-variant scoring
    # -------------------------------------------------------------- #
    def extract_text(
        self,
        images: "np.ndarray | List[np.ndarray]",
        engine: str = "tesseract",
    ) -> Dict:
        """
        Run OCR on one or more image variants and return the best result.

        Parameters
        ----------
        images : single ndarray or list of ndarrays
            If a list is given (from multi-strategy preprocessing),
            every variant is OCR-ed and the one with the highest
            confidence is returned.
        engine : str
            ``"tesseract"`` or ``"easyocr"``

        Returns
        -------
        dict with ``raw_text``, ``confidence``, ``engine``, ``word_count``
        """
        # Normalise to a list
        if isinstance(images, np.ndarray):
            variants = [images]
        else:
            variants = images

        best_text = ""
        best_conf = -1.0
        best_engine = engine

        for idx, img in enumerate(variants):
            try:
                text, conf = self._run_single(img, engine)
                word_count = len(text.split())
                logger.info(
                    f"  variant {idx}: {word_count} words, "
                    f"confidence {conf:.2f} ({engine})"
                )

                # Prefer the result with highest confidence that also
                # produced a reasonable amount of text
                score = conf * (1.0 + min(word_count / 100, 1.0))
                if score > best_conf:
                    best_conf = score
                    best_text = text
                    best_engine = engine
            except Exception as e:
                logger.warning(f"  variant {idx} failed ({engine}): {e}")

        # If Tesseract gave a poor result, try EasyOCR on the best variant
        if (
            best_conf < 0.45
            and engine != "easyocr"
            and len(variants) > 0
        ):
            try:
                logger.info("Low confidence – trying EasyOCR fallback…")
                text, conf = self._run_easyocr(variants[0])
                if conf > best_conf:
                    best_text = text
                    best_conf = conf
                    best_engine = "easyocr"
                    logger.info(
                        f"  EasyOCR fallback: {len(text.split())} words, "
                        f"confidence {conf:.2f}"
                    )
            except Exception as e:
                logger.warning(f"EasyOCR fallback failed: {e}")

        cleaned = self.clean_text(best_text)

        logger.info(
            f"OCR best result: {len(cleaned.split())} words, "
            f"confidence {best_conf:.2f}, engine={best_engine}"
        )

        return {
            "raw_text": cleaned,
            "raw_text_with_lines": best_text,
            "confidence": min(best_conf, 1.0),
            "engine": best_engine,
            "word_count": len(cleaned.split()),
        }

    # -------------------------------------------------------------- #
    #  Text cleaning
    # -------------------------------------------------------------- #
    @staticmethod
    def clean_text(text: str) -> str:
        """Normalise OCR text while preserving structure."""
        # Collapse runs of whitespace on the same line, keep newlines
        lines = text.split("\n")
        cleaned_lines = []
        for line in lines:
            line = re.sub(r"[ \t]+", " ", line).strip()
            if line:
                cleaned_lines.append(line)
        return "\n".join(cleaned_lines)
