import { USDC_BASE_ADDRESS } from './config';

export type PaymentRequirements = {
  // x402-ish metadata about what payment is needed
  scheme: string; // e.g. "evm-txhash"
  network: string; // e.g. "base"
  asset?: string; // e.g. "USDC"
  resource?: string; // e.g. "/api/secret"
  mimeType?: string; // e.g. "application/json"
  maxTimeoutSeconds?: number;
  extra?: Record<string, any>;

  // Concrete values we actually enforce in local verification
  amount: string; // human-readable decimal string, e.g. "0.0001"
  recipient: string;
  tokenAddress: string;
  description?: string;
};

export function buildPaymentRequirements(opts: Partial<PaymentRequirements> & { amount?: string }) : PaymentRequirements {
  const network = opts.network || process.env.X402_NETWORK || 'base';
  const amount = opts.amount || (process.env.PRICE_IN_USDC || '0.0001');
  const recipient = opts.recipient || process.env.SERVICE_RECIPIENT_ADDRESS || '0xSERVICE_RECIPIENT_PLACEHOLDER';
  const tokenAddress = opts.tokenAddress || process.env.USDC_BASE_ADDRESS || USDC_BASE_ADDRESS;

  return {
    scheme: opts.scheme || 'evm-txhash',
    network,
    asset: opts.asset || 'USDC',
    resource: opts.resource || '/api/secret',
    mimeType: opts.mimeType || 'application/json',
    maxTimeoutSeconds: opts.maxTimeoutSeconds ?? 600,
    extra: opts.extra,
    amount,
    recipient,
    tokenAddress,
    description: opts.description || 'Access to protected resource',
  };
}
