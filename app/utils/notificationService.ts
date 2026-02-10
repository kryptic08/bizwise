/**
 * BizWise Notification Service
 * Duolingo-style motivational notifications for business tracking
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationSettings {
  enabled: boolean;
  targetReminders: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
  dailySummaryTime: { hour: number; minute: number };
  weeklySummaryDay: number; // 0-6, Sunday = 0
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  targetReminders: true,
  dailySummary: true,
  weeklySummary: true,
  dailySummaryTime: { hour: 20, minute: 0 }, // 8 PM
  weeklySummaryDay: 1, // Monday
};

/**
 * Request notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Notification permissions not granted");
    return false;
  }

  // For Android, create notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "BizWise Updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3b6ea5",
    });
  }

  return true;
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Schedule daily summary notification
 */
export async function scheduleDailySummary(settings: NotificationSettings) {
  if (!settings.enabled || !settings.dailySummary) {
    return;
  }

  // Cancel existing daily summary notifications
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.type === "daily-summary") {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  // Schedule new daily summary
  // Use time-based trigger for cross-platform compatibility
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(
    settings.dailySummaryTime.hour,
    settings.dailySummaryTime.minute,
    0,
    0,
  );

  // If time has passed today, schedule for tomorrow
  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  const secondsUntilTrigger = Math.floor(
    (scheduledTime.getTime() - now.getTime()) / 1000,
  );

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "📊 Daily Summary",
      body: "Tap to see today's sales and expenses recap!",
      data: { type: "daily-summary", screen: "home" },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilTrigger,
      repeats: true,
    },
  });
}

/**
 * Schedule weekly summary notification
 */
export async function scheduleWeeklySummary(settings: NotificationSettings) {
  if (!settings.enabled || !settings.weeklySummary) {
    return;
  }

  // Cancel existing weekly summary notifications
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.type === "weekly-summary") {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  // Schedule new weekly summary
  // Calculate time until next occurrence of the specified weekday at 9 AM
  const now = new Date();
  const targetDay = settings.weeklySummaryDay; // 0 = Sunday, 1 = Monday, etc.
  const scheduledTime = new Date();
  scheduledTime.setHours(9, 0, 0, 0);

  // Calculate days until target day
  const currentDay = now.getDay();
  let daysUntilTarget = targetDay - currentDay;

  if (daysUntilTarget < 0 || (daysUntilTarget === 0 && now.getHours() >= 9)) {
    daysUntilTarget += 7;
  }

  scheduledTime.setDate(scheduledTime.getDate() + daysUntilTarget);
  const secondsUntilTrigger = Math.floor(
    (scheduledTime.getTime() - now.getTime()) / 1000,
  );

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "📈 Weekly Performance Report",
      body: "Check out your business growth this week!",
      data: { type: "weekly-summary", screen: "home" },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilTrigger,
      repeats: true,
    },
  });
}

/**
 * Send target income reminder notification
 */
export async function sendTargetReminder(
  status: "behind" | "on-track" | "exceeded",
  current: number,
  target: number,
  remaining: number,
  daysLeft: number,
  settings: NotificationSettings,
) {
  if (!settings.enabled || !settings.targetReminders) {
    return;
  }

  let title = "";
  let body = "";
  let emoji = "";

  if (status === "exceeded") {
    emoji = "🎉";
    title = `${emoji} Congratulations!`;
    body = `You've exceeded your monthly target! Current: ₱${current.toFixed(0)} / Target: ₱${target.toFixed(0)}`;
  } else if (status === "behind" && daysLeft > 0) {
    emoji = "💪";
    const requiredDaily = remaining / daysLeft;
    title = `${emoji} Target Reminder`;
    body = `Need ₱${requiredDaily.toFixed(0)} per day for ${daysLeft} days to reach your ₱${target.toFixed(0)} target!`;
  } else if (status === "on-track") {
    emoji = "👍";
    title = `${emoji} You're On Track!`;
    const progress = ((current / target) * 100).toFixed(0);
    body = `${progress}% of your target achieved. Keep up the great work!`;
  } else {
    return; // Don't send notification if no days left or other edge case
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { type: "target-reminder", screen: "target-income" },
      sound: true,
    },
    trigger: null, // Send immediately
  });
}

/**
 * Send milestone celebration notification
 */
export async function sendMilestoneNotification(
  type:
    | "first-sale"
    | "target-50"
    | "target-75"
    | "target-achieved"
    | "sales-streak",
  data?: any,
) {
  const notifications = {
    "first-sale": {
      title: "🎊 First Sale!",
      body: "Congratulations on your first sale! Your journey begins now!",
    },
    "target-50": {
      title: "🔥 Halfway There!",
      body: "You've reached 50% of your monthly target! Keep pushing!",
    },
    "target-75": {
      title: "💪 Almost There!",
      body: "75% complete! You're so close to your target!",
    },
    "target-achieved": {
      title: "🏆 Target Achieved!",
      body: "Amazing! You hit your monthly target. Time to aim higher!",
    },
    "sales-streak": {
      title: "🔥 Sales Streak!",
      body: `${data?.days || 7} days of consecutive sales! You're on fire!`,
    },
  };

  const notif = notifications[type];
  if (!notif) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: notif.title,
      body: notif.body,
      data: { type: "milestone", screen: "home" },
      sound: true,
    },
    trigger: null, // Send immediately
  });
}

/**
 * Send encouragement notification when no sales recorded
 */
export async function sendEncouragementNotification(daysSinceLastSale: number) {
  const messages = [
    {
      title: "💡 Ready to Make Sales?",
      body: "Open your counter and start tracking your business today!",
    },
    {
      title: "📱 Your Business Awaits",
      body: "It's been a while! Record a sale to keep your momentum going.",
    },
    {
      title: "🚀 Time to Shine!",
      body: "Every successful business starts with one sale. Make it count!",
    },
  ];

  const message = messages[Math.min(daysSinceLastSale - 1, 2)];

  await Notifications.scheduleNotificationAsync({
    content: {
      title: message.title,
      body: message.body,
      data: { type: "encouragement", screen: "counter" },
      sound: true,
    },
    trigger: null,
  });
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Initialize notification system with user settings
 */
export async function initializeNotifications(settings: NotificationSettings) {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission || !settings.enabled) {
    await cancelAllNotifications();
    return false;
  }

  // Schedule recurring notifications
  await scheduleDailySummary(settings);
  await scheduleWeeklySummary(settings);

  return true;
}
