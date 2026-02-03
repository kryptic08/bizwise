import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  Coins,
  HelpCircle,
  Utensils,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../context/AuthContext";

// --- Colors (Consistent with Dashboard) ---
const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#9ca3af",
  green: "#2ecc71", // For income/positive
  red: "#ff5c5c", // For expense/negative
  iconBlueBg: "#89b3eb", // Light blue circle for list icons
};

// --- Types ---
type TransactionType = "income" | "expense";

interface ItemDetail {
  name: string;
  category: string;
  pricePerPiece: string;
  pieces: number;
  amount: string;
}

interface Transaction {
  id: string;
  transactionId: string;
  date: string;
  time: string;
  items: string;
  amount: string;
  type: TransactionType;
  createdAt: number;
  sortKey: number;
  itemDetails: ItemDetail[];
}

export default function TransactionScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Fetch transactions from Convex
  const combinedTransactions = useQuery(
    api.analytics.getCombinedTransactions,
    user?.userId ? { userId: user.userId } : "skip",
  );

  // Fetch financial summary for totals
  const financialSummary = useQuery(
    api.analytics.getFinancialSummary,
    user?.userId ? { userId: user.userId } : "skip",
  );

  // Seed sample transactions mutation
  const seedTransactions = useMutation(
    api.seedTransactions.seedSampleTransactions,
  );

  const [filterType, setFilterType] = useState<TransactionType | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debug: log transactions as they arrive
  console.log(
    "Received transactions:",
    combinedTransactions?.map((t) => ({
      type: t.type,
      id: t.transactionId,
      time: t.time,
      sortKey: t.sortKey,
    })),
  );

  const toggleFilter = (type: TransactionType) => {
    setFilterType((prev) => (prev === type ? "all" : type));
    setExpandedId(null);
  };

  const handleTransactionPress = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Filter transactions - data comes pre-sorted from backend by recency
  const filteredTransactions = combinedTransactions
    ? filterType === "all"
      ? combinedTransactions
      : combinedTransactions.filter((t) => t.type === filterType)
    : [];

  const renderItem = ({ item }: { item: Transaction }) => {
    const isIncome = item.type === "income";
    const isExpanded = expandedId === item.id;
    const itemCount =
      parseInt(item.items) || parseInt(item.items.split(" ")[0]) || 0;

    return (
      <View style={styles.transactionCard}>
        <TouchableOpacity
          style={styles.cardMainContent}
          onPress={() => handleTransactionPress(item.id)}
          activeOpacity={0.7}
        >
          {/* Icon Section */}
          <View style={styles.iconWrapper}>
            <View style={styles.iconCircle}>
              {isIncome ? (
                <Utensils color={COLORS.white} size={20} />
              ) : (
                <Coins color={COLORS.white} size={20} />
              )}
            </View>
          </View>

          {/* Details Section */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailsLeft}>
              <View style={styles.leftTopRow}>
                <View style={styles.leftTopLeft}>
                  <Text style={styles.txIdText}>{item.transactionId}</Text>
                  <View style={styles.itemsPill}>
                    <Text style={styles.itemsPillText}>{item.items}</Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.amountText,
                    { color: isIncome ? COLORS.green : COLORS.red },
                  ]}
                >
                  {item.amount}
                </Text>
              </View>
              <View style={styles.leftBottomRow}>
                <Text style={styles.dateText}>
                  {item.date} • {item.time}
                </Text>
                <View style={styles.typePill}>
                  <Text
                    style={[
                      styles.typePillText,
                      { color: isIncome ? COLORS.green : COLORS.red },
                    ]}
                  >
                    {item.type}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.chevronWrapper}>
            <ChevronDown
              size={18}
              color={COLORS.textGray}
              style={{
                transform: [{ rotate: isExpanded ? "180deg" : "0deg" }],
              }}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContainer}>
            <View style={styles.expandedDivider} />
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colName]}>Name</Text>
              <Text style={[styles.tableHeaderText, styles.colCategory]}>
                Category
              </Text>
              <Text style={[styles.tableHeaderText, styles.colPrice]}>
                Price/pc
              </Text>
              <Text style={[styles.tableHeaderText, styles.colPcs]}>Pcs</Text>
              <Text style={[styles.tableHeaderText, styles.colAmount]}>
                Amount
              </Text>
            </View>
            {item.itemDetails.map((detail, index) => (
              <View key={index} style={styles.tableRow}>
                <Text
                  style={[styles.tableCell, styles.colName]}
                  numberOfLines={1}
                >
                  {detail.name}
                </Text>
                <Text
                  style={[styles.tableCell, styles.colCategory]}
                  numberOfLines={1}
                >
                  {detail.category}
                </Text>
                <Text style={[styles.tableCell, styles.colPrice]}>
                  {detail.pricePerPiece}
                </Text>
                <Text style={[styles.tableCell, styles.colPcs]}>
                  {detail.pieces}
                </Text>
                <Text style={[styles.tableCellBold, styles.colAmount]}>
                  {detail.amount}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Show loading state
  if (combinedTransactions === undefined) {
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
        <Text style={{ color: COLORS.white, fontSize: 18 }}>
          Loading transactions...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryBlue}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={COLORS.white} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction</Text>
        <TouchableOpacity style={styles.headerButton}>
          <View style={styles.helpIconBg}>
            <HelpCircle color={COLORS.primaryBlue} size={18} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Main Content Body */}
      <View style={styles.contentContainer}>
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <TouchableOpacity
            style={[
              styles.summaryCard,
              filterType === "income" && styles.summaryCardActive,
            ]}
            onPress={() => toggleFilter("income")}
            activeOpacity={0.8}
          >
            <View style={styles.summaryIconContainer}>
              <View style={[styles.boxIcon, { borderColor: COLORS.green }]}>
                <ArrowUpRight color={COLORS.green} size={20} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryAmount}>
                ₱
                {financialSummary?.totalIncome?.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) ?? "0.00"}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.summaryCard,
              filterType === "expense" && styles.summaryCardActive,
            ]}
            onPress={() => toggleFilter("expense")}
            activeOpacity={0.8}
          >
            <View style={styles.summaryIconContainer}>
              <View style={[styles.boxIcon, { borderColor: COLORS.red }]}>
                <ArrowDownRight color={COLORS.red} size={20} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryAmount}>
                ₱
                {financialSummary?.totalExpense?.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) ?? "0.00"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Transaction List */}
        <FlatList
          data={filteredTransactions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {combinedTransactions === undefined
                  ? "Loading transactions..."
                  : "No transactions found"}
              </Text>
              <Text style={styles.emptySubtext}>
                {combinedTransactions !== undefined &&
                  "Start making sales or adding expenses to see them here."}
              </Text>
              {combinedTransactions !== undefined && (
                <TouchableOpacity
                  style={styles.seedButton}
                  onPress={async () => {
                    try {
                      const result = await seedTransactions();
                      console.log("Seed result:", result);
                    } catch (error) {
                      console.error("Error seeding transactions:", error);
                    }
                  }}
                >
                  <Text style={styles.seedButtonText}>
                    Add Sample Transactions
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
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
    paddingBottom: 15,
    backgroundColor: COLORS.primaryBlue,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
  },
  headerButton: {
    padding: 5,
  },
  helpIconBg: {
    backgroundColor: COLORS.white,
    borderRadius: 15, // Circle
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },

  // Content Body
  contentContainer: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
  },

  // Summary Cards
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 15,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  summaryCardActive: {
    borderColor: COLORS.primaryBlue,
  },
  summaryIconContainer: {
    marginRight: 10,
  },
  boxIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  summaryAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textDark,
  },

  // List
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  transactionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardMainContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
  },
  chevronWrapper: {
    paddingLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  expandedContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: COLORS.lightBlueBg,
    borderRadius: 6,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primaryBlue,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tableCell: {
    fontSize: 12,
    color: COLORS.textDark,
  },
  tableCellBold: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  colName: {
    flex: 2,
  },
  colCategory: {
    flex: 1.5,
  },
  colPrice: {
    flex: 1.2,
    textAlign: "right",
  },
  colPcs: {
    flex: 0.6,
    textAlign: "center",
  },
  colAmount: {
    flex: 1.2,
    textAlign: "right",
  },
  itemsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  itemsCountPill: {
    fontSize: 11,
    color: COLORS.textDark,
    backgroundColor: "#e5edf6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontWeight: "600",
  },
  itemChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  itemChip: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemChipText: {
    fontSize: 11,
    color: COLORS.textDark,
  },
  iconWrapper: {
    marginRight: 12,
  },
  iconCircle: {
    backgroundColor: COLORS.iconBlueBg, // The light blue circle from image
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  detailsContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailsLeft: {
    flex: 1,
  },
  detailsRight: {
    justifyContent: "center",
    alignItems: "flex-end",
    marginLeft: 12,
  },
  leftTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  leftTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  leftBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  txIdText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textDark,
    flexShrink: 1,
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textGray,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  typePillText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  itemsPill: {
    backgroundColor: COLORS.lightBlueBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 28,
    alignItems: "center",
  },
  itemsPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primaryBlue,
  },
  amountText: {
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 0,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textGray,
    textAlign: "center",
    lineHeight: 20,
  },
  seedButton: {
    backgroundColor: COLORS.primaryBlue,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  seedButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
