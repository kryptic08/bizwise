"""
NLP Extraction Service – robust receipt field parser.

Handles the wide variety of receipt formats seen in the real world:
  • Thermal POS receipts (grocery, fast-food, gas stations)
  • Handwritten receipts / invoices
  • Restaurant bills (with tips, tax, sub-totals)
  • International formats (comma-decimal, varying date layouts)

Two extraction engines:
  1. RegexExtractor  – fast, zero-dependency heuristic (always available)
  2. BERTExtractor   – BERT-based NER for merchant / entity recognition
                       (lazy-loaded, disabled by default – enable with
                        USE_NLP_MODEL=true when server has ≥ 1 GB RAM)

The public ``NLPExtractor`` class picks the right engine based on config.
"""

import re
from datetime import datetime
from typing import Dict, List, Optional

from dateutil import parser as date_parser

from core.logging_config import logger

# ------------------------------------------------------------------ #
#  Amount helper – parse a money string into a float
# ------------------------------------------------------------------ #
_CURRENCY_RE = re.compile(
    r"[\$\£\€\¥\₱\₹\₩\₫]?"  # optional currency symbol
    r"\s*"
    r"(\d{1,7}(?:[,. ]\d{3})*"  # integer part  (with thousand separators)
    r"[.,]\d{1,2})"             # decimal part
)


def _parse_amount(raw: str) -> Optional[float]:
    """Parse a money string like ``$1,234.56`` or ``1.234,56`` → float."""
    raw = raw.strip()
    m = _CURRENCY_RE.search(raw)
    if not m:
        return None
    s = m.group(1).replace(" ", "")
    # Detect comma-decimal style (e.g. 1.234,56)
    if re.search(r"\d\.\d{3},\d{1,2}$", s):
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


# ------------------------------------------------------------------ #
#  Noise words – lines that are NOT line items
# ------------------------------------------------------------------ #
_NOISE = re.compile(
    r"(?:^|\b)("
    r"subtotal|sub total|sub-total|total|grand total"
    r"|tax|gst|vat|sales tax|hst|pst|tip|gratuity|service"
    r"|change|cash|visa|mastercard|amex|debit|credit|card"
    r"|thank|you|welcome|come again|refund|void"
    r"|date|time|receipt|invoice|order|transaction|terminal|register"
    r"|tel|phone|fax|email|www|http"
    r")(?:\b|$)",
    re.IGNORECASE,
)


# ================================================================== #
#  BERT NER Extractor (optional – future use)
# ================================================================== #
class BERTExtractor:
    """
    BERT-based Named Entity Recognition for receipt parsing.

    Uses ``dslim/bert-base-NER`` to identify ORG (merchant), DATE,
    and MONEY entities in OCR text.  Loaded lazily on first call so
    the model only consumes RAM when explicitly enabled.

    Requirements (NOT installed by default – add when upgrading server):
        pip install torch transformers sentencepiece

    Enable via env var:
        USE_NLP_MODEL=true   (requires ≥ 1 GB RAM)
    """

    _instance = None  # singleton so we only load once

    def __init__(self):
        self._pipeline = None
        self._loaded = False

    # ---- lazy singleton ---- #
    @classmethod
    def get_instance(cls) -> "BERTExtractor":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ---- load model on first use ---- #
    def _ensure_loaded(self):
        if self._loaded:
            return
        try:
            from transformers import pipeline as hf_pipeline

            self._pipeline = hf_pipeline(
                "ner",
                model="dslim/bert-base-NER",
                aggregation_strategy="simple",
            )
            self._loaded = True
            logger.info("BERT NER model loaded (dslim/bert-base-NER)")
        except ImportError:
            logger.warning(
                "BERT NER unavailable – install torch + transformers "
                "to enable. Falling back to regex."
            )
            self._loaded = False
        except Exception as e:
            logger.error(f"Failed to load BERT NER model: {e}")
            self._loaded = False

    @property
    def is_available(self) -> bool:
        self._ensure_loaded()
        return self._loaded and self._pipeline is not None

    # ---- extract entities ---- #
    def extract_entities(self, text: str) -> Dict[str, List[Dict]]:
        """
        Run NER on ``text`` and return grouped entities.

        Returns dict with keys ``ORG``, ``PER``, ``LOC``, ``MISC``
        each mapping to a list of ``{"word": str, "score": float}``.
        """
        if not self.is_available:
            return {}
        try:
            # BERT has a 512-token limit – use first ~1000 chars
            truncated = text[:1000]
            raw = self._pipeline(truncated)

            grouped: Dict[str, List[Dict]] = {}
            for ent in raw:
                group = ent.get("entity_group", "MISC")
                word = ent.get("word", "").strip()
                score = ent.get("score", 0.0)
                # Filter out sub-word fragments
                if word.startswith("##") or len(word) < 2:
                    continue
                if score < 0.60:
                    continue
                grouped.setdefault(group, []).append(
                    {"word": word, "score": round(score, 3)}
                )

            logger.info(
                f"BERT NER found: "
                + ", ".join(f"{k}={len(v)}" for k, v in grouped.items())
            )
            return grouped
        except Exception as e:
            logger.warning(f"BERT NER failed: {e}")
            return {}

    def extract_merchant_bert(self, text: str) -> Optional[str]:
        """Try to find the merchant name via ORG entities."""
        entities = self.extract_entities(text)
        orgs = entities.get("ORG", [])
        if not orgs:
            return None
        # Pick the longest high-confidence ORG
        best = max(orgs, key=lambda e: (e["score"], len(e["word"])))
        name = best["word"]
        if 3 <= len(name) <= 60:
            return name
        return None


# ================================================================== #
#  Regex Extractor (always available – primary on free tier)
# ================================================================== #


class NLPExtractor:
    """
    Extract structured data from OCR text.

    Uses regex heuristics by default.  When ``use_model=True``, also
    tries BERT NER for merchant-name extraction (requires torch +
    transformers installed).
    """

    def __init__(self, use_model: bool = False):
        self.use_model = use_model
        self._bert: Optional[BERTExtractor] = None
        if use_model:
            try:
                self._bert = BERTExtractor.get_instance()
                if self._bert.is_available:
                    logger.info("BERT NER enabled for extraction")
                else:
                    logger.info("BERT NER requested but not available – regex only")
                    self._bert = None
            except Exception as e:
                logger.warning(f"BERT init skipped: {e}")
                self._bert = None

    # ---------------------------------------------------------------- #
    #  Public API
    # ---------------------------------------------------------------- #
    def extract(self, text: str, ocr_confidence: float) -> Dict:
        result = {
            "merchant_name": self.extract_merchant(text),
            "receipt_date": self.extract_date(text),
            "total_amount": self.extract_total(text),
            "tax_amount": self.extract_tax(text),
            "line_items": self.extract_line_items(text),
        }
        result["confidence_score"] = self._calculate_confidence(
            result, ocr_confidence
        )
        return result

    # ---------------------------------------------------------------- #
    #  Merchant name
    # ---------------------------------------------------------------- #
    def extract_merchant(self, text: str) -> Optional[str]:
        lines = [l.strip() for l in text.split("\n") if l.strip()]

        merchant_kw = {
            "store", "market", "shop", "mart", "center", "supercenter",
            "restaurant", "cafe", "deli", "pharmacy", "gas", "station",
            "supermarket", "bakery", "grill", "pizza", "chicken",
            "dollar", "family", "foods", "fresh", "wholesale",
            "depot", "outlet", "express", "stop", "corner",
            "inc", "llc", "ltd", "corp", "co",
        }

        # Strategy 1 – keyword match in first 6 lines (most reliable)
        for line in lines[:6]:
            low = line.lower()
            # Strip trailing price if present
            clean = re.sub(r"\s+[\$\£\€]?\s*\d+[.,]\d{2}\s*$", "", line).strip()
            if any(kw in low for kw in merchant_kw) and len(clean) > 2:
                return self._clean_merchant(clean)

        # Strategy 2 – first prominent line that is mostly letters
        for line in lines[:6]:
            if len(line) < 3:
                continue
            # Strip trailing price
            clean = re.sub(r"\s+[\$\£\€]?\s*\d+[.,]\d{2}\s*$", "", line).strip()
            if len(clean) < 3:
                continue
            alpha_ratio = sum(c.isalpha() or c == " " for c in clean) / len(clean)
            if alpha_ratio > 0.70 and not _NOISE.search(clean):
                return self._clean_merchant(clean)

        # Last resort – first non-trivial line
        for line in lines[:3]:
            if len(line) > 3:
                return self._clean_merchant(line)

        # BERT NER fallback (only when enabled & available)
        if self._bert is not None:
            bert_merchant = self._bert.extract_merchant_bert(text)
            if bert_merchant:
                logger.info(f"BERT NER found merchant: {bert_merchant}")
                return bert_merchant

        return None

    @staticmethod
    def _clean_merchant(raw: str) -> str:
        """Remove trailing noise like address fragments / phone numbers."""
        # Drop trailing phone-number-looking stuff
        raw = re.sub(r"\s*[\(\d][\d\-\(\) ]{6,}$", "", raw)
        return raw.strip()

    # ---------------------------------------------------------------- #
    #  Date
    # ---------------------------------------------------------------- #
    def extract_date(self, text: str) -> Optional[str]:
        # OCR frequently confuses characters – normalise first
        normalised = text
        for old, new in [("O", "0"), ("l", "1"), ("I", "1"), ("S", "5")]:
            # Only replace inside digit-heavy contexts
            normalised = re.sub(
                rf"(?<=\d){re.escape(old)}(?=\d)", new, normalised
            )

        date_patterns = [
            # ISO
            r"\d{4}[-/]\d{1,2}[-/]\d{1,2}",
            # Slash / dash – US / EU
            r"\d{1,2}[-/]\d{1,2}[-/]\d{2,4}",
            # Dot-separated  01.02.2024
            r"\d{1,2}\.\d{1,2}\.\d{2,4}",
            # Month name
            r"\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{2,4}",
            r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s+\d{2,4}",
            # Long month name
            r"(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{2,4}",
        ]

        for pattern in date_patterns:
            matches = re.findall(pattern, normalised, re.IGNORECASE)
            for match in matches:
                try:
                    parsed = date_parser.parse(match, fuzzy=True, dayfirst=False)
                    # Sanity: reject dates far in the future
                    if parsed.year > datetime.now().year + 1:
                        continue
                    return parsed.strftime("%Y-%m-%d")
                except Exception:
                    continue

        return None

    # ---------------------------------------------------------------- #
    #  Total amount
    # ---------------------------------------------------------------- #
    def extract_total(self, text: str) -> Optional[float]:
        # Labels commonly found near the final total
        total_labels = [
            r"grand\s*total",
            r"total\s*due",
            r"amount\s*due",
            r"balance\s*due",
            r"net\s*total",
            r"amt\s*due",
            r"total\s*amount",
            r"total\s*sale",
            r"total",
            r"amount",
            r"due",
        ]

        for label in total_labels:
            pattern = (
                label
                + r"[:\s]*"
                + r"[\$\£\€\¥\₱\₹]?\s*"
                + r"(\d{1,7}(?:[,. ]\d{3})*[.,]\d{1,2})"
            )
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                val = _parse_amount(matches[-1])
                if val is not None and val > 0:
                    return round(val, 2)

        # Fallback – largest monetary value in the receipt
        all_amounts = _CURRENCY_RE.findall(text)
        if all_amounts:
            parsed = [_parse_amount(a) for a in all_amounts]
            values = [v for v in parsed if v is not None and v > 0]
            if values:
                return round(max(values), 2)

        return None

    # ---------------------------------------------------------------- #
    #  Tax amount
    # ---------------------------------------------------------------- #
    def extract_tax(self, text: str) -> Optional[float]:
        tax_labels = [
            r"sales\s*tax",
            r"state\s*tax",
            r"county\s*tax",
            r"local\s*tax",
            r"tax\s*amount",
            r"tax",
            r"gst",
            r"hst",
            r"pst",
            r"vat",
        ]

        for label in tax_labels:
            pattern = (
                label
                + r"[:\s]*"
                + r"[\$\£\€\¥\₱\₹]?\s*"
                + r"(\d{1,7}(?:[,. ]\d{3})*[.,]\d{1,2})"
            )
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                val = _parse_amount(matches[-1])
                if val is not None and val > 0:
                    return round(val, 2)

        return None

    # ---------------------------------------------------------------- #
    #  Line items
    # ---------------------------------------------------------------- #
    def extract_line_items(self, text: str) -> List[Dict]:
        """
        Parse individual purchased items from the receipt body.

        Handles many POS formats:
          ``2 x ITEM NAME          4.98``
          ``ITEM NAME    QTY 2  $4.98``
          ``ITEM NAME             4.98``
          ``ITEM NAME  2@2.49    4.98``
        """
        items: List[Dict] = []
        lines = text.split("\n")

        # ---- Pattern bank (order = specificity) ---- #
        patterns = [
            # "2 x Milk  $4.98"  or  "2x Milk  4.98"
            re.compile(
                r"(\d+)\s*[xX×]\s+"
                r"(.+?)\s+"
                r"[\$\£\€]?\s*(\d+[.,]\d{2})\s*$"
            ),
            # "Milk  2 @ 2.49  4.98"
            re.compile(
                r"(.+?)\s+"
                r"(\d+)\s*@\s*[\$\£\€]?\s*\d+[.,]\d{2}\s+"
                r"[\$\£\€]?\s*(\d+[.,]\d{2})\s*$"
            ),
            # "Milk   2   $4.98"  (name qty price – wide gaps)
            re.compile(
                r"([A-Za-z][\w\s/&\'-]{1,40}?)\s{2,}"
                r"(\d{1,4})\s+"
                r"[\$\£\€]?\s*(\d+[.,]\d{2})\s*$"
            ),
            # "Milk 2pct             $3.49" (name + price, wide gap, qty=1)
            re.compile(
                r"([A-Za-z][\w\s/&\'-]{1,40}?)\s{2,}"
                r"[\$\£\€]?\s*(\d+[.,]\d{2})\s*$"
            ),
            # "Milk 2pct 3.49" (single-space sep, qty=1) – last resort
            re.compile(
                r"([A-Za-z][\w\s/&\'-]{2,40}?)\s+"
                r"[\$\£\€]?\s*(\d+[.,]\d{2})\s*$"
            ),
        ]

        for line in lines:
            line = line.strip()
            if not line or len(line) < 4:
                continue

            # Skip noise lines
            if _NOISE.search(line):
                continue

            for pidx, pat in enumerate(patterns):
                m = pat.match(line)
                if not m:
                    continue

                groups = m.groups()
                try:
                    if pidx == 0:
                        # qty x name  total
                        qty = int(groups[0])
                        name = groups[1].strip()
                        total_price = _parse_amount(groups[2])
                        unit_price = round(total_price / qty, 2) if qty else total_price
                    elif pidx == 1:
                        # name  qty@unit  total
                        name = groups[0].strip()
                        qty = int(groups[1])
                        total_price = _parse_amount(groups[2])
                        unit_price = round(total_price / qty, 2) if qty else total_price
                    elif pidx == 2:
                        # name  qty  price
                        name = groups[0].strip()
                        qty = int(groups[1])
                        unit_price = _parse_amount(groups[2])
                        total_price = round(unit_price * qty, 2)
                    else:
                        # name  price  (qty=1)
                        name = groups[0].strip()
                        qty = 1
                        total_price = _parse_amount(groups[1])
                        unit_price = total_price

                    if total_price is None or total_price <= 0:
                        break  # try next line

                    items.append(
                        {
                            "name": name[:60],
                            "quantity": qty,
                            "price": unit_price,
                            "total": round(total_price, 2),
                        }
                    )
                except Exception:
                    pass
                break  # matched – don't try remaining patterns

        return items

    # ---------------------------------------------------------------- #
    #  Confidence score
    # ---------------------------------------------------------------- #
    @staticmethod
    def _calculate_confidence(result: Dict, ocr_confidence: float) -> float:
        score = ocr_confidence * 0.5

        weights = {
            "merchant_name": 0.10,
            "receipt_date": 0.15,
            "total_amount": 0.20,
            "tax_amount": 0.05,
        }

        for field, weight in weights.items():
            if result.get(field) is not None:
                score += weight

        if result.get("line_items"):
            score = min(1.0, score + 0.10)

        return round(min(score, 1.0), 2)


# ================================================================== #
#  BERT Category Classifier (FUTURE USE / PLACEHOLDER)
# ================================================================== #
class BERTCategoryClassifier:
    """
    Classify each extracted line-item into an expense category using a
    fine-tuned BERT sequence-classification model.

    Motivation
    ----------
    The current pipeline assigns categories heuristically (keyword
    matching in RegexExtractor).  A fine-tuned BERT model trained on
    labelled receipt line-items would give significantly higher accuracy,
    especially for ambiguous items ("chicken" → Food vs. Agriculture).

    Planned categories (matches app expense categories):
        Food & Beverages | Supplies | Utilities | Transport |
        Equipment | Services | Rent | Salaries | Marketing |
        Miscellaneous

    Architecture
    ------------
    Base model : ``bert-base-uncased`` (or a smaller
                 ``distilbert-base-uncased`` for lower RAM usage).
    Fine-tuning: Multi-class classification head on top of [CLS] token.
    Training data: Labelled receipt line-item text from the app's own
                   transaction history (see data collection TODO below).

    Requirements (NOT installed – add when upgrading server):
        pip install torch transformers

    Enable via env var:
        USE_NLP_MODEL=true   (same flag as BERTExtractor, requires ≥ 1 GB RAM)

    TODO list before enabling:
        1. Collect & label ~2 000 line-item strings from real receipts.
        2. Fine-tune distilbert-base-uncased for ~3 epochs.
        3. Save checkpoint to ``models/category_classifier_v1/``.
        4. Set MODEL_PATH = "models/category_classifier_v1".
        5. Set USE_NLP_MODEL=true in .env.
    """

    # TODO: Set to fine-tuned checkpoint directory once training is done.
    MODEL_PATH: Optional[str] = None

    CATEGORIES: List[str] = [
        "Food & Beverages",
        "Supplies",
        "Utilities",
        "Transport",
        "Equipment",
        "Services",
        "Rent",
        "Salaries",
        "Marketing",
        "Miscellaneous",
    ]

    _instance: Optional["BERTCategoryClassifier"] = None

    def __init__(self) -> None:
        self._pipeline = None
        self._loaded = False

    @classmethod
    def get_instance(cls) -> "BERTCategoryClassifier":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ---- lazy load ---- #
    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        try:
            from transformers import pipeline as hf_pipeline

            if not self.MODEL_PATH:
                logger.warning(
                    "BERTCategoryClassifier: no MODEL_PATH set. "
                    "Provide a fine-tuned checkpoint path to enable. "
                    "Falling back to keyword-based categorisation."
                )
                self._loaded = False
                return

            self._pipeline = hf_pipeline(
                "text-classification",
                model=self.MODEL_PATH,
                # Map label IDs back to human-readable category names.
                # The fine-tuned model should output LABEL_0…LABEL_N;
                # id2label in its config should be set during training.
            )
            self._loaded = True
            logger.info(f"BERTCategoryClassifier loaded from {self.MODEL_PATH}")

        except ImportError:
            logger.warning(
                "BERTCategoryClassifier unavailable – install torch + transformers."
            )
            self._loaded = False
        except Exception as exc:
            logger.error(f"BERTCategoryClassifier load failed: {exc}")
            self._loaded = False

    @property
    def is_available(self) -> bool:
        self._ensure_loaded()
        return self._loaded and self._pipeline is not None

    def classify(self, line_item_text: str) -> Dict:
        """
        Classify a single line-item description into an expense category.

        Args:
            line_item_text: Raw text of the line item, e.g. ``"2x Bottled Water 1L"``.

        Returns:
            {
                "category": str,   # e.g. "Food & Beverages"
                "score":    float, # confidence 0–1
                "source":   str,   # "bert" | "fallback"
            }
        """
        if not self.is_available:
            return {
                "category": "Miscellaneous",
                "score": 1.0,
                "source": "fallback",
            }

        try:
            result = self._pipeline(line_item_text[:128])[0]  # BERT token limit
            label = result.get("label", "Miscellaneous")
            # Normalise label: fine-tuned model may output "LABEL_0" → look up
            if label.startswith("LABEL_"):
                idx = int(label.split("_")[1])
                label = self.CATEGORIES[idx] if idx < len(self.CATEGORIES) else "Miscellaneous"
            return {
                "category": label,
                "score": round(float(result.get("score", 0.0)), 4),
                "source": "bert",
            }
        except Exception as exc:
            logger.warning(f"BERTCategoryClassifier.classify failed: {exc}")
            return {
                "category": "Miscellaneous",
                "score": 1.0,
                "source": "fallback",
            }

    def classify_batch(self, line_items: List[str]) -> List[Dict]:
        """
        Classify a list of line-item descriptions in one forward pass.

        More efficient than calling ``classify`` in a loop when the
        model is available, since HuggingFace pipelines batch
        automatically.
        """
        if not self.is_available or not line_items:
            return [self.classify(item) for item in line_items]

        try:
            truncated = [t[:128] for t in line_items]
            results = self._pipeline(truncated)
            output = []
            for res in results:
                label = res.get("label", "Miscellaneous")
                if label.startswith("LABEL_"):
                    idx = int(label.split("_")[1])
                    label = self.CATEGORIES[idx] if idx < len(self.CATEGORIES) else "Miscellaneous"
                output.append({
                    "category": label,
                    "score": round(float(res.get("score", 0.0)), 4),
                    "source": "bert",
                })
            return output
        except Exception as exc:
            logger.warning(f"BERTCategoryClassifier.classify_batch failed: {exc}")
            return [self.classify(item) for item in line_items]
