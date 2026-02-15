import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
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
  const [showWelcome, setShowWelcome] = useState(true);
  const { user, isLoading, isPinLocked } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navigationInProgress = useRef(false);

  // Track if we're on a PIN screen to prevent re-navigation
  const isOnPinScreen = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user && !isPinLocked && !isLoading) {
      initializeNotifications().catch(console.error);
    }
  }, [user, isPinLocked, isLoading]);

  // Determine current screen
  const currentScreen = segments[0];
  const isOnPinEntry = currentScreen === "pin-entry";
  const isOnPinSetup = currentScreen === "pin-setup";
  const isPinScreen = isOnPinEntry || isOnPinSetup;

  // Update ref when on PIN screen
  isOnPinScreen.current = isPinScreen;

  useEffect(() => {
    // Don't navigate if already on PIN screen and user is locked
    if (isPinScreen && user && isPinLocked) {
      return;
    }

    if (!isLoading && !showWelcome && !navigationInProgress.current) {
      const inAuthGroup = segments[0] === "(tabs)";
      const onAuthScreen =
        segments[0] === "welcome" ||
        segments[0] === "onboarding" ||
        segments[0] === "login" ||
        segments[0] === "reset";

      if (!user && inAuthGroup) {
        navigationInProgress.current = true;
        router.replace("/welcome");
        setTimeout(() => {
          navigationInProgress.current = false;
        }, 100);
      } else if (user && isPinLocked && !isOnPinEntry) {
        navigationInProgress.current = true;
        router.replace("/pin-entry");
        setTimeout(() => {
          navigationInProgress.current = false;
        }, 100);
      } else if (user && !user.pin && !isOnPinSetup) {
        navigationInProgress.current = true;
        router.replace("/pin-setup");
        setTimeout(() => {
          navigationInProgress.current = false;
        }, 100);
      } else if (user && !isPinLocked && onAuthScreen && !isPinScreen) {
        navigationInProgress.current = true;
        router.replace("/(tabs)");
        setTimeout(() => {
          navigationInProgress.current = false;
        }, 100);
      }
    }
  }, [user, isLoading, isPinLocked, segments, showWelcome, isOnPinEntry, isOnPinSetup]);

  if (showWelcome || isLoading) {
    return null;
  }

  return (
    <ThemeProvider value={CustomLightTheme}>
      <Stack>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="reset" options={{ headerShown: false }} />
        <Stack.Screen name="pin-setup" options={{ headerShown: false }} />
        <Stack.Screen name="pin-entry" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="checkout" options={{ headerShown: false }} />
        <Stack.Screen name="add-item" options={{ headerShown: false }} />
        <Stack.Screen name="edit-item" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="security" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="help" options={{ headerShown: false }} />
        <Stack.Screen name="contact-us" options={{ headerShown: false }} />
        <Stack.Screen name="change-password" options={{ headerShown: false }} />
        <Stack.Screen name="change-pin" options={{ headerShown: false }} />
        <Stack.Screen name="delete-account" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ headerShown: false }} />
        <Stack.Screen name="target-income" options={{ headerShown: false }} />
        <Stack.Screen
          name="notification-settings"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="manage-categories"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
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
