import { HelpTooltip } from "@/components/HelpTooltip";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { ArrowLeft, Pencil, Plus, Settings } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../context/AuthContext";

const { width } = Dimensions.get("window");

// --- Colors ---
const COLORS = {
  primaryBlue: "#3b6ea5",
  darkBlueFooter: "#2c527a",
  lightBlueBg: "#f0f6fc",
  cardBg: "#dbeafe",
  counterBg: "#6ea2d5",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
  checkoutBtn: "#6e90bd",
};

// --- Types ---
interface Product {
  _id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  qty: number; // Local quantity state
}

export default function CounterScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Fetch products and categories from Convex
  const allProducts = useQuery(
    api.products.getProducts,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const categories = useQuery(
    api.categories.getCategories,
    user?.userId ? { userId: user.userId } : "skip",
  );

  // Mutations
  const updateProduct = useMutation(api.products.updateProduct);
  const migrateDefaults = useMutation(api.categories.migrateDefaultCategories);

  // Local quantity state for each product
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Edit mode state (per category)
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});

  // Migrate default categories if none exist
  React.useEffect(() => {
    if (categories && categories.length === 0 && user?.userId) {
      migrateDefaults({ userId: user.userId })
        .then(() => console.log("Default categories migrated"))
        .catch(console.error);
    }
  }, [categories, user?.userId]);

  // Group products by category with quantity state
  const productsByCategory = useMemo(() => {
    if (!allProducts || !categories) return {};

    const productsWithQty = allProducts.map((product) => ({
      ...product,
      qty: quantities[product._id] || 0,
    }));

    // Group products by categoryId
    const grouped: Record<string, typeof productsWithQty> = {};

    categories.forEach((category) => {
      grouped[category._id] = productsWithQty.filter(
        (p) => p.categoryId === category._id,
      );
    });

    return grouped;
  }, [allProducts, categories, quantities]);

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta),
    }));
  };

  const toggleEditMode = (categoryId: string) => {
    setEditMode((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const getTotalAmount = () => {
    if (!allProducts) return "0.00";

    return allProducts
      .reduce((sum, item) => {
        const qty = quantities[item._id] || 0;
        return sum + item.price * qty;
      }, 0)
      .toFixed(2);
  };

  const getTotalItems = () => {
    return Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  };

  const renderProductCard = (item: Product, categoryId: string) => (
    <TouchableOpacity
      key={item._id}
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => {
        if (editMode[categoryId]) {
          // Navigate to edit screen in edit mode
          router.push(`/edit-item?id=${item._id}`);
        } else {
          // Add to cart in normal mode
          updateQuantity(item._id, 1);
        }
      }}
      onLongPress={() => !editMode[categoryId] && updateQuantity(item._id, 5)}
      delayLongPress={250}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.image }}
          style={styles.productImage}
          resizeMode="cover"
        />
        {/* Edit indicator in edit mode */}
        {editMode[categoryId] && (
          <View style={styles.editIndicator}>
            <Text style={styles.editIndicatorText}>✎</Text>
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.productPrice}>₱ {item.price.toFixed(2)}</Text>
      </View>

      {!editMode[categoryId] && (
        <TouchableOpacity
          style={styles.counterBox}
          activeOpacity={0.8}
          onPress={() => item.qty > 0 && updateQuantity(item._id, -1)}
          onLongPress={() => item.qty > 0 && updateQuantity(item._id, -5)}
          delayLongPress={250}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.counterText}>{item.qty}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  // Show loading state if products or categories are not yet loaded
  if (allProducts === undefined || categories === undefined) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.primaryBlue}
        />
        <Text style={[styles.headerTitle, { color: COLORS.white }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryBlue}
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={COLORS.white} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Counter</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/manage-categories")}
          >
            <Settings color={COLORS.white} size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <HelpTooltip
              title="Counter Help"
              content="To add items: Press the product image. To remove items: Press the number in the bottom-right corner. Use the pencil icon to edit products, or the plus icon to add new items. Use the gear icon to manage categories."
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No categories yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the gear icon to create categories for your products
            </Text>
          </View>
        ) : (
          categories.map((category) => {
            const products = productsByCategory[category._id] || [];

            return (
              <View key={category._id}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {category.name.toUpperCase()}
                  </Text>
                  <View style={styles.editIcons}>
                    <TouchableOpacity
                      style={[
                        styles.circleAction,
                        editMode[category._id] && styles.circleActionActive,
                      ]}
                      onPress={() => toggleEditMode(category._id)}
                    >
                      <Pencil size={14} color={COLORS.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.circleAction}
                      onPress={() =>
                        router.push(`/add-item?categoryId=${category._id}`)
                      }
                    >
                      <Plus size={16} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.gridContainer}>
                  {products.length === 0 ? (
                    <Text style={styles.emptyCategory}>
                      No products in this category
                    </Text>
                  ) : (
                    products.map((item) =>
                      renderProductCard(item, category._id),
                    )
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footerContainer}>
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
          <Text style={styles.totalValue}>₱{getTotalAmount()}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={() => {
            const totalItems = getTotalItems();
            if (totalItems > 0 && allProducts) {
              const cartItems = allProducts
                .map((p) => ({ ...p, qty: quantities[p._id] || 0 }))
                .filter((item) => item.qty > 0);

              router.push({
                pathname: "/checkout",
                params: {
                  cartData: JSON.stringify(cartItems),
                },
              });
            }
          }}
        >
          <Text style={styles.checkoutText}>
            Checkout {getTotalItems() > 0 ? `(${getTotalItems()})` : ""}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryBlue,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: COLORS.primaryBlue,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.white,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    padding: 5,
  },
  helpCircleBg: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textGray,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  emptyCategory: {
    fontSize: 13,
    color: COLORS.textGray,
    fontStyle: "italic",
    paddingVertical: 20,
  },

  scrollContent: {
    backgroundColor: COLORS.lightBlueBg,
    paddingTop: 20,
    paddingHorizontal: 15,
    paddingBottom: 120,
    minHeight: "100%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 10,
    paddingHorizontal: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    textTransform: "uppercase",
  },
  editIcons: {
    flexDirection: "row",
    gap: 8,
  },
  circleAction: {
    backgroundColor: COLORS.primaryBlue,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  circleActionActive: {
    backgroundColor: COLORS.checkoutBtn,
    opacity: 0.8,
  },
  editIndicator: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: COLORS.primaryBlue,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  editIndicatorText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },

  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 10,
  },

  card: {
    width: (width - 50) / 3,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    marginBottom: 15,
    overflow: "hidden",
    position: "relative",
    height: 145,
  },
  imageContainer: {
    width: "100%",
    height: 80,
    backgroundColor: COLORS.white,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  productImage: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
  },
  cardContent: {
    padding: 8,
  },
  productName: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 2,
    lineHeight: 14,
  },
  productPrice: {
    fontSize: 10,
    color: COLORS.textGray,
  },
  counterBox: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.counterBg,
    width: 36,
    height: 35,
    borderTopLeftRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  counterText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
    minWidth: 40,
    textAlign: "center",
  },

  footerContainer: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: COLORS.darkBlueFooter,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  totalSection: {
    justifyContent: "center",
  },
  totalLabel: {
    color: "#aabccc",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 2,
  },
  totalValue: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  checkoutButton: {
    backgroundColor: COLORS.checkoutBtn,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  checkoutText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
