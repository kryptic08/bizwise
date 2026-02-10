import { query } from "./_generated/server";

/**
 * Debug function to check users and their data counts
 */
export const checkTestUser = query({
  args: {},
  handler: async (ctx) => {
    // Get test user
    const testUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "test@bizwise.com"))
      .first();

    if (!testUser) {
      return { error: "Test user not found" };
    }

    // Count sales for test user
    const salesCount = await ctx.db
      .query("sales")
      .withIndex("by_user", (q) => q.eq("userId", testUser._id))
      .collect()
      .then((sales) => sales.length);

    // Count expenses for test user
    const expensesCount = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", testUser._id))
      .collect()
      .then((expenses) => expenses.length);

    return {
      testUser: {
        id: testUser._id,
        email: testUser.email,
        name: testUser.name,
      },
      salesCount,
      expensesCount,
      totalTransactions: salesCount + expensesCount,
    };
  },
});

/**
 * List all users in the system
 */
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((user) => ({
      id: user._id,
      email: user.email,
      name: user.name,
      createdAt: new Date(user.createdAt || 0).toISOString(),
    }));
  },
});
