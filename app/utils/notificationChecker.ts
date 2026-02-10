/**
 * Notification Checker Service
 * Monitors target progress and triggers notifications
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    NotificationSettings,
    sendEncouragementNotification,
    sendMilestoneNotification,
    sendTargetReminder,
} from "./notificationService";

const LAST_CHECK_KEY = "bizwise_last_notification_check";
const MILESTONE_KEY = "bizwise_milestone_";

interface TargetProgress {
  target: number;
  current: number;
  remaining: number;
  progressPercentage: number;
  daysRemaining: number;
  requiredDailyIncome: number;
  status: "ahead" | "on-track" | "behind";
  currentDay: number;
  totalDaysInMonth: number;
}

/**
 * Check if enough time has passed since last notification
 */
async function shouldSendNotification(
  type: string,
  minHours: number = 12,
): Promise<boolean> {
  try {
    const lastCheckKey = `${LAST_CHECK_KEY}_${type}`;
    const lastCheck = await AsyncStorage.getItem(lastCheckKey);

    if (!lastCheck) {
      return true;
    }

    const lastCheckTime = parseInt(lastCheck);
    const now = Date.now();
    const hoursPassed = (now - lastCheckTime) / (1000 * 60 * 60);

    return hoursPassed >= minHours;
  } catch (error) {
    console.error("Error checking notification cooldown:", error);
    return true; // Default to allowing notification
  }
}

/**
 * Record that a notification was sent
 */
async function recordNotificationSent(type: string) {
  try {
    const lastCheckKey = `${LAST_CHECK_KEY}_${type}`;
    await AsyncStorage.setItem(lastCheckKey, Date.now().toString());
  } catch (error) {
    console.error("Error recording notification:", error);
  }
}

/**
 * Check if a milestone has already been achieved
 */
async function hasMilestoneBeenAchieved(
  milestone: string,
  monthYear: string,
): Promise<boolean> {
  try {
    const key = `${MILESTONE_KEY}${milestone}_${monthYear}`;
    const value = await AsyncStorage.getItem(key);
    return value === "true";
  } catch (error) {
    console.error("Error checking milestone:", error);
    return false;
  }
}

/**
 * Mark a milestone as achieved
 */
async function markMilestoneAchieved(milestone: string, monthYear: string) {
  try {
    const key = `${MILESTONE_KEY}${milestone}_${monthYear}`;
    await AsyncStorage.setItem(key, "true");
  } catch (error) {
    console.error("Error marking milestone:", error);
  }
}

/**
 * Get current month-year key for milestone tracking
 */
function getCurrentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}

/**
 * Check target progress and send appropriate notifications
 */
export async function checkTargetProgress(
  targetProgress: TargetProgress | null,
  settings: NotificationSettings,
) {
  if (!targetProgress || !settings.enabled || !settings.targetReminders) {
    return;
  }

  const monthYear = getCurrentMonthYear();

  // Check for milestone notifications
  const progress = targetProgress.progressPercentage;

  // 50% milestone
  if (progress >= 50 && progress < 75) {
    const achieved = await hasMilestoneBeenAchieved("50", monthYear);
    if (!achieved) {
      await sendMilestoneNotification("target-50");
      await markMilestoneAchieved("50", monthYear);
    }
  }

  // 75% milestone
  if (progress >= 75 && progress < 100) {
    const achieved = await hasMilestoneBeenAchieved("75", monthYear);
    if (!achieved) {
      await sendMilestoneNotification("target-75");
      await markMilestoneAchieved("75", monthYear);
    }
  }

  // Target achieved (100%)
  if (progress >= 100) {
    const achieved = await hasMilestoneBeenAchieved("achieved", monthYear);
    if (!achieved) {
      await sendMilestoneNotification("target-achieved");
      await markMilestoneAchieved("achieved", monthYear);
    }
  }

  // Target exceeded notification (send once when first exceeded)
  if (targetProgress.status === "ahead" && targetProgress.remaining < 0) {
    const shouldSend = await shouldSendNotification("exceeded", 24);
    if (shouldSend) {
      await sendTargetReminder(
        "exceeded",
        targetProgress.current,
        targetProgress.target,
        Math.abs(targetProgress.remaining),
        targetProgress.daysRemaining,
        settings,
      );
      await recordNotificationSent("exceeded");
    }
  }

  // Behind target notification (send once per day max)
  if (targetProgress.status === "behind" && targetProgress.daysRemaining > 0) {
    const shouldSend = await shouldSendNotification("behind", 24);
    if (shouldSend) {
      await sendTargetReminder(
        "behind",
        targetProgress.current,
        targetProgress.target,
        targetProgress.remaining,
        targetProgress.daysRemaining,
        settings,
      );
      await recordNotificationSent("behind");
    }
  }

  // On track notification (send once per week)
  if (targetProgress.status === "on-track" && progress > 20) {
    const shouldSend = await shouldSendNotification("on-track", 168); // 7 days
    if (shouldSend) {
      await sendTargetReminder(
        "on-track",
        targetProgress.current,
        targetProgress.target,
        targetProgress.remaining,
        targetProgress.daysRemaining,
        settings,
      );
      await recordNotificationSent("on-track");
    }
  }
}

/**
 * Check for sales activity and send encouragement if needed
 */
export async function checkSalesActivity(
  daysSinceLastSale: number,
  settings: NotificationSettings,
) {
  if (!settings.enabled || daysSinceLastSale < 3) {
    return;
  }

  const shouldSend = await shouldSendNotification("encouragement", 48);
  if (shouldSend) {
    await sendEncouragementNotification(daysSinceLastSale);
    await recordNotificationSent("encouragement");
  }
}
