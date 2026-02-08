# 🚀 Render.com Deployment - Quick Reference

## ✅ What You Just Did

- [x] Code pushed to GitHub: https://github.com/kryptic08/bizwise
- [ ] Render.com account created
- [ ] Web service deployed
- [ ] API URL obtained

---

## 📋 Deployment Checklist

### 1. Go to Render.com

https://render.com → Sign up with GitHub (FREE)

### 2. Create Web Service

- Click "New +" → "Web Service"
- Connect: kryptic08/bizwise
- Click "Connect"

### 3. Configure Settings

| Setting            | Value                 |
| ------------------ | --------------------- |
| **Name**           | `bizwise-receipt-api` |
| **Branch**         | `master`              |
| **Root Directory** | `backend` ⚠️          |
| **Environment**    | `Docker`              |
| **Instance Type**  | `Free`                |

### 4. Environment Variables

Click "Advanced" → Add these:

```
API_KEY=your-secret-key-here-2026
ENVIRONMENT=production
OCR_ENGINE=tesseract
USE_NLP_MODEL=false
CONFIDENCE_THRESHOLD=0.7
PORT=8000
```

⚠️ **Change API_KEY to your own secret!**

### 5. Deploy

- Click "Create Web Service"
- Wait 5-10 minutes
- Look for "Deploy live" ✅

---

## 🔗 Your API URL

After deployment, you'll get:

```
https://bizwise-receipt-api.onrender.com
```

Or similar (with your chosen name)

---

## ✅ Testing

### Test Health Endpoint

```powershell
curl https://your-app-name.onrender.com/health
```

Expected response:

```json
{
  "status": "healthy",
  "environment": "production",
  "ocr_engine": "tesseract",
  "nlp_enabled": false
}
```

### Test Receipt Processing

```powershell
curl -X POST "https://your-app-name.onrender.com/api/v1/receipt/process" `
  -H "X-API-Key: your-secret-key" `
  -F "file=@receipt.jpg"
```

---

## 📱 Update React Native App

### 1. Add to .env file:

```bash
EXPO_PUBLIC_RECEIPT_API_URL=https://your-app-name.onrender.com
EXPO_PUBLIC_RECEIPT_API_KEY=your-secret-key
```

### 2. Test in app:

```bash
npm start
```

### 3. Take a photo of a receipt and verify it processes!

---

## ⚠️ Important Notes

### Cold Starts

- First request after 15 min: 30-60 seconds
- Subsequent requests: <2 seconds
- This is normal on free tier!

### Troubleshooting

**"Build failed"**

- Check Render.com logs
- Verify Root Directory is `backend`
- Check Dockerfile exists

**"Health check failed"**

- Wait a few more minutes
- Check environment variables
- View deploy logs

**"Cannot connect"**

- URL might be different (check Render dashboard)
- Ensure https:// in URL
- Check API key matches

---

## 💡 Next Steps

1. ✅ Deploy on Render.com
2. ✅ Get your API URL
3. ✅ Test health endpoint
4. ✅ Update React Native .env
5. ✅ Test receipt scanning in app
6. 🎉 You're live!

---

## 📞 Support

- **Build issues**: Check Render.com logs
- **API issues**: Test with curl first
- **App issues**: Check console logs

**Your backend is deploying! 🚀**

Cost: $0/month
Privacy: ✅ Self-hosted
Control: ✅ Full access
