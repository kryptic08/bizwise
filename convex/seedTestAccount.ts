import { mutation } from "./_generated/server";

/**
 * Seed a complete test account with one year of transactions
 * Email: test@bizwise.com
 * Password: test123
 */
export const seedTestAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const testEmail = "test@bizwise.com";
    const testPassword = "test123";
    const testName = "Test User";

    // 1. Create or find test user
    let testUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", testEmail))
      .first();

    if (!testUser) {
      const userId = await ctx.db.insert("users", {
        email: testEmail,
        password: testPassword,
        name: testName,
        phone: "+1234567890",
        targetIncome: {
          monthly: 50000,
          daily: 1667,
          updatedAt: Date.now(),
        },
        createdAt: Date.now(),
      });
      testUser = (await ctx.db.get(userId))!;
    }

    // 2. Create categories for test user
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
        .withIndex("by_user", (q) => q.eq("userId", testUser!._id))
        .filter((q) => q.eq(q.field("name"), cat.name))
        .first();

      if (!existing) {
        const catId = await ctx.db.insert("categories", {
          userId: testUser._id,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          sortOrder: cat.sortOrder,
          isDefault: true,
          createdAt: Date.now(),
        });
        categoryIds[cat.name] = catId;
      } else {
        categoryIds[cat.name] = existing._id;
      }
    }

    // 3. Create products for test user
    const productData = [
      {
        name: "Cheeseburger",
        category: "Snacks",
        price: 45.0,
        image:
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300",
      },
      {
        name: "French Fries",
        category: "Snacks",
        price: 35.0,
        image:
          "https://images.unsplash.com/photo-1573080496987-a199f8cd75c5?w=300",
      },
      {
        name: "Club Sandwich",
        category: "Snacks",
        price: 55.0,
        image:
          "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300",
      },
      {
        name: "Chicken Curry",
        category: "Rice Meals",
        price: 85.0,
        image:
          "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300",
      },
      {
        name: "Beef Stir Fry",
        category: "Rice Meals",
        price: 95.0,
        image:
          "https://images.unsplash.com/photo-1603360946369-dc9bb6f54262?w=300",
      },
      {
        name: "Pork Sisig",
        category: "Rice Meals",
        price: 75.0,
        image:
          "https://images.unsplash.com/photo-1562967962-972eb6eb2338?w=300",
      },
      {
        name: "Siomai Rice",
        category: "Rice Meals",
        price: 50.0,
        image:
          "https://images.unsplash.com/photo-1625938145744-e38051539994?w=300",
      },
      {
        name: "Coca-Cola",
        category: "Drinks",
        price: 25.0,
        image:
          "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300",
      },
      {
        name: "Orange Juice",
        category: "Drinks",
        price: 30.0,
        image:
          "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300",
      },
      {
        name: "Iced Coffee",
        category: "Drinks",
        price: 40.0,
        image:
          "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=300",
      },
      {
        name: "Halo-Halo",
        category: "Desserts",
        price: 65.0,
        image:
          "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300",
      },
      {
        name: "Leche Flan",
        category: "Desserts",
        price: 45.0,
        image:
          "https://images.unsplash.com/photo-1551404973-761c83cd8339?w=300",
      },
      {
        name: "Grilled Squid",
        category: "Seafood",
        price: 120.0,
        image:
          "https://images.unsplash.com/photo-1580217593062-f306ad090c0b?w=300",
      },
      {
        name: "Shrimp Tempura",
        category: "Seafood",
        price: 150.0,
        image:
          "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300",
      },
    ];

    const productIds: any[] = [];
    for (const prod of productData) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_user", (q) => q.eq("userId", testUser!._id))
        .filter((q) => q.eq(q.field("name"), prod.name))
        .first();

      if (!existing) {
        const prodId = await ctx.db.insert("products", {
          userId: testUser._id,
          name: prod.name,
          category: prod.category.toLowerCase().replace(" ", ""),
          categoryId: categoryIds[prod.category],
          price: prod.price,
          image: prod.image,
          isActive: true,
          createdAt: Date.now(),
        });
        productIds.push({
          id: prodId,
          name: prod.name,
          category: prod.category,
          price: prod.price,
        });
      } else {
        productIds.push({
          id: existing._id,
          name: existing.name,
          category: prod.category,
          price: existing.price,
        });
      }
    }

    // 4. Generate one year of transactions (365 days)
    const now = new Date();
    const oneYearAgo = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate(),
    );

    let salesCount = 0;
    let expensesCount = 0;
    let transactionCounter = 1;

    // Expense categories
    const expenseCategories = [
      {
        name: "Supplies",
        items: ["Cooking Oil", "Rice", "Vegetables", "Meat", "Condiments"],
      },
      {
        name: "Utilities",
        items: ["Electricity Bill", "Water Bill", "Internet", "Gas"],
      },
      { name: "Rent", items: ["Store Rent", "Equipment Rental"] },
      { name: "Salaries", items: ["Staff Salary", "Helper Salary"] },
      {
        name: "Maintenance",
        items: ["Equipment Repair", "Cleaning Supplies", "Store Maintenance"],
      },
      {
        name: "Marketing",
        items: ["Flyers", "Social Media Ads", "Promotional Items"],
      },
      {
        name: "Transportation",
        items: ["Delivery", "Supply Transport", "Fuel"],
      },
    ];

    // Generate transactions for each day with realistic business patterns
    for (let day = 0; day < 365; day++) {
      const currentDate = new Date(oneYearAgo);
      currentDate.setDate(currentDate.getDate() + day);

      const dateStr = currentDate.toISOString().slice(0, 10);
      const dayOfWeek = currentDate.getDay();
      const month = currentDate.getMonth() + 1; // 1-12
      const dayOfMonth = currentDate.getDate();

      // Business growth over time (10% increase from start to end of year)
      const growthFactor = 1 + (day / 365) * 0.1;

      // Seasonal multipliers (realistic for Philippine food business)
      let seasonalMultiplier = 1.0;
      if (month === 12)
        seasonalMultiplier = 1.6; // Christmas peak
      else if (month === 1)
        seasonalMultiplier = 0.7; // Post-holiday slump
      else if (month === 2)
        seasonalMultiplier = 0.75; // Still slow
      else if (month === 3 || month === 4)
        seasonalMultiplier = 1.2; // Summer
      else if (month === 5)
        seasonalMultiplier = 1.1; // Still warm
      else if (month === 6 || month === 7)
        seasonalMultiplier = 0.6; // Rainy season - significant drop
      else if (month === 8)
        seasonalMultiplier = 0.75; // Still rainy
      else if (month === 9)
        seasonalMultiplier = 0.85; // Recovering
      else if (month === 10)
        seasonalMultiplier = 1.0; // Normal
      else if (month === 11) seasonalMultiplier = 1.3; // Pre-holiday pickup

      // Weekly patterns
      let weeklyMultiplier = 1.0;
      if (dayOfWeek === 0)
        weeklyMultiplier = 0.7; // Sunday - slower
      else if (dayOfWeek === 6)
        weeklyMultiplier = 1.3; // Saturday - busy
      else if (dayOfWeek === 5)
        weeklyMultiplier = 1.2; // Friday - busy
      else if (dayOfWeek === 1) weeklyMultiplier = 0.8; // Monday - slower

      // Special events (payday effect - 15th and 30th)
      let paydayMultiplier = 1.0;
      if (dayOfMonth === 15 || dayOfMonth === 30) paydayMultiplier = 1.5;
      else if (Math.abs(dayOfMonth - 15) <= 2 || Math.abs(dayOfMonth - 30) <= 2)
        paydayMultiplier = 1.2;

      // Random events (chance of special events like rain, festivals, etc.)
      let eventMultiplier = 1.0;
      const eventRoll = Math.random();
      if (eventRoll < 0.07)
        eventMultiplier = 0.2; // Bad weather / typhoon
      else if (eventRoll < 0.12)
        eventMultiplier = 0.5; // Light rain / slow day
      else if (eventRoll < 0.15)
        eventMultiplier = 1.8; // Festival/event nearby
      else if (eventRoll < 0.17) eventMultiplier = 2.2; // Special event / fiesta

      // Calculate base sales for the day
      const baseSales = 5; // Average sales per day
      const totalMultiplier =
        growthFactor *
        seasonalMultiplier *
        weeklyMultiplier *
        paydayMultiplier *
        eventMultiplier;
      const targetSales = Math.max(1, Math.round(baseSales * totalMultiplier));

      // Add some randomness (±30%)
      const variation = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
      const numSales = Math.max(1, Math.round(targetSales * variation));

      // Generate sales with realistic time distribution
      const salesTimes = [];
      for (let saleNum = 0; saleNum < numSales; saleNum++) {
        // Peak hours: 11AM-2PM (lunch) and 5PM-8PM (dinner)
        let hour;
        if (Math.random() < 0.4) {
          hour = Math.floor(Math.random() * 4) + 11; // 11AM-2PM (40% chance)
        } else if (Math.random() < 0.3) {
          hour = Math.floor(Math.random() * 4) + 17; // 5PM-8PM (30% chance)
        } else {
          hour = Math.floor(Math.random() * 12) + 8; // 8AM-8PM (30% chance)
        }
        const minute = Math.floor(Math.random() * 60);
        salesTimes.push({ hour, minute });
      }

      // Sort sales by time
      salesTimes.sort(
        (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
      );

      // Create sales
      for (let saleNum = 0; saleNum < salesTimes.length; saleNum++) {
        const { hour, minute } = salesTimes[saleNum];
        const ampm = hour < 12 ? "AM" : "PM";
        const displayHour = hour > 12 ? hour - 12 : hour;
        const timeStr = `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`;

        // More items during peak hours
        const isPeakHour =
          (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 20);
        const numItems = isPeakHour
          ? Math.floor(Math.random() * 4) + 2 // 2-5 items during peak
          : Math.floor(Math.random() * 3) + 1; // 1-3 items normally

        const saleItems: any[] = [];
        let totalAmount = 0;
        let totalQuantity = 0;

        for (let i = 0; i < numItems; i++) {
          const product =
            productIds[Math.floor(Math.random() * productIds.length)];

          // Realistic quantity distribution (most orders are single items)
          let quantity;
          if (Math.random() < 0.7)
            quantity = 1; // 70% single quantity
          else if (Math.random() < 0.9)
            quantity = 2; // 20% double
          else quantity = Math.floor(Math.random() * 3) + 3; // 10% bulk (3-5)

          const subtotal = product.price * quantity;

          saleItems.push({
            productId: product.id,
            productName: product.name,
            category: product.category.toLowerCase().replace(" ", ""),
            price: product.price,
            quantity: quantity,
            subtotal: subtotal,
          });

          totalAmount += subtotal;
          totalQuantity += quantity;
        }

        // More realistic payment (round to nearest 5 or 10)
        let paymentReceived;
        if (totalAmount <= 50) {
          paymentReceived = Math.ceil(totalAmount / 5) * 5;
        } else if (totalAmount <= 200) {
          paymentReceived = Math.ceil(totalAmount / 10) * 10;
        } else {
          paymentReceived = Math.ceil(totalAmount / 50) * 50;
        }
        const change = paymentReceived - totalAmount;

        const saleId = await ctx.db.insert("sales", {
          userId: testUser._id,
          transactionId: `SL-${String(transactionCounter++).padStart(4, "0")}`,
          totalAmount: totalAmount,
          itemCount: totalQuantity,
          paymentReceived: paymentReceived,
          change: change,
          date: dateStr,
          time: timeStr,
          createdAt: currentDate.getTime() + (hour * 60 + minute) * 60000,
        });

        // Insert sale items
        for (const item of saleItems) {
          await ctx.db.insert("saleItems", {
            saleId: saleId,
            productId: item.productId,
            productName: item.productName,
            category: item.category,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.subtotal,
          });
        }

        salesCount++;
      }

      // MORE REALISTIC EXPENSE PATTERNS

      // Monthly recurring expenses (1st-5th of each month)
      if (dayOfMonth <= 5) {
        const recurringExpenses = [];

        if (dayOfMonth === 1) {
          // Rent increases slightly mid-year (lease renewal)
          const rentBase = month >= 7 ? 6000 : 5000;
          recurringExpenses.push(
            {
              category: "Rent",
              item: "Store Rent",
              amount: rentBase + Math.random() * 1000,
            },
            {
              category: "Salaries",
              item: "Staff Salary",
              amount: 4000 + Math.random() * 1500,
            },
          );
        }

        if (dayOfMonth === 2) {
          // Utilities higher during summer (AC) and holiday season
          const utilMultiplier =
            (month >= 3 && month <= 5) || month === 12 ? 1.4 : 1.0;
          recurringExpenses.push(
            {
              category: "Utilities",
              item: "Electricity Bill",
              amount: (900 + Math.random() * 600) * utilMultiplier,
            },
            {
              category: "Utilities",
              item: "Water Bill",
              amount: 300 + Math.random() * 200,
            },
          );
        }

        if (dayOfMonth === 3) {
          recurringExpenses.push({
            category: "Utilities",
            item: "Internet",
            amount: 1000 + Math.random() * 200,
          });
        }

        // Mid-month salary for part-time helper
        if (dayOfMonth === 4 && Math.random() < 0.6) {
          recurringExpenses.push({
            category: "Salaries",
            item: "Helper Salary",
            amount: 1500 + Math.random() * 1000,
          });
        }

        // Create recurring expenses
        for (const exp of recurringExpenses) {
          const hour = Math.floor(Math.random() * 5) + 9; // 9AM-2PM
          const minute = Math.floor(Math.random() * 60);
          const ampm = hour < 12 ? "AM" : "PM";
          const displayHour = hour > 12 ? hour - 12 : hour;
          const timeStr = `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`;

          const expenseId = await ctx.db.insert("expenses", {
            userId: testUser._id,
            transactionId: `EXP-${String(transactionCounter++).padStart(4, "0")}`,
            totalAmount: exp.amount,
            itemCount: 1,
            date: dateStr,
            time: timeStr,
            createdAt: currentDate.getTime() + (hour * 60 + minute) * 60000,
          });

          await ctx.db.insert("expenseItems", {
            expenseId: expenseId,
            category: exp.category,
            title: exp.item,
            amount: exp.amount,
            quantity: 1,
            total: exp.amount,
          });

          expensesCount++;
        }
      }

      // Occasional large one-time expenses (equipment, renovation, etc.)
      if (Math.random() < 0.02) {
        // ~7 times per year: major expense
        const bigExpenses = [
          {
            category: "Maintenance",
            item: "Equipment Repair",
            min: 3000,
            max: 8000,
          },
          {
            category: "Maintenance",
            item: "Store Renovation",
            min: 5000,
            max: 12000,
          },
          {
            category: "Supplies",
            item: "Bulk Stock Purchase",
            min: 4000,
            max: 10000,
          },
          {
            category: "Maintenance",
            item: "Appliance Replacement",
            min: 5000,
            max: 15000,
          },
        ];
        const bigExp =
          bigExpenses[Math.floor(Math.random() * bigExpenses.length)];
        const bigAmount = Math.round(
          bigExp.min + Math.random() * (bigExp.max - bigExp.min),
        );
        const bHour = Math.floor(Math.random() * 4) + 9;
        const bMinute = Math.floor(Math.random() * 60);
        const bAmpm = bHour < 12 ? "AM" : "PM";
        const bDisplayHour = bHour > 12 ? bHour - 12 : bHour;
        const bTimeStr = `${bDisplayHour}:${bMinute.toString().padStart(2, "0")} ${bAmpm}`;

        const bigExpId = await ctx.db.insert("expenses", {
          userId: testUser._id,
          transactionId: `EXP-${String(transactionCounter++).padStart(4, "0")}`,
          totalAmount: bigAmount,
          itemCount: 1,
          date: dateStr,
          time: bTimeStr,
          createdAt: currentDate.getTime() + (bHour * 60 + bMinute) * 60000,
        });

        await ctx.db.insert("expenseItems", {
          expenseId: bigExpId,
          category: bigExp.category,
          title: bigExp.item,
          amount: bigAmount,
          quantity: 1,
          total: bigAmount,
        });

        expensesCount++;
      }

      // Variable daily expenses (supply purchases, maintenance, etc.)
      const shouldHaveSupplyExpense = Math.random() < 0.35; // 35% chance

      if (shouldHaveSupplyExpense) {
        const hour = Math.floor(Math.random() * 8) + 8; // 8AM-4PM
        const minute = Math.floor(Math.random() * 60);
        const ampm = hour < 12 ? "AM" : "PM";
        const displayHour = hour > 12 ? hour - 12 : hour;
        const timeStr = `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`;

        // Supply expenses scale with business volume
        const supplyCategories = [
          {
            name: "Supplies",
            items: ["Cooking Oil", "Rice", "Vegetables", "Meat", "Condiments"],
            baseAmount: 250,
          },
          {
            name: "Maintenance",
            items: ["Equipment Repair", "Cleaning Supplies"],
            baseAmount: 150,
          },
          {
            name: "Marketing",
            items: ["Flyers", "Social Media Ads"],
            baseAmount: 120,
          },
          {
            name: "Transportation",
            items: ["Delivery", "Supply Transport", "Fuel"],
            baseAmount: 200,
          },
        ];

        const supplyCat =
          supplyCategories[Math.floor(Math.random() * supplyCategories.length)];
        const supplyItem =
          supplyCat.items[Math.floor(Math.random() * supplyCat.items.length)];

        // Scale expense with business growth and seasonal demand
        // Expenses don't scale down as much as revenue during slow periods
        const expenseMultiplier = Math.max(0.7, totalMultiplier);
        const expenseAmount = Math.round(
          supplyCat.baseAmount *
            expenseMultiplier *
            (0.6 + Math.random() * 0.8),
        );

        const expenseId = await ctx.db.insert("expenses", {
          userId: testUser._id,
          transactionId: `EXP-${String(transactionCounter++).padStart(4, "0")}`,
          totalAmount: expenseAmount,
          itemCount: 1,
          date: dateStr,
          time: timeStr,
          createdAt: currentDate.getTime() + (hour * 60 + minute) * 60000,
        });

        await ctx.db.insert("expenseItems", {
          expenseId: expenseId,
          category: supplyCat.name,
          title: supplyItem,
          amount: expenseAmount,
          quantity: 1,
          total: expenseAmount,
        });

        expensesCount++;
      }
    }

    return {
      success: true,
      message: "Test account seeded successfully with one year of data!",
      data: {
        user: {
          email: testEmail,
          password: testPassword,
          name: testName,
          userId: testUser._id,
        },
        created: {
          categories: categoryData.length,
          products: productIds.length,
          sales: salesCount,
          expenses: expensesCount,
          totalTransactions: salesCount + expensesCount,
        },
        dateRange: {
          from: oneYearAgo.toISOString().slice(0, 10),
          to: now.toISOString().slice(0, 10),
        },
      },
    };
  },
});

/**
 * Clear all data for test account (use with caution!)
 */
export const clearTestAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const testEmail = "test@bizwise.com";

    const testUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", testEmail))
      .first();

    if (!testUser) {
      return { done: true, message: "Test user not found" };
    }

    // Delete in small batches to avoid read limit (4096)
    // Delete up to 50 sales with their items per call
    const sales = await ctx.db
      .query("sales")
      .withIndex("by_user", (q) => q.eq("userId", testUser._id))
      .take(50);

    for (const sale of sales) {
      const saleItems = await ctx.db
        .query("saleItems")
        .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
        .collect();

      for (const item of saleItems) {
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(sale._id);
    }

    // Delete up to 50 expenses with their items per call
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", testUser._id))
      .take(50);

    for (const expense of expenses) {
      const expenseItems = await ctx.db
        .query("expenseItems")
        .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
        .collect();

      for (const item of expenseItems) {
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(expense._id);
    }

    const hasMore = sales.length > 0 || expenses.length > 0;

    // If no more transactions, clean up products and categories
    if (!hasMore) {
      const products = await ctx.db
        .query("products")
        .withIndex("by_user", (q) => q.eq("userId", testUser._id))
        .collect();

      for (const product of products) {
        await ctx.db.delete(product._id);
      }

      const categories = await ctx.db
        .query("categories")
        .withIndex("by_user", (q) => q.eq("userId", testUser._id))
        .collect();

      for (const category of categories) {
        await ctx.db.delete(category._id);
      }

      return {
        done: true,
        message: "Test account data cleared successfully!",
        deleted: {
          products: products.length,
          categories: categories.length,
        },
      };
    }

    return {
      done: false,
      message: `Deleted batch: ${sales.length} sales, ${expenses.length} expenses. Run again to continue.`,
      deleted: {
        sales: sales.length,
        expenses: expenses.length,
      },
    };
  },
});
