import { parseUnits, verifyTypedData } from 'viem';
import type { PaymentRequirements } from './payment';

export type Eip3009Authorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
};

export type LocalVerifyResult = {
  valid: boolean;
  reason?: string;
};

// TODO: wire real EIP-712 domain + types for Base USDC
// For now this is a stub that only checks shape + basic constraints.
export async function verifyEip3009Authorization(
  authorization: Eip3009Authorization | undefined,
  signature: string | undefined,
  paymentRequirements: PaymentRequirements,
  opts?: { now?: number }
): Promise<LocalVerifyResult> {
  if (!authorization || !signature) {
    return { valid: false, reason: 'missing_authorization_or_signature' };
  }

  const now = opts?.now ?? Math.floor(Date.now() / 1000);

  // Basic value check against paymentRequirements
  try {
    const expectedValue = parseUnits(paymentRequirements.amount, 6).toString();
    if (authorization.value !== expectedValue) {
      return { valid: false, reason: 'amount_mismatch' };
    }
  } catch {
    return { valid: false, reason: 'invalid_amount' };
  }

  if (authorization.to.toLowerCase() !== paymentRequirements.recipient.toLowerCase()) {
    return { valid: false, reason: 'recipient_mismatch' };
  }

  const validAfter = Number(authorization.validAfter);
  const validBefore = Number(authorization.validBefore);
  if (Number.isFinite(validAfter) && now < validAfter) {
    return { valid: false, reason: 'authorization_not_yet_valid' };
  }
  if (Number.isFinite(validBefore) && now >= validBefore) {
    return { valid: false, reason: 'authorization_expired' };
  }

  // EIP-712 signature verification for EIP-3009 style authorization.
  try {
    const domain = {
      // These can optionally be overridden via env if needed
      name: process.env.EIP3009_DOMAIN_NAME || 'USD Coin',
      version: process.env.EIP3009_DOMAIN_VERSION || '2',
      chainId: 8453,
      verifyingContract: paymentRequirements.tokenAddress as `0x${string}`,
    } as const;

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

    const message = {
      from: authorization.from as `0x${string}`,
      to: authorization.to as `0x${string}`,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce as `0x${string}`,
    } as const;

    const signer = await verifyTypedData({
      domain,
      types,
      primaryType: 'TransferWithAuthorization',
      message,
      signature: signature as `0x${string}`,
      address: authorization.from as `0x${string}`,
    });

    if (!signer) {
      return { valid: false, reason: 'invalid_signature' };
    }
  } catch (e: any) {
    return { valid: false, reason: e?.message || 'signature_verification_failed' };
  }

  return { valid: true };
}
