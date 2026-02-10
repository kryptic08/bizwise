import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  MessageCircle,
} from "lucide-react-native";
import React from "react";
import {
  Linking,
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

const CONTACT_OPTIONS = [
  {
    id: 1,
    icon: Globe,
    label: "Email",
    value: "bizwise.official@gmail.com",
    url: "mailto:bizwise.official@gmail.com",
  },
  {
    id: 2,
    icon: MessageCircle,
    label: "Text or Call",
    value: "+639292305818",
    url: "tel:+639292305818",
  },
];

export default function ContactUsScreen() {
  const router = useRouter();

  const handlePress = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error("Failed to open URL:", error);
    }
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
        <Text style={styles.headerTitle}>Contact Us</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.subtitle}>Get in Touch</Text>
        <Text style={styles.description}>
          Have questions or need assistance? Reach out to us through any of
          these channels:
        </Text>

        {CONTACT_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <TouchableOpacity
              key={option.id}
              style={styles.contactCard}
              onPress={() => handlePress(option.url)}
              activeOpacity={0.7}
            >
              <View style={styles.contactLeft}>
                <View style={styles.iconContainer}>
                  <Icon color={COLORS.primaryBlue} size={24} />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>{option.label}</Text>
                  <Text style={styles.contactValue}>{option.value}</Text>
                </View>
              </View>
              <ExternalLink color={COLORS.textGray} size={20} />
            </TouchableOpacity>
          );
        })}

        <View style={styles.supportBox}>
          <Text style={styles.supportTitle}>Support Hours</Text>
          <Text style={styles.supportText}>
            Monday - Friday: 9:00 AM - 6:00 PM (PHT)
          </Text>
          <Text style={styles.supportText}>
            Saturday - Sunday: 10:00 AM - 4:00 PM (PHT)
          </Text>
          <Text style={[styles.supportText, { marginTop: 12 }]}>
            We typically respond within 24 hours on business days.
          </Text>
        </View>
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
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.textGray,
    marginBottom: 24,
    lineHeight: 20,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  contactLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.lightBlueBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  contactInfo: { flex: 1 },
  contactLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 4,
  },
  contactValue: { fontSize: 13, color: COLORS.textGray },
  supportBox: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 12,
  },
  supportText: {
    fontSize: 14,
    color: COLORS.textGray,
    lineHeight: 20,
    marginBottom: 4,
  },
});
