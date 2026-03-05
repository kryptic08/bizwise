import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Trash2,
} from "lucide-react-native";
import React, { useEffect } from "react";
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

  const purgeExpiredTrash = useMutation(api.analytics.purgeExpiredTrash);
  const restoreSale = useMutation(api.sales.restoreSale);
  const restoreExpense = useMutation(api.expenses.restoreExpense);
  const permanentDeleteSale = useMutation(api.sales.permanentDeleteSale);
  const permanentDeleteExpense = useMutation(
    api.expenses.permanentDeleteExpense,
  );

  // Purge expired items whenever the screen is opened
  useEffect(() => {
    if (user?.userId) {
      purgeExpiredTrash({ userId: user.userId as Id<"users"> }).catch(() => {});
    }
  }, [user?.userId]);

  const handleRestore = async (item: TrashItem) => {
    try {
      if (item.type === "income") {
        await restoreSale({ id: item.id as Id<"sales"> });
      } else {
        await restoreExpense({ id: item.id as Id<"expenses"> });
      }
    } catch {
      Alert.alert("Error", "Failed to restore transaction. Please try again.");
    }
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

  const renderItem = ({ item }: { item: TrashItem }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: item.type === "income" ? "#dcfce7" : "#fee2e2",
              },
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                { color: item.type === "income" ? COLORS.green : COLORS.red },
              ]}
            >
              {item.type === "income" ? "Income" : "Expense"}
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

  const items = (trashItems ?? []) as TrashItem[];

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
            Items are permanently deleted after 30 days
          </Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Trash2 size={56} color={COLORS.borderGray} />
            <Text style={styles.emptyTitle}>Your trash is empty</Text>
            <Text style={styles.emptySubtitle}>
              Deleted transactions will appear here for 30 days before being
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
});
