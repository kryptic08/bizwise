import { HelpTooltip } from "@/components/HelpTooltip";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Download,
  LifeBuoy,
  LogOut,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  contentBg: "#f0f6fc", // Very light blue/white
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
  textLight: "#9ca3af",

  // Icon Background shades based on image
  iconLightBlue: "#89b3eb",
  iconBlue: "#5a96d4",
  iconDarkBlue: "#0055ff", // Bright vibrant blue for settings
  dangerBlue: "#4a8ad4",
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Fetch data for PDF generation
  const financialSummary = useQuery(
    api.analytics.getFinancialSummary,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const dailyAnalytics = useQuery(
    api.analytics.getDailyAnalytics,
    user?.userId ? { days: 7, userId: user.userId } : "skip",
  );
  const topProduct = useQuery(
    api.analytics.getTopSellingProduct,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const topCategory = useQuery(
    api.analytics.getTopSellingCategory,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const monthlyAnalytics = useQuery(
    api.analytics.getMonthlyAnalytics,
    user?.userId ? { userId: user.userId } : "skip",
  );

  const handleGeneratePDF = async () => {
    if (
      !financialSummary ||
      !dailyAnalytics ||
      !topProduct ||
      !monthlyAnalytics
    ) {
      Alert.alert(
        "Error",
        "Unable to generate report. Please try again later.",
      );
      return;
    }

    setIsGeneratingPDF(true);
    try {
      // Prepare chart data
      const chartData = dailyAnalytics.slice(-7).map((day) => ({
        day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
          new Date(day.date).getDay()
        ],
        inc: day.income,
        exp: day.expense,
      }));

      // Calculate average transaction (per sale, not per product)
      const averageTransaction =
        financialSummary.transactionCount > 0
          ? financialSummary.totalIncome / financialSummary.transactionCount
          : 0;

      console.log("PDF Data:", {
        productsSold: financialSummary.productsSold,
        transactionCount: financialSummary.transactionCount,
        averageTransaction,
        totalIncome: financialSummary.totalIncome,
      });

      await generatePDFReport(
        user?.name || "My Business",
        user?.name || "Business Owner",
        "Last 7 Days",
        {
          totalIncome: financialSummary.totalIncome,
          totalExpense: financialSummary.totalExpense,
          profit: financialSummary.profit,
          productsSold: financialSummary.productsSold,
          averageTransaction,
          topProduct: topProduct?.name || "N/A",
          topCategory: topCategory?.name || "N/A",
        },
        chartData,
        monthlyAnalytics,
      );

      // Success alert is handled by generatePDFReport
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
        handleGeneratePDF();
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
});
