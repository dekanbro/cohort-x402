"use client";
import React from 'react';
import { WagmiProvider, createConfig, createStorage, http } from 'wagmi';
import { injected } from '@wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { baseChain } from '../../lib/baseChain';

const rpcUrl = (process as any)?.env?.NEXT_PUBLIC_RPC_URL || 'https://rpc.base.org';

export const WagmiReadyContext = React.createContext<boolean>(false);

export default function WalletProvider({ children }: { children: React.ReactNode }) {
  // Create storage on client render (uses localStorage when available)
  const storage = React.useMemo(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return createStorage({ storage: window.localStorage as any });
      }
    } catch (e) {
      // ignore and fall through
    }
    return undefined as any;
  }, []);

  // Create wagmi config using transports + an injected connector.
  // This follows the wagmi v3 docs: provide `chains` and `transports` (http), and a connector from @wagmi/connectors.
  const config = React.useMemo(() => {
    try {
      return createConfig({
        chains: [baseChain as any],
        transports: {
          [Number(baseChain.id)]: http(rpcUrl),
        },
        connectors: [injected()],
        storage,
      });
    } catch (e) {
      console.error('createConfig failed', e);
      return undefined as any;
    }
  }, [storage]);

  const ready = !!config;

  const queryClient = React.useMemo(() => new QueryClient(), []);

  return (
    <WagmiReadyContext.Provider value={ready}>
      {ready ? (
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </WagmiProvider>
      ) : (
        <>{children}</>
      )}
    </WagmiReadyContext.Provider>
  );
}
