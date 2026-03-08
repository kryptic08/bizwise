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

// Generate a random expense transaction ID (e.g. EXP-B72K)
const generateExpenseId = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `EXP-${id}`;
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
    localDateStr: v.optional(v.string()), // YYYY-MM-DD in client local time
  },
  handler: async (ctx, args) => {
    const timestamp = args.clientTimestamp || Date.now();
    // Use client-provided local date string to avoid UTC offset issues
    let date: string;
    const now = new Date(timestamp);
    if (args.localDateStr) {
      date = args.localDateStr;
    } else {
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

    const total = args.amount * args.quantity;
    const transactionId = generateExpenseId();

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

    // For fractional quantities (< 1, e.g. 0.25 kg), the entered amount is the full
    // cost for that weight — keep as-is. For whole-number quantities (>= 1) multiply.
    const computeItemTotal = (amount: number, qty: number) =>
      qty < 1 ? amount : amount * qty;
    const totalAmount = args.items.reduce(
      (sum, item) => sum + computeItemTotal(item.amount, item.quantity),
      0,
    );
    const transactionId = generateExpenseId();

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
        total: computeItemTotal(item.amount, item.quantity),
      });
    }

    return { expenseId, transactionId, itemCount: args.items.length };
  },
});

/**
 * Repair mutation — fixes expense items saved with the quantity-bug where
 * total was stored as `amount` instead of `amount × quantity` for items
 * with a whole-number quantity > 1. Also corrects the parent expense's
 * totalAmount. Returns the number of items and expenses that were fixed.
 */
export const fixMiscalculatedExpenseItems = mutation({
  args: {},
  handler: async (ctx) => {
    const expenses = await ctx.db.query("expenses").collect();

    let fixedItemCount = 0;
    let affectedExpenseCount = 0;

    for (const expense of expenses) {
      const items = await ctx.db
        .query("expenseItems")
        .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
        .collect();

      let expenseNeedsUpdate = false;

      for (const item of items) {
        // Bugged items: quantity is a whole number > 1 but total === amount
        if (item.quantity > 1 && Math.abs(item.total - item.amount) < 0.001) {
          const correctTotal = item.amount * item.quantity;
          await ctx.db.patch(item._id, { total: correctTotal });
          fixedItemCount++;
          expenseNeedsUpdate = true;
        }
      }

      if (expenseNeedsUpdate) {
        // Re-fetch updated items to recompute the expense's totalAmount
        const updatedItems = await ctx.db
          .query("expenseItems")
          .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
          .collect();
        const newTotalAmount = updatedItems.reduce(
          (sum, i) => sum + i.total,
          0,
        );
        await ctx.db.patch(expense._id, { totalAmount: newTotalAmount });
        affectedExpenseCount++;
      }
    }

    return { fixedItemCount, affectedExpenseCount };
  },
});

// Soft-delete expense (move to trash)
export const softDeleteExpense = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { deletedAt: Date.now() });
  },
});

// Restore expense from trash
export const restoreExpense = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { deletedAt: undefined });
  },
});

// Permanently delete expense and all its items
export const permanentDeleteExpense = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("expenseItems")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.id))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(args.id);
  },
});
