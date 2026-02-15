import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "../../convex/_generated/api";
import { useOffline } from "./OfflineProvider";

export type MutationType = "sale" | "expense";

export interface QueuedMutation {
  id: string;
  tempId: string;
  type: MutationType;
  data: SaleData | ExpenseData;
  timestamp: number;
  retryCount: number;
  status: "pending" | "syncing" | "error" | "completed";
  errorMessage?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  category: string;
  price: number;
  quantity: number;
}

export interface SaleData {
  userId: string;
  items: SaleItem[];
  paymentReceived: number;
  clientTimestamp: number;
}

export interface ExpenseItemData {
  category: string;
  title: string;
  amount: number;
  quantity: number;
  total: number;
}

export interface ExpenseData {
  userId: string;
  items: ExpenseItemData[];
  clientTimestamp: number;
  receiptImageStorageId?: string;
}

interface MutationQueueContextType {
  queue: QueuedMutation[];
  pendingCount: number;
  syncingCount: number;
  errorCount: number;
  addMutation: (type: MutationType, data: SaleData | ExpenseData) => Promise<string>;
  removeMutation: (id: string) => Promise<void>;
  retryMutation: (id: string) => Promise<void>;
  syncNow: () => Promise<void>;
  getLocalTransactions: () => QueuedMutation[];
  isSyncing: boolean;
  clearCache: () => Promise<void>;
}

const QUEUE_STORAGE_KEY = "bizwise_mutation_queue";
const TEMP_ID_PREFIX = "PENDING-";

const MutationQueueContext = createContext<MutationQueueContextType | undefined>(
  undefined
);

export function MutationQueueProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { isOnline } = useOffline();
  const queryClient = useQueryClient();

  const createSale = useMutation(api.sales.createSale);
  const addExpenseGroup = useMutation(api.expenses.addExpenseGroup);

  // Load queue from storage on mount
  useEffect(() => {
    loadQueue();
  }, []);

  // Listen for clear data event from AuthContext
  useEffect(() => {
    const handleClearData = async () => {
      await queryClient.clear();
      await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
      setQueue([]);
    };

    window.addEventListener("bizwise_clear_data", handleClearData);
    return () => {
      window.removeEventListener("bizwise_clear_data", handleClearData);
    };
  }, [queryClient]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && !isProcessing) {
      const pendingItems = queue.filter(
        (item) => item.status === "pending" || item.status === "error"
      );
      if (pendingItems.length > 0) {
        syncNow();
      }
    }
  }, [isOnline]);

  const loadQueue = async () => {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setQueue(parsed);
      }
    } catch (error) {
      console.error("Error loading mutation queue:", error);
    }
  };

  const saveQueue = async (newQueue: QueuedMutation[]) => {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(newQueue));
      setQueue(newQueue);
    } catch (error) {
      console.error("Error saving mutation queue:", error);
    }
  };

  const generateTempId = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${TEMP_ID_PREFIX}${timestamp}-${random}`;
  };

  const addMutation = async (
    type: MutationType,
    data: SaleData | ExpenseData
  ): Promise<string> => {
    const tempId = generateTempId();
    const mutation: QueuedMutation = {
      id: `mutation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tempId,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      status: "pending",
    };

    const newQueue = [...queue, mutation];
    await saveQueue(newQueue);

    // Try to sync immediately if online
    if (isOnline) {
      syncNow();
    }

    return tempId;
  };

  const removeMutation = async (id: string) => {
    const newQueue = queue.filter((item) => item.id !== id);
    await saveQueue(newQueue);
  };

  const updateMutationStatus = async (
    id: string,
    status: QueuedMutation["status"],
    errorMessage?: string
  ) => {
    const newQueue = queue.map((item) =>
      item.id === id ? { ...item, status, errorMessage } : item
    );
    await saveQueue(newQueue);
  };

  const retryMutation = async (id: string) => {
    await updateMutationStatus(id, "pending");
    if (isOnline) {
      await syncNow();
    }
  };

  const executeMutation = async (
    mutation: QueuedMutation
  ): Promise<boolean> => {
    try {
      await updateMutationStatus(mutation.id, "syncing");

      if (mutation.type === "sale") {
        const saleData = mutation.data as SaleData;
        await createSale({
          items: saleData.items.map(item => ({
            productId: item.productId as any,
            productName: item.productName,
            category: item.category,
            price: item.price,
            quantity: item.quantity,
          })),
          paymentReceived: saleData.paymentReceived,
          userId: saleData.userId as any,
          clientTimestamp: saleData.clientTimestamp,
        });
      } else if (mutation.type === "expense") {
        const expenseData = mutation.data as ExpenseData;
        await addExpenseGroup({
          userId: expenseData.userId as any,
          items: expenseData.items.map((item) => ({
            category: item.category,
            title: item.title,
            amount: item.amount,
            quantity: item.quantity,
            total: item.total,
          })),
          clientTimestamp: expenseData.clientTimestamp,
          receiptImageStorageId: expenseData.receiptImageStorageId as any,
        });
      }

      // Mark as completed
      await updateMutationStatus(mutation.id, "completed");
      
      // Invalidate queries to refetch from server
      await queryClient.invalidateQueries();
      
      return true;
    } catch (error: any) {
      console.error("Error executing mutation:", error);
      const retryCount = mutation.retryCount + 1;
      const newQueue = queue.map((item) =>
        item.id === mutation.id
          ? { ...item, retryCount, status: "error" as const, errorMessage: error.message }
          : item
      );
      await saveQueue(newQueue);
      return false;
    }
  };

  const syncNow = useCallback(async () => {
    if (isProcessing || !isOnline) return;

    setIsProcessing(true);

    try {
      const pendingItems = queue.filter(
        (item) => item.status === "pending" || item.status === "error"
      );

      for (const mutation of pendingItems) {
        // Skip if too many retries
        if (mutation.retryCount >= 3) {
          continue;
        }

        const success = await executeMutation(mutation);
        if (!success) {
          // Continue with next item even if one fails
          console.warn(`Failed to sync mutation ${mutation.id}, will retry later`);
        }
      }

      // Clean up completed items after a longer delay to allow queries to refetch
      setTimeout(async () => {
        const newQueue = queue.filter((item) => item.status !== "completed");
        if (newQueue.length !== queue.length) {
          await saveQueue(newQueue);
        }
      }, 10000);
    } catch (error) {
      console.error("Error during sync:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [queue, isOnline, isProcessing]);

  const getLocalTransactions = useCallback(() => {
    return queue.filter(
      (item) => item.status === "pending" || item.status === "syncing" || item.status === "error" || item.status === "completed"
    );
  }, [queue]);

  const clearCache = useCallback(async () => {
    await queryClient.clear();
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
    setQueue([]);
  }, [queryClient]);

  const pendingCount = queue.filter((item) => item.status === "pending").length;
  const syncingCount = queue.filter((item) => item.status === "syncing").length;
  const errorCount = queue.filter((item) => item.status === "error").length;

  return (
    <MutationQueueContext.Provider
      value={{
        queue,
        pendingCount,
        syncingCount,
        errorCount,
        addMutation,
        removeMutation,
        retryMutation,
        syncNow,
        getLocalTransactions,
        isSyncing: isProcessing,
        clearCache,
      }}
    >
      {children}
    </MutationQueueContext.Provider>
  );
}

export function useMutationQueue() {
  const context = useContext(MutationQueueContext);
  if (context === undefined) {
    throw new Error(
      "useMutationQueue must be used within a MutationQueueProvider"
    );
  }
  return context;
}

export default MutationQueueProvider;
