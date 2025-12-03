import { NextRequest } from 'next/server';

function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

// For the local txHash-based model, "settle" doesn't need to mutate state.
// We accept the same shape as /payments/verify and simply echo success
// (optionally, this is where persistence or idempotency tracking could go).
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

  const txHash = body?.txHash as string | undefined;
  if (!txHash) {
    return new Response(JSON.stringify({ error: 'invalid_settle_request', detail: 'Missing txHash' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, txHash }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
