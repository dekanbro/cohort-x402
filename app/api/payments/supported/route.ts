import { NextRequest } from 'next/server';
import { buildPaymentRequirements } from '../../../../lib/payment';
import { PRICE_IN_USDC } from '../../../../lib/config';

export async function GET(_req: NextRequest) {
  const baseRequirements = buildPaymentRequirements({ amount: PRICE_IN_USDC, description: 'Access to /api/secret once' });

  const supported: any[] = [
    {
      paymentRequirements: baseRequirements,
    },
  ];

  if (process.env.ENABLE_EIP3009 === 'true') {
    const exactRequirements = {
      ...baseRequirements,
      scheme: 'exact',
      extra: { ...(baseRequirements.extra || {}), kind: 'eip3009' },
    };
    supported.push({ paymentRequirements: exactRequirements });
  }

  return new Response(
    JSON.stringify({
      x402Version: 1,
      supported,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
