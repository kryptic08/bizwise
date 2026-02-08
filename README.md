# 📱 BizWise - Expense Manager

A comprehensive React Native expense tracking app with AI-powered receipt scanning.

## ✨ Features

- 📷 **Receipt Scanning**: Capture receipts with camera
- 🤖 **AI Extraction**: Self-hosted OCR + NLP for data extraction
- 💰 **Expense Tracking**: Automatic categorization and logging
- 📊 **Analytics**: Track spending patterns
- 🔒 **Secure**: Self-hosted backend for privacy
- 💸 **Free**: $0 monthly cost with self-hosted API

---

## 🚀 Quick Start

### Frontend (React Native App)

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   # Create .env file
   cp .env.example .env

   # Add your API URLs
   EXPO_PUBLIC_RECEIPT_API_URL=https://your-api.onrender.com
   EXPO_PUBLIC_RECEIPT_API_KEY=your-secret-key
   ```

3. **Start the app**
   ```bash
   npx expo start
   ```

### Backend (Receipt Processing API)

See **[QUICKSTART.md](QUICKSTART.md)** for 5-minute setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python app.py
```

---

## 📚 Documentation

| Document                                                   | Description                   |
| ---------------------------------------------------------- | ----------------------------- |
| **[QUICKSTART.md](QUICKSTART.md)**                         | 5-minute setup guide          |
| **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)**               | Migrate from 3rd-party APIs   |
| **[ARCHITECTURE.md](ARCHITECTURE.md)**                     | System architecture overview  |
| **[CHECKLIST.md](CHECKLIST.md)**                           | Complete deployment checklist |
| **[backend/README.md](backend/README.md)**                 | Backend API documentation     |
| **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** | What was built                |

---

## 🏗️ Architecture

```
React Native App (Expo)
        ↓
FastAPI Backend (Self-Hosted)
    ├─ Image Preprocessing (OpenCV)
    ├─ OCR (Tesseract/EasyOCR)
    └─ NLP Extraction (Regex + BERT)
        ↓
Structured Receipt Data
        ↓
Convex Database
```

**Key Benefits:**

- ✅ 100% FREE (self-hosted on Render.com)
- ✅ Fast processing (<1 second)
- ✅ Complete privacy (your data stays private)
- ✅ Full control and customization

---

## 🎯 Tech Stack

### Frontend

- **Framework**: React Native + Expo
- **Language**: TypeScript
- **State Management**: React Hooks
- **Backend**: Convex
- **Camera**: expo-camera, expo-image-picker
- **Navigation**: expo-router

### Backend (New!)

- **Framework**: FastAPI (Python)
- **OCR**: Tesseract + EasyOCR
- **Image Processing**: OpenCV
- **NLP**: Regex + DistilBERT (optional)
- **Deployment**: Docker on Render.com (FREE)
- **Authentication**: API Key

---

## 📦 Project Structure

```
bizwise/
├── app/                          # React Native application
│   ├── (tabs)/                  # Tab navigation screens
│   │   ├── add-expense.tsx     # Receipt scanning screen
│   │   ├── transactions.tsx     # Transaction history
│   │   └── profile.tsx         # User profile
│   ├── context/                 # React context providers
│   └── utils/
│       └── receiptAPI.ts       # New API client
│
├── backend/                     # FastAPI receipt processing
│   ├── app.py                   # Main application
│   ├── schemas.py               # Request/response models
│   ├── core/                    # Configuration
│   ├── services/                # Business logic
│   │   ├── preprocessing.py    # Image preprocessing
│   │   ├── ocr.py              # OCR service
│   │   ├── extraction.py       # NLP extraction
│   │   └── receipt_processor.py # Main orchestrator
│   ├── Dockerfile               # Container config
│   └── requirements.txt         # Python dependencies
│
├── convex/                      # Convex backend
│   ├── schema.ts               # Database schema
│   ├── expenses.ts             # Expense operations
│   └── users.ts                # User management
│
└── assets/                      # Images and resources
```

---

## 💰 Cost Comparison

| Service     | Before              | After              | Savings            |
| ----------- | ------------------- | ------------------ | ------------------ |
| **OCR**     | OCR.space ($3-5/mo) | Tesseract (FREE)   | $3-5/mo            |
| **NLP**     | Gemini AI ($2-3/mo) | Self-hosted (FREE) | $2-3/mo            |
| **Hosting** | N/A                 | Render.com (FREE)  | $0                 |
| **Total**   | **$5-8/mo**         | **$0/mo**          | **$60-96/year** 💰 |

---

## 🔒 Privacy & Security

- ✅ Self-hosted backend (your data never leaves your control)
- ✅ API key authentication
- ✅ HTTPS encryption
- ✅ No data persistence (images not stored)
- ✅ CORS protection
- ✅ Input validation

---

## 🚢 Deployment

### Backend Deployment (Render.com - FREE)

1. Push code to GitHub
2. Create Render.com account (no credit card)
3. Deploy from GitHub repository
4. Set environment variables
5. Get your API URL

**Detailed instructions**: See [QUICKSTART.md](QUICKSTART.md)

### Frontend Deployment (EAS Build)

```bash
# Build for Android
npx eas build --platform android

# Build for iOS
npx eas build --platform ios
```

---

## 📱 Features

### Current Features

- [x] User authentication with PIN
- [x] Receipt camera capture
- [x] AI-powered OCR + NLP extraction
- [x] Manual expense entry
- [x] Expense categorization
- [x] Transaction history
- [x] Profile management
- [x] Dark mode support

### Roadmap

- [ ] Analytics dashboard
- [ ] Export to CSV/PDF
- [ ] Multi-currency support
- [ ] Batch receipt processing
- [ ] Offline mode
- [ ] Receipt history with images

---

## 🧪 Testing

### Test Backend API

```bash
cd backend
python test_api.py path/to/receipt.jpg
```

### Test Frontend

```bash
npm start
# Scan a receipt using the camera
```

---

## 🐛 Troubleshooting

### Common Issues

**"Cannot connect to server"**

- Check if backend is deployed
- Verify API URL in .env
- Test health endpoint: `curl YOUR_API_URL/health`

**"Low accuracy"**

- Enable BERT model in backend .env
- Switch to EasyOCR
- Improve image quality

**"Request timeout"**

- Normal for first request (cold start 30-60s)
- Subsequent requests are fast (<2s)

See [CHECKLIST.md](CHECKLIST.md) for complete troubleshooting guide.

---

## 📄 License

MIT License - Free to use and modify

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev)
- Backend powered by [FastAPI](https://fastapi.tiangolo.com)
- Database by [Convex](https://convex.dev)
- OCR by [Tesseract](https://github.com/tesseract-ocr/tesseract)
- Deployed on [Render.com](https://render.com)

---

## 📞 Support

- **Documentation**: See files above
- **Issues**: Create GitHub issue
- **Questions**: Check documentation first

---

**Made with ❤️ for small business expense tracking**

🚀 **Ready to deploy? Start with [QUICKSTART.md](QUICKSTART.md)**
