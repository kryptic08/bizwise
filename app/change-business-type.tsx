import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { ArrowLeft, Briefcase, Check } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../convex/_generated/api";
import { BUSINESS_TYPES, BusinessType, useAuth } from "./context/AuthContext";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
};

const BUSINESS_DESCRIPTIONS: Record<BusinessType, string> = {
  "Food Business": "Restaurants, catering, food stalls, bakeries",
  "Printing Services": "Print shops, tarpaulin, document printing",
  Construction: "Building, renovation, carpentry, contracting",
  Retail: "Sari-sari store, boutique, general merchandise",
  "Meat Shop": "Meat, poultry, seafood retail",
  Others: "Any other type of business",
};

export default function ChangeBusinessTypeScreen() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [selected, setSelected] = useState<BusinessType>(
    (user?.businessType as BusinessType) ?? "Others",
  );
  const [isSaving, setIsSaving] = useState(false);

  const updateBusinessType = useMutation(api.users.updateBusinessType);

  const handleSave = async () => {
    if (!user?.userId) return;

    if (selected === user?.businessType) {
      router.back();
      return;
    }

    setIsSaving(true);
    try {
      await updateBusinessType({
        userId: user.userId,
        businessType: selected,
      });

      // Persist updated business type to local auth state
      await login({ ...user, businessType: selected });

      Alert.alert(
        "Business Type Updated",
        `Your business type is now set to "${selected}". Expense categories will reflect this change.`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (error) {
      console.error("Error updating business type:", error);
      Alert.alert("Error", "Failed to update business type. Please try again.");
    } finally {
      setIsSaving(false);
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
        <Text style={styles.headerTitle}>Business Type</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.iconContainer}>
          <Briefcase color={COLORS.primaryBlue} size={56} />
        </View>

        <Text style={styles.title}>Select Business Type</Text>
        <Text style={styles.subtitle}>
          Your business type determines how expenses are automatically
          categorized. Choose the one that best describes your business.
        </Text>

        <View style={styles.optionList}>
          {BUSINESS_TYPES.map((type) => {
            const isSelected = selected === type;
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
                onPress={() => setSelected(type)}
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[styles.radio, isSelected && styles.radioSelected]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.optionTextBlock}>
                    <Text
                      style={[
                        styles.optionTitle,
                        isSelected && styles.optionTitleSelected,
                      ]}
                    >
                      {type}
                    </Text>
                    <Text style={styles.optionDesc}>
                      {BUSINESS_DESCRIPTIONS[type]}
                    </Text>
                  </View>
                </View>
                {isSelected && <Check color={COLORS.primaryBlue} size={18} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {selected !== user?.businessType && (
          <View style={styles.changeNote}>
            <Text style={styles.changeNoteText}>
              ⚠️ Changing your business type will affect how future expenses are
              auto-categorized. Past records are not changed.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
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
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textDark,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textGray,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  optionList: {
    gap: 10,
    marginBottom: 20,
  },
  optionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  optionCardSelected: {
    borderColor: COLORS.primaryBlue,
    backgroundColor: "#eef4fc",
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  radioSelected: {
    borderColor: COLORS.primaryBlue,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primaryBlue,
  },
  optionTextBlock: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 2,
  },
  optionTitleSelected: {
    color: COLORS.primaryBlue,
  },
  optionDesc: {
    fontSize: 12,
    color: COLORS.textGray,
  },
  changeNote: {
    backgroundColor: "#fff7ed",
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  changeNoteText: {
    fontSize: 13,
    color: "#78350f",
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
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
