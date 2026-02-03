import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all sales with items for a user
export const getSales = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    let sales;
    if (args.userId) {
      sales = await ctx.db
        .query("sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .collect();
    } else {
      sales = await ctx.db.query("sales").order("desc").collect();
    }

    const salesWithItems = await Promise.all(
      sales.map(async (sale) => {
        const items = await ctx.db
          .query("saleItems")
          .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
          .collect();
        return { ...sale, items };
      }),
    );

    return salesWithItems;
  },
});

// Get sales by date range for a user
export const getSalesByDateRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (args.userId) {
      const sales = await ctx.db
        .query("sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .collect();
      return sales.filter(
        (s) => s.date >= args.startDate && s.date <= args.endDate,
      );
    }
    return await ctx.db
      .query("sales")
      .withIndex("by_date", (q) =>
        q.gte("date", args.startDate).lte("date", args.endDate),
      )
      .order("desc")
      .collect();
  },
});

// Generate transaction ID for a user
const generateTransactionId = async (
  ctx: any,
  userId?: any,
): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

  // Count sales today to get next number
  let todaySales;
  if (userId) {
    todaySales = await ctx.db
      .query("sales")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    todaySales = todaySales.filter((s: any) => s.date === dateStr);
  } else {
    todaySales = await ctx.db
      .query("sales")
      .withIndex("by_date", (q: any) => q.eq("date", dateStr))
      .collect();
  }

  const nextNumber = todaySales.length + 1;
  return `SL-${nextNumber.toString().padStart(3, "0")}`;
};

// Create sale with items for a user
export const createSale = mutation({
  args: {
    userId: v.id("users"),
    items: v.array(
      v.object({
        productId: v.id("products"),
        productName: v.string(),
        category: v.string(),
        price: v.number(),
        quantity: v.number(),
      }),
    ),
    paymentReceived: v.number(),
    clientTimestamp: v.optional(v.number()), // Device timestamp
  },
  handler: async (ctx, args) => {
    // Use client timestamp if provided, otherwise use server time
    const timestamp = args.clientTimestamp || Date.now();
    const now = new Date(timestamp);
    const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const time = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Calculate totals
    const totalAmount = args.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const itemCount = args.items.reduce((sum, item) => sum + item.quantity, 0);
    const change = args.paymentReceived - totalAmount;

    // Generate transaction ID
    const transactionId = await generateTransactionId(ctx, args.userId);

    // Create sale record
    const saleId = await ctx.db.insert("sales", {
      userId: args.userId,
      transactionId,
      totalAmount,
      itemCount,
      paymentReceived: args.paymentReceived,
      change,
      date,
      time,
      createdAt: timestamp,
    });

    // Create sale items
    for (const item of args.items) {
      await ctx.db.insert("saleItems", {
        saleId,
        productId: item.productId,
        productName: item.productName,
        category: item.category,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
      });
    }

    return { saleId, transactionId };
  },
});
