import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const PinDots = React.memo(({ length, error, verifying }: { length: number; error: boolean; verifying: boolean }) => (
  <View style={styles.pinDotsContainer}>
    {[0, 1, 2, 3].map((index) => (
      <View
        key={index}
        style={[
          styles.pinDot,
          length > index && styles.pinDotFilled,
          error && styles.pinDotError,
          verifying && styles.pinDotVerifying,
        ]}
      />
    ))}
  </View>
));

const NumberPad = React.memo(({ onNumberPress, onDelete, disabled }: { 
  onNumberPress: (num: string) => void; 
  onDelete: () => void;
  disabled: boolean;
}) => {
  const numbers = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "⌫"],
  ];

  return (
    <View style={styles.numberPad}>
      {numbers.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.numberRow}>
          {row.map((num, colIndex) => {
            if (num === "") {
              return <View key={colIndex} style={styles.numberButton} />;
            }
            if (num === "⌫") {
              return (
                <TouchableOpacity
                  key={colIndex}
                  style={[styles.numberButton, disabled && styles.numberButtonDisabled]}
                  onPress={onDelete}
                  activeOpacity={0.7}
                  disabled={disabled}
                >
                  <Text style={[styles.deleteText, disabled && styles.numberTextDisabled]}>{num}</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                key={colIndex}
                style={[styles.numberButton, disabled && styles.numberButtonDisabled]}
                onPress={() => onNumberPress(num)}
                activeOpacity={0.7}
                disabled={disabled}
              >
                <Text style={[styles.numberText, disabled && styles.numberTextDisabled]}>{num}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
});

export default function PinEntryScreen() {
  const router = useRouter();
  const { user, unlockWithPin, logout } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [errorCount, setErrorCount] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Single ref to track all values
  const stateRef = useRef({
    user: user,
    pin: "",
    isVerifying: false,
  });
  
  // Keep ref in sync
  useEffect(() => {
    stateRef.current.user = user;
  }, [user]);

  useEffect(() => {
    stateRef.current.pin = pin;
  }, [pin]);

  useEffect(() => {
    stateRef.current.isVerifying = isVerifying;
  }, [isVerifying]);

  // Memoize userName - only recomputes when user?.name changes
  const userName = useMemo(() => user?.name || "User", [user?.name]);

  // Clear error when user types
  const handleClearError = useCallback(() => {
    if (error) setError("");
  }, [error]);

  // Stable callbacks with no dependencies
  const handleNumberPress = useCallback((num: string) => {
    if (stateRef.current.isVerifying || stateRef.current.pin.length >= 4) return;
    
    // Clear error when user starts typing
    if (error) {
      setError("");
    }
    
    const newPin = stateRef.current.pin + num;
    setPin(newPin);
    setError("");

    if (newPin.length === 4) {
      stateRef.current.isVerifying = true;
      setIsVerifying(true);
      
      setTimeout(() => {
        const currentUser = stateRef.current.user;
        
        // Check if user exists and has PIN set
        if (!currentUser || !currentUser.pin) {
          Vibration.vibrate(500);
          setError("PIN not set up. Please log out and try again.");
          setPin("");
          stateRef.current.pin = "";
          stateRef.current.isVerifying = false;
          setIsVerifying(false);
          return;
        }
        
        // Compare PINs
        if (currentUser.pin === newPin) {
          // Success
          unlockWithPin();
          router.replace("/(tabs)");
        } else {
          // Wrong PIN
          Vibration.vibrate(500);
          const newCount = errorCount + 1;
          setErrorCount(newCount);
          
          if (newCount >= 5) {
            setError(`Wrong PIN. ${5 - newCount} attempts left before lockout.`);
          } else {
            setError("Incorrect PIN. Please try again.");
          }
          setPin("");
          stateRef.current.pin = "";
        }
        stateRef.current.isVerifying = false;
        setIsVerifying(false);
      }, 100);
    }
  }, [error, errorCount, unlockWithPin, router]);

  const handleDelete = useCallback(() => {
    if (stateRef.current.isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
    setError("");
  }, []);

  const handleForgotPin = useCallback(() => {
    Alert.alert(
      "Forgot PIN?",
      "You'll need to log out and sign in again with your password.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/login");
          },
        },
      ],
    );
  }, [logout, router]);

  // Get error message based on error state
  const getErrorMessage = () => {
    if (!error) return null;
    return error;
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryBlue}
      />

      {/* Header */}
      <View style={styles.header}>
        <Svg width="40" height="44" viewBox="0 0 118 124" fill="none">
          <Path
            d="M55.7656 119.109V66.3306H76.9707V119.109M20.2606 119.109V93.5042H41.4658V119.109M92.126 119.109V41.1125H113.331V119.109M4.33124 77.9212L49.6953 32.5571L65.1358 46.4699L106.242 5.38353M105.305 24.1647L107.2 7.01315C107.235 6.65221 107.189 6.28795 107.066 5.94678C106.943 5.60561 106.746 5.29607 106.489 5.04061C106.232 4.78515 105.921 4.59019 105.578 4.46982C105.236 4.34945 104.872 4.3067 104.511 4.34468L87.3797 6.23908"
            stroke="white"
            strokeWidth="8.6625"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={styles.appName}>BizWise</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Enter PIN</Text>
        <Text style={styles.subtitle}>
          Welcome back, {userName}
        </Text>

        <PinDots length={pin.length} error={!!error} verifying={isVerifying} />

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={handleClearError}>
              <Text style={styles.errorDismiss}>Tap to dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <NumberPad 
          onNumberPress={handleNumberPress} 
          onDelete={handleDelete} 
          disabled={isVerifying} 
        />

        <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPin}>
          <Text style={styles.forgotText}>Forgot PIN?</Text>
        </TouchableOpacity>
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
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: "center",
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.white,
    marginTop: 16,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textGray,
    marginBottom: 40,
  },
  pinDotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.textGray,
    marginHorizontal: 8,
  },
  pinDotFilled: {
    backgroundColor: COLORS.primaryBlue,
    borderColor: COLORS.primaryBlue,
  },
  pinDotError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error,
  },
  pinDotVerifying: {
    opacity: 0.6,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: "center",
  },
  errorDismiss: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    textDecorationLine: "underline",
  },
  numberPad: {
    marginTop: 40,
    marginBottom: 40,
  },
  numberRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  numberButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.lightBlueBg,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 15,
  },
  numberText: {
    fontSize: 28,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  deleteText: {
    fontSize: 24,
    fontWeight: "600",
    color: COLORS.textGray,
  },
  forgotButton: {
    marginTop: 30,
    padding: 10,
  },
  forgotText: {
    color: COLORS.primaryBlue,
    fontSize: 16,
    fontWeight: "600",
  },
  numberButtonDisabled: {
    opacity: 0.5,
  },
  numberTextDisabled: {
    opacity: 0.5,
  },
  offlineBanner: {
    backgroundColor: COLORS.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineBannerText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
});
