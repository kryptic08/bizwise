import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { api } from "../convex/_generated/api";
import { useAuth } from "./context/AuthContext";

export default function ResetScreen() {
  const router = useRouter();
  const clearAllData = useMutation(api.clearData.clearAllData);
  const { logout } = useAuth();
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    Alert.alert(
      "Reset Everything?",
      "This will delete ALL data from the database and reset the app to onboarding. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setIsResetting(true);
            try {
              // Clear database
              const result = await clearAllData();
              console.log("Cleared data:", result);

              // Clear AsyncStorage
              await AsyncStorage.clear();

              // Logout
              await logout();

              // Navigate to welcome screen
              router.replace("/welcome");

              Alert.alert("Success", "App reset successfully!");
            } catch (error) {
              console.error("Reset error:", error);
              Alert.alert("Error", "Failed to reset app");
            } finally {
              setIsResetting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset App</Text>
      <Text style={styles.description}>
        This will clear all data from the database and reset the app to the
        beginning (splash → onboarding → signup)
      </Text>
      <TouchableOpacity
        style={[styles.button, isResetting && styles.buttonDisabled]}
        onPress={handleReset}
        disabled={isResetting}
      >
        <Text style={styles.buttonText}>
          {isResetting ? "Resetting..." : "Reset Everything"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
    color: "#1f2937",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    color: "#6b7280",
    lineHeight: 24,
  },
  button: {
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backText: {
    color: "#3b6ea5",
    fontSize: 16,
    fontWeight: "600",
  },
});
