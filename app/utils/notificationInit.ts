/**
 * Notification Initialization
 * Sets up notification permissions and schedules recurring notifications
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    NotificationSettings,
    requestNotificationPermissions,
    scheduleDailySummary,
    scheduleWeeklySummary,
    sendMilestoneNotification,
} from "./notificationService";

const FIRST_SALE_KEY = "bizwise_first_sale_celebrated";

/**
 * Initialize notifications on app start
 */
export async function initializeNotifications() {
  try {
    // Request permissions
    const granted = await requestNotificationPermissions();
    if (!granted) {
      console.log("Notification permissions not granted");
      return;
    }

    // Load settings
    const settingsJson = await AsyncStorage.getItem(
      "bizwise_notification_settings",
    );
    const settings: NotificationSettings = settingsJson
      ? JSON.parse(settingsJson)
      : {
          enabled: true,
          targetReminders: true,
          dailySummary: true,
          weeklySummary: true,
          dailySummaryTime: { hour: 20, minute: 0 }, // 8 PM
          weeklySummaryDay: 1, // Monday
        };

    if (!settings.enabled) {
      console.log("Notifications disabled in settings");
      return;
    }

    // Schedule daily summary if enabled
    if (settings.dailySummary) {
      await scheduleDailySummary(settings);
    }

    // Schedule weekly report if enabled
    if (settings.weeklySummary) {
      await scheduleWeeklySummary(settings);
    }

    console.log("Notifications initialized successfully");
  } catch (error) {
    console.error("Error initializing notifications:", error);
  }
}

/**
 * Check if this is the first sale and send celebration notification
 */
export async function checkFirstSale(hasSales: boolean) {
  if (!hasSales) return;

  try {
    const celebrated = await AsyncStorage.getItem(FIRST_SALE_KEY);
    if (celebrated === "true") return;

    // Send first sale celebration
    await sendMilestoneNotification("first-sale");
    await AsyncStorage.setItem(FIRST_SALE_KEY, "true");
  } catch (error) {
    console.error("Error checking first sale:", error);
  }
}
