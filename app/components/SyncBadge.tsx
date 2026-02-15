import { Cloud, CloudOff, Loader2, RefreshCw, XCircle } from "lucide-react-native";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import { useMutationQueue } from "../providers/MutationQueueProvider";
import { useOffline } from "../providers/OfflineProvider";

interface SyncBadgeProps {
  compact?: boolean;
  showWhenOnline?: boolean;
}

export function SyncBadge({ compact = false, showWhenOnline = false }: SyncBadgeProps) {
  const { isOnline } = useOffline();
  const {
    pendingCount,
    syncingCount,
    errorCount,
    isSyncing,
    syncNow,
  } = useMutationQueue();

  const spinAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [isSyncing, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Don't show if online with no pending items (unless showWhenOnline)
  if (isOnline && pendingCount === 0 && errorCount === 0 && !showWhenOnline) {
    return null;
  }

  // Offline with pending items
  if (!isOnline && (pendingCount > 0 || errorCount > 0)) {
    return (
      <View style={[styles.container, styles.offlineContainer]}>
        <CloudOff size={compact ? 14 : 16} color="#ffffff" />
        <Text style={[styles.text, compact && styles.compactText]}>
          {compact
            ? `${pendingCount + errorCount} pending`
            : `${pendingCount + errorCount} items pending sync`}
        </Text>
      </View>
    );
  }

  // Error state
  if (errorCount > 0 && !isSyncing) {
    return (
      <TouchableOpacity
        onPress={syncNow}
        style={[styles.container, styles.errorContainer]}
      >
        <XCircle size={compact ? 14 : 16} color="#ffffff" />
        <Text style={[styles.text, compact && styles.compactText]}>
          {compact ? `${errorCount} failed` : `${errorCount} sync failed - Tap to retry`}
        </Text>
      </TouchableOpacity>
    );
  }

  // Syncing state
  if (isSyncing || syncingCount > 0) {
    return (
      <View style={[styles.container, styles.syncingContainer]}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Loader2 size={compact ? 14 : 16} color="#ffffff" />
        </Animated.View>
        <Text style={[styles.text, compact && styles.compactText]}>
          {compact ? "Syncing..." : `Syncing ${syncingCount} items...`}
        </Text>
      </View>
    );
  }

  // Online with pending items (waiting to sync)
  if (isOnline && pendingCount > 0) {
    return (
      <TouchableOpacity
        onPress={syncNow}
        style={[styles.container, styles.pendingContainer]}
      >
        <Cloud size={compact ? 14 : 16} color="#ffffff" />
        <Text style={[styles.text, compact && styles.compactText]}>
          {compact
            ? `${pendingCount} pending`
            : `${pendingCount} items to sync - Tap now`}
        </Text>
      </TouchableOpacity>
    );
  }

  // All synced
  if (showWhenOnline && isOnline) {
    return (
      <View style={[styles.container, styles.syncedContainer]}>
        <Cloud size={compact ? 14 : 16} color="#ffffff" />
        <Text style={[styles.text, compact && styles.compactText]}>
          {compact ? "Synced" : "All changes synced"}
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
  syncingContainer: {
    backgroundColor: "#3b6ea5", // Primary blue
  },
  pendingContainer: {
    backgroundColor: "#f59e0b", // Amber
  },
  errorContainer: {
    backgroundColor: "#ef4444", // Red
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
