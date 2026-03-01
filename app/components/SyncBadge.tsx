import { Cloud, CloudOff } from "lucide-react-native";
import React from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useOffline } from "../providers/OfflineProvider";

interface SyncBadgeProps {
  compact?: boolean;
  showWhenOnline?: boolean;
}

export function SyncBadge({ compact = false, showWhenOnline = false }: SyncBadgeProps) {
  const { isOnline } = useOffline();

  if (!isOnline && !showWhenOnline) {
    return (
      <View style={[styles.container, styles.offlineContainer]}>
        <CloudOff size={compact ? 14 : 16} color="#ffffff" />
        <Text style={[styles.text, compact && styles.compactText]}>
          {compact ? "Offline" : "Offline Mode"}
        </Text>
      </View>
    );
  }

  if (showWhenOnline && isOnline) {
    return (
      <View style={[styles.container, styles.syncedContainer]}>
        <Cloud size={compact ? 14 : 16} color="#ffffff" />
        <Text style={[styles.text, compact && styles.compactText]}>
          Online
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  offlineContainer: {
    backgroundColor: "#6b7280", // Gray
  },
  syncedContainer: {
    backgroundColor: "#10b981", // Green
  },
  text: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  compactText: {
    fontSize: 10,
  },
});

export default SyncBadge;
