import { HelpTooltip } from "@/components/HelpTooltip";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Download,
  LifeBuoy,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  X,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../context/AuthContext";
import { generatePDFReport } from "../utils/pdfGenerator";

// --- Colors ---
const COLORS = {
  primaryBlue: "#3b6ea5",
  contentBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
  textLight: "#9ca3af",
  iconLightBlue: "#89b3eb",
  iconBlue: "#5a96d4",
  iconDarkBlue: "#0055ff",
  dangerBlue: "#4a8ad4",
  green: "#10b981",
  border: "#e5e7eb",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFromMonthPicker, setShowFromMonthPicker] = useState(false);
  const [showToMonthPicker, setShowToMonthPicker] = useState(false);

  // Default: last 12 months
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const [fromMonth, setFromMonth] = useState(defaultFrom.getMonth() + 1);
  const [fromYear, setFromYear] = useState(defaultFrom.getFullYear());
  const [toMonth, setToMonth] = useState(now.getMonth() + 1);
  const [toYear, setToYear] = useState(now.getFullYear());

  // Fetch data for PDF generation
  const topProduct = useQuery(
    api.analytics.getTopSellingProduct,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const topCategory = useQuery(
    api.analytics.getTopSellingCategory,
    user?.userId ? { userId: user.userId } : "skip",
  );
  // Fetch data for chosen date range
  const rangeAnalytics = useQuery(
    api.analytics.getAnalyticsByDateRange,
    user?.userId
      ? {
          userId: user.userId,
          startMonth: fromMonth,
          startYear: fromYear,
          endMonth: toMonth,
          endYear: toYear,
        }
      : "skip",
  );

  // Fetch which months actually have data
  const dataDateRange = useQuery(
    api.analytics.getDataDateRange,
    user?.userId ? { userId: user.userId } : "skip",
  );

  // Helper: check if a given month/year has data
  const monthHasData = (month: number, year: number) => {
    if (!dataDateRange || dataDateRange.monthsWithData.length === 0)
      return true; // if loading, allow all
    return dataDateRange.monthsWithData.includes(`${year}-${month}`);
  };

  // Check if the selected year has any data at all
  const yearHasAnyData = (year: number) => {
    if (!dataDateRange || dataDateRange.monthsWithData.length === 0)
      return true;
    return dataDateRange.monthsWithData.some((m) => m.startsWith(`${year}-`));
  };

  const handleExportPress = () => {
    setShowDatePicker(true);
  };

  const handleGeneratePDF = async () => {
    // Check if data is still loading
    if (rangeAnalytics === undefined || topProduct === undefined) {
      // Data is still loading, don't show error
      return;
    }

    if (!rangeAnalytics || !topProduct) {
      Alert.alert(
        "Error",
        "Unable to generate report. Please try again later.",
      );
      return;
    }

    setShowDatePicker(false);
    setIsGeneratingPDF(true);
    try {
      const { summary, monthlyData } = rangeAnalytics;

      const dateRange = `${MONTH_NAMES[fromMonth - 1]} ${fromYear} - ${MONTH_NAMES[toMonth - 1]} ${toYear}`;

      // Build daily chart data from monthly (summary view for PDF daily table)
      const chartData = monthlyData.slice(-7).map((m) => ({
        day: m.month,
        inc: m.income,
        exp: m.expense,
      }));

      await generatePDFReport(
        user?.name || "My Business",
        user?.name || "Business Owner",
        dateRange,
        {
          totalIncome: summary.totalIncome,
          totalExpense: summary.totalExpense,
          profit: summary.profit,
          productsSold: summary.productsSold,
          averageTransaction: summary.averageTransaction,
          topProduct: topProduct?.name || "N/A",
          topCategory: topCategory?.name || "N/A",
        },
        chartData,
        monthlyData,
      );
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate report. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleMenuPress = (label: string) => {
    switch (label) {
      case "Edit Profile":
        router.push("/edit-profile");
        break;
      case "Security":
        router.push("/security");
        break;
      case "Setting":
        router.push("/settings");
        break;
      case "Help":
        router.push("/help");
        break;
      case "Export Report":
        handleExportPress();
        break;
      case "Logout":
        Alert.alert("Logout", "Are you sure you want to logout?", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Logout",
            style: "destructive",
            onPress: async () => {
              await logout();
              router.replace("/login");
            },
          },
        ]);
        break;
    }
  };

  const menuItems = [
    {
      id: 1,
      label: "Edit Profile",
      icon: User,
      color: COLORS.iconLightBlue,
    },
    {
      id: 2,
      label: "Security",
      icon: ShieldCheck,
      color: COLORS.iconBlue,
    },
    {
      id: 3,
      label: "Setting",
      icon: Settings,
      color: "#1c64f2", // Specific bright blue from screenshot
    },
    {
      id: 4,
      label: "Export Report",
      icon: Download,
      color: "#10b981", // Green for export
    },
    {
      id: 5,
      label: "Help",
      icon: LifeBuoy,
      color: COLORS.iconLightBlue,
    },
    {
      id: 6,
      label: "Logout",
      icon: LogOut,
      color: COLORS.dangerBlue,
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryBlue}
      />

      {/* Header Section (Blue Background) */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={COLORS.white} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.iconButton}>
          <HelpTooltip
            title="Profile Help"
            content="Manage your account settings, update your profile information, change security settings like PIN and password, or contact support. You can also delete your account from the settings page."
          />
        </TouchableOpacity>
      </View>

      {/* Main White Sheet Content */}
      <View style={styles.contentContainer}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Spacer for profile image */}
          <View style={{ height: 70 }} />

          {/* Menu List */}
          <View style={styles.menuContainer}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={() => handleMenuPress(item.label)}
                activeOpacity={0.7}
                disabled={isGeneratingPDF && item.label === "Export Report"}
              >
                <View
                  style={[
                    styles.menuIconCircle,
                    { backgroundColor: item.color },
                    isGeneratingPDF &&
                      item.label === "Export Report" &&
                      styles.menuIconCircleDisabled,
                  ]}
                >
                  {isGeneratingPDF && item.label === "Export Report" ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <item.icon color={COLORS.white} size={20} />
                  )}
                </View>
                <Text style={styles.menuLabel}>
                  {item.label}
                  {isGeneratingPDF && item.label === "Export Report"
                    ? " (Generating...)"
                    : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bottom Spacing for tab bar */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>

      {/* Profile Image Area (Overlapping) - Positioned Absolutely */}
      <View style={styles.profileSection}>
        <View style={styles.imageWrapper}>
          {user?.profilePicture ? (
            <Image
              source={{ uri: user.profilePicture }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileInitial}>
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.userName}>{user?.name || "User"}</Text>
        <Text style={styles.userId}>{user?.email || ""}</Text>
      </View>

      {/* Date Range Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Calendar color={COLORS.primaryBlue} size={22} />
              <Text style={styles.modalTitle}>Select Report Period</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <X color={COLORS.textGray} size={22} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Choose the date range for your business report
            </Text>

            {/* From */}
            <Text style={styles.pickerLabel}>From</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowFromMonthPicker(true)}
            >
              <Text style={styles.pickerButtonText}>
                {MONTH_NAMES[fromMonth - 1]} {fromYear}
              </Text>
              <ChevronDown color={COLORS.textGray} size={18} />
            </TouchableOpacity>

            {/* To */}
            <Text style={styles.pickerLabel}>To</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowToMonthPicker(true)}
            >
              <Text style={styles.pickerButtonText}>
                {MONTH_NAMES[toMonth - 1]} {toYear}
              </Text>
              <ChevronDown color={COLORS.textGray} size={18} />
            </TouchableOpacity>

            {/* Quick presets */}
            <Text style={styles.pickerLabel}>Quick Select</Text>
            <View style={styles.presetRow}>
              {[
                { label: "Last 3 Months", months: 3 },
                { label: "Last 6 Months", months: 6 },
                { label: "Last 12 Months", months: 12 },
              ].map((preset) => (
                <TouchableOpacity
                  key={preset.months}
                  style={styles.presetButton}
                  onPress={() => {
                    const d = new Date();
                    const from = new Date(
                      d.getFullYear(),
                      d.getMonth() - (preset.months - 1),
                      1,
                    );
                    setFromMonth(from.getMonth() + 1);
                    setFromYear(from.getFullYear());
                    setToMonth(d.getMonth() + 1);
                    setToYear(d.getFullYear());
                  }}
                >
                  <Text style={styles.presetButtonText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => {
                const yr = new Date().getFullYear();
                setFromMonth(1);
                setFromYear(yr);
                setToMonth(12);
                setToYear(yr);
              }}
            >
              <Text style={styles.presetButtonText}>
                This Year ({new Date().getFullYear()})
              </Text>
            </TouchableOpacity>

            {/* Generate button */}
            <TouchableOpacity
              style={[
                styles.generateButton,
                (isGeneratingPDF ||
                  rangeAnalytics === undefined ||
                  topProduct === undefined) &&
                  styles.generateButtonDisabled,
              ]}
              onPress={handleGeneratePDF}
              disabled={
                isGeneratingPDF ||
                rangeAnalytics === undefined ||
                topProduct === undefined
              }
            >
              {isGeneratingPDF ||
              rangeAnalytics === undefined ||
              topProduct === undefined ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Download color={COLORS.white} size={18} />
                  <Text style={styles.generateButtonText}>Generate Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* From Month Picker */}
      <Modal
        visible={showFromMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFromMonthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.monthPickerContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Start Month</Text>
              <TouchableOpacity onPress={() => setShowFromMonthPicker(false)}>
                <X color={COLORS.textGray} size={22} />
              </TouchableOpacity>
            </View>

            {/* Year toggle */}
            <View style={styles.yearRow}>
              <TouchableOpacity
                onPress={() => setFromYear((y) => y - 1)}
                disabled={
                  !dataDateRange || fromYear <= (dataDateRange.minYear || 2020)
                }
              >
                <Text
                  style={[
                    styles.yearArrow,
                    (!dataDateRange ||
                      fromYear <= (dataDateRange.minYear || 2020)) &&
                      styles.yearArrowDisabled,
                  ]}
                >
                  ‹
                </Text>
              </TouchableOpacity>
              <Text style={styles.yearText}>{fromYear}</Text>
              <TouchableOpacity
                onPress={() => setFromYear((y) => y + 1)}
                disabled={
                  !dataDateRange || fromYear >= (dataDateRange.maxYear || 2030)
                }
              >
                <Text
                  style={[
                    styles.yearArrow,
                    (!dataDateRange ||
                      fromYear >= (dataDateRange.maxYear || 2030)) &&
                      styles.yearArrowDisabled,
                  ]}
                >
                  ›
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.monthGrid}>
              {MONTH_NAMES.map((name, i) => {
                const hasData = monthHasData(i + 1, fromYear);
                const isActive = fromMonth === i + 1;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.monthCell,
                      isActive && styles.monthCellActive,
                      !hasData && !isActive && styles.monthCellDisabled,
                    ]}
                    onPress={() => {
                      setFromMonth(i + 1);
                      setShowFromMonthPicker(false);
                    }}
                    disabled={!hasData}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        isActive && styles.monthCellTextActive,
                        !hasData && !isActive && styles.monthCellTextDisabled,
                      ]}
                    >
                      {name.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* To Month Picker */}
      <Modal
        visible={showToMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowToMonthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.monthPickerContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select End Month</Text>
              <TouchableOpacity onPress={() => setShowToMonthPicker(false)}>
                <X color={COLORS.textGray} size={22} />
              </TouchableOpacity>
            </View>

            {/* Year toggle */}
            <View style={styles.yearRow}>
              <TouchableOpacity
                onPress={() => setToYear((y) => y - 1)}
                disabled={
                  !dataDateRange || toYear <= (dataDateRange.minYear || 2020)
                }
              >
                <Text
                  style={[
                    styles.yearArrow,
                    (!dataDateRange ||
                      toYear <= (dataDateRange.minYear || 2020)) &&
                      styles.yearArrowDisabled,
                  ]}
                >
                  ‹
                </Text>
              </TouchableOpacity>
              <Text style={styles.yearText}>{toYear}</Text>
              <TouchableOpacity
                onPress={() => setToYear((y) => y + 1)}
                disabled={
                  !dataDateRange || toYear >= (dataDateRange.maxYear || 2030)
                }
              >
                <Text
                  style={[
                    styles.yearArrow,
                    (!dataDateRange ||
                      toYear >= (dataDateRange.maxYear || 2030)) &&
                      styles.yearArrowDisabled,
                  ]}
                >
                  ›
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.monthGrid}>
              {MONTH_NAMES.map((name, i) => {
                const hasData = monthHasData(i + 1, toYear);
                const isActive = toMonth === i + 1;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.monthCell,
                      isActive && styles.monthCellActive,
                      !hasData && !isActive && styles.monthCellDisabled,
                    ]}
                    onPress={() => {
                      setToMonth(i + 1);
                      setShowToMonthPicker(false);
                    }}
                    disabled={!hasData}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        isActive && styles.monthCellTextActive,
                        !hasData && !isActive && styles.monthCellTextDisabled,
                      ]}
                    >
                      {name.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
    backgroundColor: COLORS.primaryBlue,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 80, // Extra padding to allow for the curve and overlap
    backgroundColor: COLORS.primaryBlue,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.white,
  },
  iconButton: {
    padding: 5,
  },
  helpCircleBg: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },

  // Main Sheet
  contentContainer: {
    flex: 1,
    backgroundColor: COLORS.contentBg,
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    marginTop: -30, // Pull up to create the curve effect
  },
  scrollContent: {
    alignItems: "center",
    paddingBottom: 100, // Space for bottom nav
  },

  // Profile Section
  profileSection: {
    position: "absolute",
    top: 100,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: COLORS.contentBg, // Matches bg to look like a cutout
    elevation: 10, // Android shadow
    shadowColor: "#000", // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
  },
  profileImagePlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
    backgroundColor: COLORS.primaryBlue,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitial: {
    fontSize: 40,
    fontWeight: "700",
    color: COLORS.white,
  },
  userName: {
    fontSize: 20,
    fontWeight: "800", // Heavy bold
    color: "#0f3555", // Dark navy text
    marginTop: 10,
  },
  userId: {
    fontSize: 12,
    color: COLORS.textGray,
    fontWeight: "600",
    marginTop: 2,
  },

  // Menu Items
  menuContainer: {
    width: "100%",
    paddingHorizontal: 30,
    marginTop: 100,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },
  menuIconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  menuIconCircleDisabled: {
    opacity: 0.6,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },

  // Date Range Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
    flex: 1,
    marginLeft: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textGray,
    marginBottom: 20,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textGray,
    marginBottom: 6,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  pickerButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  presetButton: {
    flex: 1,
    backgroundColor: "#f0f6fc",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primaryBlue,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 12,
    gap: 8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.white,
  },

  // Month Picker Modal
  monthPickerContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
    gap: 24,
  },
  yearArrow: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.primaryBlue,
    paddingHorizontal: 12,
  },
  yearText: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  monthCell: {
    width: "30%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  monthCellActive: {
    backgroundColor: COLORS.primaryBlue,
  },
  monthCellText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  monthCellTextActive: {
    color: COLORS.white,
  },
  monthCellDisabled: {
    backgroundColor: "#f3f4f6",
    opacity: 0.5,
  },
  monthCellTextDisabled: {
    color: "#d1d5db",
  },
  yearArrowDisabled: {
    opacity: 0.3,
  },
});
