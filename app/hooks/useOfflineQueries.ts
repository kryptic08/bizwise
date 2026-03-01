/**
 * Data hooks using Convex's reactive useQuery.
 * These automatically re-subscribe whenever the underlying DB data changes,
 * so new sales / expenses appear instantly without any manual cache invalidation.
 *
 * OFFLINE SUPPORT
 * ───────────────
 * When the device goes offline the Convex WebSocket drops and `useQuery`
 * returns `undefined`. Every hook here also maintains a per-key AsyncStorage
 * cache so the last-known data is served immediately while offline (or while
 * the WebSocket is reconnecting). The cache is updated whenever live data
 * arrives.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type UserId = Id<"users">;

// ─── AsyncStorage cache helpers ───────────────────────────────────────────────

const CACHE_PREFIX = "bizwise_offline_";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, ts: Date.now() }),
    );
  } catch {
    // ignore write errors
  }
}

async function readCache<T>(key: string): Promise<T | undefined> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) return undefined;
    return data;
  } catch {
    return undefined;
  }
}

/**
 * Core hook that wraps any Convex `useQuery` result with an AsyncStorage
 * offline cache. Returns the live value when available, otherwise the most
 * recently cached value.
 */
function useOfflineCached<T>(
  liveData: T | undefined,
  cacheKey: string | undefined, // undefined means skip
): { data: T | undefined; isFromCache: boolean } {
  const [cachedData, setCachedData] = useState<T | undefined>(undefined);
  const lastWrittenRef = useRef<string>("");

  // Load cache on mount (or when key changes)
  useEffect(() => {
    if (!cacheKey) return;
    readCache<T>(cacheKey).then((val) => {
      if (val !== undefined) setCachedData(val);
    });
  }, [cacheKey]);

  // Persist live data to cache whenever it arrives
  useEffect(() => {
    if (!cacheKey || liveData === undefined) return;
    const serialised = JSON.stringify(liveData);
    if (serialised === lastWrittenRef.current) return; // skip unchanged
    lastWrittenRef.current = serialised;
    setCachedData(liveData);
    writeCache(cacheKey, liveData);
  }, [cacheKey, liveData]);

  const isFromCache = liveData === undefined && cachedData !== undefined;
  return { data: liveData ?? cachedData, isFromCache };
}

// ─── Public hooks ─────────────────────────────────────────────────────────────

// Hook for financial summary (reactive – updates immediately when DB changes)
export function useFinancialSummary(userId: string | undefined) {
  const live = useQuery(
    api.analytics.getFinancialSummary,
    userId ? { userId: userId as UserId } : "skip",
  );
  return useOfflineCached(
    live,
    userId ? `financial_summary_${userId}` : undefined,
  );
}

// Hook for daily analytics (reactive)
export function useDailyAnalytics(
  userId: string | undefined,
  days: number = 7,
) {
  const live = useQuery(
    api.analytics.getDailyAnalytics,
    userId ? { userId: userId as UserId, days } : "skip",
  );
  return useOfflineCached(
    live,
    userId ? `daily_analytics_${userId}_${days}` : undefined,
  );
}

// Hook for weekly analytics (reactive)
export function useWeeklyAnalytics(
  userId: string | undefined,
  weeks: number = 7,
) {
  const live = useQuery(
    api.analytics.getWeeklyAnalytics,
    userId ? { userId: userId as UserId, weeks } : "skip",
  );
  return useOfflineCached(
    live,
    userId ? `weekly_analytics_${userId}_${weeks}` : undefined,
  );
}

// Hook for monthly analytics (reactive)
export function useMonthlyAnalytics(userId: string | undefined) {
  const live = useQuery(
    api.analytics.getMonthlyAnalytics,
    userId ? { userId: userId as UserId } : "skip",
  );
  return useOfflineCached(
    live,
    userId ? `monthly_analytics_${userId}` : undefined,
  );
}

// Hook for top selling product (reactive)
export function useTopProduct(userId: string | undefined) {
  const live = useQuery(
    api.analytics.getTopSellingProduct,
    userId ? { userId: userId as UserId } : "skip",
  );
  return useOfflineCached(live, userId ? `top_product_${userId}` : undefined);
}

// Hook for top selling category (reactive)
export function useTopCategory(userId: string | undefined) {
  const live = useQuery(
    api.analytics.getTopSellingCategory,
    userId ? { userId: userId as UserId } : "skip",
  );
  return useOfflineCached(live, userId ? `top_category_${userId}` : undefined);
}

// Hook for target progress (reactive)
export function useTargetProgress(userId: string | undefined) {
  const live = useQuery(
    api.analytics.getTargetProgress,
    userId ? { userId: userId as UserId } : "skip",
  );
  return useOfflineCached(
    live,
    userId ? `target_progress_${userId}` : undefined,
  );
}

// Hook for products list (reactive)
export function useProducts(userId: string | undefined) {
  const live = useQuery(
    api.products.getProducts,
    userId ? { userId: userId as UserId } : "skip",
  );
  return useOfflineCached(live, userId ? `products_${userId}` : undefined);
}

// Hook for categories list (reactive)
export function useCategories(userId: string | undefined) {
  const live = useQuery(
    api.categories.getCategories,
    userId ? { userId: userId as UserId } : "skip",
  );
  return useOfflineCached(live, userId ? `categories_${userId}` : undefined);
}

// Hook for paginated transactions (reactive – new sales/expenses appear immediately)
export function useTransactions(
  userId: string | undefined,
  limit: number = 20,
  cursor?: number,
) {
  const live = useQuery(
    api.analytics.getCombinedTransactionsPaginated,
    userId ? { userId: userId as UserId, limit, cursor } : "skip",
  );
  return useOfflineCached(
    live,
    userId ? `transactions_${userId}_${limit}_${cursor ?? 0}` : undefined,
  );
}
