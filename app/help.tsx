import { useRouter } from "expo-router";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react-native";
import React, { useState } from "react";
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
  borderGray: "#d1d5db",
};

const FAQ_DATA = [
  {
    id: 1,
    question: "How can i delete and add products?",
    answer:
      "To add products, go to the Counter tab and tap the '+' button in the top right. To delete products, tap on any product card and select 'Edit', then you'll see a delete option at the bottom.",
  },
  {
    id: 2,
    question: "How to contact support",
    answer:
      "You can contact our support team via email at bizwise.official@gmail.com or text/call us at +639292305818. We're here to help!",
  },
  {
    id: 3,
    question: "How can i reset my password",
    answer:
      "To reset your password, go to the login screen and tap 'Forgot Password'. You'll receive a password reset link via email. Alternatively, if you're already logged in, go to Profile > Settings > Password Settings to change your password.",
  },
  {
    id: 4,
    question: "How can I delete my account",
    answer:
      "To delete your account, go to Profile > Settings > Delete Account. Please note that this action is permanent and will delete all your data including expenses, income, and transactions. You'll need to enter your password to confirm.",
  },
  {
    id: 5,
    question: "Does the app work offline?",
    answer:
      "BizWise requires an active internet connection to work properly. All your data is securely stored and synced in the cloud in real-time, ensuring your business information is always backed up and accessible from any device.",
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

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
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.subtitle}>Frequently Asked Questions</Text>

        {FAQ_DATA.map((faq) => (
          <View key={faq.id} style={styles.faqCard}>
            <TouchableOpacity
              style={styles.faqHeader}
              onPress={() => toggleExpand(faq.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              {expandedId === faq.id ? (
                <ChevronDown color={COLORS.primaryBlue} size={22} />
              ) : (
                <ChevronRight color={COLORS.textGray} size={22} />
              )}
            </TouchableOpacity>

            {expandedId === faq.id && (
              <View style={styles.faqAnswerContainer}>
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => router.push("/contact-us")}
        >
          <Text style={styles.contactButtonText}>
            Still Need Help? Contact Us
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryBlue },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: COLORS.white },
  content: {
    flex: 1,
    backgroundColor: COLORS.lightBlueBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  scrollContent: { padding: 20, paddingTop: 30 },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 16,
  },
  faqCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textDark,
    marginRight: 12,
  },
  faqAnswerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderGray,
  },
  faqAnswer: {
    fontSize: 14,
    color: COLORS.textGray,
    lineHeight: 20,
    marginTop: 12,
  },
  contactButton: {
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  contactButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
});
