"""
Pydantic schemas for request/response validation
"""
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class LineItem(BaseModel):
    """Individual line item on receipt"""
    name: str = Field(..., description="Product/item name")
    quantity: int = Field(default=1, description="Quantity purchased")
    price: float = Field(..., description="Unit price")
    total: float = Field(..., description="Total for this line item")


class ExpenseItem(BaseModel):
    """Parsed expense item from Gemini AI"""
    title: str = Field(..., description="Item name")
    amount: float = Field(..., description="Unit price")
    quantity: int = Field(default=1, description="Quantity")
    category: str = Field(default="General", description="Expense category")


class ParseReceiptRequest(BaseModel):
    """Request to parse OCR text with Gemini AI"""
    ocr_text: str = Field(..., description="Raw OCR text from receipt")


class ParseReceiptResponse(BaseModel):
    """Response from Gemini AI parsing"""
    success: bool = Field(..., description="Parsing success status")
    items: List[ExpenseItem] = Field(default_factory=list, description="Parsed expense items")
    processing_time_ms: Optional[int] = Field(None, description="Processing time in milliseconds")


class ReceiptData(BaseModel):
    """Extracted receipt data"""
    merchant_name: Optional[str] = Field(None, description="Merchant/store name")
    receipt_date: Optional[str] = Field(None, description="Receipt date (YYYY-MM-DD)")
    total_amount: Optional[float] = Field(None, description="Total amount")
    tax_amount: Optional[float] = Field(None, description="Tax amount if available")
    line_items: List[LineItem] = Field(default_factory=list, description="Line items")
    raw_text: str = Field(..., description="Raw OCR text")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Extraction confidence")


class ReceiptResponse(BaseModel):
    """API response for receipt processing"""
    success: bool = Field(..., description="Processing success status")
    data: ReceiptData = Field(..., description="Extracted receipt data")
    processing_time_ms: int = Field(..., description="Processing time in milliseconds")


class ErrorResponse(BaseModel):
    """Error response"""
    success: bool = Field(default=False)
    error: str = Field(..., description="Error message")
    processing_time_ms: Optional[int] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="Service status")
    environment: str = Field(..., description="Environment (dev/prod)")
    ocr_engine: str = Field(..., description="Active OCR engine")
    nlp_enabled: bool = Field(..., description="NLP model enabled")
