import { useMutation } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useContext, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";

export type MutationType = "sale" | "expense";

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
  createSale: (data: SaleData) => Promise<{ saleId: string; transactionId: string }>;
  createExpense: (data: ExpenseData) => Promise<{ expenseId: string; transactionId: string }>;
}

const MutationQueueContext = createContext<MutationQueueContextType | undefined>(
  undefined
);

export function MutationQueueProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const createSaleMutation = useMutation(api.sales.createSale);
  const createExpenseMutation = useMutation(api.expenses.addExpenseGroup);

  const createSale = async (data: SaleData): Promise<{ saleId: string; transactionId: string }> => {
    setIsLoading(true);
    try {
      const result = await createSaleMutation({
        userId: data.userId as any,
        items: data.items as any,
        paymentReceived: data.paymentReceived,
        clientTimestamp: data.clientTimestamp,
      });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financialSummary"] });
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const createExpense = async (data: ExpenseData): Promise<{ expenseId: string; transactionId: string }> => {
    setIsLoading(true);
    try {
      const result = await createExpenseMutation({
        userId: data.userId as any,
        items: data.items as any,
        clientTimestamp: data.clientTimestamp,
        receiptImageStorageId: data.receiptImageStorageId as any,
      });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financialSummary"] });
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      createSale,
      createExpense,
    }),
    [createSaleMutation, createExpenseMutation, queryClient]
  );

  return (
    <MutationQueueContext.Provider value={value}>
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
