import { mutation } from "./_generated/server";

// Seed sample transactions (sales and expenses) for testing
export const seedSampleTransactions = mutation({
  handler: async (ctx) => {
    // First, get some products to use in sales
    const products = await ctx.db.query("products").take(5);

    if (products.length === 0) {
      return { message: "No products found. Please seed products first." };
    }

    // Create some sample sales
    const sale1Items = [
      {
        productId: products[0]._id,
        productName: products[0].name,
        category: products[0].category,
        price: products[0].price,
        quantity: 2,
      },
      {
        productId: products[1]._id,
        productName: products[1].name,
        category: products[1].category,
        price: products[1].price,
        quantity: 1,
      },
    ];

    const sale2Items = [
      {
        productId: products[2]._id,
        productName: products[2].name,
        category: products[2].category,
        price: products[2].price,
        quantity: 1,
      },
    ];

    // Create sales
    await ctx.db.insert("sales", {
      transactionId: "SL-001",
      totalAmount: sale1Items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      ),
      itemCount: sale1Items.reduce((sum, item) => sum + item.quantity, 0),
      paymentReceived: 200,
      change:
        200 -
        sale1Items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      date: new Date().toISOString().slice(0, 10),
      time: "10:30 AM",
      createdAt: Date.now() - 86400000, // Yesterday
    });

    await ctx.db.insert("sales", {
      transactionId: "SL-002",
      totalAmount: sale2Items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      ),
      itemCount: sale2Items.reduce((sum, item) => sum + item.quantity, 0),
      paymentReceived: 100,
      change:
        100 -
        sale2Items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      date: new Date().toISOString().slice(0, 10),
      time: "2:15 PM",
      createdAt: Date.now() - 43200000, // 12 hours ago
    });

    // Create some sample expenses with items
    const expense1Id = await ctx.db.insert("expenses", {
      transactionId: "EXP-001",
      totalAmount: 300,
      itemCount: 1,
      date: new Date().toISOString().slice(0, 10),
      time: "9:00 AM",
      createdAt: Date.now() - 72000000, // 20 hours ago
    });

    // Add expense items for first expense
    await ctx.db.insert("expenseItems", {
      expenseId: expense1Id,
      category: "Supplies",
      title: "Cooking Oil",
      amount: 150,
      quantity: 2,
      total: 300,
    });

    const expense2Id = await ctx.db.insert("expenses", {
      transactionId: "EXP-002",
      totalAmount: 1200,
      itemCount: 1,
      date: new Date().toISOString().slice(0, 10),
      time: "11:45 AM",
      createdAt: Date.now() - 54000000, // 15 hours ago
    });

    // Add expense items for second expense
    await ctx.db.insert("expenseItems", {
      expenseId: expense2Id,
      category: "Utilities",
      title: "Electricity Bill",
      amount: 1200,
      quantity: 1,
      total: 1200,
    });

    return {
      message: "Sample transactions seeded successfully!",
      created: {
        sales: 2,
        expenses: 2,
      },
    };
  },
});
