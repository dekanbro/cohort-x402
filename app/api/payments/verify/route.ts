import { NextRequest } from 'next/server';
import { Hex, parseUnits } from 'viem';
import { PRICE_IN_USDC, USDC_BASE_ADDRESS, SERVICE_RECIPIENT_ADDRESS } from '../../../../lib/config';
import { verifyBaseUsdcTx } from '../../../../lib/verifyBaseUsdcTx';
import { verifyPayment } from '../../../../lib/verifyPayment';

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
  const paymentReq = body?.paymentRequirements;

  if (!paymentPayload || !paymentReq) {
    return new Response(JSON.stringify({ error: 'invalid_payment', detail: 'Missing paymentPayload or paymentRequirements' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Backwards-compatible tx-hash verification path used by current clients.
  if (!paymentPayload.scheme || paymentPayload.scheme === 'evm-txhash') {
    const txHash = paymentPayload?.payload?.txHash as string | undefined;
    if (!txHash) {
      return new Response(JSON.stringify({ error: 'invalid_payment', detail: 'Missing txHash in paymentPayload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
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

    return new Response(JSON.stringify({ isValid: result.valid, invalidReason: result.reason, scheme: 'evm-txhash' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Experimental EIP-3009 / exact path, behind a flag.
  if (paymentPayload.scheme === 'exact' && process.env.ENABLE_EIP3009 === 'true') {
    const verifyResult = await verifyPayment({
      x402Version: body.x402Version || 1,
      paymentPayload,
      paymentRequirements: paymentReq,
    });

    return new Response(JSON.stringify({ isValid: verifyResult.valid, invalidReason: verifyResult.reason, scheme: 'exact' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'unsupported_scheme', scheme: paymentPayload.scheme }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
