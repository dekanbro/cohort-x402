"use client";
import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';

// Allow usage of build-time NEXT_PUBLIC_* vars without requiring node types in client files
declare const process: any;
import { baseChain } from '../../lib/baseChain';
import { encodeFunctionData, parseUnits } from 'viem';

const erc20Abi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export default function SecretPage() {
  const [status, setStatus] = useState<'idle'|'loading'|'needsPayment'|'unlocked'>('idle');
  const [paymentReq, setPaymentReq] = useState<any>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // use global wagmi account state
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [networkMismatch, setNetworkMismatch] = useState<string | null>(null);
  // Balance display is handled in the global account dropdown, not on this page
  const isLoading = status === 'loading';

  // When the global wagmi account or payment requirement changes, re-check network
  useEffect(() => {
    setNetworkMismatch(null);
    if (paymentReq && address) {
      checkNetwork();
    }
  }, [paymentReq, address, chainId]);
  // Connection handled globally via the header/wagmi provider

  async function loadSecret(withPayment?: any) {
    setStatus('loading');
    setErrorMsg(null);
    try {
      const headers: Record<string,string> = {};
      if (withPayment) {
        headers['X-402-Payment'] = JSON.stringify(withPayment);
      }
      const res = await fetch('/api/secret', { headers });
      if (res.status === 200) {
        const body = await res.json();
        setSecret(body.data);
        setStatus('unlocked');
        return;
      }
      if (res.status === 402) {
        const body = await res.json();
        const pr = body.paymentRequirements || body;
        // prefer server-provided tokenAddress, fallback to public env var at runtime
        try {
          const fallback = (process?.env as any)?.NEXT_PUBLIC_USDC_BASE_ADDRESS || (window as any)?.NEXT_PUBLIC_USDC_BASE_ADDRESS;
          if (!pr.tokenAddress && fallback) pr.tokenAddress = fallback;
        } catch (e) {
          // ignore in non-browser env
        }
        // Store raw paymentRequirements object for use in the payment payload
        setPaymentReq(pr);
        // paymentRequirements received
        setStatus('needsPayment');
        return;
      }
      // Try to parse JSON error from server
      let bodyText = '';
      try {
        const json = await res.json();
        bodyText = (json && json.error) ? JSON.stringify(json) : JSON.stringify(json);
      } catch (e) {
        bodyText = await res.text().catch(() => String(res.status));
      }
      console.error('unexpected', res.status, bodyText);
      setErrorMsg(`Server error (${res.status}): ${bodyText}`);
      setStatus('idle');
    } catch (e) {
      console.error(e);
      setErrorMsg(`Request failed: ${String(e)}`);
      setStatus('idle');
    }
  }

  // Legacy mock-payment flow removed; always use real wallet + on-chain verification

  // Wallet-based payment: send USDC (ERC-20) to recipient and use txHash as proof
  async function payWithWallet() {
    if (!paymentReq) return;
    if (!isConnected || !address) {
      setErrorMsg('Connect a wallet to pay.');
      return;
    }
    if (!(window as any).ethereum) {
      setErrorMsg('No injected wallet (e.g. MetaMask) found');
      return;
    }
    try {
      setStatus('loading');
      setErrorMsg(null);
      // If using EIP-3009 / exact scheme, sign an authorization instead of
      // sending a direct USDC transfer.
      if (paymentReq.scheme === 'exact') {
        const nowSec = Math.floor(Date.now() / 1000);
        const validAfter = nowSec;
        const validBefore = nowSec + 3600; // 1 hour window

        const amountDecimal = paymentReq.amount || paymentReq.price || '0.0001';
        const decimals = 6; // USDC on Base has 6 decimals
        const value = parseUnits(amountDecimal, decimals).toString();

        const domain = {
          name: 'USD Coin',
          version: '2',
          chainId: 8453,
          verifyingContract: paymentReq.tokenAddress,
        };

        const types = {
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
          ],
        } as const;

        const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
        const nonceHex = Array.from(nonceBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const nonce = `0x${nonceHex}`;

        const message = {
          from: address,
          to: paymentReq.recipient,
          value,
          validAfter: BigInt(validAfter).toString(),
          validBefore: BigInt(validBefore).toString(),
          nonce,
        };

        const typedData = {
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ],
            ...types,
          },
          primaryType: 'TransferWithAuthorization',
          domain,
          message,
        } as const;

        const signature = await (window as any).ethereum.request({
          method: 'eth_signTypedData_v4',
          params: [address, JSON.stringify(typedData)],
        });

        const payment = {
          x402Version: 1,
          paymentPayload: {
            scheme: 'exact',
            network: paymentReq.network || 'base',
            payload: {
              authorization: message,
              signature,
            },
          },
          paymentRequirements: { ...paymentReq, scheme: 'exact' },
        };

        await loadSecret(payment);
        return;
      }
      // If the payment requires Base, proactively ask the wallet to switch first.
      try {
        if (paymentReq.network && String(paymentReq.network).toLowerCase().includes('base')) {
          // payment requires Base — requesting wallet switch before checks
          const forced = await switchToBase();
          if (!forced) {
            setErrorMsg('Please switch your wallet to Base to continue (user did not approve chain switch)');
            setStatus('idle');
            return;
          }
        }
      } catch (e: any) {
        // pre-check switchToBase threw
      }
      // Ensure network matches expected
        // Debug: print token and expected network before payment
        // about to payWithWallet
      let networkOk = await checkNetwork();
      if (networkOk === false) {
        // Try to auto-switch the user's wallet to Base before aborting
        try {
          // network mismatch — attempting auto-switch to Base
          const switched = await switchToBase();
          if (!switched) {
            setStatus('idle');
            return;
          }
          // re-check network after attempting to switch
          networkOk = await checkNetwork();
          if (networkOk === false) {
            setStatus('idle');
            return;
          }
        } catch (e) {
          // auto-switch failed
          setStatus('idle');
          return;
        }
      }
      const recipient = paymentReq.recipient as `0x${string}`;
      const amountDecimal = paymentReq.amount || paymentReq.price || '0.0001';
      const tokenAddress = (paymentReq.tokenAddress || (process?.env as any)?.NEXT_PUBLIC_USDC_BASE_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;
      const decimals = 6; // USDC on Base has 6 decimals
      const amount = parseUnits(amountDecimal, decimals);

      // Final guard: if still not on Base, abort before sending
      if (paymentReq.network && String(paymentReq.network).toLowerCase().includes('base') && Number(chainId ?? 0) !== 8453) {
        setErrorMsg('Please switch your wallet to Base (chainId 8453) to continue.');
        setStatus('idle');
        return;
      }

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient, amount],
      });

      // Send transaction via the injected wallet provider
      const tx = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: tokenAddress,
          data,
        }],
      });
      // normalize tx hash
      const txHash = typeof tx === 'string' ? tx : (tx && (tx as any).hash) ? (tx as any).hash : String(tx);
      const payment = {
        x402Version: 1,
        paymentPayload: {
          scheme: paymentReq.scheme || 'evm-txhash',
          network: paymentReq.network || 'base',
          payload: {
            txHash,
          },
        },
        paymentRequirements: paymentReq,
      };
      await loadSecret(payment);
    } catch (e: any) {
      console.error('wallet pay failed', e);
      setErrorMsg(String(e?.message || e));
      setStatus('idle');
    }
  }

  // (old local account listener removed; using wagmi's `address` instead)

  async function checkNetwork() {
    try {
      if (paymentReq && paymentReq.network) {
        const expected = String(paymentReq.network).toLowerCase();
        const chainIdNum = Number(chainId ?? 0);
        if (expected.includes('base') && chainIdNum !== 8453) {
          setNetworkMismatch(`Connected chainId ${chainIdNum} != expected Base (8453)`);
          return false;
        }
      }
      setNetworkMismatch(null);
      return true;
    } catch (e: any) {
      console.warn('network check failed', e);
      return null;
    }
  }

  // Request the wallet to switch to Base (chainId 8453). Prefer wagmi's switchNetwork.
  async function switchToBase() {
    try {
      if (switchChain) {
        await switchChain({ chainId: Number(baseChain.id) });
        await checkNetwork();
        return true;
      }
    } catch (err: any) {
      // switchChain may throw if the chain isn't added (4902). Try adding via provider then switching.
      const code = err?.code ?? err?.message;
      if (String(code).toLowerCase().includes('4902') || String(code).toLowerCase().includes('unrecognized')) {
        try {
          const rpcUrl = (process?.env as any)?.NEXT_PUBLIC_RPC_URL || (window as any)?.NEXT_PUBLIC_RPC_URL || 'https://rpc.base.org';
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: [rpcUrl],
              blockExplorerUrls: ['https://basescan.org'],
            }],
          });
          if (switchChain) {
            await switchChain({ chainId: Number(baseChain.id) });
          } else {
            await (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
          }
          await checkNetwork();
          return true;
        } catch (addErr: any) {
          setErrorMsg(`Failed to add/switch chain: ${String(addErr?.message || addErr)}`);
          return false;
        }
      }
      setErrorMsg(`Failed to switch chain: ${String(err?.message || err)}`);
      return false;
    }
    // If we reach here and switching via wagmi/provider wasn't available or failed, instruct the user
    setErrorMsg('Please switch your wallet to Base (chainId 8453) manually');
    return false;
  }

  // removed checkTokenBalance; rely on contract/wallet for insufficient-balance errors

  return (
    <main className="max-w-3xl mx-auto space-y-5">
      <div className="card">
        <h1 className="text-xl font-semibold mb-1">x402 Secret Demo</h1>
        <p className="text-sm text-muted-foreground">
          Load the secret, then pay with your wallet on Base to unlock. This flow will evolve into a “buy one-month pass” (≈5 USDC)
          that issues an API key for facilitator access—this page is the future home for that experience.
        </p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold">Step 1: Request access</p>
            <p className="text-sm text-muted-foreground">Fetch payment requirements and see if the secret is already unlocked.</p>
          </div>
          <Button variant="primary" onClick={() => loadSecret()} disabled={isLoading}>
            {status === 'loading' ? 'Loading…' : 'Load Secret'}
          </Button>
        </div>
      </div>

      {status === 'needsPayment' && paymentReq && (
        <div className="card space-y-2">
          <div>
            <p className="font-semibold">Step 2: Pay with wallet</p>
            <p className="text-sm text-muted-foreground">
              Scheme: {paymentReq.scheme || 'evm-txhash'} · Amount: {paymentReq.amount || paymentReq.price || 'unknown'} USDC
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {paymentReq.scheme === 'exact'
              ? 'Sign an authorization for the requested amount of USDC on Base (EIP-3009 facilitator).'
              : 'Send the requested amount of USDC on Base to unlock the secret.'}
          </p>
          {networkMismatch && (
            <div className="mt-1 text-sm text-red-700">
              {networkMismatch}
            </div>
          )}
          {!isConnected && (
            <div className="mt-1 text-sm text-red-700">
              Connect your wallet to continue (use the top-right connect control).
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="primary" onClick={payWithWallet} disabled={!isConnected || isLoading}>
              {paymentReq.scheme === 'exact' ? 'Sign message' : 'Pay with Wallet'}
            </Button>
            {networkMismatch && (
              <Button variant="secondary" onClick={switchToBase}>
                Switch to Base
              </Button>
            )}
          </div>
        </div>
      )}

      {status === 'unlocked' && secret && (
        <div className="card">
          <h3 className="text-lg font-medium mb-2">Secret</h3>
          <pre className="p-3 rounded border border-muted bg-bg whitespace-pre-wrap">{secret}</pre>
        </div>
      )}

      {errorMsg && (
        <div className="card">
          <p className="font-semibold">Error</p>
          <pre className="whitespace-pre-wrap mt-1">{errorMsg}</pre>
          <div className="mt-2">
            <button className="px-3 py-1 border rounded" onClick={() => { setErrorMsg(null); loadSecret(); }}>Retry</button>
          </div>
        </div>
      )}
    </main>
  );
}
