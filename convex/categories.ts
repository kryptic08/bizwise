import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

// Get all categories for a user (sorted by sortOrder)
export const getCategories = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user_sort", (q) => q.eq("userId", args.userId))
      .collect();

    // Sort by sortOrder
    return categories.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

// Get a single category by ID
export const getCategory = query({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.categoryId);
  },
});

// Create a new category
export const createCategory = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the highest sortOrder for this user
    const existingCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const maxSortOrder = Math.max(
      ...existingCategories.map((c) => c.sortOrder),
      0,
    );

    const categoryId = await ctx.db.insert("categories", {
      userId: args.userId,
      name: args.name,
      icon: args.icon,
      color: args.color,
      sortOrder: maxSortOrder + 1,
      createdAt: Date.now(),
    });

    return categoryId;
  },
});

// Update a category
export const updateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { categoryId, ...updates } = args;

    // Remove undefined fields
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );

    await ctx.db.patch(categoryId, cleanUpdates);
  },
});

// Delete a category (will also need to handle products in this category)
export const deleteCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    moveProductsToCategoryId: v.optional(v.id("categories")), // Optional: move products to another category
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    // Find all products in this category
    const products = await ctx.db
      .query("products")
      .withIndex("by_category_id", (q) => q.eq("categoryId", args.categoryId))
      .collect();

    if (args.moveProductsToCategoryId) {
      // Move products to the specified category
      const targetCategory = await ctx.db.get(args.moveProductsToCategoryId);
      if (!targetCategory) {
        throw new Error("Target category not found");
      }

      for (const product of products) {
        await ctx.db.patch(product._id, {
          categoryId: args.moveProductsToCategoryId,
          category: targetCategory.name, // Update legacy field
        });
      }
    } else {
      // Delete all products in this category
      for (const product of products) {
        await ctx.db.delete(product._id);
      }
    }

    // Delete the category
    await ctx.db.delete(args.categoryId);
  },
});

// Reorder categories
export const reorderCategories = mutation({
  args: {
    categoryIds: v.array(v.id("categories")), // Array of category IDs in new order
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.categoryIds.length; i++) {
      await ctx.db.patch(args.categoryIds[i], {
        sortOrder: i + 1,
      });
    }
  },
});

// Get product count for each category
export const getCategoryCounts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const counts = await Promise.all(
      categories.map(async (category) => {
        const products = await ctx.db
          .query("products")
          .withIndex("by_category_id", (q) => q.eq("categoryId", category._id))
          .collect();

        return {
          categoryId: category._id,
          name: category.name,
          productCount: products.length,
        };
      }),
    );

    return counts;
  },
});

// Migrate default categories for a user (call this once per user)
export const migrateDefaultCategories = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Check if user already has categories
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (existing.length > 0) {
      return { message: "User already has categories", categoryIds: [] };
    }

    // Create default categories
    const defaultCategories = [
      { name: "Snacks", icon: "Cookie", color: "#FF6B6B", sortOrder: 1 },
      { name: "Rice Meals", icon: "Utensils", color: "#4ECDC4", sortOrder: 2 },
      { name: "Drinks", icon: "Coffee", color: "#95E1D3", sortOrder: 3 },
    ];

    const categoryIds = [];
    const categoryMap: Record<string, Id<"categories">> = {};

    for (const cat of defaultCategories) {
      const categoryId = await ctx.db.insert("categories", {
        userId: args.userId,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        sortOrder: cat.sortOrder,
        isDefault: true,
        createdAt: Date.now(),
      });
      categoryIds.push(categoryId);

      // Map old category names to new IDs
      if (cat.name === "Snacks") categoryMap["snacks"] = categoryId;
      if (cat.name === "Rice Meals") categoryMap["riceMeals"] = categoryId;
      if (cat.name === "Drinks") categoryMap["drinks"] = categoryId;
    }

    // Update existing products to use new category IDs
    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const product of allProducts) {
      const categoryId = categoryMap[product.category];
      if (categoryId) {
        await ctx.db.patch(product._id, {
          categoryId,
        });
      }
    }

    return { message: "Default categories created", categoryIds };
  },
});
