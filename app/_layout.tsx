import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (user && !isPinLocked && !isLoading) {
      initializeNotifications().catch(console.error);
    }
  }, [user, isPinLocked, isLoading]);

  useEffect(() => {
    if (isLoading || isNavigating.current) return;

    const screen = segments[0] as string;
    const isPinScreen = screen === "pin-entry" || screen === "pin-setup";

    if (isPinScreen) return;

    if (!user) {
      if (screen !== "welcome" && screen !== "login" && screen !== "onboarding" && screen !== "reset") {
        isNavigating.current = true;
        router.replace("/welcome");
      }
    } else if (isPinLocked) {
      if (screen !== "pin-entry") {
        isNavigating.current = true;
        router.replace("/pin-entry");
      }
    } else if (!user.pin) {
      if (screen !== "pin-setup") {
        isNavigating.current = true;
        router.replace("/pin-setup");
      }
    } else if (screen === "welcome" || screen === "login" || screen === "onboarding" || screen === "reset") {
      isNavigating.current = true;
      router.replace("/(tabs)");
    }

    setTimeout(() => { isNavigating.current = false; }, 100);
  }, [user, isLoading, isPinLocked, segments]);

  if (isLoading) return null;

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
