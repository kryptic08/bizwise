import { HelpTooltip } from "@/components/HelpTooltip";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useMutation } from "convex/react";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import {
  ArrowLeft,
  Calendar,
  Camera,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../context/AuthContext";
import { useMutationQueue } from "../providers/MutationQueueProvider";
import { useOffline } from "../providers/OfflineProvider";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
  textLight: "#9ca3af",
  success: "#10b981",
  warning: "#f59e0b",
  border: "#d7e3f1",
};

const DEFAULT_EXPENSE_CATEGORY = "Store Supplies and Materials";

const RECEIPT_CATEGORIES = [
  "Store Supplies and Materials",
  "Utilities",
  "Transportation",
] as const;

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
];

const GEMINI_MODELS = (
  process.env.EXPO_PUBLIC_GEMINI_MODELS
    ? process.env.EXPO_PUBLIC_GEMINI_MODELS.split(",")
    : DEFAULT_GEMINI_MODELS
)
  .map((value) => value.trim())
  .filter((value): value is string => value.length > 0);

const GEMINI_API_KEYS = Array.from(
  new Set(
    [
      process.env.EXPO_PUBLIC_GEMINI_API_KEY_1,
      process.env.EXPO_PUBLIC_GEMINI_API_KEY_2,
      process.env.EXPO_PUBLIC_GEMINI_API_KEY_3,
      process.env.EXPO_PUBLIC_GEMINI_API_KEY_4,
      process.env.EXPO_PUBLIC_GEMINI_API_KEY_5,
      process.env.EXPO_PUBLIC_GEMINI_API_KEY_6,
      process.env.EXPO_PUBLIC_GEMINI_API_KEY,
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  ),
);

const GEMINI_DEBUG_ENABLED =
  __DEV__ || process.env.EXPO_PUBLIC_GEMINI_DEBUG === "true";

let geminiModelCursor = 0;
let geminiKeyCursor = 0;

function geminiLog(level: "info" | "warn" | "error", ...args: unknown[]) {
  if (!GEMINI_DEBUG_ENABLED) {
    return;
  }

  const prefix = "[AddExpenses][Gemini]";
  if (level === "error") {
    console.error(prefix, ...args);
    return;
  }
  if (level === "warn") {
    console.warn(prefix, ...args);
    return;
  }
  console.info(prefix, ...args);
}

function rotateFromCursor<T>(values: T[], cursor: number): T[] {
  if (!values.length) {
    return [];
  }

  const start = ((cursor % values.length) + values.length) % values.length;
  return [...values.slice(start), ...values.slice(0, start)];
}

const DRAFT_STORAGE_KEY = "bizwise_expenses_receipt_draft";

interface ReceiptSummary {
  category: (typeof RECEIPT_CATEGORIES)[number];
  totalItems: number;
  totalAmount: number;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildExpenseDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  const rawJson = match[0];

  try {
    return JSON.parse(rawJson);
  } catch {
    // Try a lenient pass for common model formatting quirks.
    const normalized = rawJson
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":')
      .replace(/:\s*'([^']*?)'/g, ': "$1"');

    try {
      return JSON.parse(normalized);
    } catch {
      return null;
    }
  }
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/,/g, "")
    .replace(/[₱Pp]\s*/g, "")
    .replace(/[^\d.-]/g, "");

  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function collectCandidateTexts(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const texts: string[] = [];
  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (typeof part.text === "string" && part.text.trim().length > 0) {
        texts.push(part.text.trim());
      }
    }
  }

  return texts;
}

function normalizeReceiptSummary(
  payload: Record<string, unknown>,
): ReceiptSummary | null {
  const category = typeof payload.category === "string" ? payload.category : "";
  const normalizedCategory = RECEIPT_CATEGORIES.find(
    (item) => item.toLowerCase() === category.toLowerCase(),
  );
  const totalItems = parseNumericValue(
    payload.totalItems ?? payload.itemCount ?? payload.items,
  );
  const totalAmount = parseNumericValue(
    payload.totalAmount ??
      payload.amount ??
      payload.total ??
      payload.grandTotal ??
      payload.finalTotal,
  );

  if (totalItems === null || totalAmount === null) {
    return null;
  }

  return {
    category: normalizedCategory ?? DEFAULT_EXPENSE_CATEGORY,
    totalItems: Math.max(1, Math.round(totalItems)),
    totalAmount: Number(totalAmount.toFixed(2)),
  };
}

export default function AddExpenseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const { createExpense } = useMutationQueue();
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [receiptSummary, setReceiptSummary] = useState<ReceiptSummary | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw);
        if (parsed.capturedImage) {
          setCapturedImage(parsed.capturedImage);
        }
        if (parsed.receiptSummary) {
          setReceiptSummary(parsed.receiptSummary);
        }
        if (parsed.selectedDate) {
          setSelectedDate(new Date(parsed.selectedDate));
        }
      } catch (error) {
        console.error("Error loading Expenses draft:", error);
      }
    };

    loadDraft();
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      try {
        await AsyncStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            capturedImage,
            receiptSummary,
            selectedDate: selectedDate.toISOString(),
          }),
        );
      } catch (error) {
        console.error("Error saving Expenses draft:", error);
      }
    };

    saveDraft();
  }, [capturedImage, receiptSummary, selectedDate]);

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error("Error clearing Expenses draft:", error);
    }
  };

  const resetScreen = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setCapturedImage(null);
    setReceiptSummary(null);
    setSelectedDate(today);
    await clearDraft();
  };

  const uploadReceiptImage = async (imageUri: string) => {
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": blob.type || "image/jpeg" },
      body: blob,
    });

    const payload = await uploadResponse.json();
    return payload.storageId as string;
  };

  const parseReceiptWithGemini = async (imageUri: string) => {
    if (!GEMINI_API_KEYS.length) {
      throw new Error("Gemini API keys are not configured.");
    }
    if (!GEMINI_MODELS.length) {
      throw new Error("Gemini models are not configured.");
    }

    geminiLog(
      "info",
      `Starting receipt parse with ${GEMINI_API_KEYS.length} key(s) and ${GEMINI_MODELS.length} model(s).`,
      `Key cursor=${geminiKeyCursor}, Model cursor=${geminiModelCursor}`,
    );

    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: "base64",
    });

    const prompt = `Analyze this receipt image and return ONLY a JSON object.

Required JSON shape:
{
  "category": "${RECEIPT_CATEGORIES[0]} | ${RECEIPT_CATEGORIES[1]} | ${RECEIPT_CATEGORIES[2]}",
  "totalItems": 0,
  "totalAmount": 0
}

Rules:
- category must be exactly one of the allowed categories in the JSON shape.
- Use "Utilities" for utility, telecom, internet, water, electricity, or gas bills.
- Use "Transportation" for fares, fuel, tolls, delivery, shipping, or logistics expenses.
- Use "Store Supplies and Materials" for every other business purchase.
- totalItems must be the total number of purchased items. Sum quantities when visible. If quantities are not visible, count the purchased line items.
- totalAmount must be the final receipt total as a number with up to 2 decimals.
- Return raw JSON only. No markdown. No code fences. No extra text.`;

    let lastError: Error | null = null;

    const orderedModels = rotateFromCursor(GEMINI_MODELS, geminiModelCursor);
    const orderedApiKeys = rotateFromCursor(GEMINI_API_KEYS, geminiKeyCursor);
    const totalAttempts = orderedModels.length * orderedApiKeys.length;
    let attempt = 0;

    for (const [modelOffset, model] of orderedModels.entries()) {
      const modelIndex =
        (geminiModelCursor + modelOffset) % GEMINI_MODELS.length;

      for (const [keyOffset, apiKey] of orderedApiKeys.entries()) {
        const keyIndex = (geminiKeyCursor + keyOffset) % GEMINI_API_KEYS.length;
        const keyLabel = `#${keyIndex + 1}`;
        attempt += 1;

        geminiLog(
          "info",
          `Attempt ${attempt}/${totalAttempts}: model=${model} (index ${modelIndex + 1}) key=${keyLabel}`,
        );

        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: prompt },
                      {
                        inline_data: {
                          mime_type: "image/jpeg",
                          data: base64Image,
                        },
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0,
                  maxOutputTokens: 400,
                },
              }),
            },
          );

          if (!response.ok) {
            const responseBody = await response.text();
            geminiLog(
              "warn",
              `HTTP ${response.status} from model=${model} key=${keyLabel}`,
              responseBody.slice(0, 240),
            );
            lastError = new Error(
              `Gemini request failed with ${response.status} on ${model} ${keyLabel}`,
            );
            continue;
          }

          const data = await response.json();
          const candidateTexts = collectCandidateTexts(data);
          const combinedRawText = candidateTexts.join("\n");

          for (const rawText of candidateTexts) {
            const parsed = extractJsonObject(rawText);
            const summary = parsed ? normalizeReceiptSummary(parsed) : null;

            if (summary) {
              geminiModelCursor = (modelIndex + 1) % GEMINI_MODELS.length;
              geminiKeyCursor = (keyIndex + 1) % GEMINI_API_KEYS.length;
              geminiLog(
                "info",
                `Parse success on model=${model} key=${keyLabel}.`,
                `Next key cursor=${geminiKeyCursor}, model cursor=${geminiModelCursor}`,
              );
              return {
                summary,
                rawText,
              };
            }
          }

          geminiLog(
            "warn",
            `Invalid summary payload from model=${model} key=${keyLabel}.`,
            combinedRawText.slice(0, 240),
          );
          lastError = new Error("Gemini returned an invalid receipt summary.");
        } catch (error) {
          geminiLog(
            "warn",
            `Request error on model=${model} key=${keyLabel}:`,
            error,
          );
          lastError = error as Error;
        }
      }
    }

    geminiModelCursor = (geminiModelCursor + 1) % GEMINI_MODELS.length;
    geminiKeyCursor = (geminiKeyCursor + 1) % GEMINI_API_KEYS.length;
    geminiLog(
      "error",
      `All ${totalAttempts} Gemini attempts failed.`,
      `Next key cursor=${geminiKeyCursor}, model cursor=${geminiModelCursor}`,
    );

    throw lastError || new Error("Unable to scan receipt.");
  };

  const processReceiptImage = async (imageUri: string) => {
    if (!isOnline) {
      Alert.alert(
        "Internet Required",
        "An internet connection is required to scan receipts.",
      );
      return;
    }

    setIsScanning(true);
    try {
      const processedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );

      const { summary } = await parseReceiptWithGemini(processedImage.uri);
      setCapturedImage(processedImage.uri);
      setReceiptSummary(summary);
    } catch (error) {
      console.error("Error scanning receipt:", error);
      Alert.alert(
        "Scan Failed",
        "BizWise could not read that receipt. Please retake the photo or try another image.",
      );
    } finally {
      setIsScanning(false);
    }
  };

  const launchCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Camera access is needed to scan receipts.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await processReceiptImage(result.assets[0].uri);
    }
  };

  const launchPhotoLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Photo library access is needed to choose a receipt image.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await processReceiptImage(result.assets[0].uri);
    }
  };

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (!date) {
      return;
    }

    date.setHours(0, 0, 0, 0);
    setSelectedDate(date);
  };

  const handleSave = async () => {
    if (!user?.userId) {
      Alert.alert("Login Required", "Please log in before saving expenses.");
      return;
    }

    if (!capturedImage || !receiptSummary) {
      Alert.alert(
        "Scan Required",
        "Scan a receipt first before saving expenses.",
      );
      return;
    }

    if (!isOnline) {
      Alert.alert(
        "Internet Required",
        "An internet connection is required to save scanned expenses.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const receiptImageStorageId = await uploadReceiptImage(capturedImage);
      const result = await createExpense({
        userId: user.userId,
        category: receiptSummary.category,
        receiptNumber: "",
        itemCount: receiptSummary.totalItems,
        totalAmount: receiptSummary.totalAmount,
        receiptImageStorageId,
        expenseDate: buildExpenseDate(selectedDate),
        clientTimestamp: Date.now(),
        ocrText: JSON.stringify(receiptSummary),
      });

      await resetScreen();
      Alert.alert("Expenses Saved", `Transaction ID: ${result.transactionId}`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error saving scanned expense:", error);
      Alert.alert(
        "Save Failed",
        "BizWise could not save that receipt. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryBlue}
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Expenses</Text>
        <View style={styles.headerButton}>
          <HelpTooltip
            title="Add Expenses Help"
            content="Manual expense entry is disabled. Scan a receipt or choose a receipt photo, then review the scanned category, total item count, and total amount before saving."
            iconSize={18}
            iconColor={COLORS.primaryBlue}
          />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingBottom: tabBarHeight + Math.max(insets.bottom, 16) + 96,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dateRowCard}>
          <Text style={styles.dateRowLabel}>Date</Text>
          <TouchableOpacity
            style={styles.dateRowValueButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateRowValueText}>
              {formatDateLabel(selectedDate)}
            </Text>
            <Calendar size={16} color={COLORS.primaryBlue} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryPanel}>
          <Text style={styles.receiptNumberText}>
            Receipt No. To be generated after save
          </Text>

          <Text style={styles.inputLabel}>Category</Text>
          <View style={styles.valueField}>
            <Text style={styles.valueFieldText}>
              {receiptSummary?.category || "Not Detected Yet"}
            </Text>
          </View>

          <View style={styles.summaryMetricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.inputLabel}>Total No. Of Items</Text>
              <View style={styles.valueField}>
                <Text style={styles.valueFieldText}>
                  {receiptSummary?.totalItems !== undefined
                    ? String(receiptSummary.totalItems)
                    : "Not Detected Yet"}
                </Text>
              </View>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.inputLabel}>Total Amount</Text>
              <View style={styles.valueField}>
                <Text style={styles.valueFieldText}>
                  {receiptSummary?.totalAmount !== undefined
                    ? `₱${receiptSummary.totalAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : "Not Detected Yet"}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.viewReceiptButton,
              !capturedImage && styles.viewReceiptButtonDisabled,
            ]}
            onPress={() => setShowReceiptPreview(true)}
            disabled={!capturedImage}
          >
            <Text style={styles.viewReceiptButtonText}>View Receipt</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!receiptSummary || isSaving || isScanning) &&
              styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!receiptSummary || isSaving || isScanning}
        >
          {isSaving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Expenses</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scanButton}
          onPress={launchCamera}
          disabled={isScanning || isSaving}
        >
          {isScanning ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Camera size={18} color={COLORS.white} />
              <Text style={styles.scanButtonText}>Scan Receipt</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.choosePhotoButton}
          onPress={launchPhotoLibrary}
          disabled={isScanning || isSaving}
        >
          <ImageIcon size={18} color={COLORS.primaryBlue} />
          <Text style={styles.choosePhotoButtonText}>Choose Photo</Text>
        </TouchableOpacity>

        {capturedImage ? (
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.previewButton}
              onPress={launchCamera}
              disabled={isScanning || isSaving}
            >
              <RotateCcw size={16} color={COLORS.primaryBlue} />
              <Text style={styles.previewButtonText}>Rescan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.previewButton}
              onPress={resetScreen}
              disabled={isScanning || isSaving}
            >
              <Trash2 size={16} color="#b91c1c" />
              <Text
                style={[styles.previewButtonText, styles.previewDeleteText]}
              >
                Clear
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      {showDatePicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
        />
      ) : null}

      <Modal
        visible={showReceiptPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReceiptPreview(false)}
      >
        <View style={styles.previewModalOverlay}>
          <View style={styles.previewModalCard}>
            <TouchableOpacity
              style={styles.previewModalClose}
              onPress={() => setShowReceiptPreview(false)}
            >
              <X size={20} color={COLORS.textDark} />
            </TouchableOpacity>
            {capturedImage ? (
              <Image
                source={{ uri: capturedImage }}
                style={styles.previewModalImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.previewModalEmptyText}>
                No receipt image available.
              </Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={isScanning} transparent animationType="fade">
        <View style={styles.scanModalOverlay}>
          <View style={styles.scanModalCard}>
            <LottieView
              source={require("../../assets/animations/Document OCR Scan.json")}
              autoPlay
              loop
              style={styles.scanAnimation}
            />
            <Text style={styles.scanModalTitle}>Scanning Receipt...</Text>
            <Text style={styles.scanModalText}>
              BizWise is reading your receipt summary. Please wait.
            </Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 18,
  },
  headerButton: {
    width: 28,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.white,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  dateRowCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateRowLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  dateRowValueButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateRowValueText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryBlue,
  },
  summaryPanel: {
    backgroundColor: "#7398be",
    borderRadius: 14,
    padding: 14,
  },
  receiptNumberText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 12,
  },
  inputLabel: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  valueField: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 10,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  valueFieldText: {
    color: COLORS.primaryBlue,
    fontSize: 13,
    fontWeight: "700",
  },
  summaryMetricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  metricItem: {
    flex: 1,
  },
  viewReceiptButton: {
    marginTop: 12,
    alignSelf: "center",
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  viewReceiptButtonDisabled: {
    opacity: 0.45,
  },
  viewReceiptButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
  noticeCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.primaryBlue,
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textDark,
  },
  categoryChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  categoryChip: {
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primaryBlue,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textGray,
    marginTop: 4,
    marginBottom: 16,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e8f0fa",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primaryBlue,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  primaryAction: {
    flex: 1,
    minHeight: 48,
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryActionText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    backgroundColor: "#edf4fc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryActionText: {
    color: COLORS.primaryBlue,
    fontSize: 14,
    fontWeight: "700",
  },
  previewCard: {
    gap: 12,
  },
  previewImage: {
    width: "100%",
    height: 240,
    borderRadius: 16,
    backgroundColor: COLORS.lightBlueBg,
  },
  previewActions: {
    flexDirection: "row",
    gap: 12,
  },
  previewButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.white,
  },
  previewButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primaryBlue,
  },
  previewDeleteText: {
    color: "#b91c1c",
  },
  emptyPreview: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 34,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.border,
    backgroundColor: "#f8fbff",
  },
  emptyPreviewTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  emptyPreviewText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textGray,
    textAlign: "center",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  summaryCard: {
    width: "48%",
    minHeight: 96,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textGray,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.primaryBlue,
  },
  metaRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textGray,
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textDark,
  },
  saveButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: COLORS.primaryBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.white,
  },
  scanButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: COLORS.primaryBlue,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  scanButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },
  choosePhotoButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#edf4fc",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  choosePhotoButtonText: {
    color: COLORS.primaryBlue,
    fontSize: 14,
    fontWeight: "700",
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  previewModalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "80%",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
  },
  previewModalClose: {
    alignSelf: "flex-end",
    padding: 4,
  },
  previewModalImage: {
    width: "100%",
    height: 430,
    backgroundColor: COLORS.lightBlueBg,
    borderRadius: 10,
  },
  previewModalEmptyText: {
    color: COLORS.textGray,
    textAlign: "center",
    paddingVertical: 20,
    fontSize: 13,
  },
  scanModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  scanModalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: "center",
  },
  scanAnimation: {
    width: 180,
    height: 180,
    marginBottom: 6,
  },
  scanModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textDark,
    marginBottom: 6,
  },
  scanModalText: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textGray,
    textAlign: "center",
  },
});
