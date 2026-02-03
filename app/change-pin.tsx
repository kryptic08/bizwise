import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { ArrowLeft, Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
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

export default function ChangePinScreen() {
  const router = useRouter();
  const { user, login } = useAuth();
  const updatePinMutation = useMutation(api.users.updatePin);

  const [formData, setFormData] = useState({
    currentPin: "",
    newPin: "",
    confirmPin: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPins, setShowPins] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const handleChange = async () => {
    if (!formData.currentPin || !formData.newPin || !formData.confirmPin) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (formData.newPin !== formData.confirmPin) {
      Alert.alert("Error", "New PINs do not match");
      return;
    }

    if (formData.newPin.length !== 4 || !/^\d+$/.test(formData.newPin)) {
      Alert.alert("Error", "PIN must be exactly 4 digits");
      return;
    }

    setIsLoading(true);
    try {
      await updatePinMutation({
        userId: user!.userId,
        currentPin: formData.currentPin,
        newPin: formData.newPin,
      });

      // Update user context with new PIN
      await login({
        ...user!,
        pin: formData.newPin,
      });

      Alert.alert("Success", "PIN changed successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to change PIN");
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

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color={COLORS.white} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change PIN</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.description}>
          Your PIN is used for quick access to sensitive features. It must be
          exactly 4 digits.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Current PIN</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter current PIN"
              placeholderTextColor={COLORS.textGray}
              secureTextEntry={!showPins.current}
              keyboardType="numeric"
              maxLength={4}
              value={formData.currentPin}
              onChangeText={(text) =>
                setFormData({ ...formData, currentPin: text })
              }
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() =>
                setShowPins({
                  ...showPins,
                  current: !showPins.current,
                })
              }
            >
              {showPins.current ? (
                <EyeOff color={COLORS.textGray} size={20} />
              ) : (
                <Eye color={COLORS.textGray} size={20} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>New PIN</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter new PIN"
              placeholderTextColor={COLORS.textGray}
              secureTextEntry={!showPins.new}
              keyboardType="numeric"
              maxLength={4}
              value={formData.newPin}
              onChangeText={(text) =>
                setFormData({ ...formData, newPin: text })
              }
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() =>
                setShowPins({
                  ...showPins,
                  new: !showPins.new,
                })
              }
            >
              {showPins.new ? (
                <EyeOff color={COLORS.textGray} size={20} />
              ) : (
                <Eye color={COLORS.textGray} size={20} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm New PIN</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Re-enter new PIN"
              placeholderTextColor={COLORS.textGray}
              secureTextEntry={!showPins.confirm}
              keyboardType="numeric"
              maxLength={4}
              value={formData.confirmPin}
              onChangeText={(text) =>
                setFormData({ ...formData, confirmPin: text })
              }
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() =>
                setShowPins({
                  ...showPins,
                  confirm: !showPins.confirm,
                })
              }
            >
              {showPins.confirm ? (
                <EyeOff color={COLORS.textGray} size={20} />
              ) : (
                <Eye color={COLORS.textGray} size={20} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleChange}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? "Changing..." : "Change PIN"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryBlue },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: COLORS.white },
  content: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  scrollContent: { padding: 20, paddingTop: 30 },
  description: {
    fontSize: 14,
    color: COLORS.textGray,
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: { marginBottom: 20 },
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
    fontSize: 20,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    textAlign: "center",
    letterSpacing: 8,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 20,
    color: COLORS.textDark,
    textAlign: "center",
    letterSpacing: 8,
  },
  eyeButton: {
    padding: 10,
    marginRight: 5,
  },
  saveButton: {
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
});
