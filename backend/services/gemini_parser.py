"""
Gemini AI Receipt Parser Service
Handles LLM-based parsing of OCR text into structured receipt items
"""
import json
import re
from typing import List, Dict, Any, Optional
import aiohttp
from core.config import settings
from core.logging_config import logger


class GeminiParser:
    """Parse receipt text using Google Gemini AI"""
    
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL
        self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        
        if not self.api_key:
            logger.warning("GEMINI_API_KEY not set - Gemini parsing will fail")
    
    async def parse_receipt_text(self, ocr_text: str) -> List[Dict[str, Any]]:
        """
        Parse OCR text into structured receipt items using Gemini AI
        
        Args:
            ocr_text: Raw OCR text from receipt
            
        Returns:
            List of expense items with title, amount, quantity, category
        """
        if not self.api_key:
            raise ValueError("Gemini API key not configured")
        
        if not ocr_text or len(ocr_text.strip()) < 5:
            logger.warning("OCR text too short for parsing")
            return []
        
        try:
            prompt = self._build_prompt(ocr_text)
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_url}?key={self.api_key}",
                    json={
                        "contents": [
                            {
                                "parts": [{"text": prompt}]
                            }
                        ],
                        "generationConfig": {
                            "temperature": 0.1,
                            "maxOutputTokens": 2048,
                        }
                    },
                    headers={"Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"Gemini API error {response.status}: {error_text}")
                        raise Exception(f"Gemini API error: {response.status}")
                    
                    result = await response.json()
                    logger.debug(f"Gemini API response: {json.dumps(result, indent=2)}")
                    
                    # Extract AI response
                    ai_response = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    
                    if not ai_response:
                        logger.warning("No response from Gemini AI")
                        return []
                    
                    # Parse JSON from response
                    items = self._extract_json(ai_response)
                    logger.info(f"Gemini parsed {len(items)} items from receipt")
                    
                    return items
        
        except Exception as e:
            logger.error(f"Error parsing receipt with Gemini: {str(e)}")
            raise
    
    def _build_prompt(self, ocr_text: str) -> str:
        """Build the prompt for Gemini AI"""
        return f"""You are an expert at parsing receipt text from the Philippines. Analyze the following receipt text and extract all purchased items.

For each item found, provide:
1. title: The name of the item (clean it up, capitalize properly)
2. amount: The unit price (number only, no currency symbol)
3. quantity: How many were purchased (default to 1 if not specified)
4. category: One of these categories: Food, Office, Transportation, Utilities, Maintenance, Marketing, Medical, Equipment, General

IMPORTANT RULES FOR PHILIPPINE RECEIPTS:
- Many receipts are HANDWRITTEN and may not have PHP/₱ symbols
- Amounts like "2345" or "1500" are Philippine pesos (don't divide by 100, use as-is)
- Common price patterns: "2345" = ₱2,345.00, "150" = ₱150.00, "15.50" = ₱15.50
- If amount has no decimal point and is 2+ digits, treat it as whole pesos
- Only extract actual purchased items, NOT totals, subtotals, change, tax, VAT, discounts
- Skip store names, addresses, dates, times, receipt numbers, cashier names
- If you see "x2" or "x 3" or "qty: 2", that's the quantity
- The amount should be the UNIT price, not the line total
- For handwritten receipts, be lenient with OCR errors ("S" might be "5", "O" might be "0")
- If unsure about category, use "General"
- Return ONLY valid JSON array, no other text

Receipt text:
\"\"\"
{ocr_text}
\"\"\"

Return a JSON array like this (no markdown, just raw JSON):
[{{"title": "Sisig", "amount": 150, "quantity": 1, "category": "Food"}}, {{"title": "Rice", "amount": 25, "quantity": 2, "category": "Food"}}]

If no items found, return: []"""
    
    def _extract_json(self, ai_response: str) -> List[Dict[str, Any]]:
        """Extract and parse JSON array from AI response"""
        try:
            # Clean up response - remove markdown code blocks
            cleaned = ai_response.replace("```json\n", "").replace("```\n", "").replace("```", "").strip()
            
            # Find JSON array
            json_match = re.search(r'\[[\s\S]*\]', cleaned)
            if not json_match:
                logger.warning("Could not find JSON array in AI response")
                return []
            
            items = json.loads(json_match.group(0))
            
            if not isinstance(items, list):
                logger.warning("AI response is not a JSON array")
                return []
            
            # Validate and normalize items
            validated_items = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                
                validated_item = {
                    "title": str(item.get("title", "Unknown Item")),
                    "amount": float(item.get("amount", 0)),
                    "quantity": int(item.get("quantity", 1)),
                    "category": str(item.get("category", "General"))
                }
                
                validated_items.append(validated_item)
            
            return validated_items
        
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from AI response: {e}")
            logger.debug(f"AI response was: {ai_response}")
            return []
        except Exception as e:
            logger.error(f"Error extracting JSON: {e}")
            return []


# Singleton instance
_gemini_parser: Optional[GeminiParser] = None


def get_gemini_parser() -> GeminiParser:
    """Get or create Gemini parser instance"""
    global _gemini_parser
    if _gemini_parser is None:
        _gemini_parser = GeminiParser()
    return _gemini_parser
