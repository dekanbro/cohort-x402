import { Hex, parseUnits } from 'viem';
import { PRICE_IN_USDC, USDC_BASE_ADDRESS, SERVICE_RECIPIENT_ADDRESS } from '../../../lib/config';
import { buildPaymentRequirements } from '../../../lib/payment';
import { verifyBaseUsdcTx } from '../../../lib/verifyBaseUsdcTx';

export async function GET(req: Request) {
  const paymentHeader = req.headers.get('x-402-payment');

  if (!paymentHeader) {
    console.debug('[api/secret] no x-402-payment header, building paymentRequirements');
    const paymentRequirements = buildPaymentRequirements({ amount: PRICE_IN_USDC, description: 'Access to /api/secret once' });
    console.debug('[api/secret] 402 paymentRequirements', paymentRequirements);
    return new Response(JSON.stringify({ paymentRequirements }), {
      status: 402,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    // Local verification path: expect x402-style payload with txHash + paymentRequirements
    let parsed: any;
    try {
      parsed = JSON.parse(paymentHeader);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'invalid_payment_header', detail: 'X-402-Payment must be JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const paymentPayload = parsed?.paymentPayload;
    const txHash = paymentPayload?.payload?.txHash as string | undefined;
    const paymentReq = parsed?.paymentRequirements;
    if (!txHash || !paymentReq) {
      return new Response(JSON.stringify({ error: 'invalid_payment', detail: 'Missing txHash or paymentRequirements' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const usdcAddress = (paymentReq.tokenAddress || USDC_BASE_ADDRESS) as Hex;
    const expectedRecipient = (paymentReq.recipient || SERVICE_RECIPIENT_ADDRESS) as Hex;
    const expectedAmountDecimal = paymentReq.amount || PRICE_IN_USDC;
    const expectedAmountUnits = parseUnits(expectedAmountDecimal, 6); // USDC has 6 decimals

    const result = await verifyBaseUsdcTx({
      txHash: txHash as Hex,
      usdcAddress,
      expectedRecipient,
      expectedAmountUnits,
    });

    if (!result.valid) {
      console.warn('[api/secret] local payment verification failed', result);
      return new Response(JSON.stringify({ error: 'Invalid payment', detail: result.reason }), { status: 402, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ data: 'Super secret message behind x402 paywall' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('verification unexpected error', e);
    return new Response(JSON.stringify({ error: 'verification_failed', detail: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
