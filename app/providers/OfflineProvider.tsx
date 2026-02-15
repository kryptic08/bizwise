import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  QueryClient,
} from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import NetInfo from "@react-native-community/netinfo";

interface OfflineContextType {
  isOnline: boolean;
  lastSyncTime: Date | null;
  isSyncing: boolean;
  syncStatus: "idle" | "syncing" | "error";
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  lastSyncTime: null,
  isSyncing: false,
  syncStatus: "idle",
});

export const useOffline = () => useContext(OfflineContext);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 60 * 5,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: "offlineFirst",
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "bizwise_query_cache",
  throttleTime: 1000,
});

interface OfflineProviderProps {
  children: React.ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");

  useEffect(() => {
    // Load last sync time
    AsyncStorage.getItem("bizwise_last_sync").then((timestamp) => {
      if (timestamp) {
        setLastSyncTime(new Date(parseInt(timestamp)));
      }
    });

    // Monitor network status
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected === true &&
        (state.isInternetReachable === true || state.isInternetReachable === null);
      setIsOnline(online);

      if (online) {
        const now = Date.now();
        AsyncStorage.setItem("bizwise_last_sync", now.toString());
        setLastSyncTime(new Date(now));
      }
    });

    NetInfo.fetch().then((state) => {
      setIsOnline(
        state.isConnected === true &&
          (state.isInternetReachable === true || state.isInternetReachable === null),
      );
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      setIsSyncing(true);
      setSyncStatus("syncing");

      queryClient
        .invalidateQueries()
        .then(() => {
          setSyncStatus("idle");
        })
        .catch(() => {
          setSyncStatus("error");
        })
        .finally(() => {
          setIsSyncing(false);
        });
    }
  }, [isOnline]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        lastSyncTime,
        isSyncing,
        syncStatus,
      }}
    >
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: asyncStoragePersister,
          maxAge: 1000 * 60 * 60 * 24 * 7,
        }}
      >
        {children}
      </PersistQueryClientProvider>
    </OfflineContext.Provider>
  );
}

export { queryClient };

export function formatLastSync(date: Date | null): string {
  if (!date) return "Never synced";

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 1000 / 60);
  const hours = Math.floor(diff / 1000 / 60 / 60);
  const days = Math.floor(diff / 1000 / 60 / 60 / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
