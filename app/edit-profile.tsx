import { useMutation } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ArrowLeft, Camera, HelpCircle } from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../convex/_generated/api";
import { useAuth } from "./context/AuthContext";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
  borderGray: "#d1d5db",
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, login, logout } = useAuth();
  const updateUser = useMutation(api.users.updateUser);
  const updateProfilePictureMutation = useMutation(
    api.users.updateProfilePicture,
  );
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
  });
  const [profilePicture, setProfilePicture] = useState(
    user?.profilePicture || null,
  );
  const [isLoading, setIsLoading] = useState(false);

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

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Camera roll permission is required to change profile picture",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      setProfilePicture(imageUri);

      // Upload to Convex and save
      try {
        const profilePictureStorageId = await uploadImageToConvex(imageUri);
        await updateProfilePictureMutation({
          userId: user!.userId,
          profilePictureStorageId,
          profilePicture: imageUri,
        });

        // Update local auth context
        await login({
          ...user!,
          profilePicture: imageUri,
        });
      } catch (error: any) {
        console.error("Error updating profile picture:", error);
        Alert.alert("Error", "Failed to update profile picture");
        setProfilePicture(user?.profilePicture || null);
      }
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateUser({
        userId: user?.userId,
        name: formData.name,
        phone: formData.phone || undefined,
      });

      // Update local auth context with the returned user data
      if (result.user) {
        await login(result.user as any);
      }

      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error("Error updating profile:", error);

      // If user not found, clear session and redirect to login
      if (error.message?.includes("User not found")) {
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please log in again.",
          [
            {
              text: "OK",
              onPress: async () => {
                await logout();
                router.replace("/login");
              },
            },
          ],
        );
      } else {
        Alert.alert("Error", "Failed to update profile. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity style={styles.headerButton}>
          <View style={styles.helpIconBg}>
            <HelpCircle color={COLORS.primaryBlue} size={18} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture */}
        <View style={styles.profilePictureContainer}>
          <View style={styles.profileImageWrapper}>
            {profilePicture ? (
              <Image
                source={{ uri: profilePicture }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profileInitial}>
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handlePickImage}
            >
              <Camera color={COLORS.white} size={16} />
            </TouchableOpacity>
          </View>
          <Text style={styles.changePhotoText}>Change Profile Picture</Text>
        </View>

        {/* Email (Read-only) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.input, styles.disabledInput]}>
            <Text style={styles.disabledText}>{user?.email}</Text>
          </View>
          <Text style={styles.helperText}>Email cannot be changed</Text>
        </View>

        {/* Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor={COLORS.textGray}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
          />
        </View>

        {/* Phone */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your phone number"
            placeholderTextColor={COLORS.textGray}
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            keyboardType="phone-pad"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
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
  content: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 30,
    flexGrow: 1,
  },
  profilePictureContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  profileImageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    position: "relative",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  profilePlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
    backgroundColor: COLORS.primaryBlue,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitial: {
    fontSize: 48,
    fontWeight: "700",
    color: COLORS.white,
  },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryBlue,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  changePhotoText: {
    fontSize: 14,
    color: COLORS.primaryBlue,
    fontWeight: "600",
    marginTop: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  required: {
    color: "#ff5c5c",
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textDark,
    borderWidth: 2,
    borderColor: COLORS.primaryBlue,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledInput: {
    backgroundColor: "#f3f4f6",
  },
  disabledText: {
    color: COLORS.textGray,
    fontSize: 15,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 5,
  },
  saveButton: {
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
