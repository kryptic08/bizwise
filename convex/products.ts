import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all products for a user
export const getProducts = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (args.userId) {
      return await ctx.db
        .query("products")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .order("desc")
        .collect();
    }
    // Fallback for legacy data without userId
    return await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("desc")
      .collect();
  },
});

// Get products by category for a user
export const getProductsByCategory = query({
  args: {
    category: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (args.userId) {
      return await ctx.db
        .query("products")
        .withIndex("by_user_category", (q) =>
          q.eq("userId", args.userId).eq("category", args.category),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
    }
    return await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Add new product for a user
export const addProduct = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    category: v.string(),
    price: v.number(),
    imageStorageId: v.optional(v.id("_storage")),
    image: v.string(),
  },
  handler: async (ctx, args) => {
    const productId = await ctx.db.insert("products", {
      userId: args.userId,
      name: args.name,
      category: args.category,
      price: args.price,
      imageStorageId: args.imageStorageId,
      image: args.image,
      isActive: true,
      createdAt: Date.now(),
    });
    return productId;
  },
});

// Update product
export const updateProduct = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    price: v.optional(v.number()),
    imageStorageId: v.optional(v.id("_storage")),
    image: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// Soft delete product
export const deleteProduct = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});
