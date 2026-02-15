import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "./context/AuthContext";
import ConvexClientProvider from "./providers/ConvexClientProvider";
import { initializeNotifications } from "./utils/notificationInit";

export const unstable_settings = {
  initialRouteName: "welcome",
};

const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    card: "transparent",
    background: DefaultTheme.colors.background,
  },
};

function RootLayoutNav() {
  const { user, isLoading, isPinLocked } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const isNavigating = useRef(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setIsAppReady(true), 6000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  useEffect(() => {
    if (user && !isPinLocked && !isLoading) {
      initializeNotifications().catch(console.error);
    }
  }, [user, isPinLocked, isLoading]);

  useEffect(() => {
    if (isLoading || !isAppReady || isNavigating.current || destination) return;

    const screen = segments[0] as string;

    if (isPinLocked && screen !== "pin-entry" && screen !== "pin-setup") {
      isNavigating.current = true;
      setDestination("pin-entry");
      return;
    }

    if (!user) {
      if (screen !== "welcome" && screen !== "login" && screen !== "onboarding" && screen !== "reset") {
        isNavigating.current = true;
        setDestination("welcome");
      }
      return;
    }

    if (!user.pin) {
      if (screen !== "pin-setup") {
        isNavigating.current = true;
        setDestination("pin-setup");
      }
      return;
    }

    if (!isPinLocked && screen !== "pin-entry" && screen !== "pin-setup" && screen !== "(tabs)") {
      if (screen === "welcome" || screen === "login" || screen === "onboarding" || screen === "reset" || screen === "index") {
        isNavigating.current = true;
        setDestination("tabs");
      }
      return;
    }

    setTimeout(() => { isNavigating.current = false; }, 500);
  }, [user, isLoading, isPinLocked, segments, isAppReady, destination]);

  useEffect(() => {
    if (!destination) return;
    
    if (destination === "pin-entry" || destination === "pin-setup" || destination === "tabs" || destination === "welcome") {
      router.replace(`/${destination === "tabs" ? "(tabs)" : destination}`);
    }
  }, [destination]);

  if (isLoading || !isAppReady || !destination) {
    return (
      <View style={{ flex: 1, backgroundColor: "#007AFF", justifyContent: "center", alignItems: "center" }}>
        <StatusBar style="light" />
        <Svg width="100" height="100" viewBox="0 0 118 124" fill="none">
          <Path
            d="M55.7656 119.109V66.3306H76.9707V119.109M20.2606 119.109V93.5042H41.4658V119.109M92.126 119.109V41.1125H113.331V119.109M4.33124 77.9212L49.6953 32.5571L65.1358 46.4699L106.242 5.38353M105.305 24.1647L107.2 7.01315C107.235 6.65221 107.189 6.28795 107.066 5.94678C106.943 5.60561 106.746 5.29607 106.489 5.04061C106.232 4.78515 105.921 4.59019 105.578 4.46982C105.236 4.34945 104.872 4.3067 104.511 4.34468L87.3797 6.23908"
            stroke="white" strokeWidth="8.6625" strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
        <Text style={{ color: "white", fontSize: 36, fontWeight: "800", marginTop: 20 }}>BizWise</Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={CustomLightTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="reset" />
        <Stack.Screen name="pin-setup" />
        <Stack.Screen name="pin-entry" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="add-item" />
        <Stack.Screen name="edit-item" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="security" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="help" />
        <Stack.Screen name="contact-us" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="change-pin" />
        <Stack.Screen name="delete-account" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="target-income" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="manage-categories" />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ConvexClientProvider>
        <RootLayoutNav />
      </ConvexClientProvider>
    </AuthProvider>
  );
}
