import { NextRequest } from 'next/server';
import { Hex, parseUnits } from 'viem';
import { PRICE_IN_USDC, USDC_BASE_ADDRESS, SERVICE_RECIPIENT_ADDRESS } from '../../../../lib/config';
import { verifyBaseUsdcTx } from '../../../../lib/verifyBaseUsdcTx';

function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.LOCAL_FACILITATOR_API_KEY;
  const provided = req.headers.get('x-api-key') || req.headers.get('authorization');

  if (!apiKey || !provided || !provided.includes(apiKey)) return unauthorized();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const paymentPayload = body?.paymentPayload;
  const txHash = paymentPayload?.payload?.txHash as string | undefined;
  const paymentReq = body?.paymentRequirements;

  if (!txHash || !paymentReq) {
    return new Response(JSON.stringify({ error: 'invalid_payment', detail: 'Missing txHash or paymentRequirements' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const usdcAddress = (paymentReq.tokenAddress || USDC_BASE_ADDRESS) as Hex;
  const expectedRecipient = (paymentReq.recipient || SERVICE_RECIPIENT_ADDRESS) as Hex;
  const expectedAmountDecimal = paymentReq.amount || PRICE_IN_USDC;
  const expectedAmountUnits = parseUnits(expectedAmountDecimal, 6);

  const result = await verifyBaseUsdcTx({
    txHash: txHash as Hex,
    usdcAddress,
    expectedRecipient,
    expectedAmountUnits,
  });

  return new Response(JSON.stringify({ isValid: result.valid, invalidReason: result.reason }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
