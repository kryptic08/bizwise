import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Id } from "../../convex/_generated/dataModel";

interface User {
  userId: Id<"users">;
  email: string;
  name: string;
  phone?: string;
  pin?: string;
  profilePicture?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isPinLocked: boolean;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  unlockWithPin: () => void;
  lockWithPin: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = "bizwise_user";
const PIN_LOCK_KEY = "bizwise_pin_locked";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPinLocked, setIsPinLocked] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);

          if (userData.pin) {
            setIsPinLocked(true);
          }
        }
      } catch (error) {
        console.error("Error loading user from storage:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = useCallback(async (userData: User) => {
    try {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);

      if (userData.pin) {
        setIsPinLocked(true);
      }
    } catch (error) {
      console.error("Error saving user to storage:", error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      await AsyncStorage.removeItem(PIN_LOCK_KEY);
      await AsyncStorage.removeItem("bizwise_mutation_queue");
      setUser(null);
      setIsPinLocked(false);
    } catch (error) {
      console.error("Error removing user from storage:", error);
      throw error;
    }
  }, []);

  const unlockWithPin = useCallback(() => {
    setIsPinLocked(false);
  }, []);

  const lockWithPin = useCallback(() => {
    setIsPinLocked((prev) => {
      if (prev && user?.pin) return true;
      return user?.pin ? true : false;
    });
  }, [user?.pin]);

  const refreshUser = useCallback(async () => {
    try {
      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isPinLocked,
      login,
      logout,
      unlockWithPin,
      lockWithPin,
      refreshUser,
    }),
    [
      user,
      isLoading,
      isPinLocked,
      login,
      logout,
      unlockWithPin,
      lockWithPin,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Default export required by React Navigation
export default AuthProvider;
