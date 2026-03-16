import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Password hashing (SHA-256 with per-user salt via email) ────────────────
// Convex runs in a V8 environment with the Web Crypto API available.
async function hashPassword(email: string, password: string): Promise<string> {
  const input = `${email.toLowerCase()}:${password}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Returns true when a stored password value is already a SHA-256 hex hash. */
function isHashed(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

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

    // Hash the password before storing
    const hashed = await hashPassword(args.email, args.password);

    const userId = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      password: hashed,
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

    // Compare password – support both legacy plaintext and new SHA-256 hashes.
    // On first login with legacy plaintext, auto-upgrade to hash.
    let passwordValid = false;
    if (isHashed(user.password)) {
      const hashed = await hashPassword(args.email, args.password);
      passwordValid = hashed === user.password;
    } else {
      // Legacy plaintext comparison (migrate on success)
      passwordValid = user.password === args.password;
      if (passwordValid) {
        // Silently upgrade to hashed storage
        const hashed = await hashPassword(args.email, args.password);
        await ctx.db.patch(user._id, { password: hashed });
      }
    }

    if (!passwordValid) {
      throw new Error("Invalid email or password");
    }

    // Resolve profile picture URL if storage ID exists
    let profilePictureUrl = user.profilePicture;
    if (user.profilePictureStorageId) {
      profilePictureUrl =
        (await ctx.storage.getUrl(user.profilePictureStorageId)) ||
        user.profilePicture;
    }

    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      pin: user.pin,
      profilePicture: profilePictureUrl,
    };
  },
});

// Get user by ID
export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Resolve profile picture URL if storage ID exists
    let profilePictureUrl = user.profilePicture;
    if (user.profilePictureStorageId) {
      profilePictureUrl =
        (await ctx.storage.getUrl(user.profilePictureStorageId)) ||
        user.profilePicture;
    }

    // Don't return password
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      createdAt: user.createdAt,
      profilePicture: profilePictureUrl,
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

    // Resolve profile picture URL if storage ID exists
    let profilePictureUrl = user?.profilePicture;
    if (user?.profilePictureStorageId) {
      profilePictureUrl =
        (await ctx.storage.getUrl(user.profilePictureStorageId)) ||
        user.profilePicture;
    }

    return {
      success: true,
      user: user
        ? {
            userId: user._id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            profilePicture: profilePictureUrl,
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

    // Verify current password (supports legacy plaintext + hashed)
    let currentValid = false;
    if (isHashed(user.password)) {
      const hashed = await hashPassword(user.email, args.currentPassword);
      currentValid = hashed === user.password;
    } else {
      currentValid = user.password === args.currentPassword;
    }
    if (!currentValid) {
      throw new Error("Current password is incorrect");
    }

    // Store new password as hash
    const newHashed = await hashPassword(user.email, args.newPassword);
    await ctx.db.patch(args.userId, { password: newHashed });
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

    // Verify password (supports legacy plaintext + hashed)
    let pwValid = false;
    if (isHashed(user.password)) {
      const hashed = await hashPassword(user.email, args.password);
      pwValid = hashed === user.password;
    } else {
      pwValid = user.password === args.password;
    }
    if (!pwValid) {
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
    profilePictureStorageId: v.optional(v.id("_storage")),
    profilePicture: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.userId, {
      profilePictureStorageId: args.profilePictureStorageId,
      profilePicture: args.profilePicture,
    });

    // Resolve and return the profile picture URL
    let profilePictureUrl = args.profilePicture;
    if (args.profilePictureStorageId) {
      profilePictureUrl =
        (await ctx.storage.getUrl(args.profilePictureStorageId)) ||
        args.profilePicture;
    }

    return {
      success: true,
      profilePicture: profilePictureUrl,
    };
  },
});

// Update user's target income
export const updateTargetIncome = mutation({
  args: {
    userId: v.id("users"),
    monthly: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const daily = args.monthly / 30;

    await ctx.db.patch(args.userId, {
      targetIncome: {
        monthly: args.monthly,
        daily: daily,
        updatedAt: Date.now(),
      },
    });

    return {
      success: true,
      monthly: args.monthly,
      daily: daily,
    };
  },
});

// Get user's target income
export const getTargetIncome = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    return user.targetIncome || null;
  },
});

// One-off cleanup for legacy user documents that still contain businessType.
export const removeLegacyBusinessTypeFromUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updatedCount = 0;

    for (const user of users) {
      if (user.businessType === undefined) {
        continue;
      }

      const { _creationTime, businessType, ...rest } = user;
      void _creationTime;
      void businessType;

      await ctx.db.replace(user._id, rest);
      updatedCount += 1;
    }

    return {
      scannedCount: users.length,
      updatedCount,
    };
  },
});
