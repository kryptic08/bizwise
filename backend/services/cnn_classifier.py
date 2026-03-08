"""
CNN Receipt Classifier – FUTURE USE / PLACEHOLDER

This module will provide two CNN-based capabilities once the server
has enough compute (GPU or ≥ 2 GB RAM):

  1. ReceiptTypeClassifier
     Classifies an input image into one of four receipt types:
       • thermal_printed  – standard POS / cashier receipt
       • handwritten      – handwritten note or informal receipt
       • invoice          – formal A4/letter-sized invoice
       • other            – screenshot, photo of screen, unknown

     This lets the preprocessing pipeline and OCR engine choose the
     best strategy per receipt type instead of applying a one-size-
     fits-all pipeline.

  2. ReceiptRegionDetector
     A lightweight object-detection CNN (MobileNetV2 + SSD head) that
     predicts bounding boxes around key regions:
       • header  (merchant name / logo)
       • line_items table
       • totals block
       • footer  (address, phone, tax number)

     The detected regions are passed to OCR individually so that
     Tesseract can use tighter PSM modes per region (e.g. PSM 6 for
     single-block line-items vs PSM 3 for the full page).

Architecture notes:
  • Backbone: MobileNetV2 (pre-trained on ImageNet, fine-tuned on a
    synthetic receipt dataset generated with receipt-generator-py).
  • Input:  224 × 224 RGB, normalised to ImageNet mean/std.
  • Output (classifier): softmax over 4 classes.
  • Output (detector):   list of {"label": str, "bbox": [x1,y1,x2,y2], "score": float}

Requirements (NOT installed – add when upgrading server):
    pip install torch torchvision

Enable via env var:
    USE_CNN_MODEL=true   (requires ≥ 2 GB RAM or GPU)
"""

from __future__ import annotations

import numpy as np
from typing import Dict, List, Optional, Tuple

from core.logging_config import logger

# ── Label maps ────────────────────────────────────────────────────────────────
RECEIPT_TYPE_LABELS = ["thermal_printed", "handwritten", "invoice", "other"]
REGION_LABELS = ["header", "line_items", "totals", "footer"]

# ── ImageNet normalisation constants ─────────────────────────────────────────
_IMAGENET_MEAN = [0.485, 0.456, 0.406]
_IMAGENET_STD = [0.229, 0.224, 0.225]


# ==============================================================================
#  ReceiptTypeClassifier
# ==============================================================================
class ReceiptTypeClassifier:
    """
    Classify a receipt image into one of four types.

    Usage (future):
        classifier = ReceiptTypeClassifier.get_instance()
        if classifier.is_available:
            receipt_type = classifier.predict(image_np)  # → "thermal_printed"
    """

    # TODO: Replace with path to fine-tuned checkpoint when training is done.
    #       e.g. MODEL_PATH = "models/receipt_type_classifier_v1.pt"
    MODEL_PATH: Optional[str] = None

    _instance: Optional["ReceiptTypeClassifier"] = None

    def __init__(self) -> None:
        self._model = None
        self._loaded = False

    @classmethod
    def get_instance(cls) -> "ReceiptTypeClassifier":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ── Lazy load ──────────────────────────────────────────────────────────────
    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        try:
            import torch
            import torchvision.models as tv_models

            # TODO: Load fine-tuned weights from MODEL_PATH once available.
            #       For now we build the architecture only (no real weights).
            backbone = tv_models.mobilenet_v2(weights=None)
            # Replace classifier head for 4-class output
            import torch.nn as nn
            backbone.classifier[1] = nn.Linear(backbone.last_channel, len(RECEIPT_TYPE_LABELS))

            if self.MODEL_PATH:
                state = torch.load(self.MODEL_PATH, map_location="cpu")
                backbone.load_state_dict(state)
                logger.info(f"CNN ReceiptTypeClassifier loaded from {self.MODEL_PATH}")
            else:
                # No weights yet – model is architecture-only (random weights)
                logger.warning(
                    "CNN ReceiptTypeClassifier: no MODEL_PATH set. "
                    "Predictions will be random until fine-tuned weights are provided."
                )

            backbone.eval()
            self._model = backbone
            self._loaded = True

        except ImportError:
            logger.warning(
                "CNN ReceiptTypeClassifier unavailable – install torch + torchvision. "
                "Falling back to heuristic (assumes thermal_printed)."
            )
            self._loaded = False
        except Exception as exc:
            logger.error(f"CNN ReceiptTypeClassifier load failed: {exc}")
            self._loaded = False

    @property
    def is_available(self) -> bool:
        self._ensure_loaded()
        return self._loaded and self._model is not None

    # ── Preprocessing ─────────────────────────────────────────────────────────
    @staticmethod
    def _preprocess(image: np.ndarray) -> "torch.Tensor":  # type: ignore[name-defined]
        """Resize to 224×224, normalise to ImageNet stats, add batch dim."""
        import torch
        import cv2

        img = cv2.resize(image, (224, 224))
        if img.ndim == 2:                          # grayscale → RGB
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
        elif img.shape[2] == 4:                    # BGRA → RGB
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
        else:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        img = img.astype(np.float32) / 255.0
        mean = np.array(_IMAGENET_MEAN, dtype=np.float32)
        std = np.array(_IMAGENET_STD, dtype=np.float32)
        img = (img - mean) / std
        tensor = torch.from_numpy(img.transpose(2, 0, 1)).unsqueeze(0)  # CHW → NCHW
        return tensor

    # ── Public API ────────────────────────────────────────────────────────────
    def predict(self, image: np.ndarray) -> Dict:
        """
        Predict receipt type from an OpenCV BGR image.

        Returns:
            {
                "label":  "thermal_printed" | "handwritten" | "invoice" | "other",
                "score":  float,            # confidence 0–1
                "all_scores": {label: float, …},
            }

        Falls back to ``{"label": "thermal_printed", "score": 1.0, …}``
        when the model is unavailable.
        """
        if not self.is_available:
            return {
                "label": "thermal_printed",
                "score": 1.0,
                "all_scores": {l: (1.0 if l == "thermal_printed" else 0.0) for l in RECEIPT_TYPE_LABELS},
                "source": "fallback",
            }

        import torch
        import torch.nn.functional as F

        try:
            tensor = self._preprocess(image)
            with torch.no_grad():
                logits = self._model(tensor)           # (1, 4)
                probs = F.softmax(logits, dim=1)[0]    # (4,)

            idx = int(probs.argmax())
            return {
                "label": RECEIPT_TYPE_LABELS[idx],
                "score": round(float(probs[idx]), 4),
                "all_scores": {
                    lbl: round(float(probs[i]), 4)
                    for i, lbl in enumerate(RECEIPT_TYPE_LABELS)
                },
                "source": "cnn",
            }
        except Exception as exc:
            logger.warning(f"CNN ReceiptTypeClassifier.predict failed: {exc}")
            return {
                "label": "thermal_printed",
                "score": 1.0,
                "all_scores": {l: (1.0 if l == "thermal_printed" else 0.0) for l in RECEIPT_TYPE_LABELS},
                "source": "fallback",
            }


# ==============================================================================
#  ReceiptRegionDetector
# ==============================================================================
class ReceiptRegionDetector:
    """
    Detect and return bounding boxes for key receipt regions.

    Architecture: MobileNetV2 backbone + lightweight SSD detection head.
    Output regions: header, line_items, totals, footer.

    Usage (future):
        detector = ReceiptRegionDetector.get_instance()
        if detector.is_available:
            regions = detector.detect(image_np)
            # → [{"label": "line_items", "bbox": [x1,y1,x2,y2], "score": 0.91}, …]

    The bounding boxes are passed to OCRService to crop and OCR each
    region independently, improving accuracy on complex layouts.
    """

    # TODO: Provide path to fine-tuned SSD checkpoint.
    MODEL_PATH: Optional[str] = None

    _instance: Optional["ReceiptRegionDetector"] = None

    def __init__(self) -> None:
        self._model = None
        self._loaded = False

    @classmethod
    def get_instance(cls) -> "ReceiptRegionDetector":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        try:
            # TODO: Replace with torchvision.models.detection or a custom SSD head
            #       once training data and fine-tuned weights are available.
            #       Example skeleton shown here for architecture reference only.
            import torch
            import torchvision.models.detection as tv_det

            # SSD-Lite with MobileNetV2 backbone (torchvision built-in)
            # num_classes = len(REGION_LABELS) + 1  (+1 for background)
            # self._model = tv_det.ssdlite320_mobilenet_v3_large(
            #     num_classes=len(REGION_LABELS) + 1,
            #     weights=None,
            # )
            # if self.MODEL_PATH:
            #     state = torch.load(self.MODEL_PATH, map_location="cpu")
            #     self._model.load_state_dict(state)
            # self._model.eval()

            # For now keep model as None — detector is architecture-only.
            logger.warning(
                "CNN ReceiptRegionDetector: architecture stub only. "
                "Provide MODEL_PATH with fine-tuned SSD weights to enable."
            )
            self._loaded = True   # loaded (but model is None → is_available=False)

        except ImportError:
            logger.warning(
                "CNN ReceiptRegionDetector unavailable – install torch + torchvision."
            )
            self._loaded = False
        except Exception as exc:
            logger.error(f"CNN ReceiptRegionDetector load failed: {exc}")
            self._loaded = False

    @property
    def is_available(self) -> bool:
        self._ensure_loaded()
        return self._loaded and self._model is not None

    def detect(
        self,
        image: np.ndarray,
        score_threshold: float = 0.50,
    ) -> List[Dict]:
        """
        Return detected regions sorted by vertical position (top → bottom).

        Returns:
            [
                {"label": "header",     "bbox": [x1,y1,x2,y2], "score": float},
                {"label": "line_items", "bbox": [x1,y1,x2,y2], "score": float},
                …
            ]

        Falls back to a single full-image bounding box when unavailable.
        """
        h, w = image.shape[:2]
        fallback = [{"label": "line_items", "bbox": [0, 0, w, h], "score": 1.0, "source": "fallback"}]

        if not self.is_available:
            return fallback

        import torch

        try:
            # TODO: fill in inference once model weights are available.
            #
            # import torchvision.transforms.functional as TF
            # tensor = TF.to_tensor(cv2.cvtColor(image, cv2.COLOR_BGR2RGB)).unsqueeze(0)
            # with torch.no_grad():
            #     preds = self._model(tensor)[0]
            # regions = []
            # for box, label_idx, score in zip(preds["boxes"], preds["labels"], preds["scores"]):
            #     if score < score_threshold:
            #         continue
            #     regions.append({
            #         "label": REGION_LABELS[label_idx - 1],
            #         "bbox": [int(v) for v in box.tolist()],
            #         "score": round(float(score), 4),
            #         "source": "cnn",
            #     })
            # regions.sort(key=lambda r: r["bbox"][1])  # sort top→bottom
            # return regions or fallback
            raise NotImplementedError("Weights not yet provided – see MODEL_PATH.")

        except Exception as exc:
            logger.warning(f"CNN ReceiptRegionDetector.detect failed: {exc}")
            return fallback
