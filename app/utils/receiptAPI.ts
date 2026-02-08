/**
 * BizWise Receipt Processing API Client
 *
 * This utility handles communication with the self-hosted FastAPI backend
 * for receipt OCR and NLP extraction.
 */

// API Configuration
const RECEIPT_API_URL =
  process.env.EXPO_PUBLIC_RECEIPT_API_URL || "https://bizwise-api.onrender.com";
const RECEIPT_API_KEY =
  process.env.EXPO_PUBLIC_RECEIPT_API_KEY || "bizwise-secret-2026-api-end";

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
 * Wake the Render server if it's sleeping (free tier spins down after 15 min).
 * Returns true if the server is reachable.
 */
async function wakeServerIfNeeded(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${RECEIPT_API_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Process a receipt image using the self-hosted API.
 *
 * Strategy:
 *  1. Quick health-check to see if server is awake (8 s timeout).
 *  2. If cold → wait for it to boot (up to 60 s), then send image.
 *  3. Send with 45 s processing timeout.
 *  4. On timeout / network error → one automatic retry.
 *
 * @param imageUri  Local URI of the compressed JPEG
 * @param attempt   Internal retry counter (callers should omit this)
 */
export async function processReceiptWithAPI(
  imageUri: string,
  attempt: number = 1,
): Promise<ReceiptResponse> {
  const MAX_ATTEMPTS = 2;

  try {
    // ── 1. Wake check ──────────────────────────────────────────
    console.log(`📤 BizWise API attempt ${attempt}/${MAX_ATTEMPTS}…`);
    const awake = await wakeServerIfNeeded();

    if (!awake) {
      // Server is cold-starting — give it up to 60 s
      console.log("⏳ Server waking up, waiting…");
      const start = Date.now();
      let ready = false;
      while (Date.now() - start < 60000) {
        await new Promise((r) => setTimeout(r, 4000));
        ready = await wakeServerIfNeeded();
        if (ready) break;
      }
      if (!ready) throw new Error("Server did not wake up within 60 s");
      console.log("✅ Server is awake");
    }

    // ── 2. Send the image ──────────────────────────────────────
    const formData = new FormData();
    formData.append("file", {
      uri: imageUri,
      type: "image/jpeg",
      name: "receipt.jpg",
    } as any);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000); // 45 s for processing

    const response = await fetch(`${RECEIPT_API_URL}/api/v1/receipt/process`, {
      method: "POST",
      headers: { "X-API-Key": RECEIPT_API_KEY },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${response.status}: ${errorText}`);
    }

    const result: ReceiptResponse = await response.json();

    console.log(`✅ Receipt processed in ${result.processing_time_ms}ms`);
    console.log(
      `📊 Confidence: ${(result.data.confidence_score * 100).toFixed(1)}%`,
    );
    console.log(`🛒 Items found: ${result.data.line_items.length}`);

    return result;
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.warn(`⚠️ BizWise API attempt ${attempt} failed: ${msg}`);

    // Retry once on timeout or network errors
    if (attempt < MAX_ATTEMPTS) {
      console.log("🔄 Retrying…");
      return processReceiptWithAPI(imageUri, attempt + 1);
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
