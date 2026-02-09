import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { AlertTriangle, ArrowLeft, Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
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
  red: "#ff5c5c",
};

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const deleteUser = useMutation(api.users.deleteUser);

  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleDelete = async () => {
    if (!password) {
      Alert.alert("Error", "Please enter your password");
      return;
    }

    Alert.alert(
      "Confirm Deletion",
      "Are you absolutely sure? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              await deleteUser({
                userId: user?.userId,
                password,
              });

              await logout();
              router.replace("/login");
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to delete account");
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryBlue}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color={COLORS.white} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.warningBox}>
          <AlertTriangle color={COLORS.red} size={40} />
          <Text style={styles.warningTitle}>Warning: Permanent Action</Text>
          <Text style={styles.warningText}>
            This action will permanently delete all of your data, and you will
            not be able to recover it.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          Please keep the following in mind:
        </Text>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>
            All your expenses, income and associated transactions will be
            eliminated.
          </Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>
            You will not be able to access your account or any related
            information.
          </Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>This action cannot be undone.</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Enter your password to continue</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor={COLORS.textGray}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff color={COLORS.textGray} size={20} />
              ) : (
                <Eye color={COLORS.textGray} size={20} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.deleteButton,
            isLoading && styles.deleteButtonDisabled,
          ]}
          onPress={handleDelete}
          disabled={isLoading}
        >
          <Text style={styles.deleteButtonText}>
            {isLoading ? "Deleting..." : "Yes, Delete Account"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightBlueBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: COLORS.primaryBlue,
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: COLORS.white },
  content: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  scrollContent: { padding: 20, paddingTop: 30, flexGrow: 1 },
  warningBox: {
    backgroundColor: "#fff5f5",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.red,
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: COLORS.textDark,
    textAlign: "center",
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 12,
  },
  bulletPoint: {
    flexDirection: "row",
    marginBottom: 8,
  },
  bullet: {
    fontSize: 16,
    color: COLORS.textDark,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 20,
  },
  inputGroup: { marginTop: 24, marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primaryBlue,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textDark,
  },
  eyeButton: {
    padding: 10,
    marginRight: 5,
  },
  deleteButton: {
    backgroundColor: COLORS.red,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
  },
  deleteButtonDisabled: { opacity: 0.6 },
  deleteButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  cancelButtonText: { color: COLORS.textDark, fontSize: 16, fontWeight: "600" },
});
