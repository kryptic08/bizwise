"""
NLP extraction service using regex and optional BERT model
"""
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dateutil import parser as date_parser

from core.logging_config import logger


class NLPExtractor:
    """Extract structured data from OCR text"""
    
    def __init__(self, use_model: bool = False):
        """
        Initialize extractor
        
        Args:
            use_model: Whether to use BERT model (slower but more accurate)
        """
        self.use_model = use_model
        self.model = None
        
        if use_model:
            self._init_model()
    
    def _init_model(self):
        """Initialize BERT model for NER (lazy loading)"""
        try:
            from transformers import pipeline
            # Use lightweight distilbert for NER
            self.model = pipeline(
                "ner",
                model="dslim/bert-base-NER",
                aggregation_strategy="simple"
            )
            logger.info("BERT NER model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load BERT model, using regex only: {e}")
            self.use_model = False
    
    def extract(self, text: str, ocr_confidence: float) -> Dict:
        """
        Extract structured fields from OCR text
        
        Returns:
            Dict with merchant_name, receipt_date, total_amount, tax_amount, line_items
        """
        result = {
            "merchant_name": self.extract_merchant(text),
            "receipt_date": self.extract_date(text),
            "total_amount": self.extract_total(text),
            "tax_amount": self.extract_tax(text),
            "line_items": self.extract_line_items(text),
        }
        
        # Calculate confidence score
        result["confidence_score"] = self._calculate_confidence(result, ocr_confidence)
        
        return result
    
    def extract_merchant(self, text: str) -> Optional[str]:
        """Extract merchant name (usually first line or largest text)"""
        lines = text.split('\n') if '\n' in text else text.split('  ')
        
        # Common merchant indicators
        merchant_keywords = [
            'store', 'market', 'shop', 'mart', 'center', 'supercenter',
            'restaurant', 'cafe', 'deli', 'pharmacy'
        ]
        
        # Try to find merchant in first few lines
        for line in lines[:5]:
            line_clean = line.strip()
            if len(line_clean) > 3:
                # Check if line contains merchant keywords
                if any(kw in line_clean.lower() for kw in merchant_keywords):
                    return line_clean
                
                # Or if it's a capitalized line without numbers
                if line_clean[0].isupper() and not re.search(r'\d', line_clean):
                    return line_clean
        
        # Fallback: return first non-empty line
        for line in lines[:3]:
            if len(line.strip()) > 3:
                return line.strip()
        
        return None
    
    def extract_date(self, text: str) -> Optional[str]:
        """Extract receipt date in YYYY-MM-DD format"""
        # Common date patterns
        date_patterns = [
            r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',  # MM/DD/YYYY or DD/MM/YYYY
            r'\d{4}[-/]\d{1,2}[-/]\d{1,2}',     # YYYY/MM/DD
            r'\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}',  # DD Mon YYYY
            r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}',  # Mon DD, YYYY
        ]
        
        for pattern in date_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                # Try to parse the first match
                try:
                    parsed_date = date_parser.parse(matches[0], fuzzy=True)
                    return parsed_date.strftime('%Y-%m-%d')
                except:
                    continue
        
        return None
    
    def extract_total(self, text: str) -> Optional[float]:
        """Extract total amount"""
        # Look for "total" keyword followed by amount
        total_patterns = [
            r'total[:\s]*\$?\s*(\d+[.,]\d{2})',
            r'amount[:\s]*\$?\s*(\d+[.,]\d{2})',
            r'grand\s*total[:\s]*\$?\s*(\d+[.,]\d{2})',
            r'balance[:\s]*\$?\s*(\d+[.,]\d{2})',
        ]
        
        for pattern in total_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                try:
                    # Get the last (likely highest) amount
                    amount = matches[-1].replace(',', '.')
                    return float(amount)
                except:
                    continue
        
        # Fallback: find largest dollar amount
        all_amounts = re.findall(r'\$?\s*(\d+[.,]\d{2})', text)
        if all_amounts:
            try:
                amounts = [float(a.replace(',', '.')) for a in all_amounts]
                return max(amounts)
            except:
                pass
        
        return None
    
    def extract_tax(self, text: str) -> Optional[float]:
        """Extract tax amount"""
        tax_patterns = [
            r'tax[:\s]*\$?\s*(\d+[.,]\d{2})',
            r'gst[:\s]*\$?\s*(\d+[.,]\d{2})',
            r'vat[:\s]*\$?\s*(\d+[.,]\d{2})',
            r'sales\s*tax[:\s]*\$?\s*(\d+[.,]\d{2})',
        ]
        
        for pattern in tax_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                try:
                    amount = matches[-1].replace(',', '.')
                    return float(amount)
                except:
                    continue
        
        return None
    
    def extract_line_items(self, text: str) -> List[Dict]:
        """
        Extract line items (product name, quantity, price)
        This is simplified - real implementation would be more complex
        """
        line_items = []
        
        # Pattern: item name followed by quantity and price
        # Example: "Milk 2 $4.99"
        item_pattern = r'([A-Za-z\s]{3,30})\s+(\d+)\s+\$?\s*(\d+[.,]\d{2})'
        
        matches = re.findall(item_pattern, text)
        
        for match in matches:
            try:
                name = match[0].strip()
                quantity = int(match[1])
                price = float(match[2].replace(',', '.'))
                total = quantity * price
                
                line_items.append({
                    "name": name,
                    "quantity": quantity,
                    "price": price,
                    "total": round(total, 2)
                })
            except:
                continue
        
        return line_items
    
    def _calculate_confidence(self, result: Dict, ocr_confidence: float) -> float:
        """
        Calculate overall extraction confidence
        
        Based on:
        - OCR confidence
        - Number of fields extracted
        - Quality of extracted data
        """
        score = ocr_confidence * 0.5  # OCR confidence is 50% of total
        
        # Add points for each extracted field
        field_weights = {
            "merchant_name": 0.1,
            "receipt_date": 0.15,
            "total_amount": 0.2,
            "tax_amount": 0.05,
        }
        
        for field, weight in field_weights.items():
            if result.get(field) is not None:
                score += weight
        
        # Bonus for line items
        if result.get("line_items"):
            score = min(1.0, score + 0.1)
        
        return round(score, 2)
