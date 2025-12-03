import type { PaymentRequirements } from './payment';
import { verifyBaseUsdcTx } from './verifyBaseUsdcTx';
import type { Eip3009Authorization } from './eip3009';
import { verifyEip3009Authorization } from './eip3009';

export type VerifyContext = {
  x402Version: number;
  paymentPayload: {
    scheme: 'evm-txhash' | 'exact';
    network: string;
    payload: any;
  };
  paymentRequirements: PaymentRequirements;
};

export type VerifyResult = {
  valid: boolean;
  scheme: string;
  reason?: string;
  txHash?: string;
  authorization?: Eip3009Authorization;
  signature?: `0x${string}` | string;
};

export async function verifyPayment(ctx: VerifyContext): Promise<VerifyResult> {
  const { paymentPayload, paymentRequirements } = ctx;
  const scheme = paymentPayload?.scheme;

  if (!scheme) {
    return { valid: false, scheme: 'unknown', reason: 'missing_scheme' };
  }

  if (scheme === 'evm-txhash') {
    const txHash = paymentPayload?.payload?.txHash as string | undefined;
    if (!txHash) {
      return { valid: false, scheme, reason: 'missing_txHash' };
    }

    // For now we only support USDC with 6 decimals and reuse the existing
    // verifyBaseUsdcTx helper, which expects amount in smallest units.
    const res = await verifyBaseUsdcTx({
      txHash: txHash as any,
      expectedRecipient: paymentRequirements.recipient as any,
      usdcAddress: paymentRequirements.tokenAddress as any,
      // Caller (routes) should prefer using verifyBaseUsdcTx directly when they
      // have already parsed amount to units; this path is mainly for generic
      // x402-style usage where amount is enforced elsewhere.
      expectedAmountUnits: BigInt(0),
    });

    return { valid: res.valid, reason: res.reason, scheme, txHash };
  }

  if (scheme === 'exact') {
    const authorization = paymentPayload?.payload?.authorization as Eip3009Authorization | undefined;
    const signature = paymentPayload?.payload?.signature as string | undefined;

    const res = await verifyEip3009Authorization(authorization, signature, paymentRequirements);
    return {
      valid: res.valid,
      reason: res.reason,
      scheme,
      authorization: authorization,
      signature,
    };
  }

  return { valid: false, scheme, reason: 'unsupported_scheme' };
}
