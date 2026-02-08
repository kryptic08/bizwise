# 🚀 Migration Guide: OCR.space + Gemini → Self-Hosted FastAPI

This guide explains how to migrate from the current third-party APIs to your new self-hosted receipt processing backend.

## 📊 Current vs New Architecture

### Current Setup (Third-Party APIs)

```
React Native App
    ↓
OCR.space API ($) → Extract text
    ↓
Gemini AI API ($) → Parse & structure
    ↓
Convex Database
```

**Issues:**

- 💰 Costs money per request
- 🐌 2-4 second latency
- 🔒 Data sent to third parties
- ❌ No offline support

### New Setup (Self-Hosted)

```
React Native App
    ↓
FastAPI Backend (FREE) → OCR + NLP
    ↓
Convex Database
```

**Benefits:**

- ✅ $0 cost
- ⚡ <1 second latency
- 🔒 Privacy - your data stays private
- 🎯 Full control

---

## 🔄 Step-by-Step Migration

### Step 1: Deploy Backend to Render.com

1. **Push code to GitHub:**

```bash
git add backend/
git commit -m "Add receipt processing backend"
git push origin main
```

2. **Create Render.com account** (free, no credit card): https://render.com

3. **Create new Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - **Root Directory**: `backend`
   - **Environment**: Docker
   - **Instance Type**: Free
   - **Branch**: main

4. **Add Environment Variables:**

```
API_KEY=your-secret-key-12345
ENVIRONMENT=production
OCR_ENGINE=tesseract
USE_NLP_MODEL=false
CONFIDENCE_THRESHOLD=0.7
```

5. **Deploy** and get your URL: `https://your-app-name.onrender.com`

### Step 2: Update React Native App

1. **Add environment variables** to your `.env` file:

```bash
# Add these to your root .env file
EXPO_PUBLIC_RECEIPT_API_URL=https://your-app-name.onrender.com
EXPO_PUBLIC_RECEIPT_API_KEY=your-secret-key-12345
```

2. **Update add-expense.tsx:**

Find the `processImageWithOCR` function (around line 240) and replace it with:

```typescript
import {
  processReceiptWithAPI,
  mapReceiptToExpenseItems,
} from "../utils/receiptAPI";

const processImageWithOCR = async (imageUri: string) => {
  setIsProcessing(true);
  try {
    console.log("Processing image URI:", imageUri);

    // Compress and resize image for faster upload
    console.log("Compressing image...");
    const compressedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1200 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );

    console.log("Using new receipt processing API...");

    // Call the new API
    const result = await processReceiptWithAPI(compressedImage.uri);

    // Store OCR text
    setOcrText(result.data.raw_text);

    // Map to expense items
    const newExpenses = mapReceiptToExpenseItems(result.data);

    if (newExpenses.length > 0) {
      setExpenses(newExpenses);

      setTimeout(() => {
        closeOCRView();
      }, 500);

      Alert.alert(
        "Receipt Processed",
        `Found ${newExpenses.length} item(s) with ${(result.data.confidence_score * 100).toFixed(0)}% confidence.`,
        [{ text: "OK" }],
      );
    } else {
      throw new Error("No items found in receipt");
    }
  } catch (error) {
    console.error("OCR Error details:", error);

    // Fallback to old method if needed
    Alert.alert(
      "Processing Error",
      "Could not process receipt. " + (error as Error).message,
      [
        { text: "Retry", onPress: () => processImageWithOCR(imageUri) },
        { text: "Cancel" },
      ],
    );
  } finally {
    setIsProcessing(false);
  }
};
```

3. **Remove old API calls:**
   - You can keep the old code commented out as fallback
   - Or completely remove OCR.space and Gemini API calls

### Step 3: Test the Integration

1. **Start your React Native app:**

```bash
npm start
```

2. **Test receipt scanning:**
   - Take a photo of a receipt
   - Check console for API calls
   - Verify items are extracted

3. **Monitor performance:**
   - First request: 30-60s (cold start)
   - Subsequent requests: <2s

---

## 🔧 Handling Cold Starts

Since Render.com free tier sleeps after 15 minutes, add a loading message:

```typescript
const [apiWaking, setApiWaking] = useState(false);

const processImageWithOCR = async (imageUri: string) => {
  setIsProcessing(true);
  setApiWaking(true);

  try {
    // Show warming message
    setTimeout(() => {
      if (apiWaking) {
        Alert.alert(
          "Server Starting",
          "The receipt processing server is waking up. This may take up to 60 seconds...",
          [{ text: "OK" }],
        );
      }
    }, 5000);

    const result = await processReceiptWithAPI(compressedImage.uri);
    setApiWaking(false);

    // ... rest of code
  } catch (error) {
    setApiWaking(false);
    // ... error handling
  }
};
```

---

## 🎯 Hybrid Approach (Recommended)

Keep both methods and use the best of both:

```typescript
const processImageWithOCR = async (imageUri: string) => {
  setIsProcessing(true);

  try {
    // Try new API first
    console.log("Trying self-hosted API...");
    const result = await processReceiptWithAPI(compressedImage.uri);

    // Success!
    const newExpenses = mapReceiptToExpenseItems(result.data);
    setExpenses(newExpenses);
  } catch (apiError) {
    console.log("Self-hosted API failed, falling back to Gemini...");

    // Fallback to Gemini AI (your existing code)
    await processWithGemini(imageUri);
  } finally {
    setIsProcessing(false);
  }
};
```

**Benefits:**

- Primary: Fast, free, private
- Fallback: Reliable when backend is down
- Best of both worlds!

---

## 📊 Comparison Table

| Feature                     | Old (OCR.space + Gemini) | New (FastAPI)              |
| --------------------------- | ------------------------ | -------------------------- |
| Cost per request            | ~$0.05                   | $0.00                      |
| Monthly cost (100 receipts) | ~$5                      | $0.00                      |
| Latency                     | 2-4s                     | <1s (after cold start)     |
| Privacy                     | ❌ Third-party           | ✅ Self-hosted             |
| Offline                     | ❌ No                    | ✅ Yes (with local deploy) |
| Customization               | ❌ Limited               | ✅ Full control            |
| Cold start                  | ✅ None                  | ⚠️ 30-60s (free tier)      |

---

## 🐛 Troubleshooting

### "Cannot connect to server"

- Check if backend is deployed on Render.com
- Verify EXPO_PUBLIC_RECEIPT_API_URL is correct
- Check API_KEY matches

### "Request timeout"

- This is normal for first request (cold start)
- The utility automatically retries
- Show user a "Server waking up" message

### "Low confidence scores"

- Try different OCR engine in backend: `OCR_ENGINE=easyocr`
- Enable NLP model: `USE_NLP_MODEL=true`
- Improve image quality before sending

### "No items extracted"

- Check raw_text in response
- Verify receipt text is readable
- May need to adjust regex patterns in extraction.py

---

## 🚀 Future Enhancements

1. **Add Redis caching** for faster repeated receipts
2. **Fine-tune BERT model** on your specific receipts
3. **Deploy to VPS** for no cold starts
4. **Add batch processing** for multiple receipts
5. **Implement offline mode** with local processing

---

## 📝 Rollback Plan

If issues occur, you can instantly rollback:

1. Comment out new API code
2. Uncomment old OCR.space + Gemini code
3. Redeploy app

Both methods can coexist during transition period!

---

Need help? Check the backend README.md or create an issue in your repository.
