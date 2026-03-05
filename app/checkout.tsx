import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Minus, Plus } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SyncBadge } from "./components/SyncBadge";
import { useAuth } from "./context/AuthContext";
import { useMutationQueue } from "./providers/MutationQueueProvider";
import { useOffline } from "./providers/OfflineProvider";
import { checkFirstSale } from "./utils/notificationInit";

const { width } = Dimensions.get("window");

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
  green: "#10b981",
  red: "#ef4444",
  borderGray: "#d1d5db",
};

export default function CheckoutScreen() {
  const router = useRouter();
  const { cartData, saleDate } = useLocalSearchParams();
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const { createSale } = useMutationQueue();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [amountReceived, setAmountReceived] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (cartData) {
      try {
        const parsedData = JSON.parse(cartData as string);
        setCartItems(parsedData);
      } catch (error) {
        console.error("Error parsing cart data:", error);
        // Fallback to empty cart
        setCartItems([]);
      }
    }
  }, [cartData]);

  const updateQuantity = (id: string, change: number) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item._id === id
            ? { ...item, qty: Math.max(0, item.qty + change) }
            : item,
        )
        .filter((item) => item.qty > 0),
    );
  };

  const getTotalAmount = () => {
    return cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  };

  const getTotalItems = () => {
    return cartItems.reduce((sum, item) => sum + item.qty, 0);
  };

  const getChange = () => {
    const received = parseFloat(amountReceived) || 0;
    const total = getTotalAmount();
    return received - total;
  };

  const handleCheckout = async () => {
    if (isProcessing) return;

    const total = getTotalAmount();
    const received = parseFloat(amountReceived) || 0;

    if (received < total) {
      Alert.alert("Error", "Amount received is less than total amount");
      return;
    }

    setIsProcessing(true);

    try {
      // Prepare items for the sale
      const saleItems = cartItems.map((item) => ({
        productId: item._id,
        productName: item.name,
        category: item.category,
        price: item.price,
        quantity: item.qty,
      }));

      if (!isOnline) {
        Alert.alert(
          "Offline",
          "You need an internet connection to complete this transaction. Please try again when you're back online.",
          [{ text: "OK" }],
        );
        setIsProcessing(false);
        return;
      }

      // Create sale online - always send today's date in YYYY-MM-DD format
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const result = await createSale({
        items: saleItems,
        paymentReceived: received,
        userId: user?.userId || "",
        clientTimestamp: Date.now(),
        saleDate: saleDate ? saleDate as string : todayStr,
      });

      const tempId = result.transactionId;

      // Check if this is the first sale and send celebration
      checkFirstSale(true).catch(console.error);

      // Set flag to clear cart cache when returning to counter
      await AsyncStorage.setItem("bizwise_checkout_complete", "true");

      // Show appropriate message based on online status
      if (isOnline) {
        Alert.alert(
          "Transaction Complete",
          `Transaction ID: ${tempId}\nTotal: ₱${total.toFixed(2)}\nReceived: ₱${received.toFixed(2)}\nChange: ₱${getChange().toFixed(2)}`,
          [
            {
              text: "New Transaction",
              onPress: () => router.replace("/(tabs)/counter"),
            },
            {
              text: "View Receipt",
              onPress: () => router.push("/(tabs)/transactions"),
            },
          ],
        );
      } else {
        Alert.alert(
          "Transaction Saved Offline",
          `Transaction ID: ${tempId}\nTotal: ₱${total.toFixed(2)}\nReceived: ₱${received.toFixed(2)}\nChange: ₱${getChange().toFixed(2)}\n\nThis transaction will sync when you're back online.`,
          [
            {
              text: "New Transaction",
              onPress: () => router.replace("/(tabs)/counter"),
            },
            {
              text: "View Receipt",
              onPress: () => router.push("/(tabs)/transactions"),
            },
          ],
        );
      }
    } catch (error) {
      console.error("Error saving transaction:", error);
      Alert.alert("Error", "Failed to save transaction. Please try again.", [
        { text: "OK" },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderCartItem = (item: any) => (
    <View key={item._id} style={styles.cartItem}>
      <Image source={{ uri: item.image }} style={styles.itemImage} />

      <View style={styles.itemDetails}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
      </View>

      <View style={styles.quantityControls}>
        <TouchableOpacity
          style={[styles.quantityButton, styles.quantityButtonMinus]}
          onPress={() => updateQuantity(item._id, -1)}
        >
          <Minus size={16} color={COLORS.white} />
        </TouchableOpacity>

        <Text style={styles.quantityText}>{item.qty}</Text>

        <TouchableOpacity
          style={[styles.quantityButton, styles.quantityButtonPlus]}
          onPress={() => updateQuantity(item._id, 1)}
        >
          <Plus size={16} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <Text style={styles.itemTotal}>
        ₱{(item.price * item.qty).toFixed(2)}
      </Text>
    </View>
  );

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
        <Text style={styles.headerTitle}>Sales Summary</Text>
        <View style={styles.headerRight}>
          <SyncBadge compact />
        </View>
      </View>

      {/* Main Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.contentContainer}>
        {/* Scrollable Order Section */}
        <View style={styles.orderSection}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Cart Items */}
            <View style={styles.cartContainer}>
              {cartItems.length > 0 ? (
                cartItems.map(renderCartItem)
              ) : (
                <View style={styles.emptyCartContainer}>
                  <Text style={styles.emptyCartText}>No items in cart</Text>
                </View>
              )}
            </View>

            {/* Totals Section */}
            <View style={styles.totalsContainer}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal:</Text>
                <Text style={styles.totalValue}>
                  ₱{getTotalAmount().toFixed(2)}
                </Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Total:</Text>
                <Text style={styles.grandTotalValue}>
                  ₱{getTotalAmount().toFixed(2)}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Payment Section - Moved to bottom */}
        <View style={styles.paymentContainer}>
          <Text style={styles.paymentTitle}>Payment</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Amount Received</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              value={amountReceived}
              onChangeText={setAmountReceived}
              keyboardType="numeric"
            />
          </View>

          {amountReceived !== "" && (
            <View style={styles.changeContainer}>
              <Text style={styles.changeLabel}>Change:</Text>
              <Text
                style={[
                  styles.changeValue,
                  { color: getChange() >= 0 ? COLORS.green : COLORS.red },
                ]}
              >
                ₱{getChange().toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Complete Transaction Button */}
        <TouchableOpacity
          style={[
            styles.checkoutButton,
            {
              opacity:
                parseFloat(amountReceived || "0") >= getTotalAmount() &&
                !isProcessing
                  ? 1
                  : 0.6,
            },
          ]}
          onPress={handleCheckout}
          disabled={
            parseFloat(amountReceived || "0") < getTotalAmount() || isProcessing
          }
        >
          <Text style={styles.checkoutButtonText}>
            {isProcessing ? "Processing..." : "Complete Transaction"}
          </Text>
        </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    borderRadius: 15,
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  orderSection: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  summaryHeader: {
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  summarySubtitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  editModeText: {
    fontSize: 12,
    color: COLORS.primaryBlue,
    fontWeight: "600",
    marginLeft: 8,
  },
  cartContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cartContainerEditing: {
    borderWidth: 2,
    borderColor: COLORS.primaryBlue,
    backgroundColor: "#f8faff",
  },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  itemPrice: {
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
  },
  quantityButton: {
    backgroundColor: COLORS.primaryBlue,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
    minWidth: 30,
    textAlign: "center",
  },
  quantityTextEditing: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primaryBlue,
    minWidth: 35,
  },
  quantityButtonMinus: {
    backgroundColor: COLORS.red,
  },
  quantityButtonPlus: {
    backgroundColor: COLORS.green,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textDark,
    minWidth: 60,
    textAlign: "right",
  },
  totalsContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  totalValue: {
    fontSize: 14,
    color: COLORS.textDark,
    fontWeight: "500",
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    marginTop: 8,
    paddingTop: 16,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  paymentContainer: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 100, // Increased margin to make room for the checkout button
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  amountInput: {
    backgroundColor: COLORS.lightBlueBg,
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    height: 60, // Increased height for better visibility
    textAlign: "center",
  },
  changeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  changeLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  changeValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  checkoutButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: COLORS.primaryBlue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  checkoutButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.white,
  },
  emptyCartContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyCartText: {
    fontSize: 16,
    color: COLORS.textGray,
    fontStyle: "italic",
  },
});
