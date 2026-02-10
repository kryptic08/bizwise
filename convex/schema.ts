import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users for authentication
  users: defineTable({
    email: v.string(),
    password: v.string(), // In production, store hashed password
    name: v.string(),
    phone: v.optional(v.string()),
    pin: v.optional(v.string()), // 4-digit PIN for quick authentication
    profilePictureStorageId: v.optional(v.id("_storage")), // Convex storage ID for profile picture
    profilePicture: v.optional(v.string()), // Legacy: URL or local URI (kept for backward compatibility)
    targetIncome: v.optional(
      v.object({
        monthly: v.number(),
        daily: v.optional(v.number()),
        updatedAt: v.number(),
      }),
    ),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // Product categories for Counter screen (user-created)
  categories: defineTable({
    userId: v.id("users"),
    name: v.string(), // Display name
    icon: v.optional(v.string()), // Icon name from lucide-react-native
    color: v.optional(v.string()), // Hex color
    sortOrder: v.number(), // For ordering categories
    isDefault: v.optional(v.boolean()), // Mark migrated default categories
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_sort", ["userId", "sortOrder"]),

  // Products for Counter screen
  products: defineTable({
    userId: v.optional(v.id("users")), // Optional for backward compatibility
    name: v.string(),
    category: v.string(), // Legacy string for backward compatibility
    categoryId: v.optional(v.id("categories")), // New reference to categories table
    price: v.number(),
    imageStorageId: v.optional(v.id("_storage")), // Convex storage ID for product image
    image: v.string(), // Legacy: URL or local URI (kept for backward compatibility)
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_user", ["userId"])
    .index("by_user_category", ["userId", "category"])
    .index("by_category_id", ["categoryId"]),

  // Sales transactions (income from counter)
  sales: defineTable({
    userId: v.optional(v.id("users")), // Optional for backward compatibility
    transactionId: v.string(), // "SL-XXX"
    totalAmount: v.number(),
    itemCount: v.number(),
    paymentReceived: v.number(),
    change: v.number(),
    date: v.string(),
    time: v.string(),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // Sale items (line items for each sale)
  saleItems: defineTable({
    saleId: v.id("sales"),
    productId: v.id("products"),
    productName: v.string(),
    category: v.string(),
    price: v.number(),
    quantity: v.number(),
    subtotal: v.number(),
  }).index("by_sale", ["saleId"]),

  // Expenses
  expenses: defineTable({
    userId: v.optional(v.id("users")), // Optional for backward compatibility
    transactionId: v.string(), // "EXP-XXX"
    totalAmount: v.number(), // Total for all items in this expense transaction
    itemCount: v.number(), // Number of items in this expense
    date: v.string(),
    time: v.string(),
    receiptImageStorageId: v.optional(v.id("_storage")), // Convex storage ID for receipt image
    receiptImage: v.optional(v.string()), // Legacy: local URI (kept for backward compatibility)
    ocrText: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // Expense items (line items for each expense)
  expenseItems: defineTable({
    expenseId: v.id("expenses"),
    category: v.string(),
    title: v.string(),
    amount: v.number(),
    quantity: v.number(),
    total: v.number(),
  }).index("by_expense", ["expenseId"]),
});
