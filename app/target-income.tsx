import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { ArrowLeft, Target } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

export default function TargetIncomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Fetch existing target income
  const existingTarget = useQuery(
    api.users.getTargetIncome,
    user?.userId ? { userId: user.userId } : "skip",
  );

  const updateTarget = useMutation(api.users.updateTargetIncome);

  // Load existing target when available
  useEffect(() => {
    if (existingTarget?.monthly) {
      setMonthlyTarget(existingTarget.monthly.toString());
    }
  }, [existingTarget]);

  const handleSave = async () => {
    const target = parseFloat(monthlyTarget);

    if (isNaN(target) || target <= 0) {
      Alert.alert(
        "Invalid Input",
        "Please enter a valid monthly income target.",
      );
      return;
    }

    setIsSaving(true);
    try {
      await updateTarget({
        userId: user?.userId!,
        monthly: target,
      });

      Alert.alert("Success", "Target income saved successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error saving target:", error);
      Alert.alert("Error", "Failed to save target income. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const dailyTarget = monthlyTarget
    ? (parseFloat(monthlyTarget) / 30).toFixed(2)
    : "0.00";

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
        <Text style={styles.headerTitle}>Target Income</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.iconContainer}>
          <Target color={COLORS.primaryBlue} size={64} />
        </View>

        <Text style={styles.title}>Set Your Income Goal</Text>
        <Text style={styles.subtitle}>
          Set a monthly income target to track your progress and receive
          motivating notifications.
        </Text>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Monthly Target</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencySymbol}>₱</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.textGray}
              value={monthlyTarget}
              onChangeText={setMonthlyTarget}
              keyboardType="numeric"
            />
          </View>
        </View>

        {monthlyTarget && parseFloat(monthlyTarget) > 0 && (
          <View style={styles.calculationCard}>
            <Text style={styles.calculationLabel}>
              Daily Target (Auto-calculated)
            </Text>
            <Text style={styles.calculationValue}>₱ {dailyTarget}</Text>
            <Text style={styles.calculationNote}>
              Based on 30 days per month
            </Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 How it works</Text>
          <Text style={styles.infoText}>
            • Track your progress on the dashboard{"\n"}• Receive motivational
            notifications{"\n"}• Get alerts when you're behind target{"\n"}•
            Celebrate when you exceed your goal!
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Target</Text>
          )}
        </TouchableOpacity>

        {existingTarget && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              Alert.alert(
                "Clear Target",
                "Are you sure you want to remove your income target?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await updateTarget({
                          userId: user?.userId!,
                          monthly: 0,
                        });
                        setMonthlyTarget("");
                        Alert.alert("Cleared", "Target income removed.");
                      } catch (error) {
                        Alert.alert("Error", "Failed to clear target.");
                      }
                    },
                  },
                ],
              );
            }}
          >
            <Text style={styles.clearButtonText}>Clear Target</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
  content: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 30,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textDark,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textGray,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 30,
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.borderGray,
    paddingHorizontal: 15,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.primaryBlue,
    marginRight: 5,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: COLORS.textDark,
    paddingVertical: 15,
  },
  calculationCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  calculationLabel: {
    fontSize: 14,
    color: COLORS.textGray,
    marginBottom: 8,
  },
  calculationValue: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.primaryBlue,
    marginBottom: 5,
  },
  calculationNote: {
    fontSize: 12,
    color: COLORS.textGray,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textGray,
    lineHeight: 22,
  },
  saveButton: {
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 15,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  clearButton: {
    borderWidth: 2,
    borderColor: COLORS.primaryBlue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  clearButtonText: {
    color: COLORS.primaryBlue,
    fontSize: 16,
    fontWeight: "600",
  },
});
