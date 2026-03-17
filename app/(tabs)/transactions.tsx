import { HelpTooltip } from "@/components/HelpTooltip";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useMutation } from "convex/react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  Coins,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { OfflineIndicator } from "../components/OfflineIndicator";
import { SyncBadge } from "../components/SyncBadge";
import { useAuth } from "../context/AuthContext";
import {
  useAllTransactions,
  useFinancialSummary,
} from "../hooks/useOfflineQueries";

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
  borderLight: "#e5e7eb",
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

interface ExpenseSummary {
  receiptNumber: string;
  category: string;
  totalItems: number;
  totalAmount: string;
  hasReceiptImage: boolean;
  receiptImageUrl?: string;
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
  expenseSummary?: ExpenseSummary;
  isPending?: boolean;
  mutationStatus?: string;
  errorMessage?: string;
}

export default function TransactionScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const softDeleteSale = useMutation(api.sales.softDeleteSale);
  const softDeleteExpense = useMutation(api.expenses.softDeleteExpense);

  const handleMoveToTrash = (item: Transaction) => {
    Alert.alert(
      "Move to Trash?",
      `${item.transactionId} will be moved to trash and can be recovered within 90 days.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move to Trash",
          style: "destructive",
          onPress: async () => {
            try {
              if (item.type === "income") {
                await softDeleteSale({ id: item.id as Id<"sales"> });
              } else {
                await softDeleteExpense({ id: item.id as Id<"expenses"> });
              }
            } catch {
              Alert.alert(
                "Error",
                "Failed to delete transaction. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  // Date filter state - default to today
  const makeToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const makeTomorrow = (from: Date) => {
    const d = new Date(from);
    d.setDate(d.getDate() + 1);
    return d;
  };

  const [startDate, setStartDate] = useState<Date>(makeToday);
  const [endDate, setEndDate] = useState<Date>(() => makeTomorrow(makeToday()));
  const [isAllTime, setIsAllTime] = useState(false);
  // Track whether user has set a custom filter; if not, refresh to today on focus
  const [hasCustomFilter, setHasCustomFilter] = useState(false);

  // Refresh "today" filter when tab gains focus so dates never go stale
  useFocusEffect(
    useCallback(() => {
      if (!hasCustomFilter) {
        const t = makeToday();
        setStartDate(t);
        setEndDate(makeTomorrow(t));
        setIsAllTime(false);
      }
    }, [hasCustomFilter]),
  );
  const [showDateFilter, setShowDateFilter] = useState(false);
  // Which date is currently being picked: null = none, "start" = from, "end" = to
  const [activePicker, setActivePicker] = useState<"start" | "end" | null>(
    null,
  );

  // Helper function to parse transaction date
  // Handles backend format: "Feb/25/2026" → local midnight for correct comparison
  const parseTransactionDate = (dateStr: string): Date | null => {
    try {
      // Handle "MMM/DD/YYYY" format from backend (e.g. "Feb/25/2026")
      const monthNames: Record<string, number> = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11,
      };
      const named = dateStr.match(/^(\w{3})\/(\d{1,2})\/(\d{4})$/);
      if (named) {
        const month = monthNames[named[1]];
        if (month !== undefined) {
          return new Date(parseInt(named[3]), month, parseInt(named[2]));
        }
      }
      // Fallback: try native parse
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        // Strip time so comparison is date-only
        return new Date(
          parsed.getFullYear(),
          parsed.getMonth(),
          parsed.getDate(),
        );
      }
      return null;
    } catch {
      return null;
    }
  };

  // Frontend pagination state
  const ITEMS_PER_PAGE = 15;
  const [currentPage, setCurrentPage] = useState(1);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  // Fetch all transactions with offline caching
  const { data: allData } = useAllTransactions(user?.userId);

  // Update transactions when data arrives
  React.useEffect(() => {
    if (allData) {
      setAllTransactions(allData);
    }
  }, [allData]);

  // Fetch financial summary with offline caching
  const { data: financialSummary } = useFinancialSummary(user?.userId);

  // Calculate filtered totals based on date range
  const filteredTotals = useMemo(() => {
    let salesTotal = 0;
    let expenseTotal = 0;

    allTransactions.forEach((t) => {
      const txDate = parseTransactionDate(t.date);
      if (txDate && txDate >= startDate && txDate < endDate) {
        const amount = parseFloat(t.amount.replace(/[^0-9.-]+/g, ""));
        if (t.type === "income") {
          salesTotal += amount;
        } else {
          expenseTotal += amount;
        }
      }
    });

    return { salesTotal, expenseTotal };
  }, [allTransactions, startDate, endDate]);

  const formatDateDisplay = (date: Date) => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[date.getMonth()]}/${date.getDate()}/${date.getFullYear()}`;
  };

  // Quick date filter presets
  const applyDateFilter = (preset: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (preset) {
      case "today":
        setStartDate(now);
        setEndDate(tomorrow);
        setIsAllTime(false);
        setHasCustomFilter(false);
        break;
      case "yesterday":
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        setStartDate(yesterday);
        setEndDate(now);
        setIsAllTime(false);
        setHasCustomFilter(true);
        break;
      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        setStartDate(weekStart);
        setEndDate(tomorrow);
        setIsAllTime(false);
        setHasCustomFilter(true);
        break;
      case "month":
        const monthStart = new Date(now);
        monthStart.setDate(1);
        setStartDate(monthStart);
        setEndDate(tomorrow);
        setIsAllTime(false);
        setHasCustomFilter(true);
        break;
      case "all":
        // Use actual data range: oldest → newest transaction date
        {
          const dates = allTransactions
            .map((t) => parseTransactionDate(t.date))
            .filter((d): d is Date => d !== null);
          if (dates.length > 0) {
            const minDate = new Date(
              Math.min(...dates.map((d) => d.getTime())),
            );
            minDate.setHours(0, 0, 0, 0);
            const maxDate = new Date(
              Math.max(...dates.map((d) => d.getTime())),
            );
            maxDate.setHours(0, 0, 0, 0);
            maxDate.setDate(maxDate.getDate() + 1); // endDate is exclusive
            setStartDate(minDate);
            setEndDate(maxDate);
          } else {
            setStartDate(new Date(2020, 0, 1));
            setEndDate(new Date(now.getTime() + 86400000));
          }
          setIsAllTime(true);
        }
        setHasCustomFilter(true);
        break;
    }
    setActivePicker(null);
    setShowDateFilter(false);
  };

  const [filterType, setFilterType] = useState<TransactionType | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedReceiptImageUrl, setSelectedReceiptImageUrl] = useState<
    string | null
  >(null);

  // Reset page when date filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate]);

  const toggleFilter = (type: TransactionType) => {
    setFilterType((prev) => (prev === type ? "all" : type));
    setExpandedId(null);
  };

  const handleTransactionPress = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const totalFilteredItems = allTransactions
    ? allTransactions.filter((t) => {
        const txDate = parseTransactionDate(t.date);
        return txDate && txDate >= startDate && txDate < endDate;
      }).length
    : 0;

  const totalPages = Math.ceil(totalFilteredItems / ITEMS_PER_PAGE);
  const hasMore = currentPage < totalPages;

  const handleLoadMore = () => {
    if (hasMore) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleFirstPage = () => {
    setCurrentPage(1);
  };

  // Filter transactions and sort by date (newest first)
  const filteredTransactions = allTransactions
    ? allTransactions
        .filter((t) => {
          const txDate = parseTransactionDate(t.date);
          return txDate && txDate >= startDate && txDate < endDate;
        })
        .filter((t) => filterType === "all" || t.type === filterType)
        .sort((a, b) => {
          const dateA = parseTransactionDate(a.date)?.getTime() || 0;
          const dateB = parseTransactionDate(b.date)?.getTime() || 0;
          return dateB - dateA; // Sort newest first
        })
    : [];

  // Frontend pagination - slice the filtered transactions
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const renderItem = ({
    item,
  }: {
    item: Transaction & {
      isPending?: boolean;
      mutationStatus?: string;
      errorMessage?: string;
    };
  }) => {
    const isIncome = item.type === "income";
    const isExpanded = expandedId === item.id;
    const showExpenseSummary = !isIncome && Boolean(item.expenseSummary);

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
                <ShoppingBag color={COLORS.white} size={20} />
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
                  <View style={styles.txIdRow}>
                    <Text style={styles.txIdText}>{item.transactionId}</Text>
                  </View>
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
              </View>
            </View>
          </View>

          <View style={styles.expandButton}>
            <Text style={styles.expandButtonText}>
              {isExpanded ? "." : "."}
            </Text>
            <ChevronDown
              size={18}
              color={COLORS.primaryBlue}
              style={{
                transform: [{ rotate: isExpanded ? "180deg" : "0deg" }],
              }}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContainer}>
            <View style={styles.expandedDivider} />
            {showExpenseSummary ? (
              <>
                <Text style={styles.expandedTitle}>
                  Expenses Receipt Summary
                </Text>
                <View style={styles.expenseSummaryGrid}>
                  <View style={styles.expenseSummaryCard}>
                    <Text style={styles.summaryCardLabel}>
                      Receipt / Invoice No.
                    </Text>
                    <Text style={styles.summaryCardValue}>
                      {item.expenseSummary?.receiptNumber || "Not detected"}
                    </Text>
                  </View>
                  <View style={styles.expenseSummaryCard}>
                    <Text style={styles.summaryCardLabel}>Category</Text>
                    <Text style={styles.summaryCardValue}>
                      {item.expenseSummary?.category}
                    </Text>
                  </View>
                  <View style={styles.expenseSummaryCard}>
                    <Text style={styles.summaryCardLabel}>Total Items</Text>
                    <Text style={styles.summaryCardValue}>
                      {item.expenseSummary?.totalItems}
                    </Text>
                  </View>
                  <View style={styles.expenseSummaryCard}>
                    <Text style={styles.summaryCardLabel}>Total Amount</Text>
                    <Text style={styles.summaryCardValue}>
                      {item.expenseSummary?.totalAmount}
                    </Text>
                  </View>
                </View>
                <View style={styles.receiptNoteCard}>
                  <Text style={styles.receiptNoteTitle}>
                    Saved Receipt Image
                  </Text>
                  <Text style={styles.receiptNoteText}>
                    {item.expenseSummary?.hasReceiptImage
                      ? "Receipt image saved. It will be deleted automatically after 3 months."
                      : "No receipt image is available for this Expenses entry."}
                  </Text>
                  {item.expenseSummary?.receiptImageUrl ? (
                    <TouchableOpacity
                      style={styles.receiptPreviewButton}
                      onPress={() =>
                        setSelectedReceiptImageUrl(
                          item.expenseSummary?.receiptImageUrl || null,
                        )
                      }
                    >
                      <Text style={styles.receiptPreviewButtonText}>
                        View Receipt Image
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.expandedTitle}>Transaction Items</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.colName]}>
                    Name
                  </Text>
                  <Text style={[styles.tableHeaderText, styles.colCategory]}>
                    Category
                  </Text>
                  <Text style={[styles.tableHeaderText, styles.colPrice]}>
                    Price/pc
                  </Text>
                  <Text style={[styles.tableHeaderText, styles.colPcs]}>
                    Pcs
                  </Text>
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
              </>
            )}
            <TouchableOpacity
              style={styles.deleteRowBtn}
              onPress={() => handleMoveToTrash(item)}
            >
              <Trash2 size={14} color="#ef4444" />
              <Text style={styles.deleteRowBtnText}>Move to Trash</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Show loading state
  if (allData === undefined && allTransactions.length === 0) {
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

      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={COLORS.white} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transactions</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push("/trash" as any)}
          >
            <Trash2 color={COLORS.white} size={20} />
          </TouchableOpacity>
          <SyncBadge compact />
          <TouchableOpacity style={styles.headerButton}>
            <HelpTooltip
              title="Transactions Help"
              content="View all your income and expenses in one place. Filter by income or expenses, expand each item to see details, and track your daily, weekly, or monthly financial activity. Transactions are automatically organized by date."
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Body */}
      <View style={styles.contentContainer}>
        {/* Date Filter Button */}
        <View style={styles.dateFilterContainer}>
          <TouchableOpacity
            style={styles.dateFilterButton}
            onPress={() => setShowDateFilter(true)}
          >
            <Calendar size={16} color={COLORS.primaryBlue} />
            <Text style={styles.dateFilterText}>
              {isAllTime
                ? "All Time"
                : `${formatDateDisplay(startDate)} - ${formatDateDisplay(new Date(endDate.getTime() - 1))}`}
            </Text>
          </TouchableOpacity>
        </View>

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
              <Text style={styles.summaryLabel}>Sales</Text>
              <Text style={styles.summaryAmount}>
                ₱
                {filteredTotals.salesTotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
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
                {filteredTotals.expenseTotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Transaction List */}
        <FlatList
          data={paginatedTransactions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ListFooterComponent={() => (
            <View style={styles.paginationFooter}>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  currentPage === 1 && styles.paginationButtonDisabled,
                ]}
                onPress={handleFirstPage}
                disabled={currentPage === 1}
              >
                <Text
                  style={[
                    styles.paginationButtonText,
                    currentPage === 1 && styles.paginationButtonTextDisabled,
                  ]}
                >
                  First
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  currentPage === 1 && styles.paginationButtonDisabled,
                ]}
                onPress={handlePrevious}
                disabled={currentPage === 1}
              >
                <Text
                  style={[
                    styles.paginationButtonText,
                    currentPage === 1 && styles.paginationButtonTextDisabled,
                  ]}
                >
                  Prev
                </Text>
              </TouchableOpacity>

              <Text style={styles.pageIndicator}>
                Page {currentPage} of {totalPages || 1}
              </Text>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  !hasMore && styles.paginationButtonDisabled,
                ]}
                onPress={handleLoadMore}
                disabled={!hasMore}
              >
                <Text
                  style={[
                    styles.paginationButtonText,
                    !hasMore && styles.paginationButtonTextDisabled,
                  ]}
                >
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={() => {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const tmrw = new Date(now);
            tmrw.setDate(tmrw.getDate() + 1);
            const isToday =
              startDate.getTime() === now.getTime() &&
              endDate.getTime() === tmrw.getTime();
            return (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {allData === undefined
                    ? "Loading transactions..."
                    : isToday
                      ? "No transactions yet today"
                      : "No transactions found"}
                </Text>
                <Text style={styles.emptySubtext}>
                  {allData !== undefined &&
                    (isToday
                      ? "Start making sales or adding expenses to see them here."
                      : "Try adjusting your date filter.")}
                </Text>
              </View>
            );
          }}
        />
      </View>

      <Modal
        visible={Boolean(selectedReceiptImageUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReceiptImageUrl(null)}
      >
        <View style={styles.imageModalOverlay}>
          <View style={styles.imageModalCard}>
            <TouchableOpacity
              style={styles.imageModalClose}
              onPress={() => setSelectedReceiptImageUrl(null)}
            >
              <X size={20} color={COLORS.textDark} />
            </TouchableOpacity>
            {selectedReceiptImageUrl ? (
              <Image
                source={{ uri: selectedReceiptImageUrl }}
                style={styles.imageModalPreview}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Date Filter Modal */}
      <Modal
        visible={showDateFilter}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDateFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Date</Text>
              <TouchableOpacity onPress={() => setShowDateFilter(false)}>
                <X size={24} color={COLORS.textGray} />
              </TouchableOpacity>
            </View>

            <View style={styles.presetButtons}>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => applyDateFilter("today")}
              >
                <Text style={styles.presetButtonText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => applyDateFilter("yesterday")}
              >
                <Text style={styles.presetButtonText}>Yesterday</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => applyDateFilter("week")}
              >
                <Text style={styles.presetButtonText}>Last 7 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => applyDateFilter("month")}
              >
                <Text style={styles.presetButtonText}>This Month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => applyDateFilter("all")}
              >
                <Text style={styles.presetButtonText}>All Time</Text>
              </TouchableOpacity>
            </View>

            {/* Custom Date Range Selection */}
            <Text style={styles.customDateTitle}>Custom Range</Text>

            <View style={styles.dateRangeRow}>
              {/* From */}
              <TouchableOpacity
                style={styles.dateRangeButton}
                onPress={() => {
                  if (Platform.OS === "android") {
                    setShowDateFilter(false);
                    setActivePicker("start");
                  } else {
                    setActivePicker(activePicker === "start" ? null : "start");
                  }
                }}
              >
                <Text style={styles.dateRangeLabel}>From</Text>
                <View style={styles.dateRangeValueRow}>
                  <Calendar size={14} color={COLORS.primaryBlue} />
                  <Text style={styles.dateRangeValue}>
                    {formatDateDisplay(startDate)}
                  </Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.dateRangeSeparator}>—</Text>

              {/* To */}
              <TouchableOpacity
                style={styles.dateRangeButton}
                onPress={() => {
                  if (Platform.OS === "android") {
                    setShowDateFilter(false);
                    setActivePicker("end");
                  } else {
                    setActivePicker(activePicker === "end" ? null : "end");
                  }
                }}
              >
                <Text style={styles.dateRangeLabel}>To</Text>
                <View style={styles.dateRangeValueRow}>
                  <Calendar size={14} color={COLORS.primaryBlue} />
                  <Text style={styles.dateRangeValue}>
                    {formatDateDisplay(new Date(endDate.getTime() - 1))}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Inline spinner on iOS */}
            {Platform.OS === "ios" && activePicker === "start" && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="spinner"
                maximumDate={new Date(endDate.getTime() - 86400000)}
                onChange={(_: DateTimePickerEvent, date?: Date) => {
                  if (date) {
                    setStartDate(date);
                    setIsAllTime(false);
                  }
                }}
                style={{ alignSelf: "center" }}
              />
            )}
            {Platform.OS === "ios" && activePicker === "end" && (
              <DateTimePicker
                value={new Date(endDate.getTime() - 1)}
                mode="date"
                display="spinner"
                minimumDate={new Date(startDate.getTime() + 86400000)}
                onChange={(_: DateTimePickerEvent, date?: Date) => {
                  if (date) {
                    const next = new Date(date);
                    next.setDate(next.getDate() + 1);
                    next.setHours(0, 0, 0, 0);
                    setEndDate(next);
                    setIsAllTime(false);
                  }
                }}
                style={{ alignSelf: "center" }}
              />
            )}

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => {
                setActivePicker(null);
                setShowDateFilter(false);
              }}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Android native date dialogs */}
      {Platform.OS === "android" && activePicker === "start" && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          maximumDate={new Date(endDate.getTime() - 86400000)}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setActivePicker(null);
            setShowDateFilter(true);
            if (event.type === "set" && date) {
              setStartDate(date);
              setIsAllTime(false);
            }
          }}
        />
      )}
      {Platform.OS === "android" && activePicker === "end" && (
        <DateTimePicker
          value={new Date(endDate.getTime() - 1)}
          mode="date"
          display="default"
          minimumDate={new Date(startDate.getTime() + 86400000)}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setActivePicker(null);
            setShowDateFilter(true);
            if (event.type === "set" && date) {
              const next = new Date(date);
              next.setDate(next.getDate() + 1);
              next.setHours(0, 0, 0, 0);
              setEndDate(next);
              setIsAllTime(false);
            }
          }}
        />
      )}
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    paddingBottom: 20,
  },
  paginationFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 25,
    paddingBottom: 100,
    gap: 15,
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
  expandButton: {
    paddingLeft: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  expandButtonText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primaryBlue,
    marginBottom: 2,
  },
  expandedContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  expandedTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 10,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginBottom: 12,
  },
  expenseSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  expenseSummaryCard: {
    width: "48%",
    backgroundColor: COLORS.lightBlueBg,
    borderRadius: 10,
    padding: 10,
  },
  summaryCardLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primaryBlue,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryCardValue: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  receiptNoteCard: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#eef6ff",
    padding: 12,
    borderWidth: 1,
    borderColor: "#d7e3f1",
  },
  receiptNoteTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primaryBlue,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  receiptNoteText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textDark,
  },
  receiptPreviewButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: COLORS.primaryBlue,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  receiptPreviewButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  imageModalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "80%",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
  },
  imageModalClose: {
    alignSelf: "flex-end",
    padding: 4,
  },
  imageModalPreview: {
    width: "100%",
    height: 420,
    borderRadius: 12,
    backgroundColor: COLORS.lightBlueBg,
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
  deleteRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 4,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 8,
  },
  deleteRowBtnText: {
    fontSize: 12,
    color: "#ef4444",
    fontWeight: "500",
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
  loadingMore: {
    paddingVertical: 20,
    alignItems: "center",
  },
  loadingMoreText: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  // Pending transaction styles
  pendingCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryBlue,
    backgroundColor: "#f8faff",
  },
  pendingIconCircle: {
    backgroundColor: "#3b6ea5", // Darker blue for pending
    opacity: 0.8,
  },
  txIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  syncIndicator: {
    marginLeft: 4,
  },
  pendingText: {
    fontSize: 11,
    color: COLORS.primaryBlue,
    fontStyle: "italic",
    marginTop: 2,
  },
  syncedText: {
    color: COLORS.green,
    fontStyle: "normal",
  },
  // Date filter styles
  dateFilterContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  dateFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    alignSelf: "flex-start",
  },
  dateFilterText: {
    fontSize: 14,
    color: COLORS.primaryBlue,
    fontWeight: "600",
  },
  // Modal styles
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  presetButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  presetButton: {
    backgroundColor: COLORS.lightBlueBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  presetButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primaryBlue,
  },
  dateDisplay: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: COLORS.lightBlueBg,
    padding: 16,
    borderRadius: 12,
  },
  dateDisplayItem: {
    alignItems: "center",
  },
  dateDisplayLabel: {
    fontSize: 12,
    color: COLORS.textGray,
    marginBottom: 4,
  },
  dateDisplayValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  customDateTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 12,
    marginTop: 8,
  },
  datePickerButton: {
    padding: 8,
  },
  dateNavButton: {
    fontSize: 16,
    color: COLORS.primaryBlue,
    fontWeight: "700",
  },
  applyButton: {
    backgroundColor: COLORS.primaryBlue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  applyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 8,
  },
  dateRangeButton: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  dateRangeLabel: {
    fontSize: 11,
    color: COLORS.textGray,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  dateRangeValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dateRangeValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primaryBlue,
  },
  dateRangeSeparator: {
    fontSize: 18,
    color: COLORS.textGray,
    fontWeight: "300",
    paddingBottom: 4,
  },
  // Pagination styles
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  paginationButton: {
    backgroundColor: COLORS.primaryBlue,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 75,
    alignItems: "center",
  },
  paginationButtonDisabled: {
    backgroundColor: COLORS.borderLight,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.white,
  },
  paginationButtonTextDisabled: {
    color: COLORS.textGray,
  },
  pageIndicator: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
  },
});
