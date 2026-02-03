import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "./context/AuthContext";
import ConvexClientProvider from "./providers/ConvexClientProvider";

export const unstable_settings = {
  anchor: "(tabs)",
};

// Create custom theme with transparent tab bar background
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

  useEffect(() => {
    // Show welcome screen for 2 seconds on app launch
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 100); // Small delay to ensure welcome screen shows first

    return () => clearTimeout(timer);
  }, []);

  // Handle PIN lock routing
  useEffect(() => {
    if (!isLoading && !showWelcome) {
      const inAuthGroup = segments[0] === "(tabs)";
      const onPinScreen =
        segments[0] === "pin-entry" || segments[0] === "pin-setup";

      if (user && isPinLocked && !onPinScreen) {
        // User is logged in, has PIN, and app is locked - show PIN entry
        router.replace("/pin-entry");
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
    <ConvexClientProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ConvexClientProvider>
  );
}
