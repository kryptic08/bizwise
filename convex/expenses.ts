import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all expenses for a user
export const getExpenses = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (args.userId) {
      return await ctx.db
        .query("expenses")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("expenses").order("desc").collect();
  },
});

// Get expenses by date range for a user
export const getExpensesByDateRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (args.userId) {
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .collect();
      return expenses.filter(
        (e) => e.date >= args.startDate && e.date <= args.endDate,
      );
    }
    return await ctx.db
      .query("expenses")
      .withIndex("by_date", (q) =>
        q.gte("date", args.startDate).lte("date", args.endDate),
      )
      .order("desc")
      .collect();
  },
});

// Generate expense transaction ID for a user
const generateExpenseId = async (ctx: any, userId?: any): Promise<string> => {
  // Count all expenses for the user to get unique sequential number
  let allExpenses;
  if (userId) {
    allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
  } else {
    allExpenses = await ctx.db.query("expenses").collect();
  }

  const nextNumber = allExpenses.length + 1;
  return `EXP-${nextNumber.toString().padStart(3, "0")}`;
};

// Add expense for a user (legacy - single item)
export const addExpense = mutation({
  args: {
    userId: v.id("users"),
    category: v.string(),
    title: v.string(),
    amount: v.number(),
    quantity: v.number(),
    receiptImageStorageId: v.optional(v.id("_storage")), // Convex storage ID
    receiptImage: v.optional(v.string()), // Legacy: local URI
    ocrText: v.optional(v.string()),
    clientTimestamp: v.optional(v.number()), // Device timestamp
  },
  handler: async (ctx, args) => {
    // Use client timestamp if provided, otherwise use server time
    const timestamp = args.clientTimestamp || Date.now();
    const now = new Date(timestamp);
    // Extract date components - the client timestamp is already in local time
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const date = `${year}-${month}-${day}`;
    const time = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const total = args.amount * args.quantity;
    const transactionId = await generateExpenseId(ctx, args.userId);

    const expenseId = await ctx.db.insert("expenses", {
      userId: args.userId,
      transactionId,
      totalAmount: total,
      itemCount: 1,
      date,
      time,
      receiptImageStorageId: args.receiptImageStorageId,
      receiptImage: args.receiptImage,
      ocrText: args.ocrText,
      createdAt: timestamp,
    });

    // Add the single item
    await ctx.db.insert("expenseItems", {
      expenseId,
      category: args.category,
      title: args.title,
      amount: args.amount,
      quantity: args.quantity,
      total,
    });

    return { expenseId, transactionId };
  },
});

// Add multiple expense items (grouped)
export const addExpenseGroup = mutation({
  args: {
    userId: v.id("users"),
    items: v.array(
      v.object({
        category: v.string(),
        title: v.string(),
        amount: v.number(),
        quantity: v.number(),
      }),
    ),
    receiptImageStorageId: v.optional(v.id("_storage")), // Convex storage ID
    receiptImage: v.optional(v.string()), // Legacy: local URI
    ocrText: v.optional(v.string()),
    clientTimestamp: v.optional(v.number()), // Device timestamp
    expenseDate: v.optional(v.string()), // Selected date in YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    // Use expenseDate if provided, otherwise derive from clientTimestamp or server time
    let date: string;
    let timestamp: number;
    let now: Date;

    if (args.expenseDate) {
      // When expenseDate is provided, use that date for both date and createdAt
      date = args.expenseDate;
      // Parse the expenseDate and get timestamp for that date (use clientTimestamp or current time)
      const clientTs = args.clientTimestamp || Date.now();
      now = new Date(clientTs);
      // Set the date to the selected date while keeping the time
      now.setFullYear(parseInt(args.expenseDate.split("-")[0]));
      now.setMonth(parseInt(args.expenseDate.split("-")[1]) - 1);
      now.setDate(parseInt(args.expenseDate.split("-")[2]));
      timestamp = now.getTime();
    } else {
      timestamp = args.clientTimestamp || Date.now();
      now = new Date(timestamp);
      // Extract date components - the client timestamp is already in local time
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      date = `${year}-${month}-${day}`;
    }

    const time = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Calculate total for all items
    const totalAmount = args.items.reduce(
      (sum, item) => sum + item.amount * item.quantity,
      0,
    );
    const transactionId = await generateExpenseId(ctx, args.userId);

    // Create the expense transaction
    const expenseId = await ctx.db.insert("expenses", {
      userId: args.userId,
      transactionId,
      totalAmount,
      itemCount: args.items.length,
      date,
      time,
      receiptImageStorageId: args.receiptImageStorageId,
      receiptImage: args.receiptImage,
      ocrText: args.ocrText,
      createdAt: timestamp,
    });

    // Add all expense items
    for (const item of args.items) {
      await ctx.db.insert("expenseItems", {
        expenseId,
        category: item.category,
        title: item.title,
        amount: item.amount,
        quantity: item.quantity,
        total: item.amount * item.quantity,
      });
    }

    return { expenseId, transactionId, itemCount: args.items.length };
  },
});

// Delete expense
export const deleteExpense = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    // Delete all expense items first
    const items = await ctx.db
      .query("expenseItems")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.id))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    // Then delete the expense
    await ctx.db.delete(args.id);
  },
});
