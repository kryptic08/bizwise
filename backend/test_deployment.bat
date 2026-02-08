@echo off
REM Test script for deployed API
REM Replace YOUR_API_URL with your actual Render.com URL

SET API_URL=https://bizwise-receipt-api.onrender.com
SET API_KEY=bizwise-secret-2026-change-this

echo Testing health endpoint...
curl %API_URL%/health

echo.
echo.
echo Testing receipt processing...
echo Note: Replace 'receipt.jpg' with an actual receipt image path
REM curl -X POST "%API_URL%/api/v1/receipt/process" ^
REM   -H "X-API-Key: %API_KEY%" ^
REM   -F "file=@receipt.jpg"

echo.
echo Update API_URL and API_KEY in this file with your actual values
pause
