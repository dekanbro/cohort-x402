import { NextRequest } from 'next/server';
import { verifyPayment } from '../../../../lib/verifyPayment';
import { settleEip3009Authorization } from '../../../../lib/settlePayment';

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
    return new Response(JSON.stringify({ error: 'invalid_settle_request', detail: 'Missing paymentPayload or paymentRequirements' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Legacy txHash-based flow: we don't mutate state here, just echo success
  // with the provided txHash. This keeps the existing happy path untouched.
  if (!paymentPayload.scheme || paymentPayload.scheme === 'evm-txhash') {
    const txHash = (paymentPayload?.payload?.txHash || body?.txHash) as string | undefined;
    if (!txHash) {
      return new Response(JSON.stringify({ error: 'invalid_settle_request', detail: 'Missing txHash for evm-txhash scheme' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, txHash, scheme: 'evm-txhash' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // EIP-3009 / exact settlement: re-verify and then execute transferWithAuthorization
  if (paymentPayload.scheme === 'exact' && process.env.ENABLE_EIP3009 === 'true') {
    const verifyResult = await verifyPayment({
      x402Version: body.x402Version || 1,
      paymentPayload,
      paymentRequirements: paymentReq,
    });

    if (!verifyResult.valid || !verifyResult.authorization || !verifyResult.signature) {
      return new Response(JSON.stringify({ error: 'settle_verification_failed', detail: verifyResult.reason }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const settleResult = await settleEip3009Authorization({
      authorization: verifyResult.authorization,
      signature: verifyResult.signature as `0x${string}`,
      paymentRequirements: paymentReq,
    });

    if (!settleResult.success) {
      return new Response(JSON.stringify({ success: false, scheme: 'exact', reason: settleResult.reason }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, scheme: 'exact', txHash: settleResult.txHash }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'unsupported_scheme', scheme: paymentPayload.scheme }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
