import { HelpTooltip } from "@/components/HelpTooltip";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "convex/react";
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
import Svg, { Circle, G, Line } from "react-native-svg";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../context/AuthContext";
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

  // Fetch financial data from Convex
  const financialSummary = useQuery(
    api.analytics.getFinancialSummary,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const dailyAnalytics = useQuery(
    api.analytics.getDailyAnalytics,
    user?.userId ? { days: 7, userId: user.userId } : "skip",
  );
  const weeklyAnalytics = useQuery(
    api.analytics.getWeeklyAnalytics,
    user?.userId ? { weeks: 7, userId: user.userId } : "skip",
  );
  const monthlyAnalytics = useQuery(
    api.analytics.getMonthlyAnalytics,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const topProduct = useQuery(
    api.analytics.getTopSellingProduct,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const topCategory = useQuery(
    api.analytics.getTopSellingCategory,
    user?.userId ? { userId: user.userId } : "skip",
  );
  const targetProgress = useQuery(
    api.analytics.getTargetProgress,
    user?.userId ? { userId: user.userId } : "skip",
  );

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

  // Format the analytics based on active tab
  const chartData = useMemo(() => {
    let rawData: Array<{ day: string; income: number; expense: number }> = [];

    if (activeTab === "Daily") {
      if (!dailyAnalytics) return INCOME_EXPENSE_DATA;
      rawData = dailyAnalytics.slice(-7).map((day) => ({
        day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
          new Date(day.date).getDay()
        ],
        income: day.income,
        expense: day.expense,
      }));
    } else if (activeTab === "Weekly") {
      if (!weeklyAnalytics) return INCOME_EXPENSE_DATA;
      rawData = weeklyAnalytics.slice(-7).map((week, index) => ({
        day: `W${index + 1}`,
        income: week.income,
        expense: week.expense,
      }));
    } else {
      // Monthly
      if (!monthlyAnalytics) return INCOME_EXPENSE_DATA.slice(0, 6);
      rawData = monthlyAnalytics.slice(-6).map((month) => ({
        day: month.month,
        income: month.income,
        expense: month.expense,
      }));
    }

    // Return raw data with actual values (no scaling)
    return rawData.map((d) => ({
      day: d.day,
      inc: d.income,
      exp: d.expense,
    }));
  }, [activeTab, dailyAnalytics, weeklyAnalytics, monthlyAnalytics]);

  // Calculate max value for income/expense chart Y-axis (round up to nearest 500)
  const incomeExpenseMaxValue = useMemo(() => {
    const maxValue = Math.max(
      ...chartData.map((d) => Math.max(d.inc, d.exp)),
      1, // Avoid division by zero
    );
    // Round up to nearest 500, with minimum of 1500
    const roundedMax = Math.ceil(maxValue / 500) * 500;
    return Math.max(roundedMax, 1500); // Minimum scale of 1500 to show 1500, 1000, 500, 0
  }, [chartData]);

  // Calculate Y-axis labels for income/expense chart (increments of 500)
  // Display from top to bottom: max, ..., 0
  const incomeExpenseYLabels = useMemo(() => {
    const max = incomeExpenseMaxValue;
    // Return labels in descending order (top to bottom): [max, max-500, max-1000, 0]
    return [max, max - 500, max - 1000, 0];
  }, [incomeExpenseMaxValue]);

  // Format profit data based on active tab
  const profitChartData = useMemo(() => {
    let profits: number[] = [];

    if (activeTab === "Daily") {
      if (!dailyAnalytics) return PROFIT_DATA;
      profits = dailyAnalytics.slice(-7).map((day) => day.income - day.expense);
    } else if (activeTab === "Weekly") {
      if (!weeklyAnalytics) return PROFIT_DATA;
      profits = weeklyAnalytics
        .slice(-7)
        .map((week) => week.income - week.expense);
    } else {
      // Monthly
      if (!monthlyAnalytics) return PROFIT_DATA.slice(0, 6);
      profits = monthlyAnalytics
        .slice(-6)
        .map((month) => month.income - month.expense);
    }

    // Return actual profit values (no scaling)
    return profits.map((profit) => Math.max(0, profit));
  }, [activeTab, dailyAnalytics, weeklyAnalytics, monthlyAnalytics]);

  // Calculate max value for profit chart Y-axis (round up to nearest 500)
  const profitMaxValue = useMemo(() => {
    const maxValue = Math.max(...profitChartData, 1); // Avoid division by zero
    // Round up to nearest 500, with minimum of 1500
    const roundedMax = Math.ceil(maxValue / 500) * 500;
    return Math.max(roundedMax, 1500); // Minimum scale of 1500 to show 1500, 1000, 500, 0
  }, [profitChartData]);

  // Calculate Y-axis labels for profit chart (increments of 500)
  // Display from top to bottom: max, ..., 0
  const profitYLabels = useMemo(() => {
    const max = profitMaxValue;
    // Return labels in descending order (top to bottom): [max, max-500, max-1000, 0]
    return [max, max - 500, max - 1000, 0];
  }, [profitMaxValue]);

  // Get labels for x-axis based on active tab
  const chartLabels = useMemo(() => {
    if (activeTab === "Daily") {
      if (!dailyAnalytics)
        return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return dailyAnalytics
        .slice(-7)
        .map(
          (day) =>
            ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
              new Date(day.date).getDay()
            ],
        );
    } else if (activeTab === "Weekly") {
      return ["W1", "W2", "W3", "W4", "W5", "W6", "W7"];
    } else {
      return monthlyAnalytics
        ? monthlyAnalytics.slice(-6).map((m) => m.month)
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

      const growthRate =
        firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

      if (growthRate > 15) {
        return `🎉 Excellent! Profit grew by ${Math.round(growthRate)}% this period. Keep up the great work!`;
      } else if (growthRate > 5) {
        return `📈 Good progress! Profit increased by ${Math.round(growthRate)}% with steady growth.`;
      } else if (growthRate > -5) {
        return `✅ Profit is stable. Consistent performance this period!`;
      } else if (growthRate > -15) {
        return `⚠️ Profit decreased by ${Math.abs(Math.round(growthRate))}%. Consider reviewing expenses.`;
      } else {
        return `📉 Profit down by ${Math.abs(Math.round(growthRate))}%. Focus on boosting sales and reducing costs.`;
      }
    }

    // Fallback for shorter data sets
    if (avgProfit > 1000) {
      return "✅ Strong profit performance! Keep maintaining this momentum.";
    } else if (avgProfit > 0) {
      return "📊 Positive profit. Continue optimizing your operations.";
    } else {
      return "";
    }
  }, [profitChartData]);

  // Generate dynamic income/expense analysis text
  const incomeExpenseAnalysisText = useMemo(() => {
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

    // Income trend
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
            return firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
          })()
        : 0;

    // Generate insights
    if (profitMargin > 50) {
      return `🌟 Excellent financial control! ${Math.round(profitMargin)}% profit margin with well-managed expenses.`;
    } else if (profitMargin > 30) {
      return `💰 Great balance! Income is ${incomeGrowth > 0 ? "growing" : "stable"} while expenses remain controlled.`;
    } else if (profitMargin > 10) {
      return `📊 Healthy finances with ${Math.round(profitMargin)}% profit margin. Room for optimization.`;
    } else if (profitMargin > 0) {
      return `⚠️ Tight margins at ${Math.round(profitMargin)}%. Consider reducing expenses or increasing income.`;
    } else if (totalExpense > totalIncome) {
      return `🚨 Expenses exceed income by ₱${Math.abs(totalExpense - totalIncome).toFixed(0)}. Take action to balance finances.`;
    } else {
      return "📈 Keep tracking your finances for better insights over time.";
    }
  }, [chartData]);

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

          {/* Balance Cards */}
          <View style={styles.balanceRow}>
            <Pressable
              style={styles.card}
              onPress={() => handleCardPress("balance")}
              android_ripple={{ color: "rgba(59, 110, 165, 0.1)" }}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <View style={styles.cardHeader}>
                  <Wallet size={14} color={COLORS.textGray} />
                  <Text style={styles.cardLabel}> Total Balance</Text>
                </View>
                <Text
                  style={[styles.amountText, { color: COLORS.primaryBlue }]}
                >
                  ₱
                  {financialSummary
                    ? financialSummary.totalBalance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "0.00"}
                </Text>
              </Animated.View>
            </Pressable>
            <Pressable
              style={styles.card}
              onPress={() => handleCardPress("expense")}
              android_ripple={{ color: "rgba(59, 110, 165, 0.1)" }}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <View style={styles.cardHeader}>
                  <Receipt size={14} color={COLORS.textGray} />
                  <Text style={styles.cardLabel}> Total Expense</Text>
                </View>
                <Text style={[styles.amountText, { color: COLORS.textDark }]}>
                  ₱
                  {financialSummary
                    ? financialSummary.totalExpense.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "0.00"}
                </Text>
              </Animated.View>
            </Pressable>
          </View>

          {/* Highlights */}
          <View style={styles.highlightCard}>
            <View style={styles.highlightItem}>
              <View style={styles.iconBoxBlue}>
                <Utensils color={COLORS.white} size={16} />
              </View>
              <View>
                <Text style={styles.highlightLabel}>Top selling product</Text>
                <Text style={styles.highlightValue}>
                  {topProduct?.name
                    ? toSentenceCase(topProduct.name)
                    : "No sales yet"}
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
                <Text style={styles.highlightValue}>
                  {topCategory?.name
                    ? toSentenceCase(topCategory.name)
                    : "No sales yet"}
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
            <Text style={styles.chartTitle}>Profit</Text>

            {/* Visual Line Chart Mockup */}
            <View style={styles.graphContainer}>
              {/* Y-Axis Labels */}
              <View style={styles.yAxis}>
                <Text style={styles.axisText}>{profitYLabels[0]}</Text>
                <Text style={styles.axisText}>{profitYLabels[1]}</Text>
                <Text style={styles.axisText}>{profitYLabels[2]}</Text>
                <Text style={styles.axisText}>{profitYLabels[3]}</Text>
              </View>

              {/* Chart Area */}
              <View style={styles.plotArea}>
                {/* Horizontal Grid Lines */}
                {[1, 2, 3, 4].map((_, i) => (
                  <View
                    key={i}
                    style={[styles.gridLine, { bottom: i * 35 + 25 }]}
                  />
                ))}

                {/* Plot Points & Lines with SVG */}
                <View style={styles.pointsContainer}>
                  {(() => {
                    const chartWidth = SCREEN_WIDTH - 100; // Account for padding and y-axis
                    const chartHeight = 120;
                    const paddingX = 20;
                    const paddingY = 10;
                    const totalPoints = profitChartData.length;
                    const availableWidth = chartWidth - paddingX * 2;
                    const spacing =
                      totalPoints > 1
                        ? availableWidth / (totalPoints - 1)
                        : availableWidth;

                    // Calculate points (scale based on max value)
                    const points = profitChartData.map((val, index) => ({
                      x:
                        paddingX +
                        (totalPoints > 1
                          ? index * spacing
                          : availableWidth / 2),
                      y:
                        paddingY +
                        chartHeight -
                        (val / profitMaxValue) * chartHeight,
                    }));

                    return (
                      <>
                        <Svg
                          width={chartWidth}
                          height={chartHeight + paddingY * 2}
                        >
                          <G>
                            {/* Draw lines between points */}
                            {points.map((point, index) => {
                              if (index === 0) return null;
                              const prevPoint = points[index - 1];
                              return (
                                <Line
                                  key={`line-${index}`}
                                  x1={prevPoint.x}
                                  y1={prevPoint.y}
                                  x2={point.x}
                                  y2={point.y}
                                  stroke={COLORS.primaryBlue}
                                  strokeWidth={2.5}
                                  strokeLinecap="round"
                                />
                              );
                            })}
                            {/* Draw circles at each point */}
                            {points.map((point, index) => (
                              <Circle
                                key={`circle-${index}`}
                                cx={point.x}
                                cy={point.y}
                                r={6}
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
                              key={`label-${index}`}
                              style={[
                                styles.dayText,
                                {
                                  position: "absolute",
                                  left: point.x - 12,
                                  width: 24,
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
            </View>

            {/* Profit Summary */}
            <View style={styles.profitSummary}>
              <Coins color={COLORS.primaryBlue} size={24} />
              <Text style={styles.profitLabel}> Total Profit</Text>
              <Text style={styles.profitValue}>
                {" "}
                ₱
                {financialSummary
                  ? financialSummary.profit.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "0.00"}
              </Text>
            </View>
            {profitAnalysisText && (
              <Text style={styles.analysisText}>{profitAnalysisText}</Text>
            )}
          </View>

          {/* Income & Expenses Section */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Income & Expenses</Text>

            {/* Bar Chart */}
            <View style={styles.graphContainer}>
              <View style={styles.yAxis}>
                <Text style={styles.axisText}>{incomeExpenseYLabels[0]}</Text>
                <Text style={styles.axisText}>{incomeExpenseYLabels[1]}</Text>
                <Text style={styles.axisText}>{incomeExpenseYLabels[2]}</Text>
                <Text style={styles.axisText}>{incomeExpenseYLabels[3]}</Text>
              </View>

              <View style={styles.plotArea}>
                {/* Horizontal Grid Lines */}
                {[1, 2, 3, 4].map((_, i) => (
                  <View
                    key={i}
                    style={[styles.gridLine, { bottom: i * 35 + 25 }]}
                  />
                ))}

                <View style={styles.barContainer}>
                  {chartData.map((item, index) => (
                    <View key={index} style={styles.barGroup}>
                      <View style={styles.barsWrapper}>
                        {/* Green Bar (Income) */}
                        <View
                          style={[
                            styles.bar,
                            {
                              height: (item.inc / incomeExpenseMaxValue) * 140,
                              backgroundColor: COLORS.green,
                            },
                          ]}
                        />
                        {/* Red Bar (Expense) */}
                        <View
                          style={[
                            styles.bar,
                            {
                              height: (item.exp / incomeExpenseMaxValue) * 140,
                              backgroundColor: COLORS.red,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.dayText}>{item.day}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Income/Expense Totals */}
            <View style={styles.totalsRow}>
              <View style={styles.totalItem}>
                <View style={styles.iconBoxGreen}>
                  <ArrowUpRight color={COLORS.green} size={20} />
                </View>
                <Text style={styles.totalLabel}>Income</Text>
                <Text style={styles.totalValueGreen}>
                  ₱
                  {financialSummary
                    ? financialSummary.totalIncome.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "0.00"}
                </Text>
              </View>

              <View style={styles.totalItem}>
                <View style={styles.iconBoxRed}>
                  <ArrowDownRight color={COLORS.red} size={20} />
                </View>
                <Text style={styles.totalLabel}>Expense</Text>
                <Text style={styles.totalValueRed}>
                  ₱
                  {financialSummary
                    ? financialSummary.totalExpense.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "0.00"}
                </Text>
              </View>
            </View>

            {incomeExpenseAnalysisText && (
              <Text style={styles.analysisTextCentered}>
                {incomeExpenseAnalysisText}
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
    backgroundColor: COLORS.tabBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 15,
  },
  graphContainer: {
    flexDirection: "row",
    height: 180,
    marginBottom: 10,
  },
  yAxis: {
    justifyContent: "space-between",
    paddingBottom: 20,
    paddingRight: 10,
    height: 160,
  },
  axisText: {
    fontSize: 10,
    color: COLORS.textGray,
    textAlign: "right",
  },
  plotArea: {
    flex: 1,
    height: 160,
    position: "relative",
    borderLeftWidth: 1,
    borderLeftColor: COLORS.textGray,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.textGray,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
  },

  // Line Chart Specifics
  pointsContainer: {
    position: "relative",
    alignItems: "center",
    paddingBottom: 30,
  },
  xAxisLabels: {
    position: "relative",
    height: 20,
    marginTop: -5,
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
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: "100%",
    paddingHorizontal: 5,
  },
  barGroup: {
    alignItems: "center",
  },
  barsWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 140,
    gap: 4,
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
  dayText: {
    marginTop: 8,
    fontSize: 10,
    color: COLORS.textGray,
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
