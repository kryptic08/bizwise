import { HelpTooltip } from "@/components/HelpTooltip";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  LayoutGrid,
  Receipt,
  Target,
  Utensils,
  Wallet,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Polygon,
  Stop,
} from "react-native-svg";
import { OfflineIndicator } from "../components/OfflineIndicator";
import { useAuth } from "../context/AuthContext";
import { useDashboardData } from "../hooks/useOfflineQueries";
import { checkTargetProgress } from "../utils/notificationChecker";
import { NotificationSettings } from "../utils/notificationService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// --- Colors based on the image ---
const COLORS = {
  primaryBlue: "#3b6ea5",
  darkBlue: "#2c527a",
  lightBlueBg: "#f0f6fc",
  chartBg: "#d6e6f5",
  tabBg: "#dbeafe",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
  borderLight: "#e5e7eb",
  green: "#2ecc71",
  red: "#ff5c5c",
  peso: "#2c527a",
};

// --- Mock Data ---
const PROFIT_DATA = [40, 60, 35, 70, 85, 95, 90]; // 0-100 scale
const INCOME_EXPENSE_DATA = [
  { day: "Mon", inc: 40, exp: 60 },
  { day: "Tue", inc: 45, exp: 30 },
  { day: "Wed", inc: 20, exp: 35 },
  { day: "Thu", inc: 60, exp: 35 },
  { day: "Fri", inc: 80, exp: 45 },
  { day: "Sat", inc: 95, exp: 30 },
  { day: "Sun", inc: 70, exp: 40 },
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function HomeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Daily");
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Convert text to sentence case
  const toSentenceCase = (text: string) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  // Compute current week boundaries in client local time (Monday-start) to avoid UTC issues
  const todayLocalStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const currentWeekStartStr = useMemo(() => {
    const d = new Date();
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const currentWeekEndStr = useMemo(() => {
    const d = new Date();
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? 0 : 7 - dow));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Calculate how many weeks to fetch to cover entire current month
  const weeksToFetch = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Find the Monday on or before the start of the month
    const startDow = startOfMonth.getDay();
    const firstMonday = new Date(startOfMonth);
    if (startDow === 0) {
      // Sunday - go back 6 days to previous Monday
      firstMonday.setDate(startOfMonth.getDate() - 6);
    } else if (startDow !== 1) {
      // Not Monday - find next Monday
      firstMonday.setDate(startOfMonth.getDate() + (8 - startDow));
    }

    // Count weeks from first Monday in/after month start to end of month
    const daysDiff = Math.floor(
      (endOfMonth.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24),
    );
    const weeksInMonth = Math.ceil(daysDiff / 7) + 1;

    // Calculate how far back from today we need to fetch
    const todayToFirstMonday = Math.floor(
      (now.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24),
    );

    return Math.max(Math.ceil(todayToFirstMonday / 7) + 1, weeksInMonth);
  }, []);

  // Single combined query replaces 7 separate subscriptions (~80% bandwidth reduction)
  const { data: dashboardData } = useDashboardData(
    user?.userId,
    todayLocalStr,
    currentWeekStartStr,
    currentWeekEndStr,
    weeksToFetch,
  );
  const dailyAnalytics = dashboardData?.dailyAnalytics;
  const weeklyAnalytics = dashboardData?.weeklyAnalytics;
  const monthlyAnalytics = dashboardData?.monthlyAnalytics;
  const targetProgress = dashboardData?.targetProgress;

  // Pick period-specific top sellers based on active tab
  // Daily tab → "this week", Weekly tab → "this month", Monthly tab → "this year"
  const topProduct =
    activeTab === "Daily"
      ? dashboardData?.topProductWeekly
      : activeTab === "Weekly"
        ? dashboardData?.topProductMonthly
        : dashboardData?.topProductYearly;
  const topCategory =
    activeTab === "Daily"
      ? dashboardData?.topCategoryWeekly
      : activeTab === "Weekly"
        ? dashboardData?.topCategoryMonthly
        : dashboardData?.topCategoryYearly;
  const leastProduct =
    activeTab === "Daily"
      ? dashboardData?.leastProductWeekly
      : activeTab === "Weekly"
        ? dashboardData?.leastProductMonthly
        : dashboardData?.leastProductYearly;
  const leastCategory =
    activeTab === "Daily"
      ? dashboardData?.leastCategoryWeekly
      : activeTab === "Weekly"
        ? dashboardData?.leastCategoryMonthly
        : dashboardData?.leastCategoryYearly;

  const formatSellerName = (entry?: { name?: string }) => {
    if (periodTotals.sales === 0 || !entry?.name) return "No sales yet";
    const name = entry.name.toLowerCase();
    if (
      name.includes("add-on") ||
      name.includes("takeout") ||
      name.includes("fee")
    ) {
      return "No sales yet";
    }
    return toSentenceCase(entry.name);
  };

  // Check target progress and trigger notifications
  useEffect(() => {
    if (!targetProgress || !user?.userId) return;

    const checkNotifications = async () => {
      try {
        // Load notification settings
        const settingsJson = await AsyncStorage.getItem(
          "bizwise_notification_settings",
        );
        const settings: NotificationSettings = settingsJson
          ? JSON.parse(settingsJson)
          : {
              enabled: true,
              targetReminders: true,
              dailySummary: true,
              weeklyReport: true,
            };

        // Check target progress and send notifications if needed
        await checkTargetProgress(targetProgress, settings);
      } catch (error) {
        console.error("Error checking notifications:", error);
      }
    };

    checkNotifications();
  }, [targetProgress, user?.userId]);

  // Helper: short date format e.g. "Mar 1"
  const fmtShort = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // Helper: month name e.g. "March"
  const fmtMonth = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long" });

  // Helper function to get the number of weeks in current month (Monday-start)
  const getWeeksInCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    // Count Mondays in the month — each Monday anchors one business week
    let mondays = 0;
    for (let d = 1; d <= lastDay.getDate(); d++) {
      if (new Date(year, month, d).getDay() === 1) mondays++;
    }
    return mondays;
  };

  // Helper to get current week boundaries (Monday-start)
  const getCurrentWeekDays = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    // Monday-start: if Sunday (0), go back 6 days; otherwise go back dayOfWeek-1
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(
        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.getDay()],
      );
    }
    return { days, startOfWeek };
  };

  // Date range label shown beside each chart title
  const chartDateRange = useMemo(() => {
    const now = new Date();
    if (activeTab === "Daily") {
      // Current week Mon–Sun
      const dow = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
      mon.setHours(0, 0, 0, 0);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return `${fmtShort(mon)} – ${fmtShort(sun)}`;
    } else if (activeTab === "Weekly") {
      // Current month start–end
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return `${fmtShort(first)} – ${fmtShort(last)}`;
    } else {
      // Current year Jan–Dec
      const year = now.getFullYear();
      return `Jan – Dec ${year}`;
    }
  }, [activeTab]);

  // Format the analytics based on active tab
  const chartData = useMemo(() => {
    let rawData: Array<{ day: string; sales: number; expense: number }> = [];
    const { days: weekDays } = getCurrentWeekDays();

    if (activeTab === "Daily") {
      if (!dailyAnalytics) return INCOME_EXPENSE_DATA;
      // Backend returns exactly Mon-Sun of current week; map to day name lookup
      const dataMap: Record<string, { sales: number; expense: number }> = {};
      dailyAnalytics.forEach(
        (day: { date: string; income: number; expense: number }) => {
          const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
            new Date(day.date + "T00:00:00").getDay()
          ];
          dataMap[dayName] = { sales: day.income, expense: day.expense };
        },
      );
      // Show all 7 days Mon-Sun with 0 for missing days
      rawData = weekDays.map((dayName) => ({
        day: dayName,
        sales: dataMap[dayName]?.sales ?? 0,
        expense: dataMap[dayName]?.expense ?? 0,
      }));
    } else if (activeTab === "Weekly") {
      if (!weeklyAnalytics) return INCOME_EXPENSE_DATA;
      const weeksInMonth = getWeeksInCurrentMonth();

      // Filter weeks that START in the current month only
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const currentMonthWeeks = weeklyAnalytics.filter(
        (week: { weekStart: string; income: number; expense: number }) => {
          const weekStartDate = new Date(week.weekStart + "T00:00:00");
          return (
            weekStartDate.getFullYear() === currentYear &&
            weekStartDate.getMonth() === currentMonth
          );
        },
      );

      // Build complete week array with all weeks in month (fill zeros for missing weeks)
      rawData = Array.from({ length: weeksInMonth }, (_, i) => {
        const weekData = currentMonthWeeks[i];
        return {
          day: `W${i + 1}`,
          sales: weekData?.income ?? 0,
          expense: weekData?.expense ?? 0,
        };
      });
    } else {
      // Monthly - show all 12 months
      if (!monthlyAnalytics) return INCOME_EXPENSE_DATA.slice(0, 6);
      rawData = monthlyAnalytics.map(
        (month: { month: string; income: number; expense: number }) => ({
          day: month.month.substring(0, 3),
          sales: month.income,
          expense: month.expense,
        }),
      );
    }

    // Return raw data with actual values (no scaling)
    return rawData.map((d) => ({
      day: d.day,
      inc: d.sales,
      exp: d.expense,
    }));
  }, [activeTab, dailyAnalytics, weeklyAnalytics, monthlyAnalytics]);

  // Calculate max value for sales/expense chart Y-axis
  const salesExpenseMaxValue = useMemo(() => {
    const maxValue = Math.max(
      ...chartData.map((d) => Math.max(d.inc, d.exp)),
      1,
    );
    // Smart rounding based on magnitude
    if (maxValue > 10000) {
      return Math.ceil(maxValue / 5000) * 5000;
    } else if (maxValue > 5000) {
      return Math.ceil(maxValue / 2000) * 2000;
    }
    const roundedMax = Math.ceil(maxValue / 500) * 500;
    return Math.max(roundedMax, 1500);
  }, [chartData]);

  // Totals for the currently visible chart period (Daily = this week, Weekly = this month, Monthly = this year)
  const periodTotals = useMemo(
    () => ({
      sales: (chartData ?? []).reduce((sum, d) => sum + d.inc, 0),
      expenses: (chartData ?? []).reduce((sum, d) => sum + d.exp, 0),
    }),
    [chartData],
  );

  // Y-axis labels for sales/expense chart
  const salesExpenseYLabels = useMemo(() => {
    const max = salesExpenseMaxValue;
    const step = max / 4;
    return [
      max,
      Math.round(max * 0.75),
      Math.round(max * 0.5),
      Math.round(max * 0.25),
      0,
    ];
  }, [salesExpenseMaxValue]);

  // Format profit data based on active tab
  const profitChartData = useMemo(() => {
    let profits: number[] = [];
    const { days: weekDays } = getCurrentWeekDays();

    if (activeTab === "Daily") {
      if (!dailyAnalytics) return PROFIT_DATA;
      // Backend returns exactly Mon-Sun of current week; map to day name lookup
      const dataMap: Record<string, number> = {};
      dailyAnalytics.forEach(
        (day: { date: string; income: number; expense: number }) => {
          const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
            new Date(day.date + "T00:00:00").getDay()
          ];
          dataMap[dayName] = day.income - day.expense;
        },
      );
      // Show all 7 days Mon-Sun with 0 for missing days
      profits = weekDays.map((dayName) => dataMap[dayName] ?? 0);
    } else if (activeTab === "Weekly") {
      if (!weeklyAnalytics) return PROFIT_DATA;
      const weeksInMonth = getWeeksInCurrentMonth();

      // Filter weeks that START in the current month only
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const currentMonthWeeks = weeklyAnalytics.filter(
        (week: { weekStart: string; income: number; expense: number }) => {
          const weekStartDate = new Date(week.weekStart + "T00:00:00");
          return (
            weekStartDate.getFullYear() === currentYear &&
            weekStartDate.getMonth() === currentMonth
          );
        },
      );

      // Build complete week array with all weeks in month (fill zeros for missing weeks)
      profits = Array.from({ length: weeksInMonth }, (_, i) => {
        const weekData = currentMonthWeeks[i];
        return weekData ? weekData.income - weekData.expense : 0;
      });
    } else {
      // Monthly - show all 12 months
      if (!monthlyAnalytics) return PROFIT_DATA.slice(0, 6);
      profits = monthlyAnalytics.map(
        (month: { income: number; expense: number }) =>
          month.income - month.expense,
      );
    }

    return profits;
  }, [activeTab, dailyAnalytics, weeklyAnalytics, monthlyAnalytics]);

  // Calculate max value for profit chart Y-axis
  const profitMaxValue = useMemo(() => {
    const maxValue = Math.max(...profitChartData, 0);
    if (maxValue <= 0) return 500; // Minimum axis when all values are negative
    if (maxValue > 10000) {
      return Math.ceil(maxValue / 5000) * 5000;
    } else if (maxValue > 5000) {
      return Math.ceil(maxValue / 2000) * 2000;
    }
    const roundedMax = Math.ceil(maxValue / 500) * 500;
    return Math.max(roundedMax, 1500);
  }, [profitChartData]);

  // Calculate min value for profit chart Y-axis (handles negative profits)
  const profitMinValue = useMemo(() => {
    const minValue = Math.min(...profitChartData, 0);
    if (minValue >= 0) return 0;
    if (minValue < -10000) {
      return Math.floor(minValue / 5000) * 5000;
    } else if (minValue < -5000) {
      return Math.floor(minValue / 2000) * 2000;
    }
    return Math.floor(minValue / 500) * 500;
  }, [profitChartData]);

  // Calculate total profit for different time periods
  const periodProfit = useMemo(() => {
    if (activeTab === "Daily") {
      // Backend returns exactly Mon-Sun of current week
      if (!dailyAnalytics) return 0;
      return dailyAnalytics.reduce(
        (sum: number, day: { income: number; expense: number }) =>
          sum + (day.income - day.expense),
        0,
      );
    } else if (activeTab === "Weekly") {
      // Current month's weeks profit
      if (!weeklyAnalytics) return 0;

      // Filter weeks that START in the current month only
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const currentMonthWeeks = weeklyAnalytics.filter(
        (week: { weekStart: string; income: number; expense: number }) => {
          const weekStartDate = new Date(week.weekStart + "T00:00:00");
          return (
            weekStartDate.getFullYear() === currentYear &&
            weekStartDate.getMonth() === currentMonth
          );
        },
      );

      return currentMonthWeeks.reduce(
        (sum: number, week: { income: number; expense: number }) =>
          sum + (week.income - week.expense),
        0,
      );
    } else {
      // Monthly - Current year profit
      if (!monthlyAnalytics) return 0;
      return monthlyAnalytics.reduce(
        (sum: number, month: { income: number; expense: number }) =>
          sum + (month.income - month.expense),
        0,
      );
    }
  }, [activeTab, dailyAnalytics, weeklyAnalytics, monthlyAnalytics]);

  // Y-axis labels for profit chart (spans min to max, always includes 0)
  const profitYLabels = useMemo(() => {
    const max = profitMaxValue;
    const min = profitMinValue;
    const range = max - min;
    return [
      max,
      Math.round(min + range * 0.75),
      Math.round(min + range * 0.5),
      Math.round(min + range * 0.25),
      min,
    ];
  }, [profitMaxValue, profitMinValue]);

  // Get labels for x-axis based on active tab
  const chartLabels = useMemo(() => {
    const { days: weekDays } = getCurrentWeekDays();

    if (activeTab === "Daily") {
      // Always show all 7 days Mon-Sun
      return weekDays;
    } else if (activeTab === "Weekly") {
      const weeksInMonth = getWeeksInCurrentMonth();
      return Array.from({ length: weeksInMonth }, (_, i) => `W${i + 1}`);
    } else {
      return monthlyAnalytics
        ? monthlyAnalytics.map((m: { month: string }) =>
            m.month.substring(0, 3),
          )
        : ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    }
  }, [activeTab, dailyAnalytics, monthlyAnalytics]);

  // Generate dynamic profit analysis text
  const profitAnalysisText = useMemo(() => {
    // Check if data is empty (all zeros)
    if (profitChartData.every((p) => p === 0)) {
      return ""; // No text for empty graph
    }

    const totalProfit = profitChartData.reduce((sum, val) => sum + val, 0);
    const avgProfit = totalProfit / profitChartData.length;

    // Calculate trend (compare last 3 vs first 3 data points)
    if (profitChartData.length >= 4) {
      const firstHalf = profitChartData.slice(
        0,
        Math.floor(profitChartData.length / 2),
      );
      const secondHalf = profitChartData.slice(
        Math.floor(profitChartData.length / 2),
      );
      const firstAvg =
        firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

      if (firstAvg === 0 && secondAvg === 0) {
        return ""; // No meaningful data
      }

      // Calculate absolute change
      const absoluteChange = secondAvg - firstAvg;

      // Only show percentage if both periods have meaningful profit (>= 500)
      const minThreshold = 500;
      const showPercentage =
        Math.abs(firstAvg) >= minThreshold &&
        Math.abs(secondAvg) >= minThreshold;

      // Calculate growth rate if meaningful
      let growthRate: number | null = null;
      if (showPercentage && firstAvg !== 0) {
        growthRate = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
        // Cap at reasonable bounds
        if (growthRate > 200) growthRate = 200;
        if (growthRate < -200) growthRate = -200;
      }

      // Format absolute change for display
      const changeText =
        absoluteChange >= 0
          ? `+₱${Math.abs(Math.round(absoluteChange)).toLocaleString()}`
          : `-₱${Math.abs(Math.round(absoluteChange)).toLocaleString()}`;

      // Generate insights based on absolute change and/or percentage
      if (growthRate !== null) {
        if (growthRate > 20) {
          return `🎉 Excellent! Profit grew by ${Math.round(growthRate)}% (${changeText}). Keep up the great work!`;
        } else if (growthRate > 10) {
          return `📈 Good progress! Profit increased by ${Math.round(growthRate)}% (${changeText}) with steady growth.`;
        } else if (growthRate > -10) {
          return `✅ Profit is stable (${changeText}). Consistent performance this period!`;
        } else if (growthRate > -25) {
          return `⚠️ Profit decreased by ${Math.abs(Math.round(growthRate))}% (${changeText}). Consider reviewing expenses.`;
        } else {
          return `📉 Profit down by ${Math.abs(Math.round(growthRate))}% (${changeText}). Focus on boosting sales and reducing costs.`;
        }
      } else {
        // No meaningful percentage - use absolute values
        if (firstAvg < 100 && secondAvg > 500) {
          return `🎉 Great improvement! Profit went from ₱${Math.round(firstAvg)} to ₱${Math.round(secondAvg)} per period.`;
        } else if (absoluteChange > 500) {
          return `📈 Good progress! Profit increased by ${changeText} per period.`;
        } else if (absoluteChange > -500 && absoluteChange < 500) {
          return `✅ Profit is stable around ₱${Math.round(secondAvg)} per period.`;
        } else if (absoluteChange < -500) {
          return `⚠️ Profit dropped by ${Math.abs(Math.round(absoluteChange)).toLocaleString()} per period. Review your expenses.`;
        } else {
          return `📊 Current profit averages ₱${Math.round(secondAvg).toLocaleString()} per period.`;
        }
      }
    }

    // Fallback for shorter data sets
    if (avgProfit > 1000) {
      return "✅ Strong profit performance! Keep maintaining this momentum.";
    } else if (avgProfit > 0) {
      return "📊 Positive profit. Continue optimizing your operations.";
    } else if (avgProfit < -1000) {
      return `🚨 Operating at a loss (avg ₱${Math.abs(Math.round(avgProfit)).toLocaleString()}/period). Review expenses urgently.`;
    } else if (avgProfit < 0) {
      return "⚠️ Slight loss this period. Monitor expenses closely.";
    } else {
      return "";
    }
  }, [profitChartData]);

  // Generate dynamic income/expense analysis text
  const salesExpenseAnalysisText = useMemo(() => {
    // Check if data is empty (all zeros)
    if (chartData.every((d) => d.inc === 0 && d.exp === 0)) {
      return ""; // No text for empty graph
    }

    const totalIncome = chartData.reduce((sum, d) => sum + d.inc, 0);
    const totalExpense = chartData.reduce((sum, d) => sum + d.exp, 0);
    const avgIncome = totalIncome / chartData.length;
    const avgExpense = totalExpense / chartData.length;

    if (totalIncome === 0 && totalExpense === 0) {
      return ""; // No meaningful data
    }

    // Calculate expense ratio
    const expenseRatio =
      totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
    const profitMargin =
      totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

    // Income trend - only calculate percentage if both periods have meaningful income
    const incomeGrowth =
      chartData.length >= 4
        ? (() => {
            const firstHalf = chartData.slice(
              0,
              Math.floor(chartData.length / 2),
            );
            const secondHalf = chartData.slice(
              Math.floor(chartData.length / 2),
            );
            const firstAvg =
              firstHalf.reduce((sum, d) => sum + d.inc, 0) / firstHalf.length;
            const secondAvg =
              secondHalf.reduce((sum, d) => sum + d.inc, 0) / secondHalf.length;
            // Only show percentage if both periods have meaningful income (>= 1000)
            const minThreshold = 1000;
            if (firstAvg < minThreshold || secondAvg < minThreshold) {
              return null; // No meaningful percentage to show
            }
            const growth = ((secondAvg - firstAvg) / firstAvg) * 100;
            // Cap unrealistic percentages
            if (growth > 200) return 200;
            if (growth < -200) return -200;
            return growth;
          })()
        : null;

    // Generate insights with realistic percentages
    const realisticProfitMargin = Math.min(Math.max(profitMargin, -100), 100);

    // Format income trend text
    const incomeTrendText =
      incomeGrowth !== null
        ? incomeGrowth > 5
          ? "growing"
          : incomeGrowth < -5
            ? "declining"
            : "stable"
        : "";

    if (realisticProfitMargin > 50) {
      return `🌟 Excellent financial control! ${Math.round(realisticProfitMargin)}% profit margin with well-managed expenses.`;
    } else if (realisticProfitMargin > 30) {
      return `💰 Great balance!${incomeTrendText ? ` Income is ${incomeTrendText}` : ""} while expenses remain controlled.`;
    } else if (realisticProfitMargin > 10) {
      return `📊 Healthy finances with ${Math.round(realisticProfitMargin)}% profit margin. Room for optimization.`;
    } else if (realisticProfitMargin > 0) {
      return `⚠️ Tight margins at ${Math.round(realisticProfitMargin)}%. Consider reducing expenses or increasing income.`;
    } else if (totalExpense > totalIncome) {
      return `🚨 Expenses exceed income by ₱${Math.abs(totalExpense - totalIncome).toFixed(0)}. Take action to balance finances.`;
    } else {
      return "📈 Keep tracking your finances for better insights over time.";
    }
  }, [chartData]);

  // Format Y-axis labels with K suffix for thousands (handles negatives)
  const formatYLabel = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal >= 1000) {
      const sign = val < 0 ? "-" : "";
      return `${sign}${(absVal / 1000).toFixed(absVal % 1000 === 0 ? 0 : 1)}k`;
    }
    return String(val);
  };

  const handleCardPress = (type: "balance" | "expense") => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (type === "expense") {
        router.push("/(tabs)/add-expense");
      } else {
        router.push("/(tabs)/transactions");
      }
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryBlue}
      />

      {/* Offline Indicator */}
      <OfflineIndicator />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.welcomeText}>
                Hi, {user?.name?.split(" ")[0] || "User"}! Welcome Back
              </Text>
              <Text style={styles.subWelcomeText}>{getGreeting()}</Text>
            </View>
            <HelpTooltip
              title="Dashboard Help"
              content="View your business overview including today's sales, total balance, income, and expenses. Tap any card to see detailed breakdowns. Use the quick actions to add sales or products."
              iconColor={COLORS.textDark}
            />
          </View>

          {/* Balance Cards - Period based on active tab */}
          <View style={styles.balanceRow}>
            <Pressable
              style={styles.card}
              onPress={() => router.push("/(tabs)/transactions")}
              android_ripple={{ color: "rgba(59, 110, 165, 0.1)" }}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <View style={styles.cardHeader}>
                  <Wallet size={14} color={COLORS.textGray} />
                  <Text style={styles.cardLabel}>
                    {" "}
                    {activeTab === "Daily"
                      ? "This Week"
                      : activeTab === "Weekly"
                        ? "This Month"
                        : "This Year"}{" "}
                    Sales
                  </Text>
                </View>
                <Text
                  style={[styles.amountText, { color: COLORS.primaryBlue }]}
                >
                  ₱
                  {periodTotals.sales.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </Animated.View>
            </Pressable>
            <Pressable
              style={styles.card}
              onPress={() => router.push("/(tabs)/transactions")}
              android_ripple={{ color: "rgba(59, 110, 165, 0.1)" }}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <View style={styles.cardHeader}>
                  <Receipt size={14} color={COLORS.textGray} />
                  <Text style={styles.cardLabel}>
                    {" "}
                    {activeTab === "Daily"
                      ? "This Week"
                      : activeTab === "Weekly"
                        ? "This Month"
                        : "This Year"}{" "}
                    Expenses
                  </Text>
                </View>
                <Text style={[styles.amountText, { color: COLORS.textDark }]}>
                  ₱
                  {periodTotals.expenses.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </Animated.View>
            </Pressable>
          </View>

          {/* Highlights - Period based */}
          <View style={styles.highlightCard}>
            <View style={styles.highlightItem}>
              <View style={styles.iconBoxBlue}>
                <Utensils color={COLORS.white} size={16} />
              </View>
              <View>
                <Text style={styles.highlightLabel}>Top selling product</Text>
                <Text
                  style={[styles.highlightPeriodLabel, { marginBottom: 2 }]}
                >
                  {activeTab === "Daily"
                    ? "this week"
                    : activeTab === "Weekly"
                      ? "this month"
                      : "this year"}
                </Text>
                <Text style={styles.highlightValue}>
                  {formatSellerName(topProduct)}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.highlightItem}>
              <View style={styles.iconBoxBlue}>
                <LayoutGrid color={COLORS.white} size={16} />
              </View>
              <View>
                <Text style={styles.highlightLabel}>Top selling category</Text>
                <Text style={styles.highlightPeriodLabel}>
                  {activeTab === "Daily"
                    ? "this week"
                    : activeTab === "Weekly"
                      ? "this month"
                      : "this year"}
                </Text>
                <Text style={styles.highlightValue}>
                  {formatSellerName(topCategory)}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.highlightCard, { marginTop: 10 }]}>
            <View style={styles.highlightItem}>
              <View style={styles.iconBoxBlue}>
                <Utensils color={COLORS.white} size={16} />
              </View>
              <View>
                <Text style={styles.highlightLabel}>Least selling product</Text>
                <Text
                  style={[styles.highlightPeriodLabel, { marginBottom: 2 }]}
                >
                  {activeTab === "Daily"
                    ? "this week"
                    : activeTab === "Weekly"
                      ? "this month"
                      : "this year"}
                </Text>
                <Text style={styles.highlightValue}>
                  {formatSellerName(leastProduct)}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.highlightItem}>
              <View style={styles.iconBoxBlue}>
                <LayoutGrid color={COLORS.white} size={16} />
              </View>
              <View>
                <Text style={styles.highlightLabel}>
                  Least selling category
                </Text>
                <Text style={styles.highlightPeriodLabel}>
                  {activeTab === "Daily"
                    ? "this week"
                    : activeTab === "Weekly"
                      ? "this month"
                      : "this year"}
                </Text>
                <Text style={styles.highlightValue}>
                  {formatSellerName(leastCategory)}
                </Text>
              </View>
            </View>
          </View>

          {/* Target Income Progress */}
          {targetProgress && (
            <TouchableOpacity
              style={styles.targetCard}
              onPress={() => router.push("/target-income")}
              activeOpacity={0.8}
            >
              <View style={styles.targetHeader}>
                <Text style={styles.targetTitle}>Monthly Target Progress</Text>
                <Target color={COLORS.primaryBlue} size={20} />
              </View>

              <View style={styles.targetProgress}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(100, targetProgress.progressPercentage)}%`,
                        backgroundColor:
                          targetProgress.status === "ahead"
                            ? COLORS.green
                            : targetProgress.status === "on-track"
                              ? COLORS.primaryBlue
                              : COLORS.red,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.targetStats}>
                <View style={styles.targetStat}>
                  <Text style={styles.targetStatLabel}>Current</Text>
                  <Text
                    style={[styles.targetStatValue, { color: COLORS.green }]}
                  >
                    ₱
                    {targetProgress.current.toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </Text>
                </View>
                <View style={styles.targetStat}>
                  <Text style={styles.targetStatLabel}>Target</Text>
                  <Text
                    style={[
                      styles.targetStatValue,
                      { color: COLORS.primaryBlue },
                    ]}
                  >
                    ₱
                    {targetProgress.target.toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </Text>
                </View>
                <View style={styles.targetStat}>
                  <Text style={styles.targetStatLabel}>
                    {targetProgress.remaining > 0 ? "Remaining" : "Exceeded"}
                  </Text>
                  <Text
                    style={[
                      styles.targetStatValue,
                      {
                        color:
                          targetProgress.remaining > 0
                            ? COLORS.textGray
                            : COLORS.green,
                      },
                    ]}
                  >
                    ₱
                    {Math.abs(targetProgress.remaining).toLocaleString(
                      "en-US",
                      {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      },
                    )}
                  </Text>
                </View>
              </View>

              {targetProgress.status === "behind" &&
                targetProgress.daysRemaining > 0 && (
                  <Text style={styles.targetMessage}>
                    ⚠️ Need ₱{targetProgress.requiredDailyIncome.toFixed(0)}/day
                    to reach target
                  </Text>
                )}
              {targetProgress.status === "ahead" && (
                <Text style={styles.targetMessageSuccess}>
                  🎉 Congratulations! You've exceeded your target!
                </Text>
              )}
              {targetProgress.status === "on-track" &&
                targetProgress.daysRemaining > 0 && (
                  <Text style={styles.targetMessageOnTrack}>
                    👍 On track! Keep up the good work!
                  </Text>
                )}
            </TouchableOpacity>
          )}
        </View>

        {/* Main White Content Area */}
        <View style={styles.mainContent}>
          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={
                activeTab === "Daily" ? styles.activeTab : styles.inactiveTab
              }
              onPress={() => setActiveTab("Daily")}
            >
              <Text
                style={
                  activeTab === "Daily"
                    ? styles.activeTabText
                    : styles.inactiveTabText
                }
              >
                Daily
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={
                activeTab === "Weekly" ? styles.activeTab : styles.inactiveTab
              }
              onPress={() => setActiveTab("Weekly")}
            >
              <Text
                style={
                  activeTab === "Weekly"
                    ? styles.activeTabText
                    : styles.inactiveTabText
                }
              >
                Weekly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={
                activeTab === "Monthly" ? styles.activeTab : styles.inactiveTab
              }
              onPress={() => setActiveTab("Monthly")}
            >
              <Text
                style={
                  activeTab === "Monthly"
                    ? styles.activeTabText
                    : styles.inactiveTabText
                }
              >
                Monthly
              </Text>
            </TouchableOpacity>
          </View>

          {/* Profit Section */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>Profit</Text>
                <Text style={styles.chartDateRange}>{chartDateRange}</Text>
              </View>
              <View style={styles.chartLegend}>
                <View style={styles.legendDot} />
                <Text style={styles.legendText}>Profit</Text>
              </View>
            </View>

            <View style={styles.graphContainer}>
              {/* Y-Axis Labels */}
              <View style={styles.yAxis}>
                {profitYLabels.map((label, i) => (
                  <Text key={i} style={styles.axisText}>
                    {formatYLabel(label)}
                  </Text>
                ))}
              </View>

              {/* Scrollable Chart Area */}
              <ScrollView
                key={`profit-scroll-${activeTab}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  minWidth:
                    activeTab === "Monthly"
                      ? profitChartData.length * 60 + 20
                      : profitChartData.length * 50,
                }}
                style={styles.scrollPlot}
              >
                <View style={styles.plotArea}>
                  {/* Grid Lines */}
                  {profitYLabels.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.gridLine,
                        { bottom: (i / (profitYLabels.length - 1)) * 150 },
                      ]}
                    />
                  ))}

                  {/* SVG Area Chart */}
                  <View
                    key={`profit-svg-${activeTab}`}
                    style={styles.pointsContainer}
                  >
                    {(() => {
                      const totalPoints = profitChartData.length;
                      const minSpacing = activeTab === "Monthly" ? 55 : 50;
                      const spacing = Math.max(
                        (SCREEN_WIDTH - 120) / (totalPoints - 1),
                        minSpacing,
                      );
                      const chartWidth = (totalPoints - 1) * spacing + 40;
                      const chartHeight = 140;
                      const paddingX = 20;
                      const paddingY = 5;

                      const profitRange = profitMaxValue - profitMinValue || 1;
                      const points = profitChartData.map((val, index) => ({
                        x: paddingX + index * spacing,
                        y:
                          paddingY +
                          chartHeight -
                          ((val - profitMinValue) / profitRange) * chartHeight,
                      }));

                      // Build area polygon - line points + bottom corners
                      // Fill area from line to zero line (or chart bottom if all positive)
                      const zeroY =
                        profitMinValue < 0
                          ? paddingY +
                            chartHeight -
                            ((0 - profitMinValue) / profitRange) * chartHeight
                          : paddingY + chartHeight;
                      const areaPoints =
                        points.map((p) => `${p.x},${p.y}`).join(" ") +
                        ` ${points[points.length - 1].x},${zeroY} ${paddingX},${zeroY}`;

                      return (
                        <>
                          <Svg
                            width={chartWidth}
                            height={chartHeight + paddingY * 2 + 25}
                          >
                            <Defs>
                              <LinearGradient
                                id="profitGradient"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <Stop
                                  offset="0"
                                  stopColor={COLORS.primaryBlue}
                                  stopOpacity="0.3"
                                />
                                <Stop
                                  offset="1"
                                  stopColor={COLORS.primaryBlue}
                                  stopOpacity="0.02"
                                />
                              </LinearGradient>
                            </Defs>
                            <G>
                              {/* Zero reference line when range spans positive and negative */}
                              {profitMinValue < 0 && profitMaxValue > 0 && (
                                <Line
                                  x1={0}
                                  y1={zeroY}
                                  x2={chartWidth}
                                  y2={zeroY}
                                  stroke="#aab5c3"
                                  strokeWidth={1}
                                  strokeDasharray="4,3"
                                />
                              )}
                              {/* Filled area */}
                              {points.length > 1 && (
                                <Polygon
                                  points={areaPoints}
                                  fill="url(#profitGradient)"
                                />
                              )}
                              {/* Lines */}
                              {points.map((point, index) => {
                                if (index === 0) return null;
                                return (
                                  <Line
                                    key={`pl-${index}`}
                                    x1={points[index - 1].x}
                                    y1={points[index - 1].y}
                                    x2={point.x}
                                    y2={point.y}
                                    stroke={COLORS.primaryBlue}
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                  />
                                );
                              })}
                              {/* Dots */}
                              {points.map((point, index) => (
                                <Circle
                                  key={`pc-${index}`}
                                  cx={point.x}
                                  cy={point.y}
                                  r={5}
                                  fill={COLORS.primaryBlue}
                                  stroke={COLORS.white}
                                  strokeWidth={2}
                                />
                              ))}
                            </G>
                          </Svg>

                          {/* X-axis labels */}
                          <View
                            style={[styles.xAxisLabels, { width: chartWidth }]}
                          >
                            {points.map((point, index) => (
                              <Text
                                key={`lbl-${index}`}
                                style={[
                                  styles.axisLabelText,
                                  {
                                    position: "absolute",
                                    left: point.x - 16,
                                    width: 32,
                                    textAlign: "center",
                                  },
                                ]}
                              >
                                {chartLabels[index] || ""}
                              </Text>
                            ))}
                          </View>
                        </>
                      );
                    })()}
                  </View>
                </View>
              </ScrollView>
            </View>

            {/* Profit Summary */}
            <View style={styles.profitSummary}>
              <Coins color={COLORS.primaryBlue} size={24} />
              <Text style={styles.profitLabel}>
                {" "}
                {activeTab === "Daily"
                  ? "Week Profit"
                  : activeTab === "Weekly"
                    ? "Month Profit"
                    : "Year Profit"}
              </Text>
              <Text style={styles.profitValue}>
                {" "}
                ₱
                {periodProfit.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
            {profitAnalysisText && (
              <Text style={styles.analysisText}>{profitAnalysisText}</Text>
            )}
          </View>

          {/* Sales & Expenses Section */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>Sales & Expenses</Text>
                <Text style={styles.chartDateRange}>{chartDateRange}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={styles.chartLegend}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: COLORS.green },
                    ]}
                  />
                  <Text style={styles.legendText}>Sales</Text>
                </View>
                <View style={styles.chartLegend}>
                  <View
                    style={[styles.legendDot, { backgroundColor: COLORS.red }]}
                  />
                  <Text style={styles.legendText}>Expenses</Text>
                </View>
              </View>
            </View>

            <View style={styles.graphContainer}>
              <View style={styles.yAxis}>
                {salesExpenseYLabels.map((label, i) => (
                  <Text key={i} style={styles.axisText}>
                    {formatYLabel(label)}
                  </Text>
                ))}
              </View>

              <ScrollView
                key={`bar-scroll-${activeTab}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  minWidth:
                    activeTab === "Monthly"
                      ? chartData.length * 60
                      : chartData.length * 50,
                  paddingHorizontal: activeTab === "Monthly" ? 10 : 0,
                }}
                style={styles.scrollPlot}
              >
                <View style={styles.plotArea}>
                  {salesExpenseYLabels.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.gridLine,
                        {
                          bottom: (i / (salesExpenseYLabels.length - 1)) * 150,
                        },
                      ]}
                    />
                  ))}

                  <View key={`bars-${activeTab}`} style={styles.barContainer}>
                    {chartData.map((item, index) => (
                      <View
                        key={index}
                        style={[
                          styles.barGroup,
                          { width: activeTab === "Monthly" ? 60 : 50 },
                        ]}
                      >
                        <View style={styles.barsWrapper}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: Math.max(
                                  2,
                                  (item.inc / salesExpenseMaxValue) * 140,
                                ),
                                backgroundColor: COLORS.green,
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.bar,
                              {
                                height: Math.max(
                                  2,
                                  (item.exp / salesExpenseMaxValue) * 140,
                                ),
                                backgroundColor: COLORS.red,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.axisLabelText}>{item.day}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>

            {/* Sales/Expense Totals */}
            <View style={styles.totalsRow}>
              <View style={styles.totalItem}>
                <View style={styles.iconBoxGreen}>
                  <ArrowUpRight color={COLORS.green} size={20} />
                </View>
                <Text style={styles.totalLabel}>Sales</Text>
                <Text style={styles.totalValueGreen}>
                  ₱
                  {periodTotals.sales.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>

              <View style={styles.totalItem}>
                <View style={styles.iconBoxRed}>
                  <ArrowDownRight color={COLORS.red} size={20} />
                </View>
                <Text style={styles.totalLabel}>Expenses</Text>
                <Text style={styles.totalValueRed}>
                  ₱
                  {periodTotals.expenses.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
            </View>

            {salesExpenseAnalysisText && (
              <Text style={styles.analysisTextCentered}>
                {salesExpenseAnalysisText}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 30,
    backgroundColor: COLORS.primaryBlue,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  welcomeText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
  },
  subWelcomeText: {
    color: "#ccddee",
    fontSize: 12,
  },
  headerIcons: {
    flexDirection: "row",
  },
  iconCircle: {
    backgroundColor: COLORS.white,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  card: {
    backgroundColor: COLORS.white,
    width: "48%",
    borderRadius: 12,
    padding: 15,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  cardLabel: {
    color: COLORS.textGray,
    fontSize: 11,
    marginLeft: 4,
  },
  amountText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  highlightCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  highlightItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: 10,
  },
  iconBoxBlue: {
    backgroundColor: "#89b3eb",
    padding: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  highlightLabel: {
    fontSize: 10,
    color: COLORS.textGray,
    marginBottom: 2,
  },
  highlightPeriodLabel: {
    fontSize: 9,
    color: COLORS.primaryBlue,
    fontStyle: "italic",
  },
  highlightValue: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textDark,
  },

  // Main Content
  mainContent: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 35,
    paddingBottom: 100,
    marginTop: -15,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 4,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  activeTab: {
    flex: 1,
    backgroundColor: COLORS.primaryBlue,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: "center",
  },
  inactiveTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTabText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 13,
  },
  inactiveTabText: {
    color: COLORS.primaryBlue,
    fontSize: 13,
  },

  // Charts
  chartCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  chartDateRange: {
    fontSize: 10,
    color: COLORS.primaryBlue,
    marginTop: 2,
    fontWeight: "500",
  },
  chartLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primaryBlue,
  },
  legendText: {
    fontSize: 10,
    color: COLORS.textGray,
  },
  graphContainer: {
    flexDirection: "row",
    height: 200,
    marginBottom: 10,
  },
  yAxis: {
    justifyContent: "space-between",
    paddingBottom: 22,
    paddingRight: 8,
    height: 180,
    minWidth: 32,
  },
  axisText: {
    fontSize: 9,
    color: COLORS.textGray,
    textAlign: "right",
    fontWeight: "500",
  },
  axisLabelText: {
    marginTop: 6,
    fontSize: 9,
    color: COLORS.textGray,
    fontWeight: "500",
  },
  scrollPlot: {
    flex: 1,
  },
  plotArea: {
    flex: 1,
    height: 180,
    position: "relative",
    borderLeftWidth: 1,
    borderLeftColor: "#dde5ed",
    borderBottomWidth: 1,
    borderBottomColor: "#dde5ed",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.04)",
  },

  // Line Chart Specifics
  pointsContainer: {
    position: "relative",
    alignItems: "center",
    paddingBottom: 25,
  },
  xAxisLabels: {
    position: "relative",
    height: 20,
    marginTop: -8,
  },
  pointWrapper: {
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primaryBlue,
    position: "absolute",
    zIndex: 10,
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  connectingLine: {
    position: "absolute",
    backgroundColor: COLORS.primaryBlue,
    height: 2,
    zIndex: 5,
  },

  // Bar Chart Specifics
  barContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: "100%",
    paddingHorizontal: 5,
    paddingBottom: 2,
  },
  barGroup: {
    alignItems: "center",
  },
  barsWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 140,
    gap: 3,
  },
  bar: {
    width: 10,
    borderRadius: 5,
    minHeight: 2,
  },
  dayText: {
    marginTop: 8,
    fontSize: 9,
    color: COLORS.textGray,
    fontWeight: "500",
  },

  // Summaries
  profitSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  profitLabel: {
    color: COLORS.textDark,
    fontWeight: "600",
    fontSize: 14,
  },
  profitValue: {
    color: COLORS.primaryBlue,
    fontWeight: "700",
    fontSize: 16,
  },
  analysisText: {
    textAlign: "center",
    fontSize: 10,
    color: COLORS.textGray,
  },
  analysisTextCentered: {
    textAlign: "center",
    fontSize: 10,
    color: COLORS.textGray,
    marginTop: 15,
    paddingHorizontal: 10,
  },

  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  totalItem: {
    alignItems: "center",
  },
  iconBoxGreen: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.green,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  iconBoxRed: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.red,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 12,
    color: COLORS.textDark,
    fontWeight: "600",
  },
  totalValueGreen: {
    fontSize: 16,
    color: COLORS.green,
    fontWeight: "700",
    marginTop: 2,
  },
  totalValueRed: {
    fontSize: 16,
    color: COLORS.red,
    fontWeight: "700",
    marginTop: 2,
  },

  // Target Income Card
  targetCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 15,
    marginTop: 15,
  },
  targetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  targetTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  targetProgress: {
    marginBottom: 15,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.borderLight,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  targetStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  targetStat: {
    flex: 1,
    alignItems: "center",
  },
  targetStatLabel: {
    fontSize: 10,
    color: COLORS.textGray,
    marginBottom: 4,
  },
  targetStatValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  targetMessage: {
    marginTop: 12,
    fontSize: 11,
    color: COLORS.red,
    textAlign: "center",
    fontWeight: "600",
  },
  targetMessageSuccess: {
    marginTop: 12,
    fontSize: 11,
    color: COLORS.green,
    textAlign: "center",
    fontWeight: "600",
  },
  targetMessageOnTrack: {
    marginTop: 12,
    fontSize: 11,
    color: COLORS.primaryBlue,
    textAlign: "center",
    fontWeight: "600",
  },
});
