import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = "bizwise_user";
const PIN_LOCK_KEY = "bizwise_pin_locked";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPinLocked, setIsPinLocked] = useState(false);

  // Load user from storage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);

          // Check if user has PIN and should be locked
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

  const login = async (userData: User) => {
    try {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);

      // If user has PIN, lock immediately
      if (userData.pin) {
        setIsPinLocked(true);
      }
    } catch (error) {
      console.error("Error saving user to storage:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      await AsyncStorage.removeItem(PIN_LOCK_KEY);
      setUser(null);
      setIsPinLocked(false);
    } catch (error) {
      console.error("Error removing user from storage:", error);
      throw error;
    }
  };

  const unlockWithPin = () => {
    setIsPinLocked(false);
  };

  const lockWithPin = () => {
    if (user?.pin) {
      setIsPinLocked(true);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isPinLocked,
        login,
        logout,
        unlockWithPin,
        lockWithPin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
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
