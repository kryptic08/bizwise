import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Cake,
  Check,
  Coffee,
  Cookie,
  Edit,
  IceCream,
  Pizza,
  Plus,
  Sandwich,
  ShoppingBag,
  Trash2,
  Utensils,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useAuth } from "./context/AuthContext";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
  red: "#ef4444",
  green: "#10b981",
  borderLight: "#e5e7eb",
};

const ICON_OPTIONS = [
  { name: "Cookie", component: Cookie },
  { name: "Coffee", component: Coffee },
  { name: "Utensils", component: Utensils },
  { name: "ShoppingBag", component: ShoppingBag },
  { name: "Cake", component: Cake },
  { name: "IceCream", component: IceCream },
  { name: "Pizza", component: Pizza },
  { name: "Sandwich", component: Sandwich },
];

const COLOR_OPTIONS = [
  "#FF6B6B",
  "#4ECDC4",
  "#95E1D3",
  "#F38181",
  "#AA96DA",
  "#FCBAD3",
  "#FDCB6E",
  "#6C5CE7",
  "#00B894",
  "#FD79A8",
];

export default function ManageCategoriesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Convex queries and mutations
  const categories = useQuery(
    api.categories.getCategories,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const categoryCounts = useQuery(
    api.categories.getCategoryCounts,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const createCategory = useMutation(api.categories.createCategory);
  const updateCategory = useMutation(api.categories.updateCategory);
  const deleteCategory = useMutation(api.categories.deleteCategory);
  const migrateDefaults = useMutation(api.categories.migrateDefaultCategories);

  // State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [categoryName, setCategoryName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Cookie");
  const [selectedColor, setSelectedColor] = useState("#FF6B6B");
  const [isLoading, setIsLoading] = useState(false);

  // Migrate default categories if none exist
  React.useEffect(() => {
    if (categories && categories.length === 0 && user?.userId) {
      migrateDefaults({ userId: user.userId })
        .then(() => console.log("Default categories migrated"))
        .catch(console.error);
    }
  }, [categories, user?.userId]);

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert("Error", "Please enter a category name");
      return;
    }

    if (!user?.userId) {
      Alert.alert("Error", "Please log in to manage categories");
      return;
    }

    setIsLoading(true);
    try {
      if (editingCategoryId) {
        // Update existing category
        await updateCategory({
          categoryId: editingCategoryId as Id<"categories">,
          name: categoryName.trim(),
          icon: selectedIcon,
          color: selectedColor,
        });
        Alert.alert("Success", "Category updated successfully");
      } else {
        // Create new category
        await createCategory({
          userId: user.userId,
          name: categoryName.trim(),
          icon: selectedIcon,
          color: selectedColor,
        });
        Alert.alert("Success", "Category created successfully");
      }

      // Reset form
      setCategoryName("");
      setSelectedIcon("Cookie");
      setSelectedColor("#FF6B6B");
      setEditingCategoryId(null);
      setShowAddModal(false);
    } catch (error) {
      console.error("Error saving category:", error);
      Alert.alert("Error", "Failed to save category. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCategory = (category: any) => {
    setCategoryName(category.name);
    setSelectedIcon(category.icon || "Cookie");
    setSelectedColor(category.color || "#FF6B6B");
    setEditingCategoryId(category._id);
    setShowAddModal(true);
  };

  const handleDeleteCategory = (category: any) => {
    const productCount =
      categoryCounts?.find((c) => c.categoryId === category._id)
        ?.productCount || 0;

    if (productCount > 0) {
      Alert.alert(
        "Delete Category",
        `This category has ${productCount} product(s). What would you like to do?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete All",
            style: "destructive",
            onPress: () => confirmDelete(category._id, null),
          },
          {
            text: "Move Products",
            onPress: () => showMoveProductsDialog(category._id),
          },
        ],
      );
    } else {
      Alert.alert(
        "Delete Category",
        `Are you sure you want to delete "${category.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => confirmDelete(category._id, null),
          },
        ],
      );
    }
  };

  const showMoveProductsDialog = (categoryId: string) => {
    const otherCategories =
      categories?.filter((c) => c._id !== categoryId) || [];

    if (otherCategories.length === 0) {
      Alert.alert(
        "Error",
        "No other categories available. Please create another category first.",
      );
      return;
    }

    Alert.alert("Move Products", "Select a category to move products to:", [
      { text: "Cancel", style: "cancel" },
      ...otherCategories.map((cat) => ({
        text: cat.name,
        onPress: () => confirmDelete(categoryId, cat._id),
      })),
    ]);
  };

  const confirmDelete = async (categoryId: string, moveToId: string | null) => {
    setIsLoading(true);
    try {
      await deleteCategory({
        categoryId: categoryId as Id<"categories">,
        moveProductsToCategoryId: moveToId as Id<"categories"> | undefined,
      });
      Alert.alert("Success", "Category deleted successfully");
    } catch (error) {
      console.error("Error deleting category:", error);
      Alert.alert("Error", "Failed to delete category. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getIconComponent = (iconName?: string) => {
    const icon = ICON_OPTIONS.find((i) => i.name === iconName);
    return icon ? icon.component : Cookie;
  };

  const renderCategoryItem = (category: any) => {
    const IconComponent = getIconComponent(category.icon);
    const productCount =
      categoryCounts?.find((c) => c.categoryId === category._id)
        ?.productCount || 0;

    return (
      <View key={category._id} style={styles.categoryItem}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: category.color || "#FF6B6B" },
          ]}
        >
          <IconComponent size={24} color={COLORS.white} />
        </View>

        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{category.name}</Text>
          <Text style={styles.categoryCount}>
            {productCount} product{productCount !== 1 ? "s" : ""}
          </Text>
        </View>

        <View style={styles.categoryActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditCategory(category)}
          >
            <Edit size={20} color={COLORS.primaryBlue} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteCategory(category)}
          >
            <Trash2 size={20} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryBlue}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={COLORS.white} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Categories</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            setCategoryName("");
            setSelectedIcon("Cookie");
            setSelectedColor("#FF6B6B");
            setEditingCategoryId(null);
            setShowAddModal(true);
          }}
        >
          <Plus color={COLORS.white} size={24} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.sectionTitle}>Product Categories</Text>
        <Text style={styles.sectionDescription}>
          Organize your counter products by creating custom categories
        </Text>

        {categories === undefined ? (
          <Text style={styles.loadingText}>Loading categories...</Text>
        ) : categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No categories yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the + button to create your first category
            </Text>
          </View>
        ) : (
          <View style={styles.categoriesList}>
            {categories.map(renderCategoryItem)}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Category Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategoryId ? "Edit Category" : "New Category"}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Category Name */}
              <Text style={styles.inputLabel}>Category Name</Text>
              <TextInput
                style={styles.input}
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="e.g., Snacks, Drinks, etc."
                placeholderTextColor={COLORS.textGray}
              />

              {/* Icon Selection */}
              <Text style={styles.inputLabel}>Select Icon</Text>
              <View style={styles.iconGrid}>
                {ICON_OPTIONS.map((icon) => {
                  const IconComponent = icon.component;
                  const isSelected = selectedIcon === icon.name;
                  return (
                    <TouchableOpacity
                      key={icon.name}
                      style={[
                        styles.iconOption,
                        isSelected && styles.iconOptionSelected,
                      ]}
                      onPress={() => setSelectedIcon(icon.name)}
                    >
                      <IconComponent
                        size={28}
                        color={
                          isSelected ? COLORS.primaryBlue : COLORS.textGray
                        }
                      />
                      {isSelected && (
                        <View style={styles.checkmark}>
                          <Check size={12} color={COLORS.white} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Color Selection */}
              <Text style={styles.inputLabel}>Select Color</Text>
              <View style={styles.colorGrid}>
                {COLOR_OPTIONS.map((color) => {
                  const isSelected = selectedColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        isSelected && styles.colorOptionSelected,
                      ]}
                      onPress={() => setSelectedColor(color)}
                    >
                      {isSelected && <Check size={20} color={COLORS.white} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  isLoading && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveCategory}
                disabled={isLoading}
              >
                <Text style={styles.saveButtonText}>
                  {isLoading ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
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
  headerButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
  },
  contentContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 5,
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.textGray,
    marginBottom: 20,
  },
  loadingText: {
    textAlign: "center",
    color: COLORS.textGray,
    marginTop: 40,
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
  },
  categoriesList: {
    gap: 12,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 13,
    color: COLORS.textGray,
  },
  categoryActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  modalCloseButton: {
    fontSize: 24,
    color: COLORS.textGray,
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.lightBlueBg,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.textDark,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  iconOption: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: COLORS.lightBlueBg,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconOptionSelected: {
    backgroundColor: COLORS.primaryBlue + "20",
    borderWidth: 2,
    borderColor: COLORS.primaryBlue,
  },
  checkmark: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  modalActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: COLORS.lightBlueBg,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  saveButton: {
    backgroundColor: COLORS.primaryBlue,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
});
