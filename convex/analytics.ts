import { v } from "convex/values";
import { query } from "./_generated/server";

// Get financial summary (totals) for a user
// Optimized to process sales and calculate totals in a single pass
export const getFinancialSummary = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // Get sales and calculate totals in parallel
    let sales;
    if (args.userId) {
      sales = await ctx.db
        .query("sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    } else {
      sales = await ctx.db.query("sales").collect();
    }

    // Get expenses in parallel with sale items processing
    const [expenses, saleItemsData] = await Promise.all([
      args.userId
        ? ctx.db
            .query("expenses")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect()
        : ctx.db.query("expenses").collect(),

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
    days: v.number(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const today = new Date();
    const startDate = new Date(
      today.getTime() - args.days * 24 * 60 * 60 * 1000,
    );

    const dateArray = [];
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      dateArray.push(d.toISOString().slice(0, 10));
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

        const income = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const expense = expenses.reduce((sum, exp) => sum + exp.totalAmount, 0);

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

        const income = sales.reduce((sum, s) => sum + s.totalAmount, 0);
        const expense = expenses.reduce((sum, e) => sum + e.totalAmount, 0);

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
      sales = await ctx.db
        .query("sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      expenses = await ctx.db
        .query("expenses")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    } else {
      sales = await ctx.db.query("sales").collect();
      expenses = await ctx.db.query("expenses").collect();
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
      return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
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
        date: formatDate(sale.createdAt),
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
        date: formatDate(expense.createdAt),
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

    // Get sales with pagination
    let salesQuery = ctx.db
      .query("sales")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc");

    const allSales = await salesQuery.take(limit * 2); // Get more to ensure we have enough after filtering

    // Get expenses with pagination
    let expensesQuery = ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc");

    const allExpenses = await expensesQuery.take(limit * 2);

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
      return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
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
    for (const sale of allSales) {
      if (args.cursor && sale.createdAt >= args.cursor) continue;

      const items = await ctx.db
        .query("saleItems")
        .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
        .collect();

      allTransactions.push({
        id: sale._id,
        transactionId: sale.transactionId,
        date: formatDate(sale.createdAt),
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
    for (const expense of allExpenses) {
      if (args.cursor && expense.createdAt >= args.cursor) continue;

      const items = await ctx.db
        .query("expenseItems")
        .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
        .collect();

      allTransactions.push({
        id: expense._id,
        transactionId: expense.transactionId,
        date: formatDate(expense.createdAt),
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
    const hasMore =
      allTransactions.length > limit ||
      allSales.length === limit * 2 ||
      allExpenses.length === limit * 2;

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
  },
  handler: async (ctx, args) => {
    const today = new Date();
    const analytics = [];

    for (let i = args.weeks - 1; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7 + today.getDay()));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const startDateStr = weekStart.toISOString().slice(0, 10);
      const endDateStr = weekEnd.toISOString().slice(0, 10);

      // Generate date array for the week
      const weekDates = [];
      for (
        let d = new Date(weekStart);
        d <= weekEnd;
        d.setDate(d.getDate() + 1)
      ) {
        weekDates.push(d.toISOString().slice(0, 10));
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

      // Aggregate the week's data
      const allSales = weekData.flatMap((d) => d.sales);
      const allExpenses = weekData.flatMap((d) => d.expenses);

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
export const getTopSellingProduct = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // Get all sale items
    const saleItems = await ctx.db.query("saleItems").collect();

    // Filter by user if needed
    let filteredItems = saleItems;
    if (args.userId) {
      const userSales = await ctx.db
        .query("sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      const userSaleIds = new Set(userSales.map((s) => s._id));
      filteredItems = saleItems.filter((item) => userSaleIds.has(item.saleId));
    }

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

    // Find the top product
    let topProduct = { name: "No Sales Yet", count: 0 };
    for (const product of productCounts.values()) {
      if (product.count > topProduct.count) {
        topProduct = product;
      }
    }

    return topProduct;
  },
});

// Get top selling category for a user
export const getTopSellingCategory = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // Get all sale items
    const saleItems = await ctx.db.query("saleItems").collect();

    // Filter by user if needed
    let filteredItems = saleItems;
    if (args.userId) {
      const userSales = await ctx.db
        .query("sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      const userSaleIds = new Set(userSales.map((s) => s._id));
      filteredItems = saleItems.filter((item) => userSaleIds.has(item.saleId));
    }

    // Count quantities by category
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

    // Find the top category
    let topCategory = { name: "No Sales Yet", count: 0 };
    for (const category of categoryCounts.values()) {
      if (category.count > topCategory.count) {
        topCategory = category;
      }
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
