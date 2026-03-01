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
          <Text style={styles.paragraph}>
            By using BizWise, you agree to use the app only for lawful purposes and to provide
            accurate financial information. BizWise is an academic project designed to assist with recording
            sales, expenses, receipt scanning, and report generation. It does not replace professional
            accounting advice.
          </Text>
          <Text style={styles.paragraph}>
            While the app uses AI to extract receipt data, users are responsible for reviewing and confirming
            all entries. The developers are not liable for financial decisions, losses, or errors resulting from
            system outputs or incorrect data input.
          </Text>
          <Text style={styles.paragraph}>
            Your data will be used only for system functionality, testing, and academic evaluation. By
            continuing to use the app, you agree to these terms.
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
});
