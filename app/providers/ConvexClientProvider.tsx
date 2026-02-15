import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import { MutationQueueProvider } from "./MutationQueueProvider";
import { OfflineProvider } from "./OfflineProvider";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

interface ConvexClientProviderProps {
  children: ReactNode;
}

export default function ConvexClientProvider({
  children,
}: ConvexClientProviderProps) {
  return (
    <OfflineProvider>
      <ConvexProvider client={convex}>
        <MutationQueueProvider>
          {children}
        </MutationQueueProvider>
      </ConvexProvider>
    </OfflineProvider>
  );
}
