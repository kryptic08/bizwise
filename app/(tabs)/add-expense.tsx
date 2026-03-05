import { HelpTooltip } from "@/components/HelpTooltip";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import {
  ArrowLeft,
  Calendar,
  Camera,
  ChevronDown,
  Lock,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SyncBadge } from "../components/SyncBadge";
import { useAuth } from "../context/AuthContext";
import { useMutationQueue } from "../providers/MutationQueueProvider";
import { useOffline } from "../providers/OfflineProvider";
import {
  categorizeItemForBusiness,
  getBusinessTypePromptContext,
  getCategoriesForBusinessType,
} from "../utils/categorizationEngine";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#9ca3af",
};

// EXPENSE_CATEGORIES is now derived dynamically per business type (see getCategoriesForBusinessType).

// Google Gemini Vision API - round-robin across models and API keys
const GEMINI_API_KEYS = [
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_1!,
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_2!,
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_3!,
];
let geminiApiKeyIndex = 0; // Round-robin counter for API keys

const GOOGLE_AI_MODELS = [
  "gemini-3-pro-preview",
  "gemini-2.5-pro",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
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
  /** True when the item was populated by OCR / AI scan. Fields are read-only. */
  isOcrSource?: boolean;
}

export default function AddExpenseScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const { createExpense } = useMutationQueue();

  // Dynamic categories based on the signed-in user's business type
  const expenseCategories = getCategoriesForBusinessType(user?.businessType);

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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showScanAnimation, setShowScanAnimation] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanError, setScanError] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState("");
  const [processingMessage, setProcessingMessage] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Date state - default to today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const lottieRef = useRef<LottieView>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const EXPENSE_CACHE_KEY = "bizwise_expense_cache";

  useEffect(() => {
    const loadSavedExpenses = async () => {
      try {
        const savedData = await AsyncStorage.getItem(EXPENSE_CACHE_KEY);
        if (savedData) {
          const parsed = JSON.parse(savedData);
          if (parsed.expenses && parsed.expenses.length > 0) {
            setExpenses(parsed.expenses);
          }
          if (parsed.selectedDate) {
            setSelectedDate(new Date(parsed.selectedDate));
          }
        }
      } catch (error) {
        console.error("Error loading saved expenses:", error);
      }
    };
    loadSavedExpenses();
  }, []);

  useEffect(() => {
    const saveExpenses = async () => {
      try {
        await AsyncStorage.setItem(
          EXPENSE_CACHE_KEY,
          JSON.stringify({
            expenses,
            selectedDate: selectedDate.toISOString(),
          }),
        );
      } catch (error) {
        console.error("Error saving expenses:", error);
      }
    };
    saveExpenses();
  }, [expenses, selectedDate]);

  const clearSavedExpenses = async () => {
    try {
      await AsyncStorage.removeItem(EXPENSE_CACHE_KEY);
    } catch (error) {
      console.error("Error clearing saved expenses:", error);
    }
  };

  const getCurrentDate = () => {
    return selectedDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Cycling processing messages
  const PROCESSING_MESSAGES = [
    "Sending image to be processed...",
    "Please wait a moment...",
    "Please don't cancel, it will waste resources...",
    "Please be patient...",
    "The server is taking a bit longer...",
    "Almost there...",
  ];

  useEffect(() => {
    let messageIndex = 0;
    let interval: ReturnType<typeof setInterval>;

    if (isProcessing && showScanAnimation) {
      setProcessingMessage(PROCESSING_MESSAGES[0]);
      interval = setInterval(() => {
        messageIndex = (messageIndex + 1) % PROCESSING_MESSAGES.length;
        setProcessingMessage(PROCESSING_MESSAGES[messageIndex]);
      }, 4000); // Change message every 4 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, showScanAnimation]);

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
          // Prevent editing locked OCR fields (category, amount, quantity)
          if (
            item.isOcrSource &&
            (field === "category" || field === "amount" || field === "quantity")
          ) {
            return item;
          }

          const updated = { ...item, [field]: value };

          // Calculate total if amount or quantity changes
          if (field === "amount" || field === "quantity") {
            const amount =
              parseFloat(field === "amount" ? value : item.amount) || 0;
            const quantity =
              parseFloat(field === "quantity" ? value : item.quantity) || 0;
            updated.total = (amount * quantity).toFixed(2);
          }

          // Auto-categorize when the title changes
          if (field === "title") {
            const trimmed = value.trim();
            if (trimmed.length >= 3) {
              updated.category = categorizeItemForBusiness(
                trimmed,
                user?.businessType,
              );
            }
          }

          return updated;
        }
        return item;
      }),
    );
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

              if (!isOnline) {
                Alert.alert(
                  "Offline",
                  "You need an internet connection to save expenses. Please try again when you're back online.",
                  [{ text: "OK" }],
                );
                setIsSaving(false);
                return;
              }

              // Create expense online - use local date in YYYY-MM-DD format
              const expenseDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
              const result = await createExpense({
                items,
                userId: user?.userId || "",
                clientTimestamp: Date.now(),
                expenseDate: expenseDateStr,
              });

              const tempId = result.transactionId;

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
              setScanComplete(false);
              setScanError(false);
              clearSavedExpenses();

              // Show appropriate message based on online status
              if (isOnline) {
                Alert.alert(
                  "Success",
                  `Expenses saved successfully!\nTransaction ID: ${tempId}`,
                  [{ text: "OK", onPress: () => router.back() }],
                );
              } else {
                Alert.alert(
                  "Saved Offline",
                  `Transaction ID: ${tempId}\n\nExpenses saved locally and will sync when you're back online.`,
                  [{ text: "OK", onPress: () => router.back() }],
                );
              }
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

  // Simplified: Take photo with native crop UI
  const handleOpenCamera = async () => {
    try {
      // Request camera permission
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Camera permission is needed to take photos.",
        );
        return;
      }

      // Launch camera with built-in crop tool
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // Enables native crop UI
        quality: 0.8,
        aspect: undefined, // Free-form cropping
      });

      if (!result.canceled && result.assets[0]) {
        // User has taken and cropped the photo
        await processWithImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error taking picture:", error);
      Alert.alert("Error", "Failed to take picture. Please try again.");
    }
  };

  // Process with automatic resize
  const processWithImage = async (imageUri: string) => {
    try {
      // Resize for optimal processing
      const processedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );

      setCapturedImage(processedImage.uri);
      setShowScanAnimation(true);
      await processImageDirectly(processedImage.uri);
    } catch (error) {
      console.error("Error processing image:", error);
      Alert.alert("Error", "Failed to process image. Please try again.");
    }
  };

  // Process image directly without auto-cropping
  const processImageDirectly = async (imageUri: string) => {
    setIsProcessing(true);

    try {
      // Process with Gemini Vision API
      await processImageWithGeminiVision(imageUri);
    } catch (error) {
      console.error("Processing error:", error);
      Alert.alert("Error", "Failed to process image. Please try again.");
      setScanError(true);
      setIsProcessing(false);
      setShowScanAnimation(false);
    }
  };

  // Process image directly with Gemini Vision API (no OCR needed)
  const processImageWithGeminiVision = async (imageUri: string) => {
    setIsProcessing(true);
    setShowScanAnimation(true);
    setScanComplete(false);
    setScanError(false);

    // Create abort controller for canceling requests
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      console.log("Processing image with Gemini Vision API...");

      // Convert to base64 for Gemini API
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: "base64",
      });

      console.log(
        `Image size: ~${Math.round((base64Image.length * 3) / 4 / 1024)} KB`,
      );

      // Parse receipt with Gemini Vision AI
      await parseReceiptWithGeminiVision(base64Image, signal);
    } catch (error) {
      // Check if error is from abort
      if ((error as Error).name === "AbortError") {
        console.log("Processing was cancelled by user");
        return;
      }

      console.error("Gemini Vision Error:", (error as Error).message);
      setScanError(true);
      setIsProcessing(false);
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  // ══════════════════════════════════════════════════════════
  // NOTE: Simple regex parser removed — AI models handle parsing
  // ══════════════════════════════════════════════════════════

  // Receipt parsing prompt (shared between Gemini and OpenRouter)
  const getReceiptPrompt = (text: string) => {
    const businessContext = getBusinessTypePromptContext(user?.businessType);
    return `You are an expert at parsing receipt text from the Philippines. Extract ONLY items that are clearly visible in the receipt.

IMPORTANT: DO NOT MAKE UP, INVENT, OR HALLUCINATE ANY ITEMS. Only extract what you actually see in the text.

${businessContext}

For each item found, provide:
1. title: The name of the item (clean it up, capitalize properly)
2. amount: The unit price (number only, no currency symbol)
3. quantity: How many were purchased (default to 1 if not specified)
4. category: One of the available categories listed above for this business type

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
[{"title": "Chicken Breast", "amount": 150, "quantity": 1, "category": "Raw Materials"}, {"title": "Rice", "amount": 25, "quantity": 2, "category": "Raw Materials"}]

If no items found or text is unclear, return: []`;
  };

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

  // Parse receipt image directly with Gemini Vision API (no OCR step)
  const parseReceiptWithGeminiVision = async (
    base64Image: string,
    signal?: AbortSignal,
  ) => {
    console.log("Parsing receipt with Gemini Vision...");

    // Vision-optimized prompt — inject business type context
    const businessContext = getBusinessTypePromptContext(user?.businessType);
    const visionPrompt = `You are an expert at analyzing receipt images from the Philippines. Look at this receipt image and extract ALL items that are visible.

IMPORTANT: DO NOT MAKE UP, INVENT, OR HALLUCINATE ANY ITEMS. Only extract what you can actually see in the image.

${businessContext}

For each item found, provide:
1. title: The name of the item (clean it up, capitalize properly)
2. amount: The unit price (number only, no currency symbol)
3. quantity: How many were purchased (default to 1 if not specified)
4. category: One of the available categories listed above for this business type

MERGE DUPLICATE ITEMS:
- If you see the SAME product name multiple times on the receipt (same item appearing on different lines), DO NOT create multiple separate items
- Instead, combine them into ONE item with the total quantity
- Example: If you see "Rice - ₱25" and "Rice - ₱25" on separate lines, return ONE item: {"title": "Rice", "amount": 25, "quantity": 2, "category": "Raw Materials"}
- Example: If you see "Chicken x2 - ₱150" and "Chicken x1 - ₱150", return ONE item: {"title": "Chicken", "amount": 150, "quantity": 3, "category": "Raw Materials"}
- Only merge items that have the EXACT same name and unit price

CRITICAL RULES FOR PHILIPPINE RECEIPTS:
- Many receipts are HANDWRITTEN and may not have PHP/₱ symbols
- Amounts like "2345" or "1500" are Philippine pesos (don't divide by 100, use as-is)
- Common price patterns: "2345" = ₱2,345.00, "150" = ₱150.00, "15.50" = ₱15.50
- If amount has no decimal point and is 2+ digits, treat it as whole pesos
- ONLY extract actual purchased items, NOT totals, subtotals, change, tax, VAT, discounts
- Skip store names, addresses, dates, times, receipt numbers, cashier names
- If you see "x2" or "x 3" or "qty: 2", that's the quantity
- The amount should be the UNIT price, not the line total
- If unsure about category, use the last category in the available list (usually "General")
- If you cannot clearly identify items, return empty array []
- DO NOT include items that look like: TOTAL, SUBTOTAL, CHANGE, CASH, PAYMENT, TAX, VAT, DISCOUNT
- Return ONLY valid JSON array, no markdown code blocks, no explanations, no other text

Return ONLY a JSON array (raw JSON, no code blocks, no markdown):
[{"title": "Chicken Breast", "amount": 150, "quantity": 1, "category": "Raw Materials"}, {"title": "Rice", "amount": 25, "quantity": 2, "category": "Raw Materials"}]

If no items found or image is unclear, return: []`;

    let items: any[] | null = null;

    // Rotate through ALL Google AI Vision models
    const startIndex = googleModelIndex;
    for (let i = 0; i < GOOGLE_AI_MODELS.length; i++) {
      const idx = (startIndex + i) % GOOGLE_AI_MODELS.length;
      const model = GOOGLE_AI_MODELS[idx];

      // Get current API key and rotate
      const currentApiKey = GEMINI_API_KEYS[geminiApiKeyIndex];
      const keyNumber = geminiApiKeyIndex + 1;
      geminiApiKeyIndex = (geminiApiKeyIndex + 1) % GEMINI_API_KEYS.length;

      try {
        console.log(
          `🔄 Trying Gemini Vision: ${model} (model ${idx + 1}/${GOOGLE_AI_MODELS.length}, key #${keyNumber})...`,
        );

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: visionPrompt },
                    {
                      inline_data: {
                        mime_type: "image/jpeg",
                        data: base64Image,
                      },
                    },
                  ],
                },
              ],
              generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
            }),
            signal: signal,
          },
        );

        if (!response.ok) {
          throw new Error(`${model} error: ${response.status}`);
        }

        const result = await response.json();
        const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
        items = extractItemsFromAIResponse(aiText);

        if (items && items.length > 0) {
          console.log(`✅ ${model} parsed ${items.length} items from image`);
          // Advance rotation to NEXT model for the next scan
          googleModelIndex = (idx + 1) % GOOGLE_AI_MODELS.length;
          break;
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        console.warn(`❌ ${model} failed:`, e);
      }
    }

    // Advance rotation even if all failed
    if (!items || items.length === 0) {
      googleModelIndex = (startIndex + 1) % GOOGLE_AI_MODELS.length;
    }

    // Process items if any AI succeeded
    if (items && items.length > 0) {
      const newExpenses: ExpenseItem[] = items.map((item: any) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        // Trust AI's category from Gemini - it has the business context from the prompt
        // Only use local categorization as fallback if AI didn't provide one
        category:
          item.category ||
          categorizeItemForBusiness(item.title || "", user?.businessType) ||
          "General",
        title: item.title || "Unknown Item",
        amount: parseFloat(item.amount || 0).toFixed(2),
        quantity: (item.quantity || 1).toString(),
        total: (parseFloat(item.amount || 0) * (item.quantity || 1)).toFixed(2),
        isOcrSource: true, // Lock fields – scanned data must not be edited
      }));

      setExpenses(newExpenses);
      setScanComplete(true);
    } else {
      console.log("All Gemini Vision models failed, showing error...");
      setScanError(true);
    }
  };

  // Fallback regex-based parsing (used when Gemini AI fails)
  const parseReceiptText = (text: string) => {
    console.log("Parsing receipt text with regex fallback:", text);

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const newExpenses: ExpenseItem[] = [];

    // Use the business-type-aware engine for fallback categorization
    const categorizeItem = (itemText: string): string =>
      categorizeItemForBusiness(itemText, user?.businessType);

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
            isOcrSource: true, // Lock fields – scanned data must not be edited
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

  const retakePhoto = () => {
    setShowScanAnimation(false);
    setScanComplete(false);
    setScanError(false);
    setCapturedImage(null);
    // Open camera again to take a new photo
    handleOpenCamera();
  };

  const viewItems = () => {
    setShowScanAnimation(false);
    setScanComplete(false);
    setScanError(false);
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
    setCapturedImage(null);
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
        <View style={styles.headerRight}>
          <SyncBadge compact />
          <TouchableOpacity style={styles.headerButton}>
            <HelpTooltip
              title="Add Expense Help"
              content="Add business expenses manually or scan receipts with your camera. The OCR scanner will automatically extract item details. You can add multiple items, edit quantities and prices, then save all at once.

                If an expense is scanned via OCR, fields may be locked to preserve data inetgrity. To make corrections, rescan the receipt or create a manual entry."
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Date Display */}
        <TouchableOpacity
          style={styles.dateContainer}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateLabel}>Date</Text>
          <View style={styles.dateValueRow}>
            <Text style={styles.dateValue}>{getCurrentDate()}</Text>
            <Calendar size={16} color={COLORS.primaryBlue} />
          </View>
        </TouchableOpacity>

        {/* Scrollable Expense Items */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {expenses.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.expenseCard,
                item.isOcrSource && styles.expenseCardOcr,
              ]}
            >
              {/* Remove Button */}
              {expenses.length > 1 && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeExpenseItem(item.id)}
                >
                  <X color={COLORS.textGray} size={20} />
                </TouchableOpacity>
              )}

              {/* Category Dropdown (locked for OCR items) */}
              <Text style={styles.inputLabel}>Category</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownInput,
                  item.isOcrSource && styles.lockedInput,
                ]}
                onPress={() => !item.isOcrSource && openCategoryPicker(item.id)}
                disabled={item.isOcrSource}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !item.category && styles.placeholderText,
                  ]}
                >
                  {item.category || "Select Category"}
                </Text>
                {!item.isOcrSource && (
                  <ChevronDown color={COLORS.textGray} size={20} />
                )}
                {item.isOcrSource && <Lock size={16} color={COLORS.textGray} />}
              </TouchableOpacity>

              {/* Expense Title */}
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Expense Title</Text>
                {!item.isOcrSource && item.category ? (
                  <Text style={styles.autoCategoryHint}>
                    Auto-categorized ↓
                  </Text>
                ) : null}
              </View>
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
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Amount</Text>
                    {item.isOcrSource && (
                      <Lock
                        size={12}
                        color={COLORS.textGray}
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </View>
                  <TextInput
                    style={[
                      styles.textInput,
                      item.isOcrSource && styles.lockedInput,
                    ]}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textGray}
                    keyboardType="decimal-pad"
                    value={item.amount}
                    editable={!item.isOcrSource}
                    onChangeText={(value) =>
                      updateExpenseItem(item.id, "amount", value)
                    }
                  />
                </View>

                <View style={styles.halfInput}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Quantity</Text>
                    {item.isOcrSource && (
                      <Lock
                        size={12}
                        color={COLORS.textGray}
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </View>
                  <TextInput
                    style={[
                      styles.textInput,
                      item.isOcrSource && styles.lockedInput,
                    ]}
                    placeholder="0"
                    placeholderTextColor={COLORS.textGray}
                    keyboardType="number-pad"
                    value={item.quantity}
                    editable={!item.isOcrSource}
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
          {(capturedImage || expenses.length > 1 || expenses[0].title) && (
            <TouchableOpacity style={styles.clearButton} onPress={clearScan}>
              <Trash2 color={COLORS.textDark} size={20} />
              <Text style={styles.clearButtonText}>Clear Scan</Text>
            </TouchableOpacity>
          )}

          {/* Bottom Spacing for tab bar */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>

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
              {expenseCategories.map((category) => (
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

      {/* Date Picker */}
      {showDatePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (event.type === "set" && date) setSelectedDate(date);
          }}
        />
      )}
      <Modal
        visible={showDatePicker && Platform.OS === "ios"}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <View
            style={styles.datePickerModalContent}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <X size={24} color={COLORS.textGray} />
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(_: DateTimePickerEvent, date?: Date) => {
                if (date) setSelectedDate(date);
              }}
              style={{ alignSelf: "center" }}
            />
            <TouchableOpacity
              style={styles.applyDateButton}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.applyDateButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
            {!scanError && !scanComplete && isProcessing && (
              <Text style={styles.animationSubText}>{processingMessage}</Text>
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  dateValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  // Date Picker Modal
  datePickerModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  datePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  dateNavButton: {
    padding: 10,
  },
  dateNavButtonText: {
    fontSize: 20,
    color: COLORS.primaryBlue,
    fontWeight: "700",
  },
  selectedDateText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  quickDateButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  quickDateButton: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  quickDateButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryBlue,
  },
  applyDateButton: {
    backgroundColor: COLORS.primaryBlue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  applyDateButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },

  // ── OCR-locked card styles ────────────────────────────────────────────────
  expenseCardOcr: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryBlue,
  },
  ocrBadgeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#eef4fb",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    gap: 6,
  },
  ocrBadgeText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.primaryBlue,
    lineHeight: 16,
  },
  lockedInput: {
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
  },

  // ── Label row (label + inline icon/hint) ─────────────────────────────────
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    // marginTop/Bottom intentionally omitted here; the inputLabel inside
    // the row already carries marginTop: 12 and marginBottom: 8 which
    // propagate through the flex layout correctly.
  },
  autoCategoryHint: {
    marginLeft: 6,
    fontSize: 10,
    color: COLORS.primaryBlue,
    fontWeight: "600",
  },
});
