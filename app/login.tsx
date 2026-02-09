import { useMutation } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Camera, Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import Svg, { Path } from "react-native-svg";
import { api } from "../convex/_generated/api";
import { useAuth } from "./context/AuthContext";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#9ca3af",
  error: "#ef4444",
};

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginUser = useMutation(api.users.loginUser);
  const createUser = useMutation(api.users.createUser);
  const updateProfilePictureMutation = useMutation(
    api.users.updateProfilePicture,
  );
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Camera roll permission is required to add profile picture",
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
      setProfilePicture(result.assets[0].uri);
    }
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

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    if (isSignUp && !name) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        // Sign up
        const result = await createUser({
          email,
          password,
          name,
        });

        // If profile picture was selected, upload it to Convex
        let profilePictureStorageId = undefined;
        if (profilePicture) {
          profilePictureStorageId = await uploadImageToConvex(profilePicture);
          await updateProfilePictureMutation({
            userId: result.userId,
            profilePictureStorageId,
            profilePicture: profilePicture,
          });
        }

        await login({
          userId: result.userId,
          email: result.email,
          name: name,
          profilePicture: profilePicture || undefined,
        });
        // New users should set up PIN
        router.replace("/pin-setup");
      } else {
        // Login
        const result = await loginUser({
          email,
          password,
        });
        await login({
          userId: result.userId,
          email: result.email,
          name: result.name,
          pin: result.pin, // Include PIN if exists
          profilePicture: result.profilePicture, // Include profile picture if exists
        });
        // If user has PIN, go to PIN entry, otherwise prompt to set up PIN
        if (result.pin) {
          router.replace("/pin-entry");
        } else {
          router.replace("/pin-setup");
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || "Authentication failed";

      // Show more specific error messages
      if (errorMessage.includes("Invalid email or password")) {
        Alert.alert(
          "Login Failed",
          "The email or password you entered is incorrect. Please try again.",
        );
      } else if (errorMessage.includes("already exists")) {
        Alert.alert(
          "Sign Up Failed",
          "An account with this email already exists. Please sign in instead.",
        );
      } else {
        Alert.alert("Error", errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryBlue}
      />

      {/* Top Blue Section with Logo Text */}
      <View style={styles.topSection}>
        <Svg
          width="40"
          height="44"
          viewBox="0 0 118 124"
          fill="none"
          style={styles.logo}
        >
          <Path
            d="M55.7656 119.109V66.3306H76.9707V119.109M20.2606 119.109V93.5042H41.4658V119.109M92.126 119.109V41.1125H113.331V119.109M4.33124 77.9212L49.6953 32.5571L65.1358 46.4699L106.242 5.38353M105.305 24.1647L107.2 7.01315C107.235 6.65221 107.189 6.28795 107.066 5.94678C106.943 5.60561 106.746 5.29607 106.489 5.04061C106.232 4.78515 105.921 4.59019 105.578 4.46982C105.236 4.34945 104.872 4.3067 104.511 4.34468L87.3797 6.23908"
            stroke="white"
            strokeWidth="8.6625"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={styles.logoText}>BizWise</Text>
        <Text style={styles.logoSubtext}>Expense Manager</Text>
      </View>

      {/* White Container with rounded top */}
      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.welcomeText}>
          {isSignUp ? "Create Account" : "Welcome Back!"}
        </Text>
        <Text style={styles.subtitle}>
          {isSignUp ? "Sign up to get started" : "Sign in to continue"}
        </Text>

        {/* Profile Picture (only for sign up) */}
        {isSignUp && (
          <View style={styles.profilePictureContainer}>
            <TouchableOpacity
              style={styles.profileImageWrapper}
              onPress={handlePickImage}
            >
              {profilePicture ? (
                <Image
                  source={{ uri: profilePicture }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Text style={styles.profileInitial}>
                    {name?.charAt(0).toUpperCase() || "+"}
                  </Text>
                </View>
              )}
              <View style={styles.cameraIconBadge}>
                <Camera color={COLORS.white} size={14} />
              </View>
            </TouchableOpacity>
            <Text style={styles.addPhotoText}>Add Profile Photo</Text>
          </View>
        )}

        {/* Name Input (only for sign up) */}
        {isSignUp && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textGray}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
        )}

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor={COLORS.textGray}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.textGray}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <Eye size={20} color={COLORS.textGray} />
              ) : (
                <EyeOff size={20} color={COLORS.textGray} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Forgot Password (only for login) */}
        {!isSignUp && (
          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        )}

        {/* Auth Button */}
        <TouchableOpacity
          style={[styles.authButton, isLoading && styles.authButtonDisabled]}
          onPress={handleAuth}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.authButtonText}>
              {isSignUp ? "Sign Up" : "Sign In"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Toggle Auth Mode */}
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleText}>
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
          </Text>
          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
            <Text style={styles.toggleLink}>
              {isSignUp ? "Sign In" : "Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryBlue,
  },
  topSection: {
    height: "25%",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  logo: {
    marginBottom: 12,
  },
  logoText: {
    fontSize: 42,
    fontWeight: "800",
    color: COLORS.white,
    letterSpacing: 1,
  },
  logoSubtext: {
    fontSize: 16,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: 4,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  scrollContent: {
    paddingHorizontal: 30,
    paddingTop: 40,
    paddingBottom: 40,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textGray,
    marginBottom: 32,
  },
  profilePictureContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  profileImageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    position: "relative",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
  },
  profilePlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
    backgroundColor: COLORS.lightBlueBg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.primaryBlue,
    borderStyle: "dashed",
  },
  profileInitial: {
    fontSize: 36,
    fontWeight: "700",
    color: COLORS.primaryBlue,
  },
  cameraIconBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryBlue,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  addPhotoText: {
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.lightBlueBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textDark,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightBlueBg,
    borderRadius: 12,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textDark,
  },
  eyeIcon: {
    padding: 8,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: COLORS.primaryBlue,
    fontWeight: "600",
  },
  authButton: {
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
    marginTop: 8,
  },
  authButtonDisabled: {
    opacity: 0.7,
  },
  authButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  toggleText: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  toggleLink: {
    fontSize: 14,
    color: COLORS.primaryBlue,
    fontWeight: "700",
  },
});
