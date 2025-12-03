import { NextRequest } from 'next/server';
import { buildPaymentRequirements } from '../../../../lib/payment';
import { PRICE_IN_USDC } from '../../../../lib/config';

export async function GET(_req: NextRequest) {
  const paymentRequirements = buildPaymentRequirements({ amount: PRICE_IN_USDC, description: 'Access to /api/secret once' });

  return new Response(
    JSON.stringify({
      x402Version: 1,
      supported: [
        {
          paymentRequirements,
        },
      ],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
