import { parseUnits } from 'viem';
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

  // NOTE: we are currently NOT verifying the signature; this is a placeholder.
  // A future iteration should use viem's verifyTypedData with the USDC EIP-712 domain.

  return { valid: true };
}
