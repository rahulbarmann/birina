"use client";

import { WagmiProvider } from "wagmi";
import { config } from "./config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
const queryClient = new QueryClient();
import { ConnectKitProvider } from "connectkit";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <Toaster />
                <ConnectKitProvider>{children}</ConnectKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
