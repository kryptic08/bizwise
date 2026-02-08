import { useMutation } from "convex/react";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  HelpCircle,
  Plus,
  X,
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
import {
  mapReceiptToExpenseItems,
  processReceiptWithAPI,
} from "../utils/receiptAPI";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#9ca3af",
};

// OCR.space API configuration
const OCR_API_URL = "https://api.ocr.space/parse/image";
const OCR_API_KEY = process.env.EXPO_PUBLIC_OCR_API_KEY!;

// Gemini AI API configuration for NLP parsing
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY!;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

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

  // Convex mutation for adding expenses (grouped)
  const addExpenseGroup = useMutation(api.expenses.addExpenseGroup);

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
              // Save all expenses as a single grouped transaction
              const items = validExpenses.map((expense) => ({
                category: expense.category || "General",
                title: expense.title,
                amount: parseFloat(expense.amount),
                quantity: parseInt(expense.quantity) || 1,
              }));

              await addExpenseGroup({
                items,
                receiptImage: capturedImage || undefined,
                ocrText: ocrText || undefined,
                userId: user?.userId,
                clientTimestamp: Date.now(), // Pass device timestamp
              });

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
      console.log("Compressed image URI:", compressedImage.uri);

      // ── PRIMARY: BizWise Receipt API (self-hosted on Render) ──
      try {
        console.log("🚀 Trying BizWise Receipt API (primary)...");
        const apiResult = await processReceiptWithAPI(compressedImage.uri);

        if (apiResult.success && apiResult.data) {
          console.log("✅ BizWise API succeeded");
          setOcrText(apiResult.data.raw_text || "");

          const mapped = mapReceiptToExpenseItems(apiResult.data);
          if (mapped.length > 0) {
            setExpenses(mapped);
            setTimeout(() => closeOCRView(), 500);
            Alert.alert(
              "Receipt Processed",
              `Found ${mapped.length} item(s) (confidence: ${(apiResult.data.confidence_score * 100).toFixed(0)}%). Review and adjust below.`,
              [{ text: "OK" }],
            );
            return; // Done – skip fallback
          }
          // API returned no items – fall through to backup
          console.log("⚠️ BizWise API returned 0 items, trying backup...");
        }
      } catch (primaryError) {
        const errMsg = (primaryError as Error).message || String(primaryError);
        console.warn("⚠️ BizWise API failed:", errMsg);
        console.log("↪ Falling back to OCR.space + Gemini backup…");
      }

      // ── BACKUP: OCR.space → Gemini AI ──
      console.log("🔄 Using backup: OCR.space + Gemini AI...");
      const base64Image = await FileSystem.readAsStringAsync(
        compressedImage.uri,
        { encoding: "base64" },
      );

      const formData = new FormData();
      formData.append("apikey", OCR_API_KEY);
      formData.append("base64Image", `data:image/jpeg;base64,${base64Image}`);
      formData.append("language", "eng");
      formData.append("isOverlayRequired", "false");
      formData.append("detectOrientation", "true");
      formData.append("scale", "true");
      formData.append("OCREngine", "2");

      const response = await fetch(OCR_API_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OCR.space API error: ${response.status} - ${errorText}`,
        );
      }

      const result = await response.json();
      let extractedText = "";
      if (
        result.ParsedResults &&
        result.ParsedResults[0] &&
        result.ParsedResults[0].ParsedText
      ) {
        extractedText = result.ParsedResults[0].ParsedText;
      } else if (result.ErrorMessage && result.ErrorMessage.length > 0) {
        throw new Error(`OCR.space error: ${result.ErrorMessage[0]}`);
      } else if (result.IsErroredOnProcessing) {
        throw new Error("OCR.space processing error");
      } else {
        throw new Error("No text found in the image");
      }

      setOcrText(extractedText);
      await parseReceiptWithAI(extractedText);
    } catch (error) {
      console.error("All OCR methods failed:", (error as Error).message);

      // Last resort – demo/mock data
      const mockText = await simulateAdvancedOCR();
      setOcrText(mockText);
      await parseReceiptWithAI(mockText);

      Alert.alert(
        "OCR Notice",
        "Using demo mode. Error: " + (error as Error).message,
        [{ text: "OK" }],
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Parse receipt text using Gemini AI for intelligent NLP
  const parseReceiptWithAI = async (text: string) => {
    console.log("Parsing receipt with Gemini AI...");

    try {
      const prompt = `You are an expert at parsing receipt text. Analyze the following receipt text and extract all purchased items.

For each item found, provide:
1. title: The name of the item (clean it up, capitalize properly)
2. amount: The unit price (number only, no currency symbol)
3. quantity: How many were purchased (default to 1 if not specified)
4. category: One of these categories: Food, Office, Transportation, Utilities, Maintenance, Marketing, Medical, Equipment, General

IMPORTANT RULES:
- Only extract actual purchased items, NOT totals, subtotals, change, tax, VAT, discounts
- Skip store names, addresses, dates, times, receipt numbers, cashier names
- If you see "x2" or "x 3" or "qty: 2", that's the quantity
- The amount should be the UNIT price, not the line total
- If unsure about category, use "General"
- Return ONLY valid JSON array, no other text

Receipt text:
"""
${text}
"""

Return a JSON array like this (no markdown, just raw JSON):
[{"title": "Item Name", "amount": 100.00, "quantity": 1, "category": "Food"}]

If no items found, return: []`;

      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      });

      console.log("Gemini API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("Gemini API error:", errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const result = await response.json();
      console.log("Gemini API result:", JSON.stringify(result, null, 2));

      // Extract the text content from Gemini response
      const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiResponse) {
        throw new Error("No response from Gemini AI");
      }

      console.log("AI Response:", aiResponse);

      // Parse the JSON from AI response
      // Clean up the response - remove markdown code blocks if present
      let cleanedResponse = aiResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      // Find the JSON array in the response
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("Could not find JSON array in AI response");
      }

      const parsedItems = JSON.parse(jsonMatch[0]);
      console.log("Parsed items from AI:", parsedItems);

      if (Array.isArray(parsedItems) && parsedItems.length > 0) {
        const newExpenses: ExpenseItem[] = parsedItems.map((item: any) => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          category: item.category || "General",
          title: item.title || "Unknown Item",
          amount: parseFloat(item.amount || 0).toFixed(2),
          quantity: (item.quantity || 1).toString(),
          total: (parseFloat(item.amount || 0) * (item.quantity || 1)).toFixed(
            2,
          ),
        }));

        setExpenses(newExpenses);

        // Auto-close the modal after successful processing
        setTimeout(() => {
          closeOCRView();
        }, 500);

        Alert.alert(
          "Receipt Processed",
          `Found ${newExpenses.length} item(s). Review and adjust the details below.`,
          [{ text: "OK" }],
        );
      } else {
        // Fallback to regex parsing if AI returns empty
        console.log("AI returned no items, falling back to regex parsing...");
        parseReceiptText(text);
      }
    } catch (error) {
      console.error("Gemini AI parsing error:", error);
      console.log("Falling back to regex parsing...");
      // Fallback to traditional regex parsing
      parseReceiptText(text);
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
          <View style={styles.helpCircleBg}>
            <HelpCircle color={COLORS.primaryBlue} size={18} />
          </View>
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
              <TouchableOpacity style={styles.dropdownInput}>
                <Text style={styles.dropdownText}>
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
          <CameraView ref={cameraRef} style={styles.cameraView} facing="back">
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
                <View style={styles.closeButton} />
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
});
