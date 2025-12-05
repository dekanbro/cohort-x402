import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import type { PaymentRequirements } from './payment';
import type { Eip3009Authorization } from './eip3009';

const erc3009Abi = [
  {
    type: 'function',
    name: 'transferWithAuthorization',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

export type SettleResult = {
  txHash?: `0x${string}`;
  success: boolean;
  reason?: string;
};

export async function settleEip3009Authorization(args: {
  authorization: Eip3009Authorization;
  signature: `0x${string}`;
  paymentRequirements: PaymentRequirements;
}): Promise<SettleResult> {
  const pk = process.env.SETTLEMENT_PRIVATE_KEY;
  if (!pk) {
    return { success: false, reason: 'missing_settlement_private_key' };
  }

  try {
    // Settlement is executed by a dedicated facilitator wallet derived from SETTLEMENT_PRIVATE_KEY.
    const account = ("0x" + pk.replace(/^0x/, "")) as `0x${string}`;

    const client = createWalletClient({
      account,
      chain: base,
      transport: http(process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org'),
    });

    const sig = args.signature;
    const r = sig.slice(0, 66) as `0x${string}`;
    const s = ("0x" + sig.slice(66, 130)) as `0x${string}`;
    const v = parseInt(sig.slice(130, 132), 16);

    const txHash = await client.writeContract({
      address: args.paymentRequirements.tokenAddress as `0x${string}`,
      abi: erc3009Abi,
      functionName: 'transferWithAuthorization',
      args: [
        args.authorization.from as `0x${string}`,
        args.authorization.to as `0x${string}`,
        BigInt(args.authorization.value),
        BigInt(args.authorization.validAfter),
        BigInt(args.authorization.validBefore),
        args.authorization.nonce as `0x${string}`,
        v,
        r,
        s,
      ],
    });

    return { success: true, txHash };
  } catch (e: any) {
    return { success: false, reason: e?.message || String(e) };
  }
}
