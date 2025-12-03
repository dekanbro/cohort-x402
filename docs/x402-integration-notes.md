# X402 Integration Notes

## Overview

This app implements a paywalled secret page using OpenX402 on Base USDC. The flow:

1. Client calls `/api/secret` with no headers.
2. Server returns `402` with `paymentRequirements` (amount, recipient, facilitator, tokenAddress, network).
3. Client performs a real USDC transfer on Base (via MetaMask) to `paymentRequirements.recipient`.
4. Client calls `/api/secret` again with an `X-402-Payment` header.
5. Server treats that header value as an opaque `proof` string and calls `https://open.x402.host/verify`.
6. On success, server returns the secret and asynchronously calls `https://open.x402.host/settle`.

## Key Files

- `app/secret/page.tsx`
  - Renders the secret page and payment UI.
  - Performs the actual USDC transfer via `payWithWallet()`.
  - Calls `loadSecret(withPayment?)` and sets `X-402-Payment` on the request when a payment proof is present.

- `app/api/secret/route.ts`
  - Implements the x402-protected API endpoint.
  - Issues payment requirements on 402.
  - On subsequent requests with `X-402-Payment`, calls `verifyPayment` then `settlePayment`.

- `lib/facilitator.ts`
  - Wraps the remote facilitator calls to `/verify` and `/settle`.

- `lib/payment.ts`
  - Builds `paymentRequirements` (facilitator URL, network, amount, recipient, tokenAddress, description).

## Current Request/Response Shapes

### 1. 402 Payment Requirements from `/api/secret`

When there is no `X-402-Payment` header, the server returns:

```json
{
  "paymentRequirements": {
    "facilitator": "https://open.x402.host",
    "network": "base",
    "amount": "0.0001",
    "recipient": "<SERVICE_RECIPIENT_ADDRESS>",
    "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "description": "Access to /api/secret once"
  }
}
```

These values are derived from `PRICE_IN_USDC`, `SERVICE_RECIPIENT_ADDRESS`, `USDC_BASE_ADDRESS` and the facilitator/network config.

### 2. Client-Side Wallet Payment (`payWithWallet`)

In `app/secret/page.tsx`:

- The page uses wagmi to ensure the wallet is connected to Base (chainId 8453) and will auto-switch where possible.
- USDC transfer is encoded using viem and sent via MetaMask:

  ```ts
  const decimals = 6; // Base USDC
  const amount = parseUnits(amountDecimal, decimals);

  const data = encodeFunctionData({
    abi: erc20Abi, // minimal ERC-20 transfer ABI
    functionName: 'transfer',
    args: [recipient, amount],
  });

  const tx = await (window as any).ethereum.request({
    method: 'eth_sendTransaction',
    params: [{ from: address, to: tokenAddress, data }],
  });

  const txHash = typeof tx === 'string' ? tx :
    (tx && (tx as any).hash) ? (tx as any).hash : String(tx);
  ```

- After a successful tx, the client currently builds:

  ```ts
  const payment = {
    paymentPayload: { txHash },
    paymentRequirements: paymentReq.paymentRequirements,
  };

  await loadSecret(payment);
  ```

- `loadSecret(withPayment)` sets:

  ```ts
  headers['X-402-Payment'] = JSON.stringify(withPayment);
  ```

So the raw `X-402-Payment` header value is a JSON string containing `paymentPayload` and `paymentRequirements`.

### 3. `/api/secret` Verification Call

In `app/api/secret/route.ts`:

- If `X-402-Payment` is present, we now treat it as an opaque proof string (no parsing):

  ```ts
  const paymentHeader = req.headers.get('x-402-payment');
  const proof = paymentHeader;
  ```

- We call `verifyPayment` with this proof and an expected amount:

  ```ts
  const result = await verifyPayment(proof, { expectedAmount: PRICE_IN_USDC });
  ```

- On success (`result.valid`), we return the secret and trigger settlement in the background:

  ```ts
  settlePayment(result).catch((e) =>
    console.warn('[api/secret] settle failed (ignored)', e),
  );
  ```

### 4. `verifyPayment` → `/verify`

In `lib/facilitator.ts`:

- For hosted OpenX402 (`https://open.x402.host`), if `verifyPayment` is given a string, it builds:

  ```ts
  payload = {
    proof: proofOrTx,         // X-402-Payment header string
    network,                  // usually 'base'
    ...(expectedAmount && { expectedAmount })
  };
  ```

- It then POSTs this to `https://open.x402.host/verify` with `Content-Type: application/json`.

This matches the OpenX402 `/verify` docs:

```ts
await fetch('https://open.x402.host/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    proof: paymentProof,
    network: 'base'
  })
});
```

### 5. `settlePayment` → `/settle`

In `lib/facilitator.ts`:

- `settlePayment(info)` expects to receive the verification result from `/verify`.
- If `info.transactionId` is present, it builds:

  ```ts
  payload = {
    transactionId: info.transactionId,
    network,
  };
  ```

- For the hosted service, it POSTs this to `https://open.x402.host/settle`.

This matches the `/settle` docs:

```ts
await fetch('https://open.x402.host/settle', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transactionId,
    network: 'base'
  })
});
```

## Current Hosted Facilitator Error

Despite matching the documented request shapes, the hosted `/verify` endpoint is responding with:

```json
{
  "error": "Failed to verify payment",
  "message": "Cannot read properties of undefined (reading 'authorization')"
}
```

Earlier, before we aligned with the docs, it also returned:

```json
{ "error": "Missing paymentPayload or paymentRequirements" }
```

Given our current behavior:

- The POST body to `/verify` contains `proof` (the raw `X-402-Payment` string) and `network: 'base'`.
- The `proof` string itself contains JSON with `paymentPayload` and `paymentRequirements` (as produced on the client).

The remaining 400 errors are now originating inside the OpenX402 service, likely due to:

- An expectation about the internal format of the `proof` string (e.g., a specific schema containing an `authorization` object), or
- A mismatch between the current public docs and the hosted implementation.

## Summary of Integration State

- **USDC payment**: Working. A real `transfer(recipient, amount)` call is sent to the Base USDC contract, and the resulting `txHash` appears onchain.
- **Verify request shape**: Aligned with docs (`proof` string + `network`, optional `expectedAmount`).
- **Settle request shape**: Ready to use `transactionId` from `/verify`, aligned with `/settle` docs.
- **Hosted errors**: 400 responses from `https://open.x402.host/verify` complaining about missing `paymentPayload` / `paymentRequirements` and then about `authorization`, which suggests a server-side implementation or configuration issue.

## What to Share with OpenX402

If reporting this upstream, include:

1. Example `/verify` request body we send:

   ```json
   {
     "proof": "{\"paymentPayload\":{\"txHash\":\"0x...\"},\"paymentRequirements\":{\"facilitator\":\"https://open.x402.host\",\"network\":\"base\",\"amount\":\"0.0001\",\"recipient\":\"0x...\",\"tokenAddress\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"description\":\"Access to /api/secret once\"}}",
     "network": "base",
     "expectedAmount": "0.0001"
   }
   ```

2. Example `/verify` response body:

   ```json
   {
     "error": "Failed to verify payment",
     "message": "Cannot read properties of undefined (reading 'authorization')"
   }
   ```

3. Confirmation that:

   - A real Base USDC transfer for the expected amount is present onchain at the given `txHash`.
   - The integration follows the `/verify` and `/settle` examples from the docs.

This should give them enough context to confirm the expected `proof` format (and any `authorization` requirements) or to fix the behavior of the hosted endpoints.
