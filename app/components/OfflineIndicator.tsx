import { Wifi, WifiOff } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  formatLastSync,
  useOffline,
} from "../providers/OfflineProvider";

export function OfflineIndicator() {
  const { isOnline, lastSyncTime, isSyncing } = useOffline();

  // Don't show anything if online and not syncing
  if (isOnline && !isSyncing) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        isOnline ? styles.syncingContainer : styles.offlineContainer,
      ]}
    >
      {isOnline ? (
        <>
          <Wifi size={14} color="#fff" />
          <Text style={styles.text}>Syncing...</Text>
        </>
      ) : (
        <>
          <WifiOff size={14} color="#fff" />
          <Text style={styles.text}>
            Offline • Last synced: {formatLastSync(lastSyncTime)}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  offlineContainer: {
    backgroundColor: "#ef4444", // Red for offline
  },
  syncingContainer: {
    backgroundColor: "#3b6ea5", // Blue for syncing
  },
  text: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
