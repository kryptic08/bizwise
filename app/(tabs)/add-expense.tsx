import { HelpTooltip } from "@/components/HelpTooltip";
import { useMutation } from "convex/react";
import { CameraView, FlashMode, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  Plus,
  Trash2,
  X,
  Zap,
  ZapOff,
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../context/AuthContext";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#9ca3af",
};

// Available expense categories
const EXPENSE_CATEGORIES = [
  "Food",
  "Office",
  "Transportation",
  "Utilities",
  "Maintenance",
  "Marketing",
  "Medical",
  "Equipment",
  "General",
];

// OCR.space API configuration
const OCR_API_URL = "https://api.ocr.space/parse/image";
const OCR_API_KEY = process.env.EXPO_PUBLIC_OCR_API_KEY!;
const OCR_API_KEY_BACKUP = "K84029735088957";

// Google AI models — rotate across all to maximize RPD (each ~20 RPD)
// Round-robin API keys to multiply daily quota (3 keys = 3x daily limit)
const GEMINI_API_KEYS = [
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_1!,
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_2!,
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_3!,
];
let geminiApiKeyIndex = 0; // Round-robin counter for API keys

const GOOGLE_AI_MODELS = [
  "gemini-2.5-flash", // 20 RPD — best quality
  "gemini-2.5-flash-lite", // 20 RPD — lighter/faster
  "gemini-3-flash", // 20 RPD — newest
  "gemma-3-27b-it", // 14.4K RPD — strong OSS
  "gemma-3-12b-it", // 14.4K RPD — mid-size
  "gemma-3-4b-it", // 14.4K RPD — small but fast
];
// Round-robin counter — persists across scans within session
let googleModelIndex = 0;

interface ExpenseItem {
  id: string;
  category: string;
  title: string;
  amount: string;
  quantity: string;
  total: string;
}

export default function AddExpenseScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Convex mutations
  const addExpenseGroup = useMutation(api.expenses.addExpenseGroup);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    {
      id: "1",
      category: "",
      title: "",
      amount: "",
      quantity: "",
      total: "0.00",
    },
  ]);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCameraView, setShowCameraView] = useState(false);
  const [flashMode, setFlashMode] = useState<FlashMode>("off");
  const [showScanAnimation, setShowScanAnimation] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanError, setScanError] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState("");
  const lottieRef = useRef<LottieView>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getCurrentDate = () => {
    const date = new Date();
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const addExpenseItem = () => {
    const newItem: ExpenseItem = {
      id: Date.now().toString(),
      category: "",
      title: "",
      amount: "",
      quantity: "",
      total: "0.00",
    };
    setExpenses([...expenses, newItem]);
  };

  const removeExpenseItem = (id: string) => {
    if (expenses.length > 1) {
      setExpenses(expenses.filter((item) => item.id !== id));
    }
  };

  const openCategoryPicker = (itemId: string) => {
    setSelectedItemId(itemId);
    setCustomCategory("");
    setShowCategoryPicker(true);
  };

  const selectCategory = (category: string) => {
    if (selectedItemId) {
      updateExpenseItem(selectedItemId, "category", category);
    }
    setShowCategoryPicker(false);
    setSelectedItemId(null);
    setCustomCategory("");
  };

  const selectCustomCategory = () => {
    if (customCategory.trim() && selectedItemId) {
      updateExpenseItem(selectedItemId, "category", customCategory.trim());
      setShowCategoryPicker(false);
      setSelectedItemId(null);
      setCustomCategory("");
    }
  };

  const updateExpenseItem = (
    id: string,
    field: keyof ExpenseItem,
    value: string,
  ) => {
    setExpenses(
      expenses.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };

          // Calculate total if amount or quantity changes
          if (field === "amount" || field === "quantity") {
            const amount =
              parseFloat(field === "amount" ? value : item.amount) || 0;
            const quantity =
              parseFloat(field === "quantity" ? value : item.quantity) || 0;
            updated.total = (amount * quantity).toFixed(2);
          }

          return updated;
        }
        return item;
      }),
    );
  };

  const uploadImageToConvex = async (imageUri: string) => {
    try {
      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Read the file as blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Upload to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });

      const { storageId } = await result.json();
      return storageId;
    } catch (error) {
      console.error("Error uploading image to Convex:", error);
      return null;
    }
  };

  const handleSave = async () => {
    // Validate expenses
    const validExpenses = expenses.filter(
      (exp) => exp.title.trim() && exp.amount && parseFloat(exp.amount) > 0,
    );

    if (validExpenses.length === 0) {
      Alert.alert(
        "Validation Error",
        "Please add at least one expense with a title and amount.",
      );
      return;
    }

    // Calculate total
    const total = validExpenses.reduce(
      (sum, exp) => sum + parseFloat(exp.total || "0"),
      0,
    );

    Alert.alert(
      "Save Expenses",
      `Total: ₱${total.toFixed(2)}\n\nSave ${validExpenses.length} expense(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async () => {
            setIsSaving(true);
            try {
              // Note: Receipt images are only used for OCR, not stored in Convex to save storage
              // Save all expenses as a single grouped transaction
              const items = validExpenses.map((expense) => ({
                category: expense.category || "General",
                title: expense.title,
                amount: parseFloat(expense.amount),
                quantity: parseInt(expense.quantity) || 1,
              }));

              await addExpenseGroup({
                items,
                ocrText: ocrText || undefined, // Only store OCR text, not the image
                userId: user?.userId!,
                clientTimestamp: Date.now(), // Pass device timestamp
              });

              // Reset form after successful save
              setExpenses([
                {
                  id: Date.now().toString(),
                  category: "",
                  title: "",
                  amount: "",
                  quantity: "",
                  total: "0.00",
                },
              ]);
              setCapturedImage(null);
              setOcrText("");
              setScanComplete(false);
              setScanError(false);

              Alert.alert("Success", "Expenses saved successfully!", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error("Error saving expenses:", error);
              Alert.alert(
                "Error",
                "Failed to save expenses. Please try again.",
              );
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenCamera = async () => {
    if (!cameraPermission) {
      return;
    }

    if (!cameraPermission.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(
          "Permission needed",
          "Camera permission is required to scan receipts",
        );
        return;
      }
    }

    setShowCameraView(true);
    setShowCamera(false);
    setCapturedImage(null);
    setOcrText("");
  };

  const toggleFlash = () => {
    setFlashMode((current) => (current === "off" ? "on" : "off"));
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
        });
        if (photo) {
          setCapturedImage(photo.uri);
          setShowCameraView(false);
          setShowCamera(true);
          processImageWithOCR(photo.uri);
        }
      } catch (error) {
        console.error("Error taking picture:", error);
        Alert.alert("Error", "Failed to take picture");
      }
    }
  };

  // Helper: fetch with timeout (OCR.space can hang on free tier)
  const fetchWithTimeout = async (
    url: string,
    options: RequestInit,
    timeoutMs: number = 25000,
  ): Promise<Response> => {
    const controller = new AbortController();
    const existingSignal = options.signal as AbortSignal | undefined;

    // If caller already has an abort signal, listen for it
    if (existingSignal) {
      existingSignal.addEventListener("abort", () => controller.abort());
    }

    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === "AbortError" && !existingSignal?.aborted) {
        throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
      }
      throw error;
    }
  };

  // Helper: try OCR.space with a specific engine and API key
  const tryOCREngine = async (
    base64Image: string,
    engine: string,
    signal: AbortSignal,
    apiKey: string = OCR_API_KEY,
  ): Promise<string> => {
    console.log(
      `🔍 Trying OCR.space Engine ${engine} (key: ${apiKey === OCR_API_KEY ? "primary" : "backup"})...`,
    );

    const formData = new FormData();
    formData.append("apikey", apiKey);
    formData.append("base64Image", `data:image/jpeg;base64,${base64Image}`);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");
    formData.append("detectOrientation", "true");
    formData.append("scale", "true");
    formData.append("OCREngine", engine);

    const response = await fetchWithTimeout(
      OCR_API_URL,
      { method: "POST", body: formData, signal },
      25000, // 25 second timeout
    );

    console.log(`OCR Engine ${engine} response status:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OCR.space Engine ${engine}: ${response.status} - ${errorText}`,
      );
    }

    const result = await response.json();
    console.log(
      `OCR Engine ${engine} result:`,
      JSON.stringify(result).substring(0, 300),
    );

    if (result.ErrorMessage && result.ErrorMessage.length > 0) {
      throw new Error(`OCR Engine ${engine}: ${result.ErrorMessage[0]}`);
    }
    if (result.IsErroredOnProcessing) {
      throw new Error(`OCR Engine ${engine} processing error`);
    }

    const text = result.ParsedResults?.[0]?.ParsedText?.trim() || "";

    if (!text) {
      throw new Error(`OCR Engine ${engine}: no text extracted`);
    }

    return text;
  };

  const processImageWithOCR = async (imageUri: string) => {
    setIsProcessing(true);
    setShowScanAnimation(true);
    setScanComplete(false);
    setScanError(false);

    // Create abort controller for canceling requests
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      console.log("Processing image URI:", imageUri);

      // Compress and resize image for OCR.space (free tier limit ~1MB)
      console.log("Compressing image...");
      const compressedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 800 } }], // Smaller to stay within free tier limits
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
      );
      console.log("Compressed image URI:", compressedImage.uri);

      // Convert to base64 for OCR.space
      const base64Image = await FileSystem.readAsStringAsync(
        compressedImage.uri,
        { encoding: "base64" },
      );

      const base64SizeKB = Math.round((base64Image.length * 3) / 4 / 1024);
      console.log(
        `Base64 length: ${base64Image.length} chars (~${base64SizeKB} KB)`,
      );

      if (base64SizeKB > 900) {
        console.warn("⚠️ Image may exceed OCR.space 1MB free tier limit");
      }

      console.log("OCR API Key present:", !!OCR_API_KEY);
      console.log("Starting OCR.space API...");

      // ── OCR.space: Try primary key → backup key (Engine 2 only) ──
      let extractedText = "";

      // Try with primary API key first
      try {
        extractedText = await tryOCREngine(base64Image, "2", signal);
        console.log(`✅ Primary key extracted ${extractedText.length} chars`);
      } catch (e1) {
        if ((e1 as Error).name === "AbortError") throw e1;
        console.warn("❌ Primary key failed:", (e1 as Error).message);

        // Try backup API key
        console.log("🔄 Switching to backup OCR API key...");
        try {
          extractedText = await tryOCREngine(
            base64Image,
            "2",
            signal,
            OCR_API_KEY_BACKUP,
          );
          console.log(`✅ Backup key extracted ${extractedText.length} chars`);
        } catch (e2) {
          if ((e2 as Error).name === "AbortError") throw e2;
          console.error("❌ All OCR attempts failed");
          throw new Error("OCR failed with both API keys. Please try again.");
        }
      }

      console.log("Extracted text:", extractedText);
      setOcrText(extractedText);

      // Check if text is empty or too short to be a receipt
      if (!extractedText || extractedText.length < 10) {
        console.log("❌ No meaningful text found in image");
        setScanError(true);
        return; // Stop processing, don't send to AI
      }

      // ── Parse the OCR text into structured items ──
      await parseReceiptWithAI(extractedText, signal);
    } catch (error) {
      // Check if error is from abort
      if ((error as Error).name === "AbortError") {
        console.log("OCR process was cancelled by user");
        return; // Don't show error, user intentionally cancelled
      }

      console.error("OCR Error:", (error as Error).message);

      // Show error animation for OCR failures
      setScanError(true);
      setIsProcessing(false);
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  // Detect receipt type from OCR text
  const detectReceiptType = (
    ocrText: string,
  ): "electricity" | "grocery" | "labor" | "general" => {
    const text = ocrText.toLowerCase();

    // Check for electricity bill keywords
    if (
      text.includes("meralco") ||
      text.includes("kwh") ||
      text.includes("kilowatt") ||
      (text.includes("electric") &&
        (text.includes("bill") || text.includes("statement"))) ||
      (text.includes("consumption") && text.includes("kwh"))
    ) {
      return "electricity";
    }

    // Check for labor/service keywords
    if (
      text.includes("labor") ||
      text.includes("service charge") ||
      text.includes("installation") ||
      text.includes("repair") ||
      text.includes("plumbing") ||
      text.includes("electrician") ||
      text.includes("carpenter") ||
      text.includes("man hours") ||
      text.includes("manpower")
    ) {
      return "labor";
    }

    // Check for grocery (multiple items pattern)
    const lines = text.split("\n");
    const itemLines = lines.filter((line) => {
      const hasNumber = /\d/.test(line);
      const hasPricePattern = /\d+\.?\d*/.test(line);
      return hasNumber && hasPricePattern && line.length > 3;
    });

    // If there are many item-like lines, likely a grocery receipt
    if (itemLines.length > 5) {
      return "grocery";
    }

    return "general";
  };

  // Get specialized prompt based on receipt type
  const getReceiptPromptByType = (
    text: string,
    type: "electricity" | "grocery" | "labor" | "general",
  ) => {
    if (type === "electricity") {
      return `You are an expert at parsing electricity bills from the Philippines (especially MERALCO).

IMPORTANT: Extract the total bill amount as a SINGLE expense item.

For the electricity bill, provide:
1. title: "Electricity Bill - [Month/Period]" (extract the billing period if visible)
2. amount: The TOTAL AMOUNT DUE (look for "Amount Due", "Total Amount", "Current Charges")
3. quantity: 1
4. category: Utilities

CRITICAL RULES:
- Look for keywords: "AMOUNT DUE", "TOTAL AMOUNT", "CURRENT CHARGES", "TOTAL"
- The bill amount is typically the largest number on the bill
- Philippine pesos: amounts like "2345" = ₱2,345.00
- Extract billing period/month if visible (e.g., "January 2026", "Dec 2025")
- Return ONLY ONE item (the total bill), not individual charges
- Return ONLY valid JSON array, no markdown, no explanations

Receipt text:
"""
${text}
"""

Return ONLY a JSON array:
[{"title": "Electricity Bill - January 2026", "amount": 2345.50, "quantity": 1, "category": "Utilities"}]

If you cannot find the bill amount, return: []`;
    }

    if (type === "labor") {
      return `You are an expert at parsing labor/service receipts from the Philippines.

Extract labor charges and services provided.

For each service/labor charge, provide:
1. title: Description of the service (e.g., "Plumbing Repair", "Electrical Installation")
2. amount: The charge amount
3. quantity: Hours or count (default to 1)
4. category: Maintenance (or Equipment if equipment-related)

CRITICAL RULES:
- Look for service descriptions, man-hours, labor charges
- Common terms: "labor", "service", "repair", "installation", "man hours"
- Philippine pesos: "500" = ₱500.00
- Separate materials from labor if both are listed
- If only total labor cost is shown, create one item for it
- Return ONLY valid JSON array, no markdown

Receipt text:
"""
${text}
"""

Return ONLY a JSON array:
[{"title": "Plumbing Repair", "amount": 500, "quantity": 1, "category": "Maintenance"}]

If no clear labor charges found, return: []`;
    }

    if (type === "grocery") {
      return `You are an expert at parsing grocery receipts from the Philippines.

Extract ALL individual items purchased from the grocery store.

For each item, provide:
1. title: Product name (cleaned up, capitalized)
2. amount: Unit price per item
3. quantity: Number purchased (look for "x2", "qty:2", etc.)
4. category: Food (or General for non-food items)

CRITICAL RULES:
- Each item is on ONE LINE: "ITEM NAME  PRICE"
- Extract ALL items, not just a few
- Skip: TOTAL, SUBTOTAL, CHANGE, TAX, VAT, DISCOUNT
- Skip: Store name, address, date, cashier, receipt number
- Philippine pesos: "45" = ₱45.00, "12.50" = ₱12.50
- Common stores: 7-Eleven, Mini Stop, SM Supermarket, Puregold, Robinsons
- Items may include: vegetables, meat, fish, snacks, drinks, household items
- Return ONLY valid JSON array, no markdown

Receipt text:
"""
${text}
"""

Return ONLY a JSON array:
[{"title": "Rice", "amount": 45, "quantity": 2, "category": "Food"}, {"title": "Cooking Oil", "amount": 85, "quantity": 1, "category": "Food"}]

If no items found, return: []`;
    }

    // General prompt (fallback)
    return getReceiptPrompt(text);
  };

  // ══════════════════════════════════════════════════════════
  // NOTE: Simple regex parser removed — AI models handle parsing
  // ══════════════════════════════════════════════════════════

  // Receipt parsing prompt (shared between Gemini and OpenRouter)
  const getReceiptPrompt = (text: string) =>
    `You are an expert at parsing receipt text from the Philippines. Extract ONLY items that are clearly visible in the receipt.

IMPORTANT: DO NOT MAKE UP, INVENT, OR HALLUCINATE ANY ITEMS. Only extract what you actually see in the text.

For each item found, provide:
1. title: The name of the item (clean it up, capitalize properly)
2. amount: The unit price (number only, no currency symbol)
3. quantity: How many were purchased (default to 1 if not specified)
4. category: One of these categories: Food, Office, Transportation, Utilities, Maintenance, Marketing, Medical, Equipment, General

CRITICAL RULES FOR PHILIPPINE RECEIPTS:
- Each item appears on ONE LINE ONLY in receipts - DO NOT combine multiple lines into one item name
- Item format is: "ITEM NAME - PRICE" or "ITEM NAME PRICE" on a SINGLE line
- If you see text on separate lines, they are SEPARATE items, not one item
- Many receipts are HANDWRITTEN and may not have PHP/₱ symbols
- Amounts like "2345" or "1500" are Philippine pesos (don't divide by 100, use as-is)
- Common price patterns: "2345" = ₱2,345.00, "150" = ₱150.00, "15.50" = ₱15.50
- If amount has no decimal point and is 2+ digits, treat it as whole pesos
- ONLY extract actual purchased items, NOT totals, subtotals, change, tax, VAT, discounts
- Skip store names, addresses, dates, times, receipt numbers, cashier names
- If you see "x2" or "x 3" or "qty: 2", that's the quantity
- The amount should be the UNIT price, not the line total
- For handwritten receipts, be lenient with OCR errors ("S" might be "5", "O" might be "0")
- If unsure about category, use "General"
- If you cannot clearly identify items, return empty array []
- DO NOT include items that look like: TOTAL, SUBTOTAL, CHANGE, CASH, PAYMENT, TAX, VAT, DISCOUNT
- Return ONLY valid JSON array, no markdown code blocks, no explanations, no other text

Receipt text:
"""
${text}
"""

Return ONLY a JSON array (raw JSON, no code blocks, no markdown):
[{"title": "Sisig", "amount": 150, "quantity": 1, "category": "Food"}, {"title": "Rice", "amount": 25, "quantity": 2, "category": "Food"}]

If no items found or text is unclear, return: []`;

  // Extract items from AI response text
  const extractItemsFromAIResponse = (aiResponse: string): any[] | null => {
    const cleanedResponse = aiResponse
      .replace(/```json\n/g, "")
      .replace(/```\n/g, "")
      .replace(/```/g, "")
      .replace(/<think>[\s\S]*?<\/think>/g, "") // Remove DeepSeek thinking tags
      .trim();

    const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    try {
      const items = JSON.parse(jsonMatch[0]);
      return Array.isArray(items) ? items : null;
    } catch {
      return null;
    }
  };

  // Try Gemini API (works for both Gemini and Gemma models)
  const tryGeminiAPI = async (
    text: string,
    model: string,
    receiptType: "electricity" | "grocery" | "labor" | "general",
    signal?: AbortSignal,
  ): Promise<any[] | null> => {
    // Get current API key and rotate to next one for next request
    const currentApiKey = GEMINI_API_KEYS[geminiApiKeyIndex];
    const keyNumber = geminiApiKeyIndex + 1;
    geminiApiKeyIndex = (geminiApiKeyIndex + 1) % GEMINI_API_KEYS.length;

    console.log(
      `Trying Google AI (${model}) with API key #${keyNumber} for ${receiptType} receipt...`,
    );
    const prompt = getReceiptPromptByType(text, receiptType);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
        signal: signal,
      },
    );

    if (!response.ok) throw new Error(`${model} error: ${response.status}`);

    const result = await response.json();
    const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return extractItemsFromAIResponse(aiText);
  };

  // Parse receipt text using AI with round-robin rotation:
  // Google AI models only (rotating through all 6 models)
  const parseReceiptWithAI = async (text: string, signal?: AbortSignal) => {
    console.log("Parsing receipt...");

    // Detect receipt type first
    const receiptType = detectReceiptType(text);
    console.log(`📋 Detected receipt type: ${receiptType}`);

    let items: any[] | null = null;

    // Rotate through ALL Google AI models to spread RPD usage
    const startIndex = googleModelIndex;
    for (let i = 0; i < GOOGLE_AI_MODELS.length; i++) {
      const idx = (startIndex + i) % GOOGLE_AI_MODELS.length;
      const model = GOOGLE_AI_MODELS[idx];
      try {
        console.log(
          `🔄 Trying Google AI: ${model} (slot ${idx + 1}/${GOOGLE_AI_MODELS.length})...`,
        );
        items = await tryGeminiAPI(text, model, receiptType, signal);
        if (items && items.length > 0) {
          console.log(`✅ ${model} parsed ${items.length} items`);
          // Advance rotation to NEXT model for the next scan
          googleModelIndex = (idx + 1) % GOOGLE_AI_MODELS.length;
          break;
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        console.warn(`❌ ${model} failed:`, e);
      }
    }
    // Advance rotation even if all failed, so next scan starts fresh
    if (!items || items.length === 0) {
      googleModelIndex = (startIndex + 1) % GOOGLE_AI_MODELS.length;
    }

    // Process items if any AI succeeded
    if (items && items.length > 0) {
      const newExpenses: ExpenseItem[] = items.map((item: any) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        category: item.category || "General",
        title: item.title || "Unknown Item",
        amount: parseFloat(item.amount || 0).toFixed(2),
        quantity: (item.quantity || 1).toString(),
        total: (parseFloat(item.amount || 0) * (item.quantity || 1)).toFixed(2),
      }));

      setExpenses(newExpenses);

      // Show success animation (user will click View Items button)
      setScanComplete(true);
    } else {
      // All AI failed, show error animation (user will click Retake Photo button)
      console.log("All AI parsers failed, showing error animation...");
      setScanError(true);
    }
  };

  // Fallback regex-based parsing (used when AI fails)

  // Fallback OCR with realistic receipt patterns (used when API fails)
  const simulateAdvancedOCR = async (): Promise<string> => {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate realistic receipt text based on common Filipino receipt formats
    const receipts = [
      `MINI STOP
DATE: ${getCurrentDate()}
CHICKEN JOY - ₱89.00
RICE - ₱25.00 x 2
COKE 1.5L - ₱45.00
BREAD - ₱35.00 x 1
TOTAL: ₱219.00
CASH: ₱250.00
CHANGE: ₱31.00
THANK YOU!`,

      `7-ELEVEN
${getCurrentDate()}
INSTANT NOODLES ₱15.00 x 3
MILK TEA ₱65.00
COFFEE ₱35.00 x 2
CHOCOLATE ₱25.00
TOTAL AMOUNT: ₱190.00
TENDERED: ₱200.00
CHANGE: ₱10.00`,

      `GROCERY RECEIPT
SUPER 8
DATE: ${getCurrentDate()}
VEGETABLES - ₱120.00
MEAT - ₱350.00 x 1
FISH - ₱180.00
COOKING OIL - ₱85.00 x 2
SUGAR - ₱55.00
SALT - ₱12.00
TOTAL: ₱887.00`,

      `OFFICE SUPPLIES
NATIONAL BOOKSTORE
${getCurrentDate()}
BOND PAPER A4 - ₱150.00
BALLPEN - ₱8.00 x 5
STAPLER - ₱75.00
FOLDER - ₱12.00 x 10
HIGHLIGHTER - ₱25.00 x 3
TOTAL: ₱430.00`,

      `GAS STATION
PETRON
${getCurrentDate()}
GASOLINE - ₱58.50 x 10L
MOTOR OIL - ₱250.00
CAR WASH - ₱150.00
TOTAL: ₱985.00`,

      `HARDWARE STORE
ACE HARDWARE
${getCurrentDate()}
SCREWS - ₱25.00 x 2
HAMMER - ₱180.00
PAINT - ₱350.00 x 1
BRUSH - ₱45.00 x 3
NAILS - ₱15.00 x 4
TOTAL: ₱750.00`,

      `PHARMACY
MERCURY DRUG
${getCurrentDate()}
PARACETAMOL - ₱35.00 x 2
VITAMINS - ₱180.00
FIRST AID KIT - ₱250.00
BAND AID - ₱25.00 x 3
ALCOHOL - ₱45.00 x 2
TOTAL: ₱615.00`,
    ];

    // Return a random receipt for simulation
    return receipts[Math.floor(Math.random() * receipts.length)];
  };

  // Fallback regex-based parsing (used when Gemini AI fails)
  const parseReceiptText = (text: string) => {
    console.log("Parsing receipt text with regex fallback:", text);

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const newExpenses: ExpenseItem[] = [];

    // Enhanced categorization keywords
    const categoryKeywords: Record<string, string[]> = {
      Food: [
        "chicken",
        "rice",
        "beef",
        "pork",
        "fish",
        "bread",
        "milk",
        "eggs",
        "vegetables",
        "fruits",
        "pizza",
        "burger",
        "sandwich",
        "coffee",
        "tea",
        "juice",
        "soda",
        "water",
        "snacks",
        "chips",
        "cookies",
        "cake",
        "noodles",
        "restaurant",
        "food",
        "grocery",
        "supermarket",
        "meat",
        "jollibee",
        "mcdonalds",
        "mcdonald",
        "kfc",
        "ministop",
        "7-eleven",
        "7eleven",
        "coke",
        "pepsi",
        "sprite",
        "fries",
        "meal",
        "combo",
        "ice cream",
        "chocolate",
        "candy",
        "biscuit",
        "crackers",
        "hotdog",
        "sausage",
        "egg",
        "ulam",
        "viand",
        "ulam",
        "softdrinks",
        "drink",
        "beverage",
      ],
      Office: [
        "paper",
        "pen",
        "pencil",
        "stapler",
        "folder",
        "binder",
        "office",
        "supplies",
        "printer",
        "ink",
        "computer",
        "laptop",
        "keyboard",
        "mouse",
        "desk",
        "chair",
        "bond",
        "ballpen",
        "highlighter",
        "marker",
        "notebook",
        "envelope",
        "clip",
        "scissors",
        "tape",
        "glue",
        "eraser",
        "ruler",
      ],
      Transportation: [
        "gas",
        "gasoline",
        "fuel",
        "diesel",
        "taxi",
        "uber",
        "grab",
        "bus",
        "train",
        "parking",
        "toll",
        "car",
        "motorcycle",
        "jeep",
        "tricycle",
        "petron",
        "shell",
        "caltex",
        "phoenix",
        "seaoil",
        "total",
        "jetti",
        "fare",
        "transpo",
        "vehicle",
        "motor",
        "oil",
        "liter",
        "litre",
      ],
      Utilities: [
        "electricity",
        "water bill",
        "internet",
        "phone",
        "cable",
        "wifi",
        "bill",
        "utility",
        "electric",
        "pldt",
        "smart",
        "globe",
        "meralco",
        "maynilad",
        "manila water",
        "converge",
        "sky",
        "cignal",
      ],
      Maintenance: [
        "repair",
        "fix",
        "maintenance",
        "service",
        "cleaning",
        "tools",
        "hardware",
        "paint",
        "construction",
        "plumbing",
        "electrical",
        "hammer",
        "screws",
        "nails",
        "brush",
        "cement",
        "wood",
        "lumber",
        "ace hardware",
        "handyman",
        "wilcon",
        "cw home",
      ],
      Marketing: [
        "advertising",
        "ads",
        "marketing",
        "promotion",
        "flyers",
        "banner",
        "social media",
        "facebook",
        "google ads",
        "website",
        "tarpaulin",
        "signage",
        "poster",
        "brochure",
      ],
      Medical: [
        "medicine",
        "doctor",
        "hospital",
        "clinic",
        "pharmacy",
        "medical",
        "health",
        "pills",
        "vitamins",
        "first aid",
        "paracetamol",
        "biogesic",
        "mercury drug",
        "watsons",
        "southstar",
        "generics",
        "tablet",
        "capsule",
        "syrup",
        "alcohol",
        "bandage",
        "band aid",
        "mask",
        "thermometer",
      ],
      Equipment: [
        "equipment",
        "machine",
        "device",
        "appliance",
        "refrigerator",
        "oven",
        "microwave",
        "blender",
        "mixer",
        "fan",
        "aircon",
        "ac",
        "freezer",
      ],
    };

    // Function to categorize based on keywords
    const categorizeItem = (itemText: string): string => {
      const lowercaseText = itemText.toLowerCase();

      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some((keyword) => lowercaseText.includes(keyword))) {
          return category;
        }
      }
      return "General"; // Default category
    };

    // Skip words - lines containing these are not items
    const skipPatterns = [
      /^total/i,
      /^subtotal/i,
      /^sub-total/i,
      /^grand\s*total/i,
      /^tax/i,
      /^vat/i,
      /^change/i,
      /^cash/i,
      /^payment/i,
      /^tendered/i,
      /^receipt/i,
      /^thank\s*you/i,
      /^welcome/i,
      /^address/i,
      /^tel/i,
      /^date/i,
      /^time/i,
      /^tin/i,
      /^vatable/i,
      /^non-vat/i,
      /^discount/i,
      /^senior/i,
      /^pwd/i,
      /^invoice/i,
      /^or\s*no/i,
      /^si\s*no/i,
      /^cashier/i,
      /^store/i,
      /^branch/i,
      /^customer/i,
      /^member/i,
      /^points/i,
      /^card/i,
      /^balance/i,
      /^amount\s*due/i,
      /^amt/i,
      /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, // Date patterns
      /^\d{1,2}:\d{2}/, // Time patterns
    ];

    // Additional patterns to skip (can appear anywhere in line)
    const skipContainsPatterns = [
      /total/i,
      /subtotal/i,
      /change/i,
      /tendered/i,
      /vat\s*(?:able|exempt|amount)/i,
      /discount/i,
      /receipt\s*(?:no|#|number)/i,
      /invoice\s*(?:no|#|number)/i,
      /transaction/i,
      /thank\s*you/i,
      /come\s*again/i,
      /please\s*come/i,
      /customer\s*copy/i,
      /store\s*copy/i,
      /\btin\b/i,
      /serial\s*no/i,
      /terminal/i,
      /cashier/i,
      /\bor\s*#/i,
      /\bsi\s*#/i,
    ];

    const shouldSkipLine = (line: string): boolean => {
      const trimmedLine = line.trim();
      // Check start patterns
      if (skipPatterns.some((pattern) => pattern.test(trimmedLine))) {
        return true;
      }
      // Check contains patterns
      if (skipContainsPatterns.some((pattern) => pattern.test(trimmedLine))) {
        return true;
      }
      return false;
    };

    // Function to check if a number is likely a valid price
    const isValidPrice = (amount: number, line: string): boolean => {
      // Price should be positive
      if (amount <= 0) return false;

      // Prices typically have reasonable values (0.50 to 100,000)
      if (amount < 0.5 || amount > 100000) return false;

      // Skip if the line looks like a phone number (7+ consecutive digits)
      if (/\d{7,}/.test(line.replace(/[\s\-\.]/g, ""))) return false;

      // Skip if line looks like a date (e.g., 01/15/2026, 2026-01-15)
      if (/\d{1,4}[\-\/]\d{1,2}[\-\/]\d{1,4}/.test(line)) return false;

      // Skip if line looks like a time (e.g., 10:30, 14:45:00)
      if (/\d{1,2}:\d{2}(:\d{2})?/.test(line)) return false;

      // Skip if line looks like a receipt/transaction number (mostly digits, 6+ chars)
      if (
        /^[\d\-#]+$/.test(line.replace(/\s/g, "")) &&
        line.replace(/\s/g, "").length >= 6
      )
        return false;

      // Skip amounts that look like years (1900-2099)
      if (amount >= 1900 && amount <= 2099 && Number.isInteger(amount))
        return false;

      // Skip if the number is likely a reference/ID (no decimal and very large)
      if (amount >= 10000 && Number.isInteger(amount) && !/[₱P]/.test(line))
        return false;

      return true;
    };

    // Function to check if a title is valid
    const isValidTitle = (title: string): boolean => {
      if (!title || title.length < 2) return false;

      // Skip if title is just numbers
      if (/^\d+$/.test(title)) return false;

      // Skip if title looks like a code/ID (mostly uppercase letters and numbers)
      if (/^[A-Z0-9\-]{5,}$/.test(title) && !/\s/.test(title)) return false;

      // Skip common non-item patterns
      const invalidTitles = [
        /^no\.?\s*\d/i,
        /^ref\.?\s*\d/i,
        /^trx\.?\s*\d/i,
        /^#\d+/,
        /^\d+\s*$/,
        /^[A-Z]{1,3}\d+$/i, // Like "A123", "AB456"
        /^pos\s/i,
        /^terminal/i,
        /^store\s*\d/i,
        /^branch\s*\d/i,
      ];

      if (invalidTitles.some((pattern) => pattern.test(title))) return false;

      return true;
    };

    // Enhanced pattern matching for different receipt formats
    for (const line of lines) {
      // Skip non-item lines
      if (shouldSkipLine(line)) {
        console.log("Skipping line:", line);
        continue;
      }

      let title = "";
      let amount = 0;
      let quantity = 1;
      let matched = false;

      // Pattern 1: "ITEM NAME - ₱100.00 x 2" or "ITEM - ₱100.00 x2"
      let itemMatch = line.match(
        /^(.+?)\s*[-–]\s*[₱P]?\s*([\d,]+\.?\d*)\s*[xX×]\s*(\d+)/,
      );
      if (itemMatch) {
        title = itemMatch[1].trim();
        amount = parseFloat(itemMatch[2].replace(/,/g, ""));
        quantity = parseInt(itemMatch[3]);
        matched = true;
      }

      // Pattern 2: "ITEM NAME ₱100.00 x 2" (no dash)
      if (!matched) {
        itemMatch = line.match(
          /^(.+?)\s+[₱P]\s*([\d,]+\.?\d*)\s*[xX×]\s*(\d+)/,
        );
        if (itemMatch) {
          title = itemMatch[1].trim();
          amount = parseFloat(itemMatch[2].replace(/,/g, ""));
          quantity = parseInt(itemMatch[3]);
          matched = true;
        }
      }

      // Pattern 3: "2x ITEM NAME ₱100.00" or "2 x ITEM ₱100.00"
      if (!matched) {
        itemMatch = line.match(
          /^(\d+)\s*[xX×]\s*(.+?)\s+[₱P]?\s*([\d,]+\.?\d*)$/,
        );
        if (itemMatch) {
          quantity = parseInt(itemMatch[1]);
          title = itemMatch[2].trim();
          amount = parseFloat(itemMatch[3].replace(/,/g, ""));
          matched = true;
        }
      }

      // Pattern 4: "ITEM NAME - ₱100.00" or "ITEM NAME ₱100.00" (no quantity)
      if (!matched) {
        itemMatch = line.match(/^(.+?)\s*[-–]?\s*[₱P]\s*([\d,]+\.?\d*)$/);
        if (itemMatch && itemMatch[1].length > 1) {
          title = itemMatch[1].trim();
          amount = parseFloat(itemMatch[2].replace(/,/g, ""));
          quantity = 1;
          matched = true;
        }
      }

      // Pattern 5: "₱100.00 ITEM NAME" (price first)
      if (!matched) {
        itemMatch = line.match(/^[₱P]\s*([\d,]+\.?\d*)\s+(.+)$/);
        if (itemMatch && itemMatch[2].length > 1) {
          amount = parseFloat(itemMatch[1].replace(/,/g, ""));
          title = itemMatch[2].trim();
          quantity = 1;
          matched = true;
        }
      }

      // Pattern 6: "ITEM NAME 100.00" (no peso sign, price at end)
      if (!matched) {
        itemMatch = line.match(/^([A-Za-z].+?)\s+([\d,]+\.?\d{2})$/);
        if (itemMatch && itemMatch[1].length > 2) {
          title = itemMatch[1].trim();
          amount = parseFloat(itemMatch[2].replace(/,/g, ""));
          quantity = 1;
          matched = true;
        }
      }

      // Pattern 7: "100.00 ITEM NAME" (price first, no peso sign)
      if (!matched) {
        itemMatch = line.match(/^([\d,]+\.?\d{2})\s+([A-Za-z].+)$/);
        if (itemMatch && itemMatch[2].length > 2) {
          amount = parseFloat(itemMatch[1].replace(/,/g, ""));
          title = itemMatch[2].trim();
          quantity = 1;
          matched = true;
        }
      }

      // Pattern 8: "ITEM    100.00" (item and price separated by spaces/tabs)
      if (!matched) {
        itemMatch = line.match(/^([A-Za-z][A-Za-z\s]+?)\s{2,}([\d,]+\.?\d*)$/);
        if (
          itemMatch &&
          itemMatch[1].length > 2 &&
          parseFloat(itemMatch[2]) > 0
        ) {
          title = itemMatch[1].trim();
          amount = parseFloat(itemMatch[2].replace(/,/g, ""));
          quantity = 1;
          matched = true;
        }
      }

      // Clean up the title and validate
      if (matched && title && amount > 0) {
        // Remove common prefixes/suffixes
        title = title
          .replace(/^[-*•·]\s*/, "") // Remove bullet points
          .replace(/^\d+\.\s*/, "") // Remove numbered list
          .replace(/\s*[-–]\s*$/, "") // Remove trailing dashes
          .replace(/\s+/g, " ") // Normalize whitespace
          .trim();

        // Remove quantity indicators from title
        title = title.replace(/\s*[xX×]\s*\d+\s*$/, "").trim();
        title = title.replace(/^\d+\s*[xX×]\s*/, "").trim();
        title = title
          .replace(/\s*\(\d+\s*(?:pcs?|pieces?|ea)\)\s*/i, "")
          .trim();

        // Validate both title and price using our helper functions
        if (isValidTitle(title) && isValidPrice(amount, line)) {
          const category = categorizeItem(title);
          const total = (amount * quantity).toFixed(2);

          console.log(
            `✓ Parsed item: ${title} | Amount: ${amount} | Qty: ${quantity} | Category: ${category}`,
          );

          newExpenses.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            category: category,
            title: title.charAt(0).toUpperCase() + title.slice(1).toLowerCase(),
            amount: amount.toFixed(2),
            quantity: quantity.toString(),
            total: total,
          });
        } else {
          console.log(
            `✗ Rejected: "${title}" with amount ${amount} (invalid title or price)`,
          );
        }
      }
    }

    console.log("Total parsed expenses:", newExpenses.length);
    console.log("Parsed expenses:", JSON.stringify(newExpenses, null, 2));

    if (newExpenses.length > 0) {
      setExpenses(newExpenses);
      Alert.alert(
        "Receipt Processed",
        `Found ${newExpenses.length} item(s). Please review and adjust as needed.`,
        [{ text: "OK" }],
      );
    } else {
      Alert.alert(
        "No Items Found",
        "Could not automatically extract items from the receipt. Please add them manually.",
        [{ text: "OK" }],
      );
    }
  };

  const closeOCRView = () => {
    setShowCamera(false);
    setShowCameraView(false);
    setCapturedImage(null);
    setOcrText("");
  };

  const retakePhoto = () => {
    setShowScanAnimation(false);
    setScanComplete(false);
    setScanError(false);
    setShowCamera(false);
    setCapturedImage(null);
    setOcrText("");
    setShowCameraView(true);
  };

  const viewItems = () => {
    setShowScanAnimation(false);
    setScanComplete(false);
    setScanError(false);
    closeOCRView();
  };

  const cancelScan = () => {
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Reset all scan-related states
    setIsProcessing(false);
    setShowScanAnimation(false);
    setScanComplete(false);
    setScanError(false);
    setShowCamera(false);
    setCapturedImage(null);
    setOcrText("");
  };

  const clearScan = () => {
    Alert.alert(
      "Clear Scan",
      "Are you sure you want to clear all scanned items and start over?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setExpenses([
              {
                id: "1",
                category: "",
                title: "",
                amount: "",
                quantity: "",
                total: "0.00",
              },
            ]);
            setCapturedImage(null);
            setOcrText("");
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryBlue}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={COLORS.white} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Expense</Text>
        <TouchableOpacity style={styles.headerButton}>
          <HelpTooltip
            title="Add Expense Help"
            content="Add business expenses manually or scan receipts with your camera. The OCR scanner will automatically extract item details. You can add multiple items, edit quantities and prices, then save all at once."
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Date Display */}
        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>Date</Text>
          <Text style={styles.dateValue}>{getCurrentDate()}</Text>
        </View>

        {/* Scrollable Expense Items */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {expenses.map((item, index) => (
            <View key={item.id} style={styles.expenseCard}>
              {/* Remove Button */}
              {expenses.length > 1 && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeExpenseItem(item.id)}
                >
                  <X color={COLORS.textGray} size={20} />
                </TouchableOpacity>
              )}

              {/* Category Dropdown */}
              <Text style={styles.inputLabel}>Category</Text>
              <TouchableOpacity
                style={styles.dropdownInput}
                onPress={() => openCategoryPicker(item.id)}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !item.category && styles.placeholderText,
                  ]}
                >
                  {item.category || "Select Category"}
                </Text>
                <ChevronDown color={COLORS.textGray} size={20} />
              </TouchableOpacity>

              {/* Expense Title */}
              <Text style={styles.inputLabel}>Expense Title</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter expense title"
                placeholderTextColor={COLORS.textGray}
                value={item.title}
                onChangeText={(value) =>
                  updateExpenseItem(item.id, "title", value)
                }
              />

              {/* Amount and Quantity Row */}
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Amount</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textGray}
                    keyboardType="decimal-pad"
                    value={item.amount}
                    onChangeText={(value) =>
                      updateExpenseItem(item.id, "amount", value)
                    }
                  />
                </View>

                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Quantity</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    placeholderTextColor={COLORS.textGray}
                    keyboardType="number-pad"
                    value={item.quantity}
                    onChangeText={(value) =>
                      updateExpenseItem(item.id, "quantity", value)
                    }
                  />
                </View>
              </View>

              {/* Total Display */}
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₱{item.total}</Text>
              </View>
            </View>
          ))}

          {/* Add More Button */}
          <TouchableOpacity
            style={styles.addMoreButton}
            onPress={addExpenseItem}
          >
            <Plus color={COLORS.primaryBlue} size={20} />
            <Text style={styles.addMoreText}>Add Another Item</Text>
          </TouchableOpacity>

          {/* Action Buttons inside ScrollView */}
          <TouchableOpacity
            style={[styles.saveButton, { opacity: isSaving ? 0.6 : 1 }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save Expense</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cameraButton}
            onPress={handleOpenCamera}
          >
            <Camera color={COLORS.white} size={24} />
            <Text style={styles.cameraButtonText}>Scan Receipt</Text>
          </TouchableOpacity>

          {/* Clear Scan Button */}
          {(capturedImage ||
            ocrText ||
            expenses.length > 1 ||
            expenses[0].title) && (
            <TouchableOpacity style={styles.clearButton} onPress={clearScan}>
              <Trash2 color={COLORS.textDark} size={20} />
              <Text style={styles.clearButtonText}>Clear Scan</Text>
            </TouchableOpacity>
          )}

          {/* Bottom Spacing for tab bar */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>

      {/* Native Camera View Modal */}
      <Modal
        visible={showCameraView}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCameraView(false)}
      >
        <View style={styles.container}>
          <CameraView
            ref={cameraRef}
            style={styles.cameraView}
            facing="back"
            flash={flashMode}
          >
            {/* Camera Overlay with Frame Guide */}
            <View style={styles.cameraOverlay}>
              {/* Header */}
              <View style={styles.cameraHeader}>
                <TouchableOpacity
                  onPress={() => setShowCameraView(false)}
                  style={styles.closeButton}
                >
                  <X color={COLORS.white} size={24} />
                </TouchableOpacity>
                <Text style={styles.cameraTitle}>Scan Receipt</Text>
                <TouchableOpacity
                  onPress={toggleFlash}
                  style={styles.closeButton}
                >
                  {flashMode === "on" ? (
                    <Zap color={COLORS.white} size={24} fill={COLORS.white} />
                  ) : (
                    <ZapOff color={COLORS.white} size={24} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Frame Guide */}
              <View style={styles.cameraFrameContainer}>
                <Text style={styles.cameraInstructionText}>
                  Position receipt within frame
                </Text>
                <View style={styles.cameraFrame}>
                  {/* Corner guides */}
                  <View style={styles.frameCornerTL} />
                  <View style={styles.frameCornerTR} />
                  <View style={styles.frameCornerBL} />
                  <View style={styles.frameCornerBR} />
                </View>
              </View>

              {/* Capture Button */}
              <View style={styles.cameraControls}>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={takePicture}
                >
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.categoryPickerContainer}>
            <View style={styles.categoryPickerHeader}>
              <Text style={styles.categoryPickerTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <X color={COLORS.textDark} size={24} />
              </TouchableOpacity>
            </View>

            {/* Custom Category Input */}
            <View style={styles.customCategoryContainer}>
              <Text style={styles.customCategoryLabel}>Or type your own:</Text>
              <View style={styles.customInputRow}>
                <TextInput
                  style={styles.customCategoryInput}
                  placeholder="Enter custom category"
                  placeholderTextColor={COLORS.textGray}
                  value={customCategory}
                  onChangeText={setCustomCategory}
                  onSubmitEditing={selectCustomCategory}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[
                    styles.customCategoryButton,
                    !customCategory.trim() &&
                      styles.customCategoryButtonDisabled,
                  ]}
                  onPress={selectCustomCategory}
                  disabled={!customCategory.trim()}
                >
                  <Text style={styles.customCategoryButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.categoryDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or choose from list</Text>
              <View style={styles.dividerLine} />
            </View>

            <ScrollView style={styles.categoryList}>
              {EXPENSE_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryItem}
                  onPress={() => selectCategory(category)}
                >
                  <Text style={styles.categoryItemText}>{category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* OCR Camera Modal */}
      <Modal
        visible={showCamera}
        animationType="slide"
        transparent={false}
        onRequestClose={closeOCRView}
      >
        <View style={styles.modalContainer}>
          <StatusBar
            barStyle="light-content"
            backgroundColor={COLORS.primaryBlue}
          />

          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeOCRView} style={styles.closeButton}>
              <X color={COLORS.white} size={24} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Receipt Scanner</Text>
            <View style={styles.closeButton} />
          </View>

          {/* Image Preview with Square Guide */}
          {capturedImage && (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: capturedImage }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              {/* Square Guide Overlay */}
              <View style={styles.scanGuideOverlay}>
                <View style={styles.scanGuideCornerTL} />
                <View style={styles.scanGuideCornerTR} />
                <View style={styles.scanGuideCornerBL} />
                <View style={styles.scanGuideCornerBR} />
              </View>
              <Text style={styles.scanGuideText}>
                Cropped area will be processed
              </Text>
            </View>
          )}

          {/* OCR Text Display */}
          <View style={styles.ocrContainer}>
            <Text style={styles.ocrLabel}>Extracted Text:</Text>

            {isProcessing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={COLORS.primaryBlue} />
                <Text style={styles.processingText}>Processing receipt...</Text>
              </View>
            ) : (
              <ScrollView style={styles.ocrScrollView}>
                <Text style={styles.ocrText}>
                  {ocrText || "No text extracted yet"}
                </Text>
              </ScrollView>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={handleOpenCamera}
              disabled={isProcessing}
            >
              <Camera color={COLORS.primaryBlue} size={20} />
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>
            {capturedImage && !isProcessing && (
              <TouchableOpacity
                style={styles.reprocessButton}
                onPress={() => processImageWithOCR(capturedImage)}
              >
                <Text style={styles.reprocessButtonText}>Re-process</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={closeOCRView}
              disabled={isProcessing}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Scanning Animation Modal */}
      <Modal
        visible={showScanAnimation}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.animationModalOverlay}>
          <View style={styles.animationContainer}>
            <LottieView
              ref={lottieRef}
              source={
                scanError
                  ? require("../../assets/animations/Error Occurred!.json")
                  : scanComplete
                    ? require("../../assets/animations/Check Animation.json")
                    : require("../../assets/animations/Document OCR Scan.json")
              }
              autoPlay
              loop={!scanComplete && !scanError}
              style={styles.lottieAnimation}
            />
            <Text style={styles.animationText}>
              {scanError
                ? "OCR Failed"
                : scanComplete
                  ? "Receipt Processed!"
                  : "Scanning Receipt..."}
            </Text>
            {scanError && (
              <Text style={styles.animationSubText}>
                Could not process the image.{"\n"}Please try again with a
                clearer photo.
              </Text>
            )}
            {scanComplete && (
              <Text style={styles.animationSubText}>
                Items detected successfully.{"\n"}Review and adjust as needed.
              </Text>
            )}

            {/* Show cancel button while processing */}
            {!scanError && !scanComplete && isProcessing && (
              <TouchableOpacity
                style={[styles.animationButton, styles.cancelButton]}
                onPress={cancelScan}
              >
                <Text style={styles.animationButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}

            {/* Show button when animation completes (error or success) */}
            {scanError && (
              <TouchableOpacity
                style={styles.animationButton}
                onPress={retakePhoto}
              >
                <Text style={styles.animationButtonText}>Retake Photo</Text>
              </TouchableOpacity>
            )}
            {scanComplete && (
              <TouchableOpacity
                style={styles.animationButton}
                onPress={viewItems}
              >
                <Text style={styles.animationButtonText}>View Items</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryBlue,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: COLORS.primaryBlue,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
  },
  headerButton: {
    padding: 5,
    width: 34,
  },
  helpCircleBg: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },

  // Content
  contentContainer: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },

  // Date
  dateContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  dateValue: {
    fontSize: 14,
    color: COLORS.textGray,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // Expense Card
  expenseCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    position: "relative",
  },
  removeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 5,
  },

  // Inputs
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: COLORS.lightBlueBg,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textDark,
  },
  dropdownInput: {
    backgroundColor: COLORS.lightBlueBg,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownText: {
    fontSize: 14,
    color: COLORS.textGray,
  },

  // Row
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
  },
  halfInput: {
    flex: 1,
  },

  // Total
  totalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightBlueBg,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primaryBlue,
  },

  // Add More Button
  addMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primaryBlue,
    borderStyle: "dashed",
    marginBottom: 15,
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryBlue,
    marginLeft: 8,
  },

  // Action Buttons
  saveButton: {
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 15,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  cameraButton: {
    backgroundColor: "#6ea2d5",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
  },
  cameraButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  clearButton: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  clearButtonText: {
    color: COLORS.textDark,
    fontSize: 16,
    fontWeight: "600",
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.primaryBlue,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: COLORS.primaryBlue,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
  },
  closeButton: {
    padding: 5,
    width: 34,
  },

  // Image Preview
  imagePreviewContainer: {
    backgroundColor: COLORS.white,
    margin: 20,
    borderRadius: 16,
    overflow: "hidden",
    height: 300,
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  scanGuideOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  scanGuideCornerTL: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.primaryBlue,
  },
  scanGuideCornerTR: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.primaryBlue,
  },
  scanGuideCornerBL: {
    position: "absolute",
    bottom: 40,
    left: 20,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.primaryBlue,
  },
  scanGuideCornerBR: {
    position: "absolute",
    bottom: 40,
    right: 20,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.primaryBlue,
  },
  scanGuideText: {
    position: "absolute",
    bottom: 10,
    color: COLORS.primaryBlue,
    fontSize: 12,
    fontWeight: "600",
  },

  // OCR Container
  ocrContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
  },
  ocrLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 12,
  },
  ocrScrollView: {
    flex: 1,
  },
  ocrText: {
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  processingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 15,
  },
  processingText: {
    fontSize: 14,
    color: COLORS.textGray,
  },

  // Modal Actions
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: COLORS.primaryBlue,
  },
  retakeButtonText: {
    color: COLORS.primaryBlue,
    fontSize: 16,
    fontWeight: "600",
  },
  reprocessButton: {
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  reprocessButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
  acceptButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButtonText: {
    color: COLORS.primaryBlue,
    fontSize: 16,
    fontWeight: "700",
  },

  // Camera View Styles
  cameraView: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
  },
  cameraFrameContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraInstructionText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
    marginBottom: 30,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cameraFrame: {
    width: 300,
    height: 400,
    position: "relative",
  },
  frameCornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: COLORS.white,
  },
  frameCornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: COLORS.white,
  },
  frameCornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: COLORS.white,
  },
  frameCornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: COLORS.white,
  },
  cameraControls: {
    paddingVertical: 40,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: COLORS.primaryBlue,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryBlue,
  },
  animationModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  animationContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    width: 300,
  },
  lottieAnimation: {
    width: 200,
    height: 200,
  },
  animationText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textDark,
    textAlign: "center",
  },
  animationSubText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textGray,
    textAlign: "center",
    lineHeight: 20,
  },
  animationButton: {
    marginTop: 20,
    backgroundColor: COLORS.primaryBlue,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 200,
  },
  cancelButton: {
    backgroundColor: COLORS.textGray,
  },
  animationButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  // Category Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  categoryPickerContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  categoryPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  categoryPickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  categoryList: {
    maxHeight: 400,
  },
  categoryItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  categoryItemText: {
    fontSize: 16,
    color: COLORS.textDark,
  },
  placeholderText: {
    color: COLORS.textGray,
  },
  customCategoryContainer: {
    padding: 20,
    paddingBottom: 0,
  },
  customCategoryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 10,
  },
  customInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  customCategoryInput: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  customCategoryButton: {
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  customCategoryButtonDisabled: {
    backgroundColor: COLORS.textGray,
    opacity: 0.5,
  },
  customCategoryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  categoryDivider: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: COLORS.textGray,
    textTransform: "uppercase",
  },
});
