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
  // Count all sales for the user to get unique sequential number
  let allSales;
  if (userId) {
    allSales = await ctx.db
      .query("sales")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
  } else {
    allSales = await ctx.db.query("sales").collect();
  }

  const nextNumber = allSales.length + 1;
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
    saleDate: v.optional(v.string()), // Selected date in YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    // Use saleDate if provided, otherwise derive from clientTimestamp or server time
    let date: string;
    let timestamp: number;
    let now: Date;

    if (args.saleDate) {
      // When saleDate is provided, use that date for both date and createdAt
      date = args.saleDate;
      // Parse the saleDate and get timestamp for that date (use clientTimestamp or current time)
      const clientTs = args.clientTimestamp || Date.now();
      now = new Date(clientTs);
      // Set the date to the selected date while keeping the time
      now.setFullYear(parseInt(args.saleDate.split("-")[0]));
      now.setMonth(parseInt(args.saleDate.split("-")[1]) - 1);
      now.setDate(parseInt(args.saleDate.split("-")[2]));
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
