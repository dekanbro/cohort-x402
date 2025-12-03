# Local Verification & Settlement Plan

This document outlines the plan to remove third-party facilitators (Corbits/OpenX402/etc.) from the critical path and perform verification + settlement locally inside this app. It also notes how we can add EIP-3009/EIP-712 support later without breaking the current flow.

## Goals

- Keep the current UX: user sends a real Base USDC transfer via their wallet.
- Verify that payment server-side using the transaction hash.
- Unlock the secret only when an on-chain transfer meeting our requirements is observed.
- Avoid depending on any hosted x402 facilitator.
- Leave room to add a second, EIP-3009-based flow in the future.

## Current State (Before Change)

- Client (`app/secret/page.tsx`):
  - Constructs a `payment` object and sends it in the `X-402-Payment` header.
  - Currently wired to talk to generic `/verify` endpoints via `lib/facilitator.ts`.
- Server (`app/api/secret/route.ts`):
  - On first call (no header): builds `paymentRequirements` via `buildPaymentRequirements` and returns 402.
  - On second call (with header): forwards the opaque proof to `verifyPayment` in `lib/facilitator.ts`.
  - Uses `settlePayment` as a best-effort, non-blocking call.
- `lib/facilitator.ts` and `lib/payment.ts` have been bent toward Corbits’ `/verify` shape.

## Target Architecture (After Change)

- No external facilitator in the critical path.
- `/api/secret` does **both**:
  - Issue `paymentRequirements` for the client (Base USDC amount, recipient, token address, etc.).
  - Verify payment by directly querying Base RPC using the provided `txHash`.
- `lib/facilitator.ts` either becomes unused / legacy, or is repurposed for future x402 flows.

### Request/Response Shape

- 402 response (unchanged semantics, simpler shape if desired):

  ```jsonc
  {
    "paymentRequirements": {
      "network": "base",
      "amount": "0.0001",
      "recipient": "0x...",
      "tokenAddress": "0xUSDC...",
      "description": "Access to /api/secret once"
    }
  }
  ```

- Follow-up request with payment proof:

  ```http
  GET /api/secret
  X-402-Payment: {"txHash":"0x...","network":"base","paymentRequirements":{...}}
  ```

  - We treat `txHash` + `paymentRequirements` as our contract for local verification.

## Verification Logic (Local)

We will add a helper (e.g. `lib/verifyBaseUsdcTx.ts`) that:

1. Accepts:
   - `txHash: string`.
   - `expectedAmount: string` (e.g. `PRICE_IN_USDC`).
   - `expectedRecipient: string` (service address).
   - `usdcAddress: string` (Base USDC contract).
   - Optional tolerance / extra checks.
2. Uses `viem` (or `ethers`) with a Base RPC URL to:
   - Fetch the transaction and receipt by `txHash`.
   - Ensure the transaction:
     - Was to the USDC contract (`to === usdcAddress`).
     - Has `status === 1` in the receipt.
   - Decode the transaction `data` as ERC-20 `transfer(to, value)`.
   - Compare:
     - `decoded.to === expectedRecipient`.
     - `decoded.value` matches `expectedAmount` (converted to smallest units).
3. Returns a simple result:

   ```ts
   type LocalVerifyResult = {
     valid: boolean;
     reason?: string;
   };
   ```

4. `/api/secret` uses this helper instead of `verifyPayment` from `lib/facilitator.ts`.

### Settlement

- In this model, "settlement" is effectively just **observing the confirmed tx**.
- We can keep a small "settlement" layer for symmetry:
  - Optionally, store successful payments (txHash, address, timestamp) in some store (for replay protection or analytics).
  - For now, we can treat verification as atomic: if the tx has succeeded and matches requirements, we consider it settled.

## Code Changes (High-Level)

1. **Add a local verifier helper**
   - New file: `lib/verifyBaseUsdcTx.ts`.
   - Export `verifyBaseUsdcTx(txHash, requirementsLike)`.
2. **Refactor `app/api/secret/route.ts`**
   - Keep the 402 branch using `buildPaymentRequirements`.
   - Replace `verifyPayment` + `settlePayment` calls with:
     - Parse the `X-402-Payment` header as JSON.
     - Extract `txHash` (or similar) and `paymentRequirements`.
     - Call `verifyBaseUsdcTx` with `PRICE_IN_USDC` and config values.
     - On success → return 200 with secret.
     - On failure → 402 with an error message.
   - Remove or comment the external facilitator-specific error handling.
3. **Simplify client payload**
   - In `app/secret/page.tsx` `payWithWallet`, construct a proof object like:

     ```ts
     const payment = {
       txHash,
       network: 'base',
       paymentRequirements: paymentReq,
     };
     ```

   - Send this via `X-402-Payment`.
4. **Keep `lib/payment.ts` minimal**
   - Revert/trim it back to the simpler `amount`/`recipient`/`tokenAddress` shape, since we are no longer trying to satisfy Corbits’ `paymentRequirements` schema.

## Future EIP-3009 / EIP-712 Support

We can design the server-side verifier to support multiple proof shapes later:

- **Local txHash flow (current):**

  - Detected when the parsed header contains `txHash` and `paymentRequirements` with a simple ERC-20 schema.
  - Routed to `verifyBaseUsdcTx`.

- **EIP-3009/x402 flow (future):**

  - Detected when the header contains `paymentPayload` with:

    ```jsonc
    {
      "x402Version": 1,
      "paymentPayload": {
        "scheme": "exact" | "evm-authorization",
        "network": "base",
        "payload": {
          "signature": "0x...",
          "authorization": {
            "from": "0x...",
            "to": "0x...",
            "value": "...",
            "validAfter": "...",
            "validBefore": "...",
            "nonce": "0x..."
          }
        }
      },
      "paymentRequirements": { /* x402-style requirements */ }
    }
    ```

  - Routed to a future `verifyEip3009Authorization` helper or to a third-party facilitator.

By keeping verification logic behind a simple dispatcher function (e.g. `verifyPaymentLocallyOrExternally(payment)`), we can add the EIP-3009 path later without changing the public behavior of `/api/secret` or the rest of the app.

---

**Next steps:**

- Implement `lib/verifyBaseUsdcTx.ts`.
- Refactor `app/api/secret/route.ts` to call it.
- Simplify `lib/payment.ts` and `app/secret/page.tsx` to use the txHash-based proof again.
- Optionally, leave `lib/facilitator.ts` and the Corbits-specific notes in docs as reference for future EIP-3009 integration.
