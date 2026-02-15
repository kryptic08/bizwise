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
  const [initialized, setInitialized] = useState(false);
  const { user, isLoading, isPinLocked } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const routerRef = useRef(router);
  const isNavigating = useRef(false);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    if (!isLoading) {
      setInitialized(true);
    }
  }, [isLoading]);

  useEffect(() => {
    if (user && !isPinLocked && !isLoading) {
      initializeNotifications().catch(console.error);
    }
  }, [user, isPinLocked, isLoading]);

  useEffect(() => {
    if (!initialized || isNavigating.current) {
      return;
    }

<<<<<<< HEAD
=======
    if (isLoading || showWelcome || isNavigating.current) {
      return;
    }

>>>>>>> 6c98226e4164984682e8b5f60ba194b24a355d07
    const currentScreen = segments[0];
    const isOnPinScreen = currentScreen === "pin-entry" || currentScreen === "pin-setup";

    if (isOnPinScreen) {
      return;
    }

    const inAuthGroup = currentScreen === "(tabs)";
    const onAuthScreen =
      currentScreen === "welcome" ||
      currentScreen === "onboarding" ||
      currentScreen === "login" ||
      currentScreen === "reset";

    if (!user && inAuthGroup) {
      isNavigating.current = true;
      routerRef.current.replace("/welcome");
    } else if (user && isPinLocked) {
      isNavigating.current = true;
      routerRef.current.replace("/pin-entry");
    } else if (user && !user.pin) {
      isNavigating.current = true;
      routerRef.current.replace("/pin-setup");
    } else if (user && !isPinLocked && onAuthScreen) {
      isNavigating.current = true;
      routerRef.current.replace("/(tabs)");
    }
<<<<<<< HEAD
=======

    setTimeout(() => {
      isNavigating.current = false;
    }, 100);
  }, [user, isLoading, isPinLocked, segments, showWelcome]);
>>>>>>> 6c98226e4164984682e8b5f60ba194b24a355d07

    setTimeout(() => {
      isNavigating.current = false;
    }, 100);
  }, [user, isLoading, isPinLocked, segments, initialized]);

  if (!initialized || isLoading) {
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
