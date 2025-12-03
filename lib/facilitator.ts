import { DEFAULT_FACILITATOR, X402_NETWORK } from './config';

type VerifyResult = {
  valid: boolean;
  transactionId?: string;
  [k: string]: any;
};

function delay(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function postJsonWithTimeout(url: string, body: any, timeout = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function verifyPayment(proofOrTx: any, opts?: { facilitatorUrl?: string, network?: string, timeout?: number, retries?: number, expectedAmount?: string }): Promise<VerifyResult> {
  // Allow opt overrides, then prefer env vars (NEXT_PUBLIC), then default
  const facilitator = opts?.facilitatorUrl || process.env.NEXT_PUBLIC_X402_FACILITATOR_URL || process.env.X402_FACILITATOR_URL || DEFAULT_FACILITATOR;
  const network = opts?.network || X402_NETWORK;
  const timeout = opts?.timeout ?? 5000;
  const retries = opts?.retries ?? 2;

  // Corbits-style payload: always send x402Version + paymentPayload/paymentHeader + paymentRequirements
  let payload: any;
  if (typeof proofOrTx === 'string') {
    // proof is a JSON string from X-402-Payment header
    try {
      const parsed = JSON.parse(proofOrTx);
      const { paymentRequirements, ...paymentPayload } = parsed;
      payload = {
        x402Version: 1,
        paymentPayload,
        paymentRequirements,
      };
    } catch {
      // If parsing fails, fall back to passing it as a header-style field
      payload = {
        x402Version: 1,
        paymentHeader: proofOrTx,
      };
    }
  } else {
    // If caller provided an object, assume it's already the payment payload
    const { paymentRequirements, ...paymentPayload } = proofOrTx || {};
    payload = {
      x402Version: 1,
      paymentPayload,
      paymentRequirements,
    };
  }

  let lastError: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const fac = facilitator.replace(/\/+$/, '');
      const net = String(network || '').replace(/^\/+|\/+$/g, '');

      // Always call /verify and send network in the body; do not prefix path with /:network
      const candidates = [`${fac}/verify`];

      console.debug('[facilitator] verifyPayment config', { facilitator: fac, network: net, payload });
      let res: Response | null = null;
      let lastErr: any = null;
      for (const url of candidates) {
        try {
          console.debug(`[facilitator] trying verify URL: ${url}`);
          res = await postJsonWithTimeout(url, payload, timeout);
          // if we got a response, break and handle below
          console.debug(`[facilitator] got response from: ${url} (status ${res.status})`);
          break;
        } catch (e) {
          lastErr = e;
          console.warn(`[facilitator] verify failed for ${url}: ${String(e)}`);
          // try next candidate
          continue;
        }
      }
      if (!res) throw lastErr || new Error('no response from facilitator');
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[facilitator] verify non-200 response', { status: res.status, body: text });
        throw new Error(`Facilitator returned ${res.status}: ${text}`);
      }
      const json = await res.json();
      return json as VerifyResult;
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await delay(200 * Math.pow(2, attempt));
        continue;
      }
      throw new Error(`verifyPayment failed: ${String(lastError)}`);
    }
  }
  throw new Error('verifyPayment unexpected exit');
}

export async function settlePayment(info: any, opts?: { facilitatorUrl?: string, network?: string, timeout?: number }) {
  const facilitator = opts?.facilitatorUrl || process.env.NEXT_PUBLIC_X402_FACILITATOR_URL || process.env.X402_FACILITATOR_URL || DEFAULT_FACILITATOR;
  const network = opts?.network || X402_NETWORK;
  const timeout = opts?.timeout ?? 5000;
  // For hosted OpenX402, expect verification result with transactionId; fall back to txHash/proof for others
  const payload = (info && info.transactionId)
    ? { transactionId: info.transactionId, network }
    : (info && info.txHash)
      ? { txHash: info.txHash, network }
      : { proof: info, network };
  try {
    const fac = facilitator.replace(/\/+$/, '');
    const net = String(network || '').replace(/^\/+|\/+$/g, '');
    const candidates = [`${fac}/settle`];

    console.debug('[facilitator] settlePayment config', { facilitator: fac, network: net, payload });
    let lastError: any = null;
    for (const url of candidates) {
      try {
        console.debug(`[facilitator] trying settle URL: ${url}`);
        const res = await postJsonWithTimeout(url, payload, timeout);
        console.debug(`[facilitator] settle response from ${url}: ${res.status}`);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Facilitator settle returned ${res.status}: ${text}`);
        }
        return await res.json();
      } catch (e) {
        lastError = e;
        console.warn(`[facilitator] settle failed for ${url}: ${String(e)}`);
        continue;
      }
    }
    throw new Error(`settlePayment failed: ${String(lastError)}`);
  } catch (e) {
    throw new Error(`settlePayment failed: ${String(e)}`);
  }
}
