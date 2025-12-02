import { DEFAULT_FACILITATOR, X402_NETWORK, PRICE_IN_USDC } from '../../../lib/config';

export async function GET(req: Request) {
  const paymentHeader = req.headers.get('x-402-payment');

  if (!paymentHeader) {
    const paymentRequirements = {
      facilitator: DEFAULT_FACILITATOR,
      network: X402_NETWORK,
      amount: PRICE_IN_USDC,
      description: 'Access to /api/secret once',
    };

    return new Response(JSON.stringify({ paymentRequirements }), {
      status: 402,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // If paymentHeader present, verify with facilitator
  let payload: any = null;
  try {
    payload = JSON.parse(paymentHeader as string);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'invalid payment header' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    let verifyRes: Response;
    try {
      verifyRes = await fetch(`${DEFAULT_FACILITATOR}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: payload, network: X402_NETWORK })
      });
    } catch (e) {
      console.error('facilitator unreachable', e);
      return new Response(JSON.stringify({ error: 'facilitator_unreachable', detail: String(e) }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    if (!verifyRes.ok) {
      const text = await verifyRes.text().catch(() => '');
      console.error('facilitator returned error', verifyRes.status, text);
      return new Response(JSON.stringify({ error: 'facilitator_error', status: verifyRes.status, detail: text }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    const result: any = await verifyRes.json().catch(() => null);
    if (!result || !result.valid) {
      return new Response(JSON.stringify({ error: 'Invalid payment' }), { status: 402, headers: { 'Content-Type': 'application/json' } });
    }

    // Optionally settle (best-effort)
    fetch(`${DEFAULT_FACILITATOR}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof: payload, network: X402_NETWORK })
    }).catch((e) => console.warn('settle failed (ignored)', e));

    return new Response(JSON.stringify({ data: 'Super secret message behind x402 paywall' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('verification unexpected error', e);
    return new Response(JSON.stringify({ error: 'verification_failed', detail: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
