import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Seed realistic data for a specific user by email
 */
export const seedForUser = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Find existing user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      return { error: `User with email ${args.email} not found` };
    }

    // Clear existing data for this user
    const existingSales = await ctx.db
      .query("sales")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existingExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const sale of existingSales) {
      // Delete sale items first
      const saleItems = await ctx.db
        .query("saleItems")
        .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
        .collect();
      for (const item of saleItems) {
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(sale._id);
    }

    for (const expense of existingExpenses) {
      // Delete expense items first
      const expenseItems = await ctx.db
        .query("expenseItems")
        .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
        .collect();
      for (const item of expenseItems) {
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(expense._id);
    }

    // Create categories for user if they don't exist
    const categoryData = [
      { name: "Snacks", icon: "cookie", color: "#FF6B6B", sortOrder: 1 },
      { name: "Rice Meals", icon: "utensils", color: "#4ECDC4", sortOrder: 2 },
      { name: "Drinks", icon: "coffee", color: "#45B7D1", sortOrder: 3 },
      { name: "Desserts", icon: "icecream", color: "#FFA07A", sortOrder: 4 },
      { name: "Seafood", icon: "fish", color: "#20B2AA", sortOrder: 5 },
    ];

    const categoryIds: Record<string, any> = {};
    for (const cat of categoryData) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("name"), cat.name))
        .first();

      if (existing) {
        categoryIds[cat.name] = existing._id;
      } else {
        categoryIds[cat.name] = await ctx.db.insert("categories", {
          ...cat,
          userId: user._id,
          createdAt: Date.now(),
        });
      }
    }

    // Create products for user if they don't exist
    const productData = [
      { name: "Fried Chicken", category: "Rice Meals", price: 85 },
      { name: "Pork Adobo", category: "Rice Meals", price: 70 },
      { name: "Beef Steak", category: "Rice Meals", price: 95 },
      { name: "Fish Fillet", category: "Seafood", price: 120 },
      { name: "Grilled Bangus", category: "Seafood", price: 80 },
      { name: "Chips", category: "Snacks", price: 15 },
      { name: "Crackers", category: "Snacks", price: 12 },
      { name: "Iced Tea", category: "Drinks", price: 25 },
      { name: "Softdrinks", category: "Drinks", price: 30 },
      { name: "Halo-halo", category: "Desserts", price: 65 },
    ];

    const productIds: Record<string, any> = {};
    for (const prod of productData) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("name"), prod.name))
        .first();

      if (existing) {
        productIds[prod.name] = existing._id;
      } else {
        productIds[prod.name] = await ctx.db.insert("products", {
          ...prod,
          categoryId: categoryIds[prod.category],
          userId: user._id,
          image: "",
          isActive: true,
          createdAt: Date.now(),
        });
      }
    }

    // Generate 365 days of realistic business data
    const startDate = new Date("2025-01-01");
    let saleCounter = 1;
    let expenseCounter = 1;

    for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + dayOffset);
      const dateString = currentDate.toISOString().slice(0, 10);

      // Business growth factor (10% yearly growth)
      const growthFactor = 1 + (dayOffset / 365) * 0.1;

      // Seasonal multipliers
      const month = currentDate.getMonth() + 1;
      let seasonalMultiplier = 1;
      if (month >= 11 || month <= 1)
        seasonalMultiplier = 1.4; // Holiday season
      else if (month >= 3 && month <= 5)
        seasonalMultiplier = 1.2; // Summer
      else if (month >= 6 && month <= 8) seasonalMultiplier = 0.8; // Rainy season

      // Day of week multiplier
      const dayOfWeek = currentDate.getDay();
      let weekMultiplier = 1;
      if (dayOfWeek === 0)
        weekMultiplier = 0.7; // Sunday
      else if (dayOfWeek === 6)
        weekMultiplier = 1.3; // Saturday
      else if (dayOfWeek === 5) weekMultiplier = 1.2; // Friday

      // Payday effect (15th and 30th of month)
      const dayOfMonth = currentDate.getDate();
      let paydayMultiplier = 1;
      if (dayOfMonth === 15 || dayOfMonth === 30) paydayMultiplier = 1.5;
      else if ([14, 16, 29, 31].includes(dayOfMonth)) paydayMultiplier = 1.2;

      // Calculate base transactions for the day
      const baseTransactions = Math.round(
        8 *
          growthFactor *
          seasonalMultiplier *
          weekMultiplier *
          paydayMultiplier,
      );

      // Generate sales throughout the day
      for (let i = 0; i < baseTransactions; i++) {
        // Time distribution (peak hours)
        let hour;
        const peakRand = Math.random();
        if (peakRand < 0.4) {
          // 40% during lunch rush (11 AM - 2 PM)
          hour = Math.floor(Math.random() * 4) + 11;
        } else if (peakRand < 0.7) {
          // 30% during dinner rush (5 PM - 8 PM)
          hour = Math.floor(Math.random() * 4) + 17;
        } else {
          // 30% other times (9 AM - 10 PM)
          const otherHours = [9, 10, 14, 15, 16, 21, 22];
          hour = otherHours[Math.floor(Math.random() * otherHours.length)];
        }

        const minute = Math.floor(Math.random() * 60);
        const saleTime = new Date(currentDate);
        saleTime.setHours(hour, minute, 0, 0);

        // Select random products (1-3 items per sale)
        const itemCount = Math.floor(Math.random() * 3) + 1;
        const products = Object.keys(productIds);
        const selectedProducts = [];

        for (let j = 0; j < itemCount; j++) {
          const product = products[Math.floor(Math.random() * products.length)];
          const quantity = Math.floor(Math.random() * 3) + 1;
          selectedProducts.push({ product, quantity });
        }

        // Calculate total
        let totalAmount = 0;
        for (const item of selectedProducts) {
          const productInfo = productData.find((p) => p.name === item.product);
          totalAmount += productInfo!.price * item.quantity;
        }

        // Create sale record
        const saleId = await ctx.db.insert("sales", {
          transactionId: `SL-${saleCounter.toString().padStart(4, "0")}`,
          userId: user._id,
          date: dateString,
          time: saleTime.toTimeString().slice(0, 8),
          itemCount,
          totalAmount,
          paymentReceived: totalAmount,
          change: 0,
          createdAt: saleTime.getTime(),
        });

        // Create sale items
        for (const item of selectedProducts) {
          const productInfo = productData.find((p) => p.name === item.product);
          const categoryName = productInfo!.category;

          await ctx.db.insert("saleItems", {
            saleId,
            productId: productIds[item.product],
            productName: item.product,
            category: categoryName,
            price: productInfo!.price,
            quantity: item.quantity,
            subtotal: productInfo!.price * item.quantity,
          });
        }

        saleCounter++;
      }

      // Generate monthly recurring expenses (first 5 days of month)
      if (dayOfMonth <= 5) {
        const expenseTypes = [
          { name: "Store Rent", amount: 8000, category: "Utilities" },
          { name: "Staff Salary", amount: 12000, category: "Labor" },
          { name: "Electricity Bill", amount: 2500, category: "Utilities" },
          { name: "Water Bill", amount: 800, category: "Utilities" },
          { name: "Internet Bill", amount: 1500, category: "Utilities" },
        ];

        const expense = expenseTypes[dayOfMonth - 1];
        if (expense) {
          const expenseTime = new Date(currentDate);
          expenseTime.setHours(10, 0, 0, 0);

          const expenseId = await ctx.db.insert("expenses", {
            transactionId: `EX-${expenseCounter.toString().padStart(4, "0")}`,
            userId: user._id,
            date: dateString,
            time: expenseTime.toTimeString().slice(0, 8),
            itemCount: 1,
            totalAmount: expense.amount,
            createdAt: expenseTime.getTime(),
          });

          await ctx.db.insert("expenseItems", {
            expenseId,
            title: expense.name,
            category: expense.category,
            amount: expense.amount,
            quantity: 1,
            total: expense.amount,
          });

          expenseCounter++;
        }
      }
    }

    return {
      success: true,
      message: `Generated realistic data for ${user.email}`,
      salesGenerated: saleCounter - 1,
      expensesGenerated: expenseCounter - 1,
    };
  },
});
