# BizWise Receipt Processing Architecture

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REACT NATIVE APP                         │
│                      (BizWise)                              │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐   ┌──────────────┐  │
│  │   Camera     │───▶│  Image       │──▶│  Upload      │  │
│  │   Capture    │    │  Compression │   │  Handler     │  │
│  └──────────────┘    └──────────────┘   └──────┬───────┘  │
│                                                  │          │
└──────────────────────────────────────────────────┼──────────┘
                                                   │
                                         HTTPS POST (multipart)
                                         X-API-Key: xxxxx
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────┐
│              FASTAPI BACKEND (Self-Hosted)                  │
│              Deployed on Render.com (FREE)                  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              API Layer (app.py)                      │  │
│  │  - Authentication (API Key)                          │  │
│  │  - CORS Middleware                                   │  │
│  │  - Request Validation                                │  │
│  │  - Error Handling                                    │  │
│  └─────────────────────┬────────────────────────────────┘  │
│                        │                                    │
│                        ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        Receipt Processor (orchestrator)              │  │
│  └─────────────────────┬────────────────────────────────┘  │
│                        │                                    │
│            ┌───────────┼───────────┐                       │
│            ▼           ▼           ▼                       │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐          │
│  │ Preprocessing│ │   OCR    │ │     NLP      │          │
│  │   Service    │ │ Service  │ │  Extraction  │          │
│  │              │ │          │ │   Service    │          │
│  │ - Denoise    │ │Tesseract │ │ - Regex      │          │
│  │ - Grayscale  │ │    or    │ │ - BERT (opt) │          │
│  │ - Threshold  │ │ EasyOCR  │ │ - DateParser │          │
│  │ - Deskew     │ │          │ │ - Patterns   │          │
│  │ - Enhance    │ │ Text +   │ │ - Validation │          │
│  │   (OpenCV)   │ │Confidence│ │              │          │
│  └──────────────┘ └──────────┘ └──────────────┘          │
│            │           │           │                       │
│            └───────────┼───────────┘                       │
│                        ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Structured JSON Response                   │  │
│  │  {                                                   │  │
│  │    merchant_name: "Walmart",                        │  │
│  │    receipt_date: "2026-02-08",                      │  │
│  │    total_amount: 125.47,                            │  │
│  │    tax_amount: 10.21,                               │  │
│  │    line_items: [...],                               │  │
│  │    confidence_score: 0.89                           │  │
│  │  }                                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                   JSON Response
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    REACT NATIVE APP                         │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐   ┌──────────────┐  │
│  │ Parse        │───▶│  Map to      │──▶│  Save to     │  │
│  │ Response     │    │  ExpenseItems│   │  Convex      │  │
│  └──────────────┘    └──────────────┘   └──────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Display to User for Review                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘


## 🔄 Data Flow

1. **Image Capture**
   - User takes photo with camera
   - Image compressed to 1200px width
   - Convert to JPEG format

2. **API Request**
   - Multipart form upload
   - API key authentication
   - Max 90s timeout (cold start)

3. **Backend Processing**
   a. Preprocessing (100-200ms)
      - Noise reduction
      - Grayscale conversion
      - Adaptive thresholding
      - Rotation correction

   b. OCR (300-800ms)
      - Tesseract or EasyOCR
      - Extract text with confidence
      - Word-level bounding boxes

   c. NLP Extraction (50-500ms)
      - Regex pattern matching
      - Date parsing
      - Amount extraction
      - Line item detection
      - Optional BERT classification

4. **Response**
   - Structured JSON
   - Confidence scores
   - Processing time
   - Raw OCR text

5. **Client Processing**
   - Map to Convex schema
   - Category classification
   - User review & edit
   - Save to database


## 🎯 Component Responsibilities

### Frontend (React Native)
- ✅ Camera interface
- ✅ Image compression
- ✅ API communication
- ✅ Error handling
- ✅ User interface
- ✅ Data persistence (Convex)

### Backend (FastAPI)
- ✅ Image preprocessing
- ✅ OCR processing
- ✅ NLP extraction
- ✅ API authentication
- ✅ Response formatting
- ✅ Logging & monitoring

### External Services
- ✅ Render.com (hosting)
- ✅ Convex (database)
- ❌ No third-party AI APIs (self-hosted)


## 🔒 Security Layers

```

Request
│
├─▶ HTTPS (Transport Layer Security)
│
├─▶ API Key Authentication
│ └─▶ X-API-Key header validation
│
├─▶ CORS Protection
│ └─▶ Origin validation
│
├─▶ Input Validation
│ ├─▶ File type check
│ ├─▶ File size limit
│ └─▶ Content validation
│
└─▶ Rate Limiting (optional)
└─▶ Per-key request limits

```


## 📊 Technology Stack

### Backend Stack
```

┌──────────────────┐
│ FastAPI │ Async web framework
├──────────────────┤
│ Uvicorn │ ASGI server
├──────────────────┤
│ Pydantic │ Data validation
├──────────────────┤
│ OpenCV │ Image processing
├──────────────────┤
│ Tesseract/Easy │ OCR engines
├──────────────────┤
│ Transformers │ BERT models (opt)
├──────────────────┤
│ Python 3.11 │ Runtime
└──────────────────┘

```

### Frontend Stack
```

┌──────────────────┐
│ React Native │ Mobile framework
├──────────────────┤
│ Expo │ Development platform
├──────────────────┤
│ Convex │ Backend database
├──────────────────┤
│ TypeScript │ Type safety
└──────────────────┘

```

### Infrastructure
```

┌──────────────────┐
│ Render.com │ Hosting (FREE)
├──────────────────┤
│ Docker │ Containerization
├──────────────────┤
│ GitHub │ Source control
└──────────────────┘

```


## 💰 Cost Breakdown

### Current (Before)
```

Monthly Costs:
├─ OCR.space: $3-5/month (100 receipts)
├─ Gemini AI: $2-3/month (100 receipts)
└─ Total: $5-8/month = $60-96/year

```

### New (After)
```

Monthly Costs:
├─ Render.com: $0 (free tier)
├─ Backend API: $0 (self-hosted)
└─ Total: $0/month = $0/year

Savings: $60-96/year 💰

```


## 🚀 Deployment Flow

```

Developer Machine
│
│ git push
▼
GitHub Repository
│
│ webhook
▼
Render.com
│
├─▶ Pull code
├─▶ Build Docker image
├─▶ Run container
└─▶ Deploy to URL
│
▼
Live API Endpoint
https://bizwise-receipt-api.onrender.com

```


## 📈 Scaling Strategy

### Current Capacity (Free Tier)
- 5-10 concurrent requests
- 750 hours/month uptime
- ~3,000 receipts/month capacity

### If Growth Needed
```

Free Tier
│
├─▶ Upgrade to Render.com Starter ($7/mo)
│ └─▶ No cold starts, always-on
│
├─▶ Add Redis caching
│ └─▶ Faster repeated receipts
│
├─▶ Deploy to VPS
│ └─▶ Full control, unlimited
│
└─▶ Add CDN
└─▶ Edge processing

```


## 🎓 Key Design Decisions

1. **Why FastAPI?**
   - Fast async performance
   - Auto-generated docs
   - Type safety with Pydantic
   - Modern Python features

2. **Why Regex over BERT?**
   - 10x faster processing
   - 70-80% accuracy (good enough)
   - Lower memory usage
   - BERT optional for complex cases

3. **Why Render.com?**
   - 100% free (no credit card)
   - Easy deployment
   - Automatic HTTPS
   - Docker support
   - Good enough for personal use

4. **Why Not Cloud Functions?**
   - Cold starts worse than Render
   - Image processing needs memory
   - Stateful model loading
   - Better control with containers

---

This architecture provides a **production-ready, scalable, and cost-effective** solution for receipt processing! 🎉
```
