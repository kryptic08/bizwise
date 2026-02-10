import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Camera, HelpCircle } from "lucide-react-native";
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
};

export default function AddItemScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();

  // Queries and mutations
  const categories = useQuery(
    api.categories.getCategories,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const addProduct = useMutation(api.products.addProduct);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [formData, setFormData] = useState({
    name: "",
    categoryId: categoryId || "",
    price: "",
    image: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  // Set initial category from URL param
  useEffect(() => {
    if (categoryId && !formData.categoryId) {
      setFormData((prev) => ({ ...prev, categoryId }));
    }
  }, [categoryId]);

  const pickImage = async () => {
    // Request permission
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission to access camera roll is required!");
      return;
    }

    // Launch image picker
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
    // Request permission
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission to access camera is required!");
      return;
    }

    // Launch camera
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
    Alert.alert("Select Image", "Choose how to add image", [
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
    if (!user?.userId) {
      Alert.alert("Error", "Please login to add items");
      return;
    }

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

      // Upload image to Convex if available
      let imageStorageId = undefined;
      if (formData.image) {
        imageStorageId = await uploadImageToConvex(formData.image);
      }

      await addProduct({
        userId: user?.userId,
        name: formData.name,
        category: selectedCategory.name, // Legacy field
        categoryId: formData.categoryId as Id<"categories">,
        price: parseFloat(formData.price),
        imageStorageId,
        image: formData.image || "https://via.placeholder.com/100", // Fallback for legacy
      });

      Alert.alert("Success", "Item created successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error adding product:", error);
      Alert.alert("Error", "Failed to create item. Please try again.");
    } finally {
      setIsLoading(false);
    }
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
        <Text style={styles.headerTitle}>Add New Item</Text>
        <TouchableOpacity style={styles.headerButton}>
          <View style={styles.helpIconBg}>
            <HelpCircle color={COLORS.primaryBlue} size={18} />
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
            {isLoading ? "Saving..." : "Save Item"}
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
    fontWeight: "600",
    color: COLORS.white,
  },
  headerButton: {
    padding: 5,
  },
  helpIconBg: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
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
    overflow: "hidden",
    borderWidth: 2,
    borderColor: COLORS.borderGray,
    borderStyle: "dashed",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageText: {
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textGray,
    fontStyle: "italic",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textGray,
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
