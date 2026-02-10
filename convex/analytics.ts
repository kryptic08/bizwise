import { v } from "convex/values";
import { query } from "./_generated/server";

// Get financial summary (totals) for a user
export const getFinancialSummary = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // Get total income from sales
    let sales;
    if (args.userId) {
      sales = await ctx.db
        .query("sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    } else {
      sales = await ctx.db.query("sales").collect();
    }
    const totalIncome = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);

    // Get total expenses
    let expenses;
    if (args.userId) {
      expenses = await ctx.db
        .query("expenses")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    } else {
      expenses = await ctx.db.query("expenses").collect();
    }
    const totalExpense = expenses.reduce(
      (sum, expense) => sum + expense.totalAmount,
      0,
    );

    // Calculate total products sold (sum of quantities from all sale items)
    const salesIds = sales.map((sale) => sale._id);
    let totalProductsSold = 0;

    for (const saleId of salesIds) {
      const saleItems = await ctx.db
        .query("saleItems")
        .withIndex("by_sale", (q) => q.eq("saleId", saleId))
        .collect();
      totalProductsSold += saleItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
    }

    return {
      totalBalance: totalIncome - totalExpense,
      totalIncome,
      totalExpense,
      profit: totalIncome - totalExpense,
      productsSold: totalProductsSold,
      transactionCount: sales.length, // Number of transactions
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
        // Get sales for this date
        let sales;
        if (args.userId) {
          const allSales = await ctx.db
            .query("sales")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
          sales = allSales.filter((s) => s.date === date);
        } else {
          sales = await ctx.db
            .query("sales")
            .withIndex("by_date", (q) => q.eq("date", date))
            .collect();
        }

        // Get expenses for this date
        let expenses;
        if (args.userId) {
          const allExpenses = await ctx.db
            .query("expenses")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
          expenses = allExpenses.filter((e) => e.date === date);
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

// Get monthly analytics (January to December) for a user
export const getMonthlyAnalytics = query({
  args: {
    year: v.optional(v.number()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentYear = args.year || new Date().getFullYear();
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

    const monthlyData = await Promise.all(
      Array.from({ length: 12 }, async (_, monthIndex) => {
        // Get all sales and expenses for the year
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

        // Filter by month
        const monthSales = sales.filter((s) => {
          const saleDate = new Date(s.date);
          return (
            saleDate.getFullYear() === currentYear &&
            saleDate.getMonth() === monthIndex
          );
        });

        const monthExpenses = expenses.filter((e) => {
          const expenseDate = new Date(e.date);
          return (
            expenseDate.getFullYear() === currentYear &&
            expenseDate.getMonth() === monthIndex
          );
        });

        const income = monthSales.reduce(
          (sum, sale) => sum + sale.totalAmount,
          0,
        );
        const expense = monthExpenses.reduce(
          (sum, exp) => sum + exp.totalAmount,
          0,
        );

        return {
          month: monthNames[monthIndex],
          monthNumber: monthIndex + 1,
          income,
          expense,
          profit: income - expense,
          salesCount: monthSales.length,
          expenseCount: monthExpenses.length,
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

      console.log(
        `Adding SALE: ${sale.transactionId}, createdAt: ${sale.createdAt}, formatted: ${transaction.time}`,
      );
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

      console.log(
        `Adding EXPENSE: ${expense.transactionId}, createdAt: ${expense.createdAt}, formatted: ${transaction.time}`,
      );
      allTransactions.push(transaction);
    }

    // Sort ALL transactions by sortKey (most recent first)
    allTransactions.sort((a, b) => b.sortKey - a.sortKey);

    // Debug log
    console.log(
      "Final sorted transactions:",
      allTransactions.map((t) => ({
        type: t.type,
        id: t.transactionId,
        time: t.time,
        sortKey: t.sortKey,
      })),
    );

    return allTransactions;
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

      // Get sales for this week
      let sales;
      if (args.userId) {
        const allSales = await ctx.db
          .query("sales")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect();
        sales = allSales.filter(
          (s) => s.date >= startDateStr && s.date <= endDateStr,
        );
      } else {
        sales = await ctx.db.query("sales").collect();
        sales = sales.filter(
          (s) => s.date >= startDateStr && s.date <= endDateStr,
        );
      }

      // Get expenses for this week
      let expenses;
      if (args.userId) {
        const allExpenses = await ctx.db
          .query("expenses")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect();
        expenses = allExpenses.filter(
          (e) => e.date >= startDateStr && e.date <= endDateStr,
        );
      } else {
        expenses = await ctx.db.query("expenses").collect();
        expenses = expenses.filter(
          (e) => e.date >= startDateStr && e.date <= endDateStr,
        );
      }

      const income = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
      const expense = expenses.reduce((sum, exp) => sum + exp.totalAmount, 0);

      analytics.push({
        weekStart: startDateStr,
        weekEnd: endDateStr,
        income,
        expense,
        profit: income - expense,
        salesCount: sales.length,
        expenseCount: expenses.length,
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
