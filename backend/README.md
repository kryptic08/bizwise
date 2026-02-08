# BizWise Receipt Processing API

FastAPI microservice for processing receipt images using OCR and NLP extraction.

## 🚀 Features

- **Free & Open Source**: 100% free OCR using Tesseract or EasyOCR
- **Smart Extraction**: Regex-based + optional BERT NLP model
- **Fast Processing**: Optimized for CPU, <2s per receipt
- **Production Ready**: Docker support, health checks, logging
- **Easy Integration**: Simple REST API with OpenAPI docs

## 📋 Extracted Data

- Merchant name
- Receipt date
- Total amount
- Tax amount
- Line items (product, quantity, price)
- Raw OCR text
- Confidence score

## 🛠️ Local Development

### Prerequisites

- Python 3.11+
- Tesseract OCR (optional but recommended)

#### Install Tesseract:

**Windows:**

```bash
# Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
# Or use chocolatey:
choco install tesseract
```

**Mac:**

```bash
brew install tesseract
```

**Linux:**

```bash
sudo apt-get install tesseract-ocr
```

### Setup

1. **Navigate to backend directory:**

```bash
cd backend
```

2. **Create virtual environment:**

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

3. **Install dependencies:**

```bash
pip install -r requirements.txt
```

4. **Configure environment:**

```bash
# Copy example env file
copy .env.example .env

# Edit .env and set your API_KEY
```

5. **Run the server:**

```bash
python app.py
```

Server will start at: `http://localhost:8000`

API docs at: `http://localhost:8000/docs`

### Testing

```bash
# Test with an image
python test_api.py path/to/receipt.jpg

# Test health endpoint only
python test_api.py
```

## 🐳 Docker Deployment

### Build and run locally:

```bash
cd backend

# Build image
docker build -t bizwise-receipt-api .

# Run container
docker run -p 8000:8000 -e API_KEY=your-secret-key bizwise-receipt-api
```

## 🌐 Deploy to Render.com (FREE)

1. **Create account** at [render.com](https://render.com) (no credit card required)

2. **Create new Web Service:**
   - Connect your GitHub repository
   - Select the `backend` directory
   - Configure:
     - **Name**: `bizwise-receipt-api`
     - **Environment**: `Docker`
     - **Instance Type**: `Free`
     - **Branch**: `main`

3. **Environment Variables:**

   ```
   API_KEY=your-secret-key-here
   ENVIRONMENT=production
   OCR_ENGINE=tesseract
   USE_NLP_MODEL=true
   ```

4. **Deploy** and get your URL: `https://bizwise-receipt-api.onrender.com`

⚠️ **Note**: Free tier sleeps after 15 min inactivity. First request will take 30-60s to wake up.

## 📱 API Usage

### Endpoint

```
POST /api/v1/receipt/process
```

### Request

```bash
curl -X POST "http://localhost:8000/api/v1/receipt/process" \
  -H "X-API-Key: your-secret-api-key-here" \
  -F "file=@receipt.jpg"
```

### Response

```json
{
  "success": true,
  "data": {
    "merchant_name": "Walmart Supercenter",
    "receipt_date": "2026-02-08",
    "total_amount": 125.47,
    "tax_amount": 10.21,
    "line_items": [
      {
        "name": "Organic Milk",
        "quantity": 2,
        "price": 4.99,
        "total": 9.98
      }
    ],
    "raw_text": "WALMART SUPERCENTER...",
    "confidence_score": 0.89
  },
  "processing_time_ms": 650
}
```

## 🔒 Security

- API Key authentication via `X-API-Key` header
- CORS configured (update origins for production)
- No sensitive data logged
- Image data not persisted

## ⚙️ Configuration

Edit `.env` file:

```bash
# API Security
API_KEY=your-secret-api-key-here

# OCR Engine (tesseract or easyocr)
OCR_ENGINE=tesseract

# Enable BERT NLP model (slower but more accurate)
USE_NLP_MODEL=true

# Minimum confidence threshold
CONFIDENCE_THRESHOLD=0.7
```

## 📊 Performance

- **Latency**: 500ms - 2s (depending on image size)
- **Accuracy**: 75-85% for structured fields
- **Memory**: ~500MB without BERT, ~1GB with BERT
- **CPU**: Optimized for single-core
- **Cost**: $0 (self-hosted)

## 🔧 Troubleshooting

### "Tesseract not found"

Install Tesseract OCR or switch to EasyOCR in `.env`:

```
OCR_ENGINE=easyocr
```

### "Out of memory"

Disable BERT model in `.env`:

```
USE_NLP_MODEL=false
```

### Slow processing

- Use Tesseract instead of EasyOCR
- Disable BERT model
- Reduce image size before upload

## 📄 License

MIT License - Feel free to use in your projects!

## 🤝 Contributing

Pull requests welcome! Please ensure code passes linting and tests.

---

Built with ❤️ for BizWise Expense Manager
