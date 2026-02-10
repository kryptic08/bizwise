import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Camera, Trash2 } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
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
  borderGray: "#d1d5db",
  red: "#ff5c5c",
};

export default function EditItemScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Fetch the product to edit
  const allProducts = useQuery(
    api.products.getProducts,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const product = allProducts?.find((p) => p._id === id);

  // Fetch user's categories from DB
  const categories = useQuery(
    api.categories.getCategories,
    user?.userId ? { userId: user.userId } : "skip",
  );

  // Mutations
  const updateProduct = useMutation(api.products.updateProduct);
  const deleteProduct = useMutation(api.products.deleteProduct);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    price: "",
    image: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form data when product loads
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        categoryId: product.categoryId || "",
        price: product.price.toString(),
        image: product.image,
      });
    }
  }, [product]);

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission to access camera roll is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setFormData({ ...formData, image: result.assets[0].uri });
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission to access camera is required!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setFormData({ ...formData, image: result.assets[0].uri });
    }
  };

  const handleImageAction = () => {
    Alert.alert("Select Image", "Choose how to update image", [
      { text: "Camera", onPress: takePhoto },
      { text: "Gallery", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const uploadImageToConvex = async (imageUri: string) => {
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(imageUri);
      const blob = await response.blob();

      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });

      const { storageId } = await result.json();
      return storageId;
    } catch (error) {
      console.error("Error uploading image to Convex:", error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.categoryId || !formData.price) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (isNaN(parseFloat(formData.price))) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    setIsLoading(true);
    try {
      // Get category details
      const selectedCategory = categories?.find(
        (c) => c._id === formData.categoryId,
      );
      if (!selectedCategory) {
        throw new Error("Invalid category selected");
      }

      // Upload new image to Convex if changed and is local URI
      let imageStorageId = undefined;
      if (formData.image && formData.image.startsWith("file://")) {
        imageStorageId = await uploadImageToConvex(formData.image);
      }

      await updateProduct({
        id: id as any,
        name: formData.name,
        category: selectedCategory.name,
        categoryId: formData.categoryId as Id<"categories">,
        price: parseFloat(formData.price),
        imageStorageId,
        image: formData.image,
      });

      Alert.alert("Success", "Item updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error updating product:", error);
      Alert.alert("Error", "Failed to update item. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert("Delete Item", "Are you sure you want to delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setIsLoading(true);
          try {
            await deleteProduct({ id: id as any });
            Alert.alert("Success", "Item deleted successfully!", [
              { text: "OK", onPress: () => router.back() },
            ]);
          } catch (error) {
            console.error("Error deleting product:", error);
            Alert.alert("Error", "Failed to delete item. Please try again.");
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  // Show loading if product not found yet
  if (!product && allProducts !== undefined) {
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
        <Text style={{ color: COLORS.white, fontSize: 18 }}>
          Product not found
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!product) {
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
        <Text style={{ color: COLORS.white, fontSize: 18 }}>
          Loading product...
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={COLORS.white} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Item</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleDelete}>
          <View style={styles.deleteIconBg}>
            <Trash2 color={COLORS.red} size={18} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.contentContainer}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Image Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Item Photo</Text>
            <TouchableOpacity
              style={styles.imageContainer}
              onPress={handleImageAction}
            >
              {formData.image ? (
                <Image
                  source={{ uri: formData.image }}
                  style={styles.itemImage}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Camera size={40} color={COLORS.textGray} />
                  <Text style={styles.imageText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Name Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Item Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter item name"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
          </View>

          {/* Category Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category *</Text>
            {categories === undefined ? (
              <Text style={styles.loadingText}>Loading categories...</Text>
            ) : categories.length === 0 ? (
              <Text style={styles.emptyText}>
                No categories available. Please create categories first.
              </Text>
            ) : (
              <View style={styles.categoryContainer}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category._id}
                    style={[
                      styles.categoryChip,
                      formData.categoryId === category._id &&
                        styles.categoryChipActive,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, categoryId: category._id })
                    }
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        formData.categoryId === category._id &&
                          styles.categoryTextActive,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Price Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="0.00"
              value={formData.price}
              onChangeText={(text) => setFormData({ ...formData, price: text })}
              keyboardType="numeric"
            />
          </View>
        </ScrollView>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? "Saving..." : "Update Item"}
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
  },
  headerButton: {
    padding: 5,
  },
  deleteIconBg: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  backButtonText: {
    color: COLORS.primaryBlue,
    fontWeight: "600",
  },
  contentContainer: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    position: "relative",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 12,
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.borderGray,
    borderStyle: "dashed",
  },
  itemImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  imagePlaceholder: {
    alignItems: "center",
  },
  imageText: {
    fontSize: 14,
    color: COLORS.textGray,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primaryBlue,
    borderColor: COLORS.primaryBlue,
  },
  categoryText: {
    fontSize: 14,
    color: COLORS.textDark,
    fontWeight: "500",
  },
  categoryTextActive: {
    color: COLORS.white,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textGray,
    fontStyle: "italic",
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  saveButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: COLORS.primaryBlue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.white,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.textGray,
    opacity: 0.6,
  },
});
