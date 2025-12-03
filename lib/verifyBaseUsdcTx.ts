import { createPublicClient, http, decodeFunctionData, Hex } from 'viem';
import { base } from 'viem/chains';

// Minimal ERC-20 transfer ABI
const erc20TransferAbi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export type VerifyBaseUsdcTxOptions = {
  txHash: Hex;
  usdcAddress: Hex;
  expectedRecipient: Hex;
  expectedAmountUnits: bigint; // amount in smallest units (6 decimals for USDC)
  rpcUrl?: string;
};

export type LocalVerifyResult = {
  valid: boolean;
  reason?: string;
};

export async function verifyBaseUsdcTx(opts: VerifyBaseUsdcTxOptions): Promise<LocalVerifyResult> {
  const rpcUrl = opts.rpcUrl || process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org';

  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  const maxAttempts = 3;
  const delayMs = 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Prefer receipt first so we don't fail on nodes that only index receipts
      const receipt = await client.getTransactionReceipt({ hash: opts.txHash });
      if (!receipt) {
        if (attempt < maxAttempts - 1) {
          await new Promise((res) => setTimeout(res, delayMs));
          continue;
        }
        return { valid: false, reason: 'Transaction not found (receipt unavailable yet)' };
      }

      if (receipt.status !== 'success') {
        return { valid: false, reason: 'Transaction not successful' };
      }

      const tx = await client.getTransaction({ hash: opts.txHash });
      if (!tx) {
        if (attempt < maxAttempts - 1) {
          await new Promise((res) => setTimeout(res, delayMs));
          continue;
        }
        return { valid: false, reason: 'Transaction not found (tx unavailable yet)' };
      }

      if (!tx.to || tx.to.toLowerCase() !== opts.usdcAddress.toLowerCase()) {
        return { valid: false, reason: 'Transaction not sent to expected USDC contract' };
      }

      if (!tx.input || tx.input === '0x') {
        return { valid: false, reason: 'Transaction has no data; not an ERC-20 transfer' };
      }

      const decoded = decodeFunctionData({
        abi: erc20TransferAbi,
        data: tx.input,
      });

      if (decoded.functionName !== 'transfer') {
        return { valid: false, reason: 'Not an ERC-20 transfer call' };
      }

      const [to, value] = decoded.args as [Hex, bigint];

      if (to.toLowerCase() !== opts.expectedRecipient.toLowerCase()) {
        return { valid: false, reason: 'Transfer recipient does not match expected recipient' };
      }

      if (value !== opts.expectedAmountUnits) {
        return { valid: false, reason: 'Transfer amount does not match expected amount' };
      }

      return { valid: true };
    } catch (e: any) {
      if (attempt < maxAttempts - 1) {
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      return { valid: false, reason: e?.message || String(e) };
    }
  }

  return { valid: false, reason: 'Unknown verification failure' };
}
