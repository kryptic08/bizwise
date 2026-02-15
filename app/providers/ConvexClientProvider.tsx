import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import { MutationQueueProvider } from "./MutationQueueProvider";
import { OfflineProvider } from "./OfflineProvider";

// Initialize the Convex client
const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

interface ConvexClientProviderProps {
  children: ReactNode;
  userId?: string;
}

export default function ConvexClientProvider({
  children,
  userId,
}: ConvexClientProviderProps) {
  return (
    <OfflineProvider userId={userId}>
      <ConvexProvider client={convex}>
        <MutationQueueProvider userId={userId}>
          {children}
        </MutationQueueProvider>
      </ConvexProvider>
    </OfflineProvider>
  );
}
