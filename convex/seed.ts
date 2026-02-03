import { mutation } from "./_generated/server";

// Seed initial products data
export const seedProducts = mutation({
  handler: async (ctx) => {
    // Check if products already exist
    const existingProducts = await ctx.db.query("products").collect();
    if (existingProducts.length > 0) {
      return { message: "Products already seeded" };
    }

    const productsToSeed = [
      // SNACKS
      {
        name: "Cheese Burger",
        category: "snacks",
        price: 25.0,
        image:
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80",
        isActive: true,
        createdAt: Date.now(),
      },
      {
        name: "Fries",
        category: "snacks",
        price: 30.0,
        image:
          "https://images.unsplash.com/photo-1573080496987-a199f8cd75c5?auto=format&fit=crop&w=300&q=80",
        isActive: true,
        createdAt: Date.now(),
      },
      {
        name: "Sandwich",
        category: "snacks",
        price: 15.0,
        image:
          "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=300&q=80",
        isActive: true,
        createdAt: Date.now(),
      },

      // RICE MEALS
      {
        name: "Chicken Ala King",
        category: "riceMeals",
        price: 69.0,
        image:
          "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=300&q=80",
        isActive: true,
        createdAt: Date.now(),
      },
      {
        name: "Chicken Inasal",
        category: "riceMeals",
        price: 69.0,
        image:
          "https://images.unsplash.com/photo-1603360946369-dc9bb6f54262?auto=format&fit=crop&w=300&q=80",
        isActive: true,
        createdAt: Date.now(),
      },
      {
        name: "Pork Sisig",
        category: "riceMeals",
        price: 69.0,
        image:
          "https://images.unsplash.com/photo-1562967962-972eb6eb2338?auto=format&fit=crop&w=300&q=80",
        isActive: true,
        createdAt: Date.now(),
      },
      {
        name: "Siomai Rice",
        category: "riceMeals",
        price: 39.0,
        image:
          "https://images.unsplash.com/photo-1625938145744-e38051539994?auto=format&fit=crop&w=300&q=80",
        isActive: true,
        createdAt: Date.now(),
      },

      // DRINKS
      {
        name: "Coke",
        category: "drinks",
        price: 20.0,
        image:
          "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=300&q=80",
        isActive: true,
        createdAt: Date.now(),
      },
      {
        name: "Orange Juice",
        category: "drinks",
        price: 25.0,
        image:
          "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=300&q=80",
        isActive: true,
        createdAt: Date.now(),
      },
      {
        name: "Iced Tea",
        category: "drinks",
        price: 18.0,
        image:
          "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=300&q=80",
        isActive: true,
        createdAt: Date.now(),
      },
    ];

    // Insert all products
    const insertedIds = [];
    for (const product of productsToSeed) {
      const id = await ctx.db.insert("products", product);
      insertedIds.push(id);
    }

    return {
      message: "Products seeded successfully",
      count: insertedIds.length,
      productIds: insertedIds,
    };
  },
});
