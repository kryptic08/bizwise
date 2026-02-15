import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "./context/AuthContext";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#9ca3af",
  error: "#ef4444",
};

const PinDots = ({ length, error }: { length: number; error: boolean }) => (
  <View style={styles.pinDotsContainer}>
    {[0, 1, 2, 3].map((index) => (
      <View
        key={index}
        style={[
          styles.pinDot,
          length > index && styles.pinDotFilled,
          error && styles.pinDotError,
        ]}
      />
    ))}
  </View>
);

const NumberButton = ({ num, onPress, disabled }: { num: string; onPress: () => void; disabled: boolean }) => (
  <TouchableOpacity
    style={[styles.numberButton, disabled && styles.disabled]}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={disabled}
  >
    <Text style={[styles.numberText, disabled && styles.disabledText]}>{num}</Text>
  </TouchableOpacity>
);

const DeleteButton = ({ onPress, disabled }: { onPress: () => void; disabled: boolean }) => (
  <TouchableOpacity
    style={[styles.numberButton, disabled && styles.disabled]}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={disabled}
  >
    <Text style={[styles.deleteText, disabled && styles.disabledText]}>⌫</Text>
  </TouchableOpacity>
);

export default function PinEntryScreen() {
  const router = useRouter();
  const { user, unlockWithPin, logout } = useAuth();
  
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const userName = user?.name || "User";

  const handleNumber = (num: string) => {
    if (isVerifying || pin.length >= 4) return;
    
    const newPin = pin + num;
    setPin(newPin);
    setError("");

    if (newPin.length === 4) {
      setIsVerifying(true);
      setTimeout(() => verifyPin(newPin), 150);
    }
  };

  const verifyPin = (enteredPin: string) => {
    if (!user?.pin) {
      Vibration.vibrate(500);
      setError("PIN not set up");
      setPin("");
      setIsVerifying(false);
      return;
    }
    
    if (user.pin === enteredPin) {
      unlockWithPin();
      router.replace("/(tabs)");
    } else {
      Vibration.vibrate(500);
      setError("Incorrect PIN");
      setPin("");
    }
    setIsVerifying(false);
  };

  const handleDelete = () => {
    if (isVerifying) return;
    setPin((p) => p.slice(0, -1));
    setError("");
  };

  const handleForgotPin = () => {
    Alert.alert(
      "Forgot PIN?",
      "Log out and sign in with password.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: () => { logout(); router.replace("/login"); } },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryBlue} />

      <View style={styles.header}>
        <Svg width="40" height="44" viewBox="0 0 118 124" fill="none">
          <Path
            d="M55.7656 119.109V66.3306H76.9707V119.109M20.2606 119.109V93.5042H41.4658V119.109M92.126 119.109V41.1125H113.331V119.109M4.33124 77.9212L49.6953 32.5571L65.1358 46.4699L106.242 5.38353M105.305 24.1647L107.2 7.01315C107.235 6.65221 107.189 6.28795 107.066 5.94678C106.943 5.60561 106.746 5.29607 106.489 5.04061C106.232 4.78515 105.921 4.59019 105.578 4.46982C105.236 4.34945 104.872 4.3067 104.511 4.34468L87.3797 6.23908"
            stroke="white" strokeWidth="8.6625" strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
        <Text style={styles.appName}>BizWise</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Enter PIN</Text>
        <Text style={styles.subtitle}>Welcome back, {userName}</Text>

        <PinDots length={pin.length} error={!!error} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.numberPad}>
          <View style={styles.numberRow}>
            <NumberButton num="1" onPress={() => handleNumber("1")} disabled={isVerifying} />
            <NumberButton num="2" onPress={() => handleNumber("2")} disabled={isVerifying} />
            <NumberButton num="3" onPress={() => handleNumber("3")} disabled={isVerifying} />
          </View>
          <View style={styles.numberRow}>
            <NumberButton num="4" onPress={() => handleNumber("4")} disabled={isVerifying} />
            <NumberButton num="5" onPress={() => handleNumber("5")} disabled={isVerifying} />
            <NumberButton num="6" onPress={() => handleNumber("6")} disabled={isVerifying} />
          </View>
          <View style={styles.numberRow}>
            <NumberButton num="7" onPress={() => handleNumber("7")} disabled={isVerifying} />
            <NumberButton num="8" onPress={() => handleNumber("8")} disabled={isVerifying} />
            <NumberButton num="9" onPress={() => handleNumber("9")} disabled={isVerifying} />
          </View>
          <View style={styles.numberRow}>
            <View style={styles.numberButton} />
            <NumberButton num="0" onPress={() => handleNumber("0")} disabled={isVerifying} />
            <DeleteButton onPress={handleDelete} disabled={isVerifying} />
          </View>
        </View>

        <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPin}>
          <Text style={styles.forgotText}>Forgot PIN?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryBlue },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: COLORS.white, fontSize: 18 },
  header: { paddingTop: 60, paddingBottom: 40, alignItems: "center" },
  appName: { fontSize: 32, fontWeight: "800", color: COLORS.white, marginTop: 16 },
  content: { flex: 1, backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingHorizontal: 20, paddingBottom: 40, alignItems: "center" },
  title: { fontSize: 28, fontWeight: "700", color: COLORS.textDark, marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.textGray, marginBottom: 40 },
  pinDotsContainer: { flexDirection: "row", justifyContent: "center", marginBottom: 20 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.textGray, marginHorizontal: 8 },
  pinDotFilled: { backgroundColor: COLORS.primaryBlue, borderColor: COLORS.primaryBlue },
  pinDotError: { borderColor: COLORS.error, backgroundColor: COLORS.error },
  errorText: { color: COLORS.error, fontSize: 14, marginBottom: 20 },
  numberPad: { marginTop: 40 },
  numberRow: { flexDirection: "row", marginBottom: 20 },
  numberButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.lightBlueBg, justifyContent: "center", alignItems: "center", marginHorizontal: 15 },
  numberText: { fontSize: 28, fontWeight: "600", color: COLORS.textDark },
  deleteText: { fontSize: 24, fontWeight: "600", color: COLORS.textGray },
  forgotButton: { marginTop: 30, padding: 10 },
  forgotText: { color: COLORS.primaryBlue, fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  disabledText: { opacity: 0.5 },
});
