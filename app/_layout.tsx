import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
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

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setIsAppReady(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  useEffect(() => {
    if (user && !isPinLocked && !isLoading) {
      initializeNotifications().catch(console.error);
    }
  }, [user, isPinLocked, isLoading]);

  useEffect(() => {
    if (isLoading || !isAppReady || isNavigating.current) return;

    const screen = segments[0] as string;
    const isPinScreen = screen === "pin-entry" || screen === "pin-setup";

    if (isPinScreen) return;

    if (!user) {
      if (screen !== "welcome" && screen !== "login" && screen !== "onboarding" && screen !== "reset") {
        isNavigating.current = true;
        router.replace("/welcome");
      }
    } else if (isPinLocked) {
      if (screen !== "welcome") {
        isNavigating.current = true;
        router.replace("/welcome");
      }
    } else if (screen === "welcome" || screen === "login" || screen === "onboarding" || screen === "reset") {
      if (user && user.pin) {
        isNavigating.current = true;
        router.replace("/(tabs)");
      }
    }

    setTimeout(() => { isNavigating.current = false; }, 500);
  }, [user, isLoading, isPinLocked, segments, isAppReady]);

  if (isLoading || !isAppReady) {
    return (
      <View style={{ flex: 1, backgroundColor: "#007AFF", justifyContent: "center", alignItems: "center" }}>
        <StatusBar style="light" />
        <Svg width="118" height="124" viewBox="0 0 118 124" fill="none">
          <Path
            d="M55.7656 119.109V66.3306H76.9707V119.109M20.2606 119.109V93.5042H41.4658V119.109M92.126 119.109V41.1125H113.331V119.109M4.33124 77.9212L49.6953 32.5571L65.1358 46.4699L106.242 5.38353M105.305 24.1647L107.2 7.01315C107.235 6.65221 107.189 6.28795 107.066 5.94678C106.943 5.60561 106.746 5.29607 106.489 5.04061C106.232 4.78515 105.921 4.59019 105.578 4.46982C105.236 4.34945 104.872 4.3067 104.511 4.34468L87.3797 6.23908"
            stroke="white" strokeWidth="8.6625" strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
        <View style={{ marginTop: 16 }}>
          <Svg width="197" height="42" viewBox="0 0 197 42" fill="none">
            <Path
              d="M20.6486 22.2129C22.6995 22.5952 24.3855 23.6207 25.7064 25.2893C27.0274 26.9579 27.6879 28.8698 27.6879 31.025C27.6879 32.9717 27.2012 34.6924 26.2279 36.1871C25.2893 37.6471 23.9162 38.7943 22.1086 39.6286C20.301 40.4629 18.1631 40.88 15.695 40.88H1.0682e-05V4.48429H15.0172C17.4853 4.48429 19.6057 4.88405 21.3786 5.68357C23.1862 6.4831 24.5419 7.59548 25.4457 9.02072C26.3843 10.446 26.8536 12.0624 26.8536 13.87C26.8536 15.9905 26.28 17.7633 25.1329 19.1886C24.0205 20.6138 22.5257 21.6219 20.6486 22.2129ZM7.30001 19.5014H13.9743C15.7124 19.5014 17.0507 19.1191 17.9893 18.3543C18.9279 17.5548 19.3972 16.425 19.3972 14.965C19.3972 13.505 18.9279 12.3752 17.9893 11.5757C17.0507 10.7762 15.7124 10.3764 13.9743 10.3764H7.30001V19.5014ZM14.6522 34.9357C16.425 34.9357 17.7981 34.5186 18.7714 33.6843C19.7795 32.85 20.2836 31.6681 20.2836 30.1386C20.2836 28.5743 19.7622 27.3576 18.7193 26.4886C17.6764 25.5848 16.2686 25.1329 14.4957 25.1329H7.30001V34.9357H14.6522ZM37.208 8.55143C35.9218 8.55143 34.8442 8.15167 33.9752 7.35215C33.1409 6.51786 32.7237 5.49238 32.7237 4.27572C32.7237 3.05905 33.1409 2.05095 33.9752 1.25143C34.8442 0.417143 35.9218 2.80516e-07 37.208 2.80516e-07C38.4942 2.80516e-07 39.5544 0.417143 40.3887 1.25143C41.2578 2.05095 41.6923 3.05905 41.6923 4.27572C41.6923 5.49238 41.2578 6.51786 40.3887 7.35215C39.5544 8.15167 38.4942 8.55143 37.208 8.55143ZM40.8059 11.9929V40.88H33.5059V11.9929H40.8059Z"
              fill="white"
            />
          </Svg>
        </View>
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
