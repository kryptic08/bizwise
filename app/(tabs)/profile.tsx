import { useRouter } from "expo-router";
import {
  ArrowLeft,
  HelpCircle,
  LifeBuoy,
  LogOut,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react-native";
import React from "react";
import {
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";

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
      label: "Help",
      icon: LifeBuoy,
      color: COLORS.iconLightBlue,
    },
    {
      id: 5,
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
          <View style={styles.helpCircleBg}>
            <HelpCircle color={COLORS.primaryBlue} size={18} />
          </View>
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
              >
                <View
                  style={[
                    styles.menuIconCircle,
                    { backgroundColor: item.color },
                  ]}
                >
                  <item.icon color={COLORS.white} size={20} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
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
  menuLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
});
