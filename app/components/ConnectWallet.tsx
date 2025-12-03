"use client";
import React, { useEffect, useState, useContext } from 'react';
import { WagmiReadyContext } from '../providers/WalletProvider';
import Button from './Button';
import { baseChain } from '../../lib/baseChain';
// use the public client inside the hook instead of importing readContract directly
import { formatUnits } from 'viem';

export default function ConnectWallet() {
  const ready = useContext(WagmiReadyContext);
  // Avoid hydration mismatch: don't render provider-dependent UI until after client hydration.
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => { setHydrated(true); }, []);

  if (!hydrated || !ready) {
    // Render a stable placeholder both on server and initial client render.
    return (
      <div>
        <Button variant="secondary" disabled>Connect Wallet</Button>
      </div>
    );
  }

  return <ConnectWalletInner />;
}

function ConnectWalletInner() {
  const { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } = require('wagmi');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { address, isConnected } = useAccount();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { connect, connectors } = useConnect();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { disconnect } = useDisconnect();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const chainId = useChainId();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { switchChain } = useSwitchChain();

  const short = (addr?: string | null) => (addr ? `${addr.slice(0,6)}...${addr.slice(-4)}` : '');
  const tokenAddress = (process as any)?.env?.NEXT_PUBLIC_USDC_BASE_ADDRESS || (window as any)?.NEXT_PUBLIC_USDC_BASE_ADDRESS || null;
  const tokenBalance = useTokenBalance(isConnected && !!chainId && Number(chainId) === Number(baseChain.id), tokenAddress, address);

  const onConnect = async () => {
    try {
      const preferred = connectors && connectors.length ? connectors[0] : undefined;
      if (!preferred) {
        console.error('no connector available');
        return;
      }
      await connect({ connector: preferred });
    } catch (e) {
      console.error('connect failed', e);
    }
  };

  const onSwitch = async () => {
    try {
      if (switchChain) {
        await switchChain({ chainId: Number(baseChain.id) });
      } else {
        console.error('switchChain not available on this connector; please switch chain in your wallet');
      }
    } catch (e) {
      console.error('switch to base failed', e);
    }
  };

  return (
    <div>
      {!isConnected && (
        <Button variant="primary" onClick={onConnect}>Connect Wallet</Button>
      )}
      {isConnected && (
        <AccountButton
          address={address}
          short={short}
          tokenBalance={tokenBalance}
          chainId={chainId}
          onDisconnect={() => disconnect()}
          onSwitch={onSwitch}
        />
      )}
    </div>
  );
}

function Avatar({ address }: { address?: string | null | undefined }) {
  const shortHash = (address || '').slice(2, 10);
  let hue = 200;
  try {
    hue = [...shortHash].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;
  } catch (e) {}
  const bg = `hsl(${hue} 65% 45%)`;
  const initials = address ? address.slice(2, 4).toUpperCase() : '??';

  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono text-white" style={{ background: bg }}>
      {initials}
    </div>
  );
}

function AccountButton({ address, short, tokenBalance, chainId, onDisconnect, onSwitch }: {
  address?: string | null | undefined;
  short: (addr?: string | null) => string;
  tokenBalance?: string | null;
  chainId?: number | undefined;
  onDisconnect: () => void;
  onSwitch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(s => !s)} leftIcon={<Avatar address={address} />} rightIcon={<span className="text-sm">▾</span>}>
        {short(address)}
      </Button>

      {open ? (
        <div className="absolute right-0 mt-2 w-48 rounded-md bg-scroll-100 border border-moloch-800 p-2 shadow-lg z-50">
          <div className="text-xs text-brand-fg/80 mb-2">{chainId ? `Chain ${chainId}` : 'No chain'}</div>
          {tokenBalance ? <div className="text-sm text-brand-fg/90 mb-2">USDC: {tokenBalance}</div> : null}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { onDisconnect(); setOpen(false); }}>Disconnect</Button>
            {chainId && Number(chainId) !== Number(baseChain.id) ? (
              <Button variant="primary" size="sm" onClick={() => { onSwitch(); setOpen(false); }}>Switch</Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// fetch balance when connected and on Base
function useTokenBalance(enabled: boolean, tokenAddress?: string | null, account?: string | undefined) {
  const [balance, setBalance] = React.useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!enabled || !tokenAddress || !account) return setBalance(null);
      try {
        const { usePublicClient } = require('wagmi');
        const publicClient = usePublicClient();
        const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        let decimals = 6;
        try {
          const d = await (publicClient as any).readContract({ address: tokenAddress as `0x${string}`, abi: usdcAbi, functionName: 'decimals', chainId: Number(baseChain.id) });
          decimals = Number(d ?? 6);
        } catch (e) {
          // ignore and use default
        }
        const raw = await (publicClient as any).readContract({ address: tokenAddress as `0x${string}`, abi: usdcAbi, functionName: 'balanceOf', args: [account], chainId: Number(baseChain.id) }) as unknown as bigint;
        const formatted = formatUnits(raw, decimals);
        if (!cancelled) setBalance(formatted);
      } catch (e) {
        if (!cancelled) setBalance(null);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [enabled, tokenAddress, account]);
  return balance;
}
