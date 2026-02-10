import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { ArrowLeft, Bell, BellOff, Clock } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  initializeNotifications,
  NotificationSettings,
  requestNotificationPermissions,
} from "./utils/notificationService";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
  borderGray: "#d1d5db",
};

const STORAGE_KEY = "bizwise_notification_settings";

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);

      // Reinitialize notifications with new settings
      await initializeNotifications(newSettings);

      Alert.alert("Success", "Notification settings saved!");
    } catch (error) {
      console.error("Error saving notification settings:", error);
      Alert.alert("Error", "Failed to save settings. Please try again.");
    }
  };

  const toggleMasterSwitch = async (value: boolean) => {
    if (value) {
      // Request permissions when enabling
      const hasPermission = await requestNotificationPermissions();
      if (!hasPermission) {
        Alert.alert(
          "Permission Required",
          "Please enable notifications in your device settings to use this feature.",
        );
        return;
      }
    }

    const newSettings = { ...settings, enabled: value };
    await saveSettings(newSettings);
  };

  const toggleSetting = async (
    key: keyof NotificationSettings,
    value: boolean,
  ) => {
    const newSettings = { ...settings, [key]: value };
    await saveSettings(newSettings);
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.primaryBlue}
        />
        <Text style={styles.headerTitle}>Loading...</Text>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.iconContainer}>
          {settings.enabled ? (
            <Bell color={COLORS.primaryBlue} size={64} />
          ) : (
            <BellOff color={COLORS.textGray} size={64} />
          )}
        </View>

        <Text style={styles.title}>Stay Motivated</Text>
        <Text style={styles.subtitle}>
          Get Duolingo-style notifications to keep you on track with your
          business goals!
        </Text>

        {/* Master Switch */}
        <View style={styles.settingCard}>
          <View style={styles.settingHeader}>
            <View style={styles.settingLeft}>
              <Bell color={COLORS.primaryBlue} size={24} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Enable Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive motivational reminders and updates
                </Text>
              </View>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={toggleMasterSwitch}
              trackColor={{
                false: COLORS.borderGray,
                true: COLORS.primaryBlue,
              }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* Notification Types */}
        {settings.enabled && (
          <>
            <Text style={styles.sectionTitle}>Notification Types</Text>

            <View style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={styles.emoji}>
                    <Text style={styles.emojiText}>🎯</Text>
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>Target Reminders</Text>
                    <Text style={styles.settingDescription}>
                      Progress updates when behind, on track, or exceeding
                      target
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.targetReminders}
                  onValueChange={(value) =>
                    toggleSetting("targetReminders", value)
                  }
                  trackColor={{
                    false: COLORS.borderGray,
                    true: COLORS.primaryBlue,
                  }}
                  thumbColor={COLORS.white}
                />
              </View>
            </View>

            <View style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={styles.emoji}>
                    <Text style={styles.emojiText}>📊</Text>
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>Daily Summary</Text>
                    <Text style={styles.settingDescription}>
                      Evening recap of today's income and expenses
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.dailySummary}
                  onValueChange={(value) =>
                    toggleSetting("dailySummary", value)
                  }
                  trackColor={{
                    false: COLORS.borderGray,
                    true: COLORS.primaryBlue,
                  }}
                  thumbColor={COLORS.white}
                />
              </View>

              {settings.dailySummary && (
                <View style={styles.timeInfo}>
                  <Clock color={COLORS.textGray} size={16} />
                  <Text style={styles.timeText}>
                    Every day at {settings.dailySummaryTime.hour}:
                    {settings.dailySummaryTime.minute
                      .toString()
                      .padStart(2, "0")}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={styles.emoji}>
                    <Text style={styles.emojiText}>📈</Text>
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>Weekly Report</Text>
                    <Text style={styles.settingDescription}>
                      Monday morning performance summary
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.weeklySummary}
                  onValueChange={(value) =>
                    toggleSetting("weeklySummary", value)
                  }
                  trackColor={{
                    false: COLORS.borderGray,
                    true: COLORS.primaryBlue,
                  }}
                  thumbColor={COLORS.white}
                />
              </View>

              {settings.weeklySummary && (
                <View style={styles.timeInfo}>
                  <Clock color={COLORS.textGray} size={16} />
                  <Text style={styles.timeText}>Every Monday at 9:00 AM</Text>
                </View>
              )}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>💡 What you'll receive:</Text>
              <Text style={styles.infoText}>
                • 🎉 Celebration when you exceed your target{"\n"}• 💪
                Motivation when you're behind schedule{"\n"}• 👍 Encouragement
                when you're on track{"\n"}• 🏆 Milestone achievements{"\n"}• 📊
                Daily and weekly performance recaps
              </Text>
            </View>
          </>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    marginTop: 10,
    marginBottom: 15,
  },
  settingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  settingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: COLORS.textGray,
    lineHeight: 18,
  },
  emoji: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightBlueBg,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 20,
  },
  timeInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderGray,
  },
  timeText: {
    fontSize: 13,
    color: COLORS.textGray,
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginTop: 10,
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
});
