"""
NLP Extraction Service – robust receipt field parser.

Handles the wide variety of receipt formats seen in the real world:
  • Thermal POS receipts (grocery, fast-food, gas stations)
  • Handwritten receipts / invoices
  • Restaurant bills (with tips, tax, sub-totals)
  • International formats (comma-decimal, varying date layouts)

Uses layered regex + heuristic scoring, with an optional BERT NER
fallback for merchant-name extraction.
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


class NLPExtractor:
    """Extract structured data from OCR text."""

    def __init__(self, use_model: bool = False):
        self.use_model = use_model
        self.model = None
        if use_model:
            self._init_model()

    # ---------------------------------------------------------------- #
    #  Optional BERT NER
    # ---------------------------------------------------------------- #
    def _init_model(self):
        try:
            from transformers import pipeline

            self.model = pipeline(
                "ner",
                model="dslim/bert-base-NER",
                aggregation_strategy="simple",
            )
            logger.info("BERT NER model loaded")
        except Exception as e:
            logger.warning(f"BERT not available, regex only: {e}")
            self.use_model = False

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

        # Strategy 3 – BERT NER (ORG entity) as fallback
        if self.use_model and self.model:
            try:
                header = " | ".join(lines[:4])  # use separator to prevent merging
                ents = self.model(header)
                orgs = [
                    e["word"].strip()
                    for e in ents
                    if e["entity_group"] == "ORG"
                    and e["score"] > 0.7
                    and len(e["word"].strip()) > 2
                    and not e["word"].startswith("##")
                ]
                if orgs:
                    best = max(orgs, key=len)
                    if 3 <= len(best) <= 60:
                        return best
            except Exception:
                pass

        # Last resort – first non-trivial line
        for line in lines[:3]:
            if len(line) > 3:
                return self._clean_merchant(line)

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
