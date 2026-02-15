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

  useEffect(() => {
    if (!isLoading && !showWelcome && !navigationInProgress.current) {
      const inAuthGroup = segments[0] === "(tabs)";
      const onAuthScreen =
        segments[0] === "welcome" ||
        segments[0] === "onboarding" ||
        segments[0] === "login" ||
        segments[0] === "reset";
      const onPinEntryScreen = segments[0] === "pin-entry";
      const onPinSetupScreen = segments[0] === "pin-setup";
      const onPinScreen = onPinEntryScreen || onPinSetupScreen;

      if (!user && inAuthGroup) {
        navigationInProgress.current = true;
        router.replace("/welcome");
        setTimeout(() => {
          navigationInProgress.current = false;
        }, 100);
      } else if (user && isPinLocked && !onPinEntryScreen) {
        navigationInProgress.current = true;
        router.replace("/pin-entry");
        setTimeout(() => {
          navigationInProgress.current = false;
        }, 100);
      } else if (user && !user.pin && !onPinSetupScreen) {
        navigationInProgress.current = true;
        router.replace("/pin-setup");
        setTimeout(() => {
          navigationInProgress.current = false;
        }, 100);
      } else if (user && !isPinLocked && onAuthScreen && !onPinScreen) {
        navigationInProgress.current = true;
        router.replace("/(tabs)");
        setTimeout(() => {
          navigationInProgress.current = false;
        }, 100);
      }
    }
  }, [user, isLoading, isPinLocked, segments, showWelcome]);

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
