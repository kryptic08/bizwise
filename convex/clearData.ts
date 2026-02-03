import { mutation } from "./_generated/server";

// DANGER: This mutation clears ALL data from all tables
// Use only for development/testing purposes
export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all documents from each table
    const users = await ctx.db.query("users").collect();
    const products = await ctx.db.query("products").collect();
    const sales = await ctx.db.query("sales").collect();
    const saleItems = await ctx.db.query("saleItems").collect();
    const expenses = await ctx.db.query("expenses").collect();
    const expenseItems = await ctx.db.query("expenseItems").collect();

    // Delete all documents
    for (const user of users) {
      await ctx.db.delete(user._id);
    }
    for (const product of products) {
      await ctx.db.delete(product._id);
    }
    for (const sale of sales) {
      await ctx.db.delete(sale._id);
    }
    for (const saleItem of saleItems) {
      await ctx.db.delete(saleItem._id);
    }
    for (const expense of expenses) {
      await ctx.db.delete(expense._id);
    }
    for (const expenseItem of expenseItems) {
      await ctx.db.delete(expenseItem._id);
    }

    return {
      success: true,
      deleted: {
        users: users.length,
        products: products.length,
        sales: sales.length,
        saleItems: saleItems.length,
        expenses: expenses.length,
        expenseItems: expenseItems.length,
      },
    };
  },
});

// Clear only expenses and expense items (useful after schema changes)
export const clearExpenses = mutation({
  args: {},
  handler: async (ctx) => {
    const expenses = await ctx.db.query("expenses").collect();
    const expenseItems = await ctx.db.query("expenseItems").collect();

    for (const expense of expenses) {
      await ctx.db.delete(expense._id);
    }
    for (const expenseItem of expenseItems) {
      await ctx.db.delete(expenseItem._id);
    }

    return {
      success: true,
      deleted: {
        expenses: expenses.length,
        expenseItems: expenseItems.length,
      },
    };
  },
});
