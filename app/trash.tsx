import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckSquare,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useAuth } from "./context/AuthContext";
import { useTrashTransactions } from "./hooks/useOfflineQueries";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
  green: "#22c55e",
  red: "#ef4444",
  orange: "#f97316",
  borderGray: "#e5e7eb",
};

type TrashItem = {
  id: string;
  transactionId: string;
  type: "income" | "expense";
  amount: string;
  date: string;
  deletedAt: number;
  trashedDate: string;
  daysRemaining: number;
};

export default function TrashScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: trashItems } = useTrashTransactions(user?.userId);
  const items = (trashItems ?? []) as TrashItem[];
  const promptedExpiredKeyRef = useRef("");
  const [expiredSelectionMode, setExpiredSelectionMode] = useState(false);
  const [selectedExpiredIds, setSelectedExpiredIds] = useState<string[]>([]);

  const purgeExpiredTrash = useMutation(api.analytics.purgeExpiredTrash);
  const restoreSale = useMutation(api.sales.restoreSale);
  const restoreExpense = useMutation(api.expenses.restoreExpense);
  const permanentDeleteSale = useMutation(api.sales.permanentDeleteSale);
  const permanentDeleteExpense = useMutation(
    api.expenses.permanentDeleteExpense,
  );

  const expiredItems = useMemo(
    () => items.filter((item) => item.daysRemaining <= 0),
    [items],
  );

  const selectedExpiredItems = useMemo(
    () => expiredItems.filter((item) => selectedExpiredIds.includes(item.id)),
    [expiredItems, selectedExpiredIds],
  );

  const restoreTransaction = async (item: TrashItem) => {
    if (item.type === "income") {
      await restoreSale({ id: item.id as Id<"sales"> });
      return;
    }
    await restoreExpense({ id: item.id as Id<"expenses"> });
  };

  const toggleExpiredSelection = (id: string) => {
    setSelectedExpiredIds((prev) =>
      prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id],
    );
  };

  const handleSelectAllExpired = () => {
    setSelectedExpiredIds(expiredItems.map((item) => item.id));
  };

  const handleClearExpiredSelection = () => {
    setSelectedExpiredIds([]);
  };

  const restoreExpiredItems = async (targets: TrashItem[]) => {
    for (const item of targets) {
      await restoreTransaction(item);
    }
  };

  const handleRestoreSelectedExpired = () => {
    if (selectedExpiredItems.length === 0) {
      Alert.alert("No Selection", "Select expired transactions to restore.");
      return;
    }

    Alert.alert(
      "Restore Selected Transactions?",
      `Restore ${selectedExpiredItems.length} expired transaction(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          onPress: async () => {
            try {
              await restoreExpiredItems(selectedExpiredItems);
              setSelectedExpiredIds([]);
              setExpiredSelectionMode(false);
            } catch {
              Alert.alert(
                "Error",
                "Failed to restore selected transactions. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const handleRestoreAllExpired = () => {
    if (expiredItems.length === 0) {
      Alert.alert("No Expired Transactions", "Nothing to restore.");
      return;
    }

    Alert.alert(
      "Restore All Expired Transactions?",
      `Restore all ${expiredItems.length} expired transaction(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore All",
          onPress: async () => {
            try {
              await restoreExpiredItems(expiredItems);
              setSelectedExpiredIds([]);
              setExpiredSelectionMode(false);
            } catch {
              Alert.alert(
                "Error",
                "Failed to restore expired transactions. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  // Background timer: automatically purge transactions that reached the TTL.
  useEffect(() => {
    if (!user?.userId) return;

    const timer = setInterval(() => {
      if (expiredSelectionMode) {
        return;
      }
      purgeExpiredTrash({ userId: user.userId as Id<"users"> }).catch(() => {});
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, [user?.userId, expiredSelectionMode]);

  useEffect(() => {
    if (expiredItems.length === 0) {
      setExpiredSelectionMode(false);
      setSelectedExpiredIds([]);
    }
  }, [expiredItems.length]);

  // Ask once per unique set of expired transactions.
  useEffect(() => {
    if (!user?.userId || expiredItems.length === 0) return;

    const key = expiredItems
      .map((item) => item.id)
      .sort()
      .join("|");
    if (!key || promptedExpiredKeyRef.current === key) return;
    promptedExpiredKeyRef.current = key;

    Alert.alert(
      "Expired Transactions",
      "Are you sure you don't want to restore the transactions? This will delete all expired transactions.",
      [
        {
          text: "No",
          style: "cancel",
          // No = let user choose which expired transactions to restore.
          onPress: () => {
            setExpiredSelectionMode(true);
            setSelectedExpiredIds([]);
          },
        },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            try {
              await purgeExpiredTrash({ userId: user.userId as Id<"users"> });
            } catch {
              Alert.alert(
                "Error",
                "Failed to delete expired transactions. Please try again.",
              );
            }
          },
        },
      ],
    );
  }, [expiredItems, user?.userId]);

  const handleRestore = (item: TrashItem) => {
    Alert.alert(
      "Restore Transaction?",
      `Restore ${item.transactionId} back to your transactions?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          onPress: async () => {
            try {
              await restoreTransaction(item);
            } catch {
              Alert.alert(
                "Error",
                "Failed to restore transaction. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const handlePermanentDelete = (item: TrashItem) => {
    Alert.alert(
      "Delete Permanently?",
      `This will permanently remove ${item.transactionId}. This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (item.type === "income") {
                await permanentDeleteSale({ id: item.id as Id<"sales"> });
              } else {
                await permanentDeleteExpense({ id: item.id as Id<"expenses"> });
              }
            } catch {
              Alert.alert("Error", "Failed to delete. Please try again.");
            }
          },
        },
      ],
    );
  };

  const getDaysColor = (days: number) => {
    if (days <= 3) return COLORS.red;
    if (days <= 7) return COLORS.orange;
    return COLORS.textGray;
  };

  const renderItem = ({ item }: { item: TrashItem }) => {
    const isExpired = item.daysRemaining <= 0;
    const isSelected = selectedExpiredIds.includes(item.id);

    return (
      <View
        style={[
          styles.card,
          expiredSelectionMode &&
            isExpired &&
            isSelected &&
            styles.selectedCard,
        ]}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <View
              style={[
                styles.typeBadge,
                {
                  backgroundColor:
                    item.type === "income" ? "#dcfce7" : "#fee2e2",
                },
              ]}
            >
              <Text
                style={[
                  styles.typeBadgeText,
                  { color: item.type === "income" ? COLORS.green : COLORS.red },
                ]}
              >
                {item.type === "income" ? "Income" : "Expenses"}
              </Text>
            </View>
            <Text style={styles.transactionId}>{item.transactionId}</Text>
          </View>
          <Text
            style={[
              styles.amount,
              { color: item.type === "income" ? COLORS.green : COLORS.red },
            ]}
          >
            {item.type === "expense" ? "-" : "+"}
            {item.amount}
          </Text>
        </View>

        {expiredSelectionMode && isExpired ? (
          <TouchableOpacity
            style={styles.selectRow}
            onPress={() => toggleExpiredSelection(item.id)}
          >
            {isSelected ? (
              <CheckSquare size={18} color={COLORS.primaryBlue} />
            ) : (
              <Square size={18} color={COLORS.textGray} />
            )}
            <Text style={styles.selectRowText}>Select for restore</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>Transaction date: {item.date}</Text>
          <Text style={styles.metaText}>Trashed: {item.trashedDate}</Text>
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.daysBadge}>
            <AlertTriangle
              size={12}
              color={getDaysColor(item.daysRemaining)}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.daysText,
                { color: getDaysColor(item.daysRemaining) },
              ]}
            >
              {item.daysRemaining === 0
                ? "Expires today"
                : `${item.daysRemaining}d remaining`}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.restoreBtn}
              onPress={() => handleRestore(item)}
            >
              <RotateCcw size={14} color={COLORS.primaryBlue} />
              <Text style={styles.restoreBtnText}>Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handlePermanentDelete(item)}
            >
              <Trash2 size={14} color={COLORS.red} />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

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
        <Text style={styles.headerTitle}>Trash Bin</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoBanner}>
          <AlertTriangle size={16} color={COLORS.orange} />
          <Text style={styles.infoBannerText}>
            Items are permanently deleted after 90 days
          </Text>
        </View>

        {expiredSelectionMode && expiredItems.length > 0 ? (
          <View style={styles.selectionPanel}>
            <Text style={styles.selectionTitle}>Expired Transactions</Text>
            <Text style={styles.selectionSubtitle}>
              Select expired transactions to restore, or restore all.
            </Text>
            <View style={styles.selectionActionsRow}>
              <TouchableOpacity
                style={styles.selectionSecondaryBtn}
                onPress={handleSelectAllExpired}
              >
                <Text style={styles.selectionSecondaryBtnText}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.selectionSecondaryBtn}
                onPress={handleClearExpiredSelection}
              >
                <Text style={styles.selectionSecondaryBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.selectionActionsRow}>
              <TouchableOpacity
                style={styles.selectionPrimaryBtn}
                onPress={handleRestoreSelectedExpired}
              >
                <Text style={styles.selectionPrimaryBtnText}>
                  Restore Selected
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.selectionPrimaryBtn}
                onPress={handleRestoreAllExpired}
              >
                <Text style={styles.selectionPrimaryBtnText}>Restore All</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Trash2 size={56} color={COLORS.borderGray} />
            <Text style={styles.emptyTitle}>Your trash is empty</Text>
            <Text style={styles.emptySubtitle}>
              Deleted transactions will appear here for 90 days before being
              permanently removed.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
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
    paddingTop: 16,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff7ed",
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  infoBannerText: {
    fontSize: 13,
    color: "#92400e",
    flex: 1,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedCard: {
    borderWidth: 1,
    borderColor: COLORS.primaryBlue,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  transactionId: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  amount: {
    fontSize: 15,
    fontWeight: "700",
  },
  cardMeta: {
    gap: 2,
    marginBottom: 10,
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  selectRowText: {
    fontSize: 12,
    color: COLORS.primaryBlue,
    fontWeight: "600",
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textGray,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.borderGray,
    paddingTop: 10,
  },
  daysBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  daysText: {
    fontSize: 12,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.primaryBlue,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  restoreBtnText: {
    fontSize: 13,
    color: COLORS.primaryBlue,
    fontWeight: "500",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deleteBtnText: {
    fontSize: 13,
    color: COLORS.red,
    fontWeight: "500",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textGray,
    textAlign: "center",
    lineHeight: 22,
  },
  selectionPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    gap: 10,
  },
  selectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  selectionSubtitle: {
    fontSize: 12,
    color: COLORS.textGray,
  },
  selectionActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  selectionSecondaryBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primaryBlue,
    borderRadius: 8,
    paddingVertical: 9,
  },
  selectionSecondaryBtnText: {
    color: COLORS.primaryBlue,
    fontSize: 12,
    fontWeight: "700",
  },
  selectionPrimaryBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 8,
    paddingVertical: 10,
  },
  selectionPrimaryBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
});
