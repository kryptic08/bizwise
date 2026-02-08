/**
 * BizWise Receipt Processing API Client
 *
 * This utility handles communication with the self-hosted FastAPI backend
 * for receipt OCR and NLP extraction.
 */

// API Configuration
const RECEIPT_API_URL =
  process.env.EXPO_PUBLIC_RECEIPT_API_URL || "https://bizwise-api.onrender.com";
const RECEIPT_API_KEY = process.env.EXPO_PUBLIC_RECEIPT_API_KEY || "bizwise-secret-2026-api-end";

export interface LineItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ReceiptData {
  merchant_name: string | null;
  receipt_date: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  line_items: LineItem[];
  raw_text: string;
  confidence_score: number;
}

export interface ReceiptResponse {
  success: boolean;
  data: ReceiptData;
  processing_time_ms: number;
}

/**
 * Process a receipt image using the self-hosted API
 *
 * @param imageUri - Local URI of the image to process
 * @param retryOnTimeout - Whether to retry if timeout occurs (for cold starts)
 * @returns Processed receipt data
 */
export async function processReceiptWithAPI(
  imageUri: string,
  retryOnTimeout: boolean = true,
): Promise<ReceiptResponse> {
  try {
    console.log("📤 Sending image to receipt processing API...");

    // Create FormData with the image
    const formData = new FormData();
    formData.append("file", {
      uri: imageUri,
      type: "image/jpeg",
      name: "receipt.jpg",
    } as any);

    // Make the request with longer timeout for potential cold start
    const controller = new AbortController();
    const timeoutDuration = 90000; // 90 seconds for first request
    const timeout = setTimeout(() => controller.abort(), timeoutDuration);

    const response = await fetch(`${RECEIPT_API_URL}/api/v1/receipt/process`, {
      method: "POST",
      headers: {
        "X-API-Key": RECEIPT_API_KEY,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const result: ReceiptResponse = await response.json();

    console.log(`✅ Receipt processed in ${result.processing_time_ms}ms`);
    console.log(
      `📊 Confidence: ${(result.data.confidence_score * 100).toFixed(1)}%`,
    );
    console.log(`🛒 Items found: ${result.data.line_items.length}`);

    return result;
  } catch (error: any) {
    // Handle timeout (likely cold start)
    if (error.name === "AbortError" && retryOnTimeout) {
      console.log(
        "⏰ Request timeout - server might be waking up, retrying...",
      );
      // Retry once without timeout handling
      return processReceiptWithAPI(imageUri, false);
    }

    // Handle connection errors
    if (error.message.includes("Network request failed")) {
      throw new Error(
        "Cannot connect to receipt processing server. Is it running?",
      );
    }

    throw error;
  }
}

/**
 * Check if the receipt processing API is available
 *
 * @returns True if API is healthy
 */
export async function checkAPIHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${RECEIPT_API_URL}/health`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Health check failed:", error);
    return false;
  }
}

/**
 * Map API response to ExpenseItem format
 *
 * @param data - Receipt data from API
 * @returns Array of expense items
 */
export function mapReceiptToExpenseItems(data: ReceiptData): Array<{
  id: string;
  category: string;
  title: string;
  amount: string;
  quantity: string;
  total: string;
}> {
  // Map line items if available
  if (data.line_items && data.line_items.length > 0) {
    return data.line_items.map((item) => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      category: categorizeLLM(item.name),
      title: item.name,
      amount: item.price.toFixed(2),
      quantity: item.quantity.toString(),
      total: item.total.toFixed(2),
    }));
  }

  // Fallback: create single item from total if no line items
  if (data.total_amount) {
    return [
      {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        category: "General",
        title: data.merchant_name || "Receipt Total",
        amount: data.total_amount.toFixed(2),
        quantity: "1",
        total: data.total_amount.toFixed(2),
      },
    ];
  }

  return [];
}

/**
 * Simple category mapping based on item name
 */
function categorizeLLM(itemName: string): string {
  const lower = itemName.toLowerCase();

  if (
    lower.includes("food") ||
    lower.includes("meal") ||
    lower.includes("lunch") ||
    lower.includes("dinner") ||
    lower.includes("snack")
  ) {
    return "Food";
  }
  if (
    lower.includes("gas") ||
    lower.includes("fuel") ||
    lower.includes("transport") ||
    lower.includes("uber") ||
    lower.includes("taxi")
  ) {
    return "Transportation";
  }
  if (
    lower.includes("office") ||
    lower.includes("supplies") ||
    lower.includes("paper") ||
    lower.includes("pen")
  ) {
    return "Office";
  }
  if (
    lower.includes("utility") ||
    lower.includes("electric") ||
    lower.includes("water") ||
    lower.includes("internet")
  ) {
    return "Utilities";
  }
  if (
    lower.includes("maintenance") ||
    lower.includes("repair") ||
    lower.includes("clean")
  ) {
    return "Maintenance";
  }
  if (
    lower.includes("marketing") ||
    lower.includes("ad") ||
    lower.includes("promo")
  ) {
    return "Marketing";
  }
  if (
    lower.includes("medical") ||
    lower.includes("health") ||
    lower.includes("doctor")
  ) {
    return "Medical";
  }
  if (
    lower.includes("equipment") ||
    lower.includes("tool") ||
    lower.includes("machine")
  ) {
    return "Equipment";
  }

  return "General";
}
