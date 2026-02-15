import { useQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";

// Hook for cached financial summary
export function useFinancialSummary(userId: string | undefined) {
  const convex = useConvex();

  return useQuery({
    queryKey: ["financialSummary", userId],
    queryFn: async () => {
      if (!userId) return null;
      return await convex.query(api.analytics.getFinancialSummary, { userId });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook for cached daily analytics
export function useDailyAnalytics(userId: string | undefined, days: number = 7) {
  const convex = useConvex();

  return useQuery({
    queryKey: ["dailyAnalytics", userId, days],
    queryFn: async () => {
      if (!userId) return [];
      return await convex.query(api.analytics.getDailyAnalytics, {
        userId,
        days,
      });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook for cached weekly analytics
export function useWeeklyAnalytics(userId: string | undefined, weeks: number = 7) {
  const convex = useConvex();

  return useQuery({
    queryKey: ["weeklyAnalytics", userId, weeks],
    queryFn: async () => {
      if (!userId) return [];
      return await convex.query(api.analytics.getWeeklyAnalytics, {
        userId,
        weeks,
      });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook for cached monthly analytics
export function useMonthlyAnalytics(userId: string | undefined) {
  const convex = useConvex();

  return useQuery({
    queryKey: ["monthlyAnalytics", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await convex.query(api.analytics.getMonthlyAnalytics, { userId });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook for cached top product
export function useTopProduct(userId: string | undefined) {
  const convex = useConvex();

  return useQuery({
    queryKey: ["topProduct", userId],
    queryFn: async () => {
      if (!userId) return null;
      return await convex.query(api.analytics.getTopSellingProduct, { userId });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook for cached top category
export function useTopCategory(userId: string | undefined) {
  const convex = useConvex();

  return useQuery({
    queryKey: ["topCategory", userId],
    queryFn: async () => {
      if (!userId) return null;
      return await convex.query(api.analytics.getTopSellingCategory, { userId });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook for cached target progress
export function useTargetProgress(userId: string | undefined) {
  const convex = useConvex();

  return useQuery({
    queryKey: ["targetProgress", userId],
    queryFn: async () => {
      if (!userId) return null;
      return await convex.query(api.analytics.getTargetProgress, { userId });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook for cached products
export function useProducts(userId: string | undefined) {
  const convex = useConvex();

  return useQuery({
    queryKey: ["products", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await convex.query(api.products.getProducts, { userId });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutes for products
  });
}

// Hook for cached categories
export function useCategories(userId: string | undefined) {
  const convex = useConvex();

  return useQuery({
    queryKey: ["categories", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await convex.query(api.categories.getCategories, { userId });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}

// Hook for cached transactions
export function useTransactions(
  userId: string | undefined,
  limit: number = 20,
  cursor?: number,
) {
  const convex = useConvex();

  return useQuery({
    queryKey: ["transactions", userId, limit, cursor],
    queryFn: async () => {
      if (!userId) return { transactions: [], hasMore: false, nextCursor: undefined };
      return await convex.query(api.analytics.getCombinedTransactionsPaginated, {
        userId,
        limit,
        cursor,
      });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes for transactions
  });
}
