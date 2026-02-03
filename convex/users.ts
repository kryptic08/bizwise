import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new user (signup)
export const createUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Create the user (in production, hash the password!)
    const userId = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      password: args.password, // TODO: Hash in production
      name: args.name || args.email.split("@")[0],
      createdAt: Date.now(),
    });

    return { userId, email: args.email.toLowerCase() };
  },
});

// Login user
export const loginUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Check password (in production, compare hashed passwords!)
    if (user.password !== args.password) {
      throw new Error("Invalid email or password");
    }

    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      pin: user.pin,
      profilePicture: user.profilePicture,
    };
  },
});

// Get user by ID
export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Don't return password
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      createdAt: user.createdAt,
    };
  },
});

// Check if email exists
export const checkEmailExists = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    return !!user;
  },
});

// Update user profile
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;

    // Check if user exists
    const existingUser = await ctx.db.get(userId);
    if (!existingUser) {
      throw new Error("User not found. Please log in again.");
    }

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    await ctx.db.patch(userId, filteredUpdates);

    // Return updated user data
    const user = await ctx.db.get(userId);
    return {
      success: true,
      user: user
        ? {
            userId: user._id,
            email: user.email,
            name: user.name,
            phone: user.phone,
          }
        : null,
    };
  },
});

// Update user password
export const updatePassword = mutation({
  args: {
    userId: v.id("users"),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    if (user.password !== args.currentPassword) {
      throw new Error("Current password is incorrect");
    }

    // Update to new password
    await ctx.db.patch(args.userId, { password: args.newPassword });
    return { success: true };
  },
});

// Delete user account
export const deleteUser = mutation({
  args: {
    userId: v.id("users"),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify password
    if (user.password !== args.password) {
      throw new Error("Incorrect password");
    }

    // Delete all user data
    const products = await ctx.db
      .query("products")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const product of products) {
      await ctx.db.delete(product._id);
    }

    const sales = await ctx.db
      .query("sales")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const sale of sales) {
      await ctx.db.delete(sale._id);
    }

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const expense of expenses) {
      await ctx.db.delete(expense._id);
    }

    // Finally, delete the user
    await ctx.db.delete(args.userId);

    return { success: true };
  },
});

// Set user PIN
export const setPin = mutation({
  args: {
    userId: v.id("users"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Validate PIN (4 digits)
    if (!/^\d{4}$/.test(args.pin)) {
      throw new Error("PIN must be exactly 4 digits");
    }

    await ctx.db.patch(args.userId, { pin: args.pin });
    return { success: true };
  },
});

// Verify user PIN
export const verifyPin = mutation({
  args: {
    userId: v.id("users"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.pin) {
      throw new Error("No PIN set for this user");
    }

    if (user.pin !== args.pin) {
      throw new Error("Incorrect PIN");
    }

    return { success: true };
  },
});

// Update user PIN
export const updatePin = mutation({
  args: {
    userId: v.id("users"),
    currentPin: v.string(),
    newPin: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify current PIN
    if (!user.pin) {
      throw new Error("No PIN set for this user");
    }

    if (user.pin !== args.currentPin) {
      throw new Error("Current PIN is incorrect");
    }

    // Validate new PIN
    if (!/^\d{4}$/.test(args.newPin)) {
      throw new Error("PIN must be exactly 4 digits");
    }

    await ctx.db.patch(args.userId, { pin: args.newPin });
    return { success: true };
  },
});

// Update profile picture
export const updateProfilePicture = mutation({
  args: {
    userId: v.id("users"),
    profilePicture: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.userId, { profilePicture: args.profilePicture });
    return { success: true };
  },
});
