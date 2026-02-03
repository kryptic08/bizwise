import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
};

export default function TermsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryBlue}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color={COLORS.white} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms and Conditions</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.paragraph}>Welcome to BizWise!</Text>
          <Text style={styles.paragraph}>
            BizWise is designed to help you manage your finances efficiently.
            You must be at least 18 years old to use the app, and you are
            responsible for keeping your account login details safe. Any
            activity under your account is your responsibility.
          </Text>
          <Text style={styles.paragraph}>
            We collect and use your financial data to provide and improve our
            services. While we use strong security measures to protect your
            information, we cannot guarantee that it is completely secure.
            BizWise may also connect with third-party services such as banks or
            payment platforms. We are not responsible for how these third
            parties handle your data.
          </Text>
          <Text style={styles.paragraph}>
            All content, software, and designs in BizWise are owned by us and
            are protected by copyright and intellectual property laws. You may
            not copy, share, or modify any part of the app without permission.
          </Text>
          <Text style={styles.subtitle}>Please note:</Text>
          <Text style={styles.paragraph}>
            BizWise provides financial insights and calculations as is and for
            guidance only. We are not liable for financial losses, errors, or
            decisions based on the app.
          </Text>
          <Text style={styles.paragraph}>
            Accounts may be suspended or terminated if rules are broken. You may
            also close your account anytime.
          </Text>
        </ScrollView>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 30,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    marginTop: 8,
    marginBottom: 12,
  },
});
