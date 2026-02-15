import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { api } from "../convex/_generated/api";
import { useAuth } from "./context/AuthContext";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#9ca3af",
  error: "#ef4444",
};

const PinDots = ({ length }: { length: number }) => (
  <View style={styles.pinDotsContainer}>
    {[0, 1, 2, 3].map((index) => (
      <View key={index} style={[styles.pinDot, length > index && styles.pinDotFilled]} />
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

export default function PinSetupScreen() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const setPinMutation = useMutation(api.users.setPin);

  const title = step === "enter" ? "Create PIN" : "Confirm PIN";
  const subtitle = step === "enter" ? "Set up a 4-digit PIN" : "Enter PIN again to confirm";

  const handleNumber = async (num: string) => {
    if (pin.length >= 4 || isSaving) return;
    
    const newPin = pin + num;
    setPin(newPin);
    setError("");

    if (newPin.length === 4) {
      if (step === "enter") {
        setFirstPin(newPin);
        setPin("");
        setStep("confirm");
      } else {
        if (newPin === firstPin) {
          await savePin(newPin);
        } else {
          setError("PINs don't match. Try again.");
          setPin("");
          setFirstPin("");
          setStep("enter");
        }
      }
    }
  };

  const savePin = async (pinToSave: string) => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      await setPinMutation({ userId: user.userId, pin: pinToSave });
      await login({ ...user, pin: pinToSave });
      Alert.alert("Success!", "PIN set up successfully.", [
        { text: "Continue", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to set PIN");
      setPin("");
      setFirstPin("");
      setStep("enter");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (isSaving) return;
    setPin((p) => p.slice(0, -1));
    setError("");
  };

  const handleSkip = () => {
    Alert.alert("Skip PIN?", "Set up later from Security.", [
      { text: "Cancel", style: "cancel" },
      { text: "Skip", onPress: () => router.replace("/(tabs)") },
    ]);
  };

  const handleNumberPress = (num: string) => () => handleNumber(num);

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
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <PinDots length={pin.length} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.numberPad}>
          <View style={styles.numberRow}>
            <NumberButton num="1" onPress={handleNumberPress("1")} disabled={isSaving} />
            <NumberButton num="2" onPress={handleNumberPress("2")} disabled={isSaving} />
            <NumberButton num="3" onPress={handleNumberPress("3")} disabled={isSaving} />
          </View>
          <View style={styles.numberRow}>
            <NumberButton num="4" onPress={handleNumberPress("4")} disabled={isSaving} />
            <NumberButton num="5" onPress={handleNumberPress("5")} disabled={isSaving} />
            <NumberButton num="6" onPress={handleNumberPress("6")} disabled={isSaving} />
          </View>
          <View style={styles.numberRow}>
            <NumberButton num="7" onPress={handleNumberPress("7")} disabled={isSaving} />
            <NumberButton num="8" onPress={handleNumberPress("8")} disabled={isSaving} />
            <NumberButton num="9" onPress={handleNumberPress("9")} disabled={isSaving} />
          </View>
          <View style={styles.numberRow}>
            <View style={styles.numberButton} />
            <NumberButton num="0" onPress={handleNumberPress("0")} disabled={isSaving} />
            <DeleteButton onPress={handleDelete} disabled={isSaving} />
          </View>
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryBlue },
  header: { paddingTop: 60, paddingBottom: 40, alignItems: "center" },
  appName: { fontSize: 32, fontWeight: "800", color: COLORS.white, marginTop: 16 },
  content: { flex: 1, backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingHorizontal: 20, paddingBottom: 40, alignItems: "center" },
  title: { fontSize: 28, fontWeight: "700", color: COLORS.textDark, marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.textGray, marginBottom: 40, textAlign: "center" },
  pinDotsContainer: { flexDirection: "row", justifyContent: "center", marginBottom: 20 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.textGray, marginHorizontal: 8 },
  pinDotFilled: { backgroundColor: COLORS.primaryBlue, borderColor: COLORS.primaryBlue },
  errorText: { color: COLORS.error, fontSize: 14, marginBottom: 20 },
  numberPad: { marginTop: 40 },
  numberRow: { flexDirection: "row", marginBottom: 20 },
  numberButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.lightBlueBg, justifyContent: "center", alignItems: "center", marginHorizontal: 15 },
  numberText: { fontSize: 28, fontWeight: "600", color: COLORS.textDark },
  deleteText: { fontSize: 24, fontWeight: "600", color: COLORS.textGray },
  skipButton: { marginTop: 30, padding: 10 },
  skipText: { color: COLORS.textGray, fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  disabledText: { opacity: 0.5 },
});
