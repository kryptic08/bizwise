import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get financial summary (totals) for a user
// Optimized to process sales and calculate totals in a single pass
export const getFinancialSummary = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // Get sales and calculate totals in parallel
    let sales;
    if (args.userId) {
      sales = (
        await ctx.db
          .query("sales")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect()
      ).filter((s) => !s.deletedAt);
    } else {
      sales = (await ctx.db.query("sales").collect()).filter(
        (s) => !s.deletedAt,
      );
    }

    // Get expenses in parallel with sale items processing
    const [expenses, saleItemsData] = await Promise.all([
      args.userId
        ? ctx.db
            .query("expenses")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect()
            .then((arr) => arr.filter((e) => !e.deletedAt))
        : ctx.db
            .query("expenses")
            .collect()
            .then((arr) => arr.filter((e) => !e.deletedAt)),

      // Fetch all sale items in parallel (batch operation)
      Promise.all(
        sales.slice(0, 100).map(async (sale) => {
          const items = await ctx.db
            .query("saleItems")
            .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
            .collect();
          return items.reduce((sum, item) => sum + item.quantity, 0);
        }),
      ),
    ]);

    // Calculate totals
    const totalIncome = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalExpense = expenses.reduce(
      (sum, expense) => sum + expense.totalAmount,
      0,
    );

    // Sum up products sold from the batched results
    const totalProductsSold = saleItemsData.reduce((sum, qty) => sum + qty, 0);

    // If there are more than 100 sales, add remaining products
    let remainingProductsSold = 0;
    if (sales.length > 100) {
      const remainingSales = sales.slice(100);
      const remainingItems = await Promise.all(
        remainingSales.slice(0, 100).map(async (sale) => {
          const items = await ctx.db
            .query("saleItems")
            .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
            .collect();
          return items.reduce((sum, item) => sum + item.quantity, 0);
        }),
      );
      remainingProductsSold = remainingItems.reduce((sum, qty) => sum + qty, 0);
    }

    return {
      totalBalance: totalIncome - totalExpense,
      totalIncome,
      totalExpense,
      profit: totalIncome - totalExpense,
      productsSold: totalProductsSold + remainingProductsSold,
      transactionCount: sales.length,
    };
  },
});

// Get daily analytics for charts for a user
export const getDailyAnalytics = query({
  args: {
    startDate: v.string(), // YYYY-MM-DD in client local time (Monday of current week)
    endDate: v.string(), // YYYY-MM-DD in client local time (Sunday of current week)
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Build date array from client-provided local date strings (avoids UTC offset issues)
    const dateArray: string[] = [];
    const start = new Date(args.startDate + "T00:00:00");
    const end = new Date(args.endDate + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dateArray.push(`${y}-${m}-${day}`);
    }

    const analytics = await Promise.all(
      dateArray.map(async (date) => {
        // Get sales for this date using compound index
        let sales;
        if (args.userId) {
          sales = await ctx.db
            .query("sales")
            .withIndex("by_user_date", (q) =>
              q.eq("userId", args.userId).eq("date", date),
            )
            .collect();
        } else {
          sales = await ctx.db
            .query("sales")
            .withIndex("by_date", (q) => q.eq("date", date))
            .collect();
        }

        // Get expenses for this date using compound index
        let expenses;
        if (args.userId) {
          expenses = await ctx.db
            .query("expenses")
            .withIndex("by_user_date", (q) =>
              q.eq("userId", args.userId).eq("date", date),
            )
            .collect();
        } else {
          expenses = await ctx.db
            .query("expenses")
            .withIndex("by_date", (q) => q.eq("date", date))
            .collect();
        }

        const income = sales
          .filter((s) => !s.deletedAt)
          .reduce((sum, sale) => sum + sale.totalAmount, 0);
        const expense = expenses
          .filter((e) => !e.deletedAt)
          .reduce((sum, exp) => sum + exp.totalAmount, 0);

        return {
          date,
          income,
          expense,
          profit: income - expense,
          salesCount: sales.length,
          expenseCount: expenses.length,
        };
      }),
    );

    return analytics;
  },
});

// Get monthly analytics (last 12 months) for a user
// Optimized: uses range queries per month on compound index (only 24 queries for 12 months)
// Previous per-day approach (~730 queries) exceeded the 4,096 read limit
export const getMonthlyAnalytics = query({
  args: {
    year: v.optional(v.number()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    // Build the 12 months to query (last 12 months including current)
    const months: { year: number; month: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }

    // Process each month using efficient RANGE queries on the compound index
    const monthlyData = await Promise.all(
      months.map(async ({ year, month }) => {
        // Start: first day of this month, End: first day of next month
        const mm = String(month + 1).padStart(2, "0");
        const startDate = `${year}-${mm}-01`;

        const nextMonth = month + 1;
        const endYear = nextMonth > 11 ? year + 1 : year;
        const endMM = String((nextMonth > 11 ? 0 : nextMonth) + 1).padStart(
          2,
          "0",
        );
        const endDate = `${endYear}-${endMM}-01`;

        let sales;
        let expenses;

        if (args.userId) {
          [sales, expenses] = await Promise.all([
            ctx.db
              .query("sales")
              .withIndex("by_user_date", (q) =>
                q
                  .eq("userId", args.userId)
                  .gte("date", startDate)
                  .lt("date", endDate),
              )
              .collect(),
            ctx.db
              .query("expenses")
              .withIndex("by_user_date", (q) =>
                q
                  .eq("userId", args.userId)
                  .gte("date", startDate)
                  .lt("date", endDate),
              )
              .collect(),
          ]);
        } else {
          [sales, expenses] = await Promise.all([
            ctx.db
              .query("sales")
              .withIndex("by_date", (q) =>
                q.gte("date", startDate).lt("date", endDate),
              )
              .collect(),
            ctx.db
              .query("expenses")
              .withIndex("by_date", (q) =>
                q.gte("date", startDate).lt("date", endDate),
              )
              .collect(),
          ]);
        }

        const income = sales
          .filter((s) => !s.deletedAt)
          .reduce((sum, s) => sum + s.totalAmount, 0);
        const expense = expenses
          .filter((e) => !e.deletedAt)
          .reduce((sum, e) => sum + e.totalAmount, 0);

        return {
          month: monthNames[month],
          monthNumber: month + 1,
          income,
          expense,
          profit: income - expense,
          salesCount: sales.length,
          expenseCount: expenses.length,
        };
      }),
    );

    return monthlyData;
  },
});

// Get combined transactions (sales + expenses) for transaction screen for a user
export const getCombinedTransactions = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // Get all sales and expenses
    let sales;
    let expenses;

    if (args.userId) {
      sales = (
        await ctx.db
          .query("sales")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect()
      ).filter((s) => !s.deletedAt);
      expenses = (
        await ctx.db
          .query("expenses")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect()
      ).filter((e) => !e.deletedAt);
    } else {
      sales = (await ctx.db.query("sales").collect()).filter(
        (s) => !s.deletedAt,
      );
      expenses = (await ctx.db.query("expenses").collect()).filter(
        (e) => !e.deletedAt,
      );
    }

    // Helper function to format time in Philippines timezone (UTC+8)
    // Convex runs on cloud servers in UTC, so we must add 8 hours
    const formatTime = (timestamp: number) => {
      // Add 8 hours (28800000 ms) for Philippines timezone
      const phTimestamp = timestamp + 8 * 60 * 60 * 1000;
      const date = new Date(phTimestamp);
      const hours24 = date.getUTCHours();
      const minutes = date.getUTCMinutes();
      const ampm = hours24 >= 12 ? "PM" : "AM";
      let hours = hours24 % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
    };

    // Helper function to format date in Philippines timezone
    const formatDate = (timestamp: number) => {
      const phTimestamp = timestamp + 8 * 60 * 60 * 1000;
      const date = new Date(phTimestamp);
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${months[date.getUTCMonth()]}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
    };

    // Helper to format date from sale/expense record (use stored date if available)
    const getDateFromSale = (sale: { date?: string; createdAt: number }) => {
      if (sale.date) {
        const [year, month, day] = sale.date.split("-").map(Number);
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        return `${months[month - 1]}/${day}/${year}`;
      }
      return formatDate(sale.createdAt);
    };

    const getDateFromExpense = (expense: {
      date?: string;
      createdAt: number;
    }) => {
      if (expense.date) {
        const [year, month, day] = expense.date.split("-").map(Number);
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        return `${months[month - 1]}/${day}/${year}`;
      }
      return formatDate(expense.createdAt);
    };

    // Create unified transaction array with sortKey
    const allTransactions: {
      id: string;
      transactionId: string;
      date: string;
      time: string;
      items: string;
      amount: string;
      type: "income" | "expense";
      createdAt: number;
      sortKey: number;
      itemDetails: {
        name: string;
        category: string;
        pricePerPiece: string;
        pieces: number;
        amount: string;
      }[];
    }[] = [];

    // Process and add sales
    for (const sale of sales) {
      const items = await ctx.db
        .query("saleItems")
        .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
        .collect();

      const transaction = {
        id: sale._id,
        transactionId: sale.transactionId,
        date: getDateFromSale(sale),
        time: formatTime(sale.createdAt),
        items: `${sale.itemCount} items`,
        amount: `₱${sale.totalAmount.toFixed(2)}`,
        type: "income" as const,
        createdAt: sale.createdAt,
        sortKey: sale.createdAt,
        itemDetails: items.map((item) => ({
          name: item.productName,
          category: item.category,
          pricePerPiece: `₱${item.price.toFixed(2)}`,
          pieces: item.quantity,
          amount: `₱${item.subtotal.toFixed(2)}`,
        })),
      };

      allTransactions.push(transaction);
    }

    // Process and add expenses
    for (const expense of expenses) {
      const items = await ctx.db
        .query("expenseItems")
        .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
        .collect();

      const transaction = {
        id: expense._id,
        transactionId: expense.transactionId,
        date: getDateFromExpense(expense),
        time: formatTime(expense.createdAt),
        items: `${expense.itemCount} items`,
        amount: `₱${expense.totalAmount.toFixed(2)}`,
        type: "expense" as const,
        createdAt: expense.createdAt,
        sortKey: expense.createdAt,
        itemDetails: items.map((item) => ({
          name: item.title,
          category: item.category,
          pricePerPiece: `₱${item.amount.toFixed(2)}`,
          pieces: item.quantity,
          amount: `₱${item.total.toFixed(2)}`,
        })),
      };

      allTransactions.push(transaction);
    }

    // Sort ALL transactions by sortKey (most recent first)
    allTransactions.sort((a, b) => b.sortKey - a.sortKey);

    return allTransactions;
  },
});

// Get combined transactions with pagination (more efficient)
export const getCombinedTransactionsPaginated = query({
  args: {
    userId: v.id("users"),
    limit: v.number(),
    cursor: v.optional(v.number()), // createdAt timestamp for pagination
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit, 50); // Cap at 50 for safety
    const cursor = args.cursor;

    // Get sales - order by createdAt desc for proper pagination
    let salesQuery = ctx.db
      .query("sales")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc");

    const salesPage = await salesQuery.take(limit + 1); // Take one extra to check if there's more

    // Get expenses - order by createdAt desc for proper pagination
    let expensesQuery = ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc");

    const expensesPage = await expensesQuery.take(limit + 1);

    // Apply cursor filter and exclude trashed records
    let filteredSales = salesPage.filter((s) => !s.deletedAt);
    let filteredExpenses = expensesPage.filter((e) => !e.deletedAt);

    if (cursor) {
      filteredSales = filteredSales.filter((s) => s.createdAt < cursor);
      filteredExpenses = filteredExpenses.filter((e) => e.createdAt < cursor);
    }

    // Check if there are more results (compare original pages before filtering)
    const salesHasMore = salesPage.length > limit;
    const expensesHasMore = expensesPage.length > limit;

    // Trim to actual limit
    const sales = filteredSales.slice(0, limit);
    const expenses = filteredExpenses.slice(0, limit);

    // Helper functions
    const formatTime = (timestamp: number) => {
      const phTimestamp = timestamp + 8 * 60 * 60 * 1000;
      const date = new Date(phTimestamp);
      const hours24 = date.getUTCHours();
      const minutes = date.getUTCMinutes();
      const ampm = hours24 >= 12 ? "PM" : "AM";
      let hours = hours24 % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
    };

    // Use the stored date field if available, otherwise format from createdAt
    const formatDateFromSale = (sale: { date?: string; createdAt: number }) => {
      if (sale.date) {
        // date is in YYYY-MM-DD format, convert to "Feb/25/2026" format
        const [year, month, day] = sale.date.split("-").map(Number);
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        return `${months[month - 1]}/${day}/${year}`;
      }
      // Fallback to createdAt
      const phTimestamp = sale.createdAt + 8 * 60 * 60 * 1000;
      const date = new Date(phTimestamp);
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${months[date.getUTCMonth()]}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
    };

    const formatDateFromExpense = (expense: {
      date?: string;
      createdAt: number;
    }) => {
      if (expense.date) {
        // date is in YYYY-MM-DD format, convert to "Feb/25/2026" format
        const [year, month, day] = expense.date.split("-").map(Number);
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        return `${months[month - 1]}/${day}/${year}`;
      }
      // Fallback to createdAt
      const phTimestamp = expense.createdAt + 8 * 60 * 60 * 1000;
      const date = new Date(phTimestamp);
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${months[date.getUTCMonth()]}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
    };

    // Combine and sort transactions
    const allTransactions: Array<{
      id: string;
      transactionId: string;
      date: string;
      time: string;
      items: string;
      amount: string;
      type: "income" | "expense";
      createdAt: number;
      sortKey: number;
      itemDetails: Array<{
        name: string;
        category: string;
        pricePerPiece: string;
        pieces: number;
        amount: string;
      }>;
    }> = [];

    // Process sales
    for (const sale of sales) {
      const items = await ctx.db
        .query("saleItems")
        .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
        .collect();

      allTransactions.push({
        id: sale._id,
        transactionId: sale.transactionId,
        date: formatDateFromSale(sale),
        time: formatTime(sale.createdAt),
        items: `${sale.itemCount} items`,
        amount: `₱${sale.totalAmount.toFixed(2)}`,
        type: "income" as const,
        createdAt: sale.createdAt,
        sortKey: sale.createdAt,
        itemDetails: items.map((item) => ({
          name: item.productName,
          category: item.category,
          pricePerPiece: `₱${item.price.toFixed(2)}`,
          pieces: item.quantity,
          amount: `₱${item.subtotal.toFixed(2)}`,
        })),
      });
    }

    // Process expenses
    for (const expense of expenses) {
      const items = await ctx.db
        .query("expenseItems")
        .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
        .collect();

      allTransactions.push({
        id: expense._id,
        transactionId: expense.transactionId,
        date: formatDateFromExpense(expense),
        time: formatTime(expense.createdAt),
        items: `${expense.itemCount} items`,
        amount: `₱${expense.totalAmount.toFixed(2)}`,
        type: "expense" as const,
        createdAt: expense.createdAt,
        sortKey: expense.createdAt,
        itemDetails: items.map((item) => ({
          name: item.title,
          category: item.category,
          pricePerPiece: `₱${item.amount.toFixed(2)}`,
          pieces: item.quantity,
          amount: `₱${item.total.toFixed(2)}`,
        })),
      });
    }

    // Sort by most recent first
    allTransactions.sort((a, b) => b.sortKey - a.sortKey);

    // Take only the requested limit
    const paginatedTransactions = allTransactions.slice(0, limit);

    // Determine if there are more results
    const hasMore = salesHasMore || expensesHasMore;

    // Get the cursor for next page (oldest item's createdAt)
    const nextCursor =
      paginatedTransactions.length > 0
        ? paginatedTransactions[paginatedTransactions.length - 1].createdAt
        : undefined;

    return {
      transactions: paginatedTransactions,
      hasMore,
      nextCursor,
    };
  },
});

// Get weekly analytics (last N weeks) for a user
export const getWeeklyAnalytics = query({
  args: {
    weeks: v.number(),
    userId: v.optional(v.id("users")),
    todayLocalStr: v.optional(v.string()), // YYYY-MM-DD in client local time
  },
  handler: async (ctx, args) => {
    // Use client's local today string to avoid UTC offset issues
    const todayStr =
      args.todayLocalStr ?? new Date().toISOString().slice(0, 10);
    const today = new Date(todayStr + "T00:00:00");
    const analytics = [];

    // Monday-start: how many days back to reach the Monday of this week
    const todayDow = today.getDay();
    const daysToCurrentMonday = todayDow === 0 ? 6 : todayDow - 1;

    // Helper: format Date as YYYY-MM-DD using local date parts
    const fmtDate = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    for (let i = args.weeks - 1; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7 + daysToCurrentMonday));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const startDateStr = fmtDate(weekStart);
      const endDateStr = fmtDate(weekEnd);

      // Generate date array for the week
      const weekDates = [];
      for (
        let d = new Date(weekStart);
        d <= weekEnd;
        d.setDate(d.getDate() + 1)
      ) {
        weekDates.push(fmtDate(d));
      }

      // Query each day in the week using compound index
      const weekData = await Promise.all(
        weekDates.map(async (date) => {
          let sales, expenses;

          if (args.userId) {
            [sales, expenses] = await Promise.all([
              ctx.db
                .query("sales")
                .withIndex("by_user_date", (q) =>
                  q.eq("userId", args.userId).eq("date", date),
                )
                .collect(),
              ctx.db
                .query("expenses")
                .withIndex("by_user_date", (q) =>
                  q.eq("userId", args.userId).eq("date", date),
                )
                .collect(),
            ]);
          } else {
            [sales, expenses] = await Promise.all([
              ctx.db
                .query("sales")
                .withIndex("by_date", (q) => q.eq("date", date))
                .collect(),
              ctx.db
                .query("expenses")
                .withIndex("by_date", (q) => q.eq("date", date))
                .collect(),
            ]);
          }

          return { sales, expenses };
        }),
      );

      // Aggregate the week's data (exclude soft-deleted records)
      const allSales = weekData
        .flatMap((d) => d.sales)
        .filter((s) => !s.deletedAt);
      const allExpenses = weekData
        .flatMap((d) => d.expenses)
        .filter((e) => !e.deletedAt);

      const income = allSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
      const expense = allExpenses.reduce(
        (sum, exp) => sum + exp.totalAmount,
        0,
      );

      analytics.push({
        weekStart: startDateStr,
        weekEnd: endDateStr,
        income,
        expense,
        profit: income - expense,
        salesCount: allSales.length,
        expenseCount: allExpenses.length,
      });
    }

    return analytics;
  },
});

// Get top selling product for a user
// Fixed: queries user's own sales first (indexed), then fetches only their saleItems
// Old approach scanned ALL saleItems from ALL users — very wasteful
export const getTopSellingProduct = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // Fetch user's non-deleted sales via index (not a full table scan)
    let activeSales;
    if (args.userId) {
      activeSales = (
        await ctx.db
          .query("sales")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect()
      ).filter((s) => !s.deletedAt);
    } else {
      activeSales = (await ctx.db.query("sales").collect()).filter(
        (s) => !s.deletedAt,
      );
    }

    // Fetch saleItems only for this user's sales (capped at 200 to stay within limits)
    const saleItemArrays = await Promise.all(
      activeSales.slice(0, 200).map((s) =>
        ctx.db
          .query("saleItems")
          .withIndex("by_sale", (q) => q.eq("saleId", s._id))
          .collect(),
      ),
    );
    const filteredItems = saleItemArrays.flat();

    // Count quantities by product
    const productCounts = new Map<string, { name: string; count: number }>();
    for (const item of filteredItems) {
      const existing = productCounts.get(item.productName);
      if (existing) {
        existing.count += item.quantity;
      } else {
        productCounts.set(item.productName, {
          name: item.productName,
          count: item.quantity,
        });
      }
    }

    let topProduct = { name: "No Sales Yet", count: 0 };
    for (const product of productCounts.values()) {
      if (product.count > topProduct.count) topProduct = product;
    }

    return topProduct;
  },
});

// Get top selling category for a user
// Fixed: same user-indexed approach as getTopSellingProduct
export const getTopSellingCategory = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // Fetch user's non-deleted sales via index
    let activeSales;
    if (args.userId) {
      activeSales = (
        await ctx.db
          .query("sales")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect()
      ).filter((s) => !s.deletedAt);
    } else {
      activeSales = (await ctx.db.query("sales").collect()).filter(
        (s) => !s.deletedAt,
      );
    }

    const saleItemArrays = await Promise.all(
      activeSales.slice(0, 200).map((s) =>
        ctx.db
          .query("saleItems")
          .withIndex("by_sale", (q) => q.eq("saleId", s._id))
          .collect(),
      ),
    );
    const filteredItems = saleItemArrays.flat();

    const categoryCounts = new Map<string, { name: string; count: number }>();
    for (const item of filteredItems) {
      const existing = categoryCounts.get(item.category);
      if (existing) {
        existing.count += item.quantity;
      } else {
        categoryCounts.set(item.category, {
          name: item.category,
          count: item.quantity,
        });
      }
    }

    let topCategory = { name: "No Sales Yet", count: 0 };
    for (const category of categoryCounts.values()) {
      if (category.count > topCategory.count) topCategory = category;
    }

    return topCategory;
  },
});

// Get target income progress for current month
export const getTargetProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get user and target
    const user = await ctx.db.get(args.userId);
    if (!user || !user.targetIncome || !user.targetIncome.monthly) {
      return null;
    }

    const target = user.targetIncome;

    // Get current month's date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const currentDay = now.getDate();
    const totalDaysInMonth = endOfMonth.getDate();

    // Calculate date strings for filtering
    const startDateStr = startOfMonth.toISOString().slice(0, 10);
    const endDateStr = endOfMonth.toISOString().slice(0, 10);

    // Get all sales for current month
    const allSales = await ctx.db
      .query("sales")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const monthSales = allSales.filter(
      (sale) => sale.date >= startDateStr && sale.date <= endDateStr,
    );

    const currentIncome = monthSales.reduce(
      (sum, sale) => sum + sale.totalAmount,
      0,
    );

    // Calculate progress
    const progressPercentage = (currentIncome / target.monthly) * 100;
    const remaining = target.monthly - currentIncome;
    const daysRemaining = totalDaysInMonth - currentDay;
    const requiredDailyIncome =
      daysRemaining > 0 ? remaining / daysRemaining : 0;

    // Determine status
    const expectedIncome = (target.monthly / totalDaysInMonth) * currentDay;
    let status: "ahead" | "on-track" | "behind" = "on-track";

    if (currentIncome >= target.monthly) {
      status = "ahead";
    } else if (currentIncome >= expectedIncome * 0.9) {
      status = "on-track";
    } else {
      status = "behind";
    }

    return {
      target: target.monthly,
      current: currentIncome,
      remaining: Math.max(0, remaining),
      progressPercentage: Math.min(100, progressPercentage),
      daysRemaining,
      requiredDailyIncome: Math.max(0, requiredDailyIncome),
      status,
      currentDay,
      totalDaysInMonth,
    };
  },
});

// Combined dashboard query — returns ALL data the home screen needs in ONE subscription.
// Replaces 7 separate subscriptions (getFinancialSummary, getDailyAnalytics,
// getWeeklyAnalytics, getMonthlyAnalytics, getTopSellingProduct,
// getTopSellingCategory, getTargetProgress) → ~80% bandwidth reduction.
//
// Sunday-leak proof: date arithmetic uses client-provided local date strings
// (weekStartDate, weekEndDate, todayLocalStr) so Philippines 12AM–7:59AM
// transactions are stored on the correct local day, not the UTC-previous day.
export const getDashboardData = query({
  args: {
    userId: v.id("users"),
    todayLocalStr: v.string(), // YYYY-MM-DD in client local time
    weekStartDate: v.string(), // Monday of current week (YYYY-MM-DD)
    weekEndDate: v.string(), // Sunday of current week (YYYY-MM-DD)
    weeksCount: v.optional(v.number()), // Weeks for weekly chart (default 7)
  },
  handler: async (ctx, args) => {
    const weeksCount = args.weeksCount ?? 7;

    // ── Fetch user, sales, expenses ONCE via indexed queries ────────────
    const [user, allSales, allExpenses] = await Promise.all([
      ctx.db.get(args.userId),
      ctx.db
        .query("sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect(),
      ctx.db
        .query("expenses")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect(),
    ]);

    const activeSales = allSales.filter((s) => !s.deletedAt);
    const activeExpenses = allExpenses.filter((e) => !e.deletedAt);

    // ── Helper: format Date → YYYY-MM-DD ───────────────────────────────
    const fmtDate = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    // ── Financial Summary ───────────────────────────────────────────────
    // Uses stored totalAmount and itemCount — no saleItems scan needed here
    const totalIncome = activeSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalExpense = activeExpenses.reduce(
      (sum, e) => sum + e.totalAmount,
      0,
    );
    const productsSold = activeSales.reduce((sum, s) => sum + s.itemCount, 0);

    // ── Top Product & Category ──────────────────────────────────────────
    // Scan saleItems ONCE for this user's sales (capped at 200 sales)
    const salesForItems = activeSales.slice(0, 200);
    const saleItemArrays = await Promise.all(
      salesForItems.map((s) =>
        ctx.db
          .query("saleItems")
          .withIndex("by_sale", (q) => q.eq("saleId", s._id))
          .collect(),
      ),
    );
    const saleItems = saleItemArrays.flat();

    // ── Period-specific Top Products / Categories ───────────────────────
    // Helper to compute top product and category from a subset of saleItems
    const computeTopProductAndCategory = (
      forSaleIds: Set<string>,
    ): {
      topProduct: { name: string; count: number };
      topCategory: { name: string; count: number };
    } => {
      const pm = new Map<string, { name: string; count: number }>();
      const cm = new Map<string, { name: string; count: number }>();
      for (const item of saleItems) {
        if (!forSaleIds.has(String(item.saleId))) continue;
        const p = pm.get(item.productName);
        if (p) p.count += item.quantity;
        else
          pm.set(item.productName, {
            name: item.productName,
            count: item.quantity,
          });
        const c = cm.get(item.category);
        if (c) c.count += item.quantity;
        else
          cm.set(item.category, { name: item.category, count: item.quantity });
      }
      let tp = { name: "No Sales Yet", count: 0 };
      for (const p of pm.values()) if (p.count > tp.count) tp = p;
      let tc = { name: "No Sales Yet", count: 0 };
      for (const c of cm.values()) if (c.count > tc.count) tc = c;
      return { topProduct: tp, topCategory: tc };
    };

    // Weekly (current week: weekStartDate–weekEndDate)
    const weeklySaleIds = new Set(
      activeSales
        .filter(
          (s) => s.date >= args.weekStartDate && s.date <= args.weekEndDate,
        )
        .map((s) => String(s._id)),
    );
    const { topProduct: topProductWeekly, topCategory: topCategoryWeekly } =
      computeTopProductAndCategory(weeklySaleIds);

    // Monthly (current calendar month)
    const todayD = new Date(args.todayLocalStr + "T00:00:00");
    const mm = String(todayD.getMonth() + 1).padStart(2, "0");
    const monthStart = `${todayD.getFullYear()}-${mm}-01`;
    const lastDayOfMonth = new Date(
      todayD.getFullYear(),
      todayD.getMonth() + 1,
      0,
    ).getDate();
    const monthEnd = `${todayD.getFullYear()}-${mm}-${String(lastDayOfMonth).padStart(2, "0")}`;
    const monthlySaleIds = new Set(
      activeSales
        .filter((s) => s.date >= monthStart && s.date <= monthEnd)
        .map((s) => String(s._id)),
    );
    const { topProduct: topProductMonthly, topCategory: topCategoryMonthly } =
      computeTopProductAndCategory(monthlySaleIds);

    // Yearly (current calendar year)
    const yearStart = `${todayD.getFullYear()}-01-01`;
    const yearEnd = `${todayD.getFullYear()}-12-31`;
    const yearlySaleIds = new Set(
      activeSales
        .filter((s) => s.date >= yearStart && s.date <= yearEnd)
        .map((s) => String(s._id)),
    );
    const { topProduct: topProductYearly, topCategory: topCategoryYearly } =
      computeTopProductAndCategory(yearlySaleIds);

    // ── Daily Analytics (Mon–Sun of current week, in-memory) ───────────
    const weekStart = new Date(args.weekStartDate + "T00:00:00");
    const weekEnd = new Date(args.weekEndDate + "T00:00:00");
    const dailyAnalytics: {
      date: string;
      income: number;
      expense: number;
      profit: number;
    }[] = [];
    for (
      let d = new Date(weekStart);
      d <= weekEnd;
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = fmtDate(d);
      const income = activeSales
        .filter((s) => s.date === dateStr)
        .reduce((sum, s) => sum + s.totalAmount, 0);
      const expense = activeExpenses
        .filter((e) => e.date === dateStr)
        .reduce((sum, e) => sum + e.totalAmount, 0);
      dailyAnalytics.push({
        date: dateStr,
        income,
        expense,
        profit: income - expense,
      });
    }

    // ── Weekly Analytics (last N weeks, Monday-start, in-memory) ───────
    const today = new Date(args.todayLocalStr + "T00:00:00");
    const todayDow = today.getDay();
    const daysToCurrentMonday = todayDow === 0 ? 6 : todayDow - 1;
    const weeklyAnalytics: {
      weekStart: string;
      weekEnd: string;
      income: number;
      expense: number;
      profit: number;
    }[] = [];
    for (let i = weeksCount - 1; i >= 0; i--) {
      const wStart = new Date(today);
      wStart.setDate(today.getDate() - (i * 7 + daysToCurrentMonday));
      wStart.setHours(0, 0, 0, 0);
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);
      const startStr = fmtDate(wStart);
      const endStr = fmtDate(wEnd);
      const income = activeSales
        .filter((s) => s.date >= startStr && s.date <= endStr)
        .reduce((sum, s) => sum + s.totalAmount, 0);
      const expense = activeExpenses
        .filter((e) => e.date >= startStr && e.date <= endStr)
        .reduce((sum, e) => sum + e.totalAmount, 0);
      weeklyAnalytics.push({
        weekStart: startStr,
        weekEnd: endStr,
        income,
        expense,
        profit: income - expense,
      });
    }

    // ── Monthly Analytics (last 12 months, in-memory) ──────────────────
    const MONTH_NAMES = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const now = new Date();
    const monthlyAnalytics: {
      month: string;
      monthNumber: number;
      income: number;
      expense: number;
      profit: number;
    }[] = [];
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(
        now.getFullYear(),
        now.getMonth() - (11 - i),
        1,
      );
      const mm = String(monthDate.getMonth() + 1).padStart(2, "0");
      const startDate = `${monthDate.getFullYear()}-${mm}-01`;
      const nextM = monthDate.getMonth() + 1;
      const endYear =
        nextM > 11 ? monthDate.getFullYear() + 1 : monthDate.getFullYear();
      const endMM = String((nextM > 11 ? 0 : nextM) + 1).padStart(2, "0");
      const endDate = `${endYear}-${endMM}-01`;
      const income = activeSales
        .filter((s) => s.date >= startDate && s.date < endDate)
        .reduce((sum, s) => sum + s.totalAmount, 0);
      const expense = activeExpenses
        .filter((e) => e.date >= startDate && e.date < endDate)
        .reduce((sum, e) => sum + e.totalAmount, 0);
      monthlyAnalytics.push({
        month: MONTH_NAMES[monthDate.getMonth()],
        monthNumber: monthDate.getMonth() + 1,
        income,
        expense,
        profit: income - expense,
      });
    }

    // ── Target Progress ─────────────────────────────────────────────────
    // Uses todayLocalStr (client local date) to avoid UTC midnight miscount
    // e.g. Philippines 12AM–7:59AM = previous UTC day → wrong month detection fixed
    type TargetProgressResult = {
      target: number;
      current: number;
      remaining: number;
      progressPercentage: number;
      daysRemaining: number;
      requiredDailyIncome: number;
      status: "ahead" | "on-track" | "behind";
      currentDay: number;
      totalDaysInMonth: number;
    };
    let targetProgress: TargetProgressResult | null = null;
    if (user && user.targetIncome && user.targetIncome.monthly) {
      const target = user.targetIncome.monthly;
      const clientToday = new Date(args.todayLocalStr + "T00:00:00");
      const currentDay = clientToday.getDate();
      const endOfMonthDate = new Date(
        clientToday.getFullYear(),
        clientToday.getMonth() + 1,
        0,
      );
      const totalDaysInMonth = endOfMonthDate.getDate();
      const mm = String(clientToday.getMonth() + 1).padStart(2, "0");
      const startOfMonthStr = `${clientToday.getFullYear()}-${mm}-01`;
      const endOfMonthStr = fmtDate(endOfMonthDate);
      const currentIncome = activeSales
        .filter((s) => s.date >= startOfMonthStr && s.date <= endOfMonthStr)
        .reduce((sum, s) => sum + s.totalAmount, 0);
      const progressPercentage = (currentIncome / target) * 100;
      const remaining = target - currentIncome;
      const daysRemaining = totalDaysInMonth - currentDay;
      const requiredDailyIncome =
        daysRemaining > 0 ? remaining / daysRemaining : 0;
      const expectedIncome = (target / totalDaysInMonth) * currentDay;
      let status: "ahead" | "on-track" | "behind" = "on-track";
      if (currentIncome >= target) status = "ahead";
      else if (currentIncome >= expectedIncome * 0.9) status = "on-track";
      else status = "behind";
      targetProgress = {
        target,
        current: currentIncome,
        remaining: Math.max(0, remaining),
        progressPercentage: Math.min(100, progressPercentage),
        daysRemaining,
        requiredDailyIncome: Math.max(0, requiredDailyIncome),
        status,
        currentDay,
        totalDaysInMonth,
      };
    }

    return {
      financialSummary: {
        totalBalance: totalIncome - totalExpense,
        totalIncome,
        totalExpense,
        profit: totalIncome - totalExpense,
        productsSold,
        transactionCount: activeSales.length,
      },
      topProductWeekly,
      topCategoryWeekly,
      topProductMonthly,
      topCategoryMonthly,
      topProductYearly,
      topCategoryYearly,
      dailyAnalytics,
      weeklyAnalytics,
      monthlyAnalytics,
      targetProgress,
    };
  },
});

// Get analytics for a custom date range (for PDF reports)
export const getAnalyticsByDateRange = query({
  args: {
    userId: v.id("users"),
    startMonth: v.number(), // 1-12
    startYear: v.number(),
    endMonth: v.number(), // 1-12
    endYear: v.number(),
  },
  handler: async (ctx, args) => {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    // Build month list from start to end
    const months: { year: number; month: number }[] = [];
    let y = args.startYear;
    let m = args.startMonth - 1; // 0-indexed
    const endM = args.endMonth - 1;
    const endY = args.endYear;

    while (y < endY || (y === endY && m <= endM)) {
      months.push({ year: y, month: m });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }

    // Calculate totals and monthly data by querying each day efficiently
    let totalIncome = 0;
    let totalExpense = 0;
    let totalSalesCount = 0;
    let totalProductsSold = 0;

    const monthlyData = await Promise.all(
      months.map(async ({ year, month }) => {
        // Generate all dates in this month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthDates = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day);
          monthDates.push(date.toISOString().slice(0, 10));
        }

        // Query all dates in parallel using compound index
        const dailyData = await Promise.all(
          monthDates.map(async (date) => {
            const [sales, expenses] = await Promise.all([
              ctx.db
                .query("sales")
                .withIndex("by_user_date", (q) =>
                  q.eq("userId", args.userId).eq("date", date),
                )
                .collect(),
              ctx.db
                .query("expenses")
                .withIndex("by_user_date", (q) =>
                  q.eq("userId", args.userId).eq("date", date),
                )
                .collect(),
            ]);
            return { sales, expenses };
          }),
        );

        // Aggregate month data
        const monthSales = dailyData.flatMap((d) => d.sales);
        const monthExpenses = dailyData.flatMap((d) => d.expenses);

        const income = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);
        const expense = monthExpenses.reduce(
          (sum, e) => sum + e.totalAmount,
          0,
        );

        // Calculate products sold for this month (limited batching)
        let monthProductsSold = 0;
        const salesBatch = monthSales.slice(0, 50); // Limit to avoid too many reads
        for (const sale of salesBatch) {
          const saleItems = await ctx.db
            .query("saleItems")
            .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
            .collect();
          monthProductsSold += saleItems.reduce(
            (sum, item) => sum + item.quantity,
            0,
          );
        }

        totalIncome += income;
        totalExpense += expense;
        totalSalesCount += monthSales.length;
        totalProductsSold += monthProductsSold;

        return {
          month: `${monthNames[month]} ${year}`,
          monthNumber: month + 1,
          income,
          expense,
          profit: income - expense,
          salesCount: monthSales.length,
          expenseCount: monthExpenses.length,
        };
      }),
    );

    return {
      monthlyData,
      summary: {
        totalIncome,
        totalExpense,
        profit: totalIncome - totalExpense,
        productsSold: totalProductsSold,
        transactionCount: totalSalesCount,
        averageTransaction:
          totalSalesCount > 0 ? totalIncome / totalSalesCount : 0,
      },
    };
  },
});

// Get the date range that has actual data (earliest and latest transaction dates)
// Optimized to use order and pagination instead of collecting all records
export const getDataDateRange = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get a sample of recent sales and expenses to determine active date range
    // This is much more efficient than collecting all records
    const [recentSales, recentExpenses] = await Promise.all([
      ctx.db
        .query("sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(500), // Sample recent transactions
      ctx.db
        .query("expenses")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(500),
    ]);

    // Also get oldest records
    const [oldestSales, oldestExpenses] = await Promise.all([
      ctx.db
        .query("sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("asc")
        .take(100),
      ctx.db
        .query("expenses")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("asc")
        .take(100),
    ]);

    // Combine all sampled records
    const allRecords = [
      ...recentSales,
      ...recentExpenses,
      ...oldestSales,
      ...oldestExpenses,
    ];

    if (allRecords.length === 0) {
      return {
        monthsWithData: [],
        minYear: new Date().getFullYear(),
        maxYear: new Date().getFullYear(),
      };
    }

    // Collect all unique months from sampled data
    const monthsWithData = new Set<string>();
    for (const record of allRecords) {
      const d = new Date(record.date);
      monthsWithData.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    }

    const years = [...monthsWithData].map((m) => parseInt(m.split("-")[0]));
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    return {
      monthsWithData: [...monthsWithData].sort(), // ["2025-2", "2025-3", ...]
      minYear,
      maxYear,
    };
  },
});

// ─── Monthly Financial Report data (bandwidth-optimised) ──────────────────────
// Fetches ONLY the data for a single selected month in one server-side call,
// including line-item detail needed by generateMonthlyFinancialReportPDF.
// This avoids pulling all historical data just to filter client-side.
export const getMonthlyReportData = query({
  args: {
    userId: v.id("users"),
    month: v.number(), // 1-12
    year: v.number(), // e.g. 2026
  },
  handler: async (ctx, args) => {
    const mm = String(args.month).padStart(2, "0");
    const startDate = `${args.year}-${mm}-01`;

    // Compute first day of the NEXT month as the exclusive upper bound
    const nextMonth = args.month === 12 ? 1 : args.month + 1;
    const nextYear = args.month === 12 ? args.year + 1 : args.year;
    const mmNext = String(nextMonth).padStart(2, "0");
    const endDate = `${nextYear}-${mmNext}-01`;

    // Fetch sales and expenses for the month in parallel using compound index
    const [salesRaw, expensesRaw] = await Promise.all([
      ctx.db
        .query("sales")
        .withIndex("by_user_date", (q) =>
          q
            .eq("userId", args.userId)
            .gte("date", startDate)
            .lt("date", endDate),
        )
        .collect(),
      ctx.db
        .query("expenses")
        .withIndex("by_user_date", (q) =>
          q
            .eq("userId", args.userId)
            .gte("date", startDate)
            .lt("date", endDate),
        )
        .collect(),
    ]);

    // Fetch line items for each sale (parallel)
    const salesWithItems = await Promise.all(
      salesRaw.map(async (sale) => {
        const items = await ctx.db
          .query("saleItems")
          .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
          .collect();
        return {
          saleId: sale._id as string,
          transactionId: sale.transactionId,
          date: sale.date, // "YYYY-MM-DD"
          createdAt: sale.createdAt,
          totalAmount: sale.totalAmount,
          items: items.map((i) => ({
            name: i.productName,
            category: i.category,
            quantity: i.quantity,
            unitPrice: i.price,
            subtotal: i.subtotal,
          })),
        };
      }),
    );

    // Fetch line items for each expense (parallel)
    const expensesWithItems = await Promise.all(
      expensesRaw.map(async (expense) => {
        const items = await ctx.db
          .query("expenseItems")
          .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
          .collect();
        return {
          expenseId: expense._id as string,
          transactionId: expense.transactionId,
          date: expense.date,
          createdAt: expense.createdAt,
          totalAmount: expense.totalAmount,
          items: items.map((i) => ({
            title: i.title,
            category: i.category,
            quantity: i.quantity,
            amount: i.amount,
            total: i.total,
          })),
        };
      }),
    );

    return {
      month: args.month,
      year: args.year,
      sales: salesWithItems,
      expenses: expensesWithItems,
      salesGrandTotal: salesRaw.reduce((s, r) => s + r.totalAmount, 0),
      expensesGrandTotal: expensesRaw.reduce((s, r) => s + r.totalAmount, 0),
    };
  },
});

//  Trash Bin

const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Get all trashed transactions for a user (sorted by most recently trashed first)
export const getTrashTransactions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();

    const trashedSales = (
      await ctx.db
        .query("sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect()
    ).filter((s) => !!s.deletedAt);

    const trashedExpenses = (
      await ctx.db
        .query("expenses")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect()
    ).filter((e) => !!e.deletedAt);

    const formatDate = (ts: number) => {
      const phTs = ts + 8 * 60 * 60 * 1000;
      const d = new Date(phTs);
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${months[d.getUTCMonth()]}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
    };

    const result: {
      id: string;
      transactionId: string;
      type: "income" | "expense";
      amount: string;
      date: string;
      deletedAt: number;
      trashedDate: string;
      daysRemaining: number;
    }[] = [];

    for (const s of trashedSales) {
      const daysRemaining = Math.max(
        0,
        Math.ceil((s.deletedAt! + TRASH_TTL_MS - now) / (1000 * 60 * 60 * 24)),
      );
      result.push({
        id: s._id,
        transactionId: s.transactionId,
        type: "income",
        amount: `${s.totalAmount.toFixed(2)}`,
        date: s.date
          ? (() => {
              const [y, m, d] = s.date.split("-").map(Number);
              const mo = [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ];
              return `${mo[m - 1]}/${d}/${y}`;
            })()
          : formatDate(s.createdAt),
        deletedAt: s.deletedAt!,
        trashedDate: formatDate(s.deletedAt!),
        daysRemaining,
      });
    }

    for (const e of trashedExpenses) {
      const daysRemaining = Math.max(
        0,
        Math.ceil((e.deletedAt! + TRASH_TTL_MS - now) / (1000 * 60 * 60 * 24)),
      );
      result.push({
        id: e._id,
        transactionId: e.transactionId,
        type: "expense",
        amount: `${e.totalAmount.toFixed(2)}`,
        date: e.date
          ? (() => {
              const [y, m, d] = e.date.split("-").map(Number);
              const mo = [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ];
              return `${mo[m - 1]}/${d}/${y}`;
            })()
          : formatDate(e.createdAt),
        deletedAt: e.deletedAt!,
        trashedDate: formatDate(e.deletedAt!),
        daysRemaining,
      });
    }

    // Sort by most recently trashed first
    result.sort((a, b) => b.deletedAt - a.deletedAt);
    return result;
  },
});

// Permanently delete all expired trash records (older than 30 days)
export const purgeExpiredTrash = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - TRASH_TTL_MS;

    const expiredSales = (
      await ctx.db
        .query("sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect()
    ).filter((s) => !!s.deletedAt && s.deletedAt < cutoff);

    const expiredExpenses = (
      await ctx.db
        .query("expenses")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect()
    ).filter((e) => !!e.deletedAt && e.deletedAt < cutoff);

    for (const s of expiredSales) {
      const items = await ctx.db
        .query("saleItems")
        .withIndex("by_sale", (q) => q.eq("saleId", s._id))
        .collect();
      for (const item of items) await ctx.db.delete(item._id);
      await ctx.db.delete(s._id);
    }

    for (const e of expiredExpenses) {
      const items = await ctx.db
        .query("expenseItems")
        .withIndex("by_expense", (q) => q.eq("expenseId", e._id))
        .collect();
      for (const item of items) await ctx.db.delete(item._id);
      await ctx.db.delete(e._id);
    }

    return {
      purgedSales: expiredSales.length,
      purgedExpenses: expiredExpenses.length,
    };
  },
});
