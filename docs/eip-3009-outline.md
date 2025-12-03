

**1. Canonical EIP-3009 / exact payload shape**

Let’s standardize on this for `scheme: "exact"`:

- Header/body (browser via `X-402-Payment`, agents via JSON body):

```jsonc
{
  "x402Version": 1,
  "paymentPayload": {
    "scheme": "exact",
    "network": "base",
    "payload": {
      "authorization": {
        "from": "0xFrom",
        "to": "0xRecipient",
        "value": "1000000",         // USDC 1e6 scale or raw big-int in string
        "validAfter": "0",          // unix timestamp or 0
        "validBefore": "1735689600",
        "nonce": "0x..."            // unique per authorization
      },
      "signature": "0x..."          // EIP-712 or EIP-191 sig for that struct
    }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base",
    "asset": "USDC",
    "resource": "/api/secret",
    "amount": "0.0001",
    "recipient": "0xRecipient",
    "tokenAddress": "0xUSDC",
    "description": "Access to /api/secret once"
  }
}
```

Key conventions:

- `paymentRequirements.amount` stays **human-readable** (e.g. `"0.0001"`).
- `authorization.value` is in **token units** (USDC 6 decimals), derived from `amount` during signing.
- `scheme` on both sides is `"exact"` when using EIP-3009; `"evm-txhash"` stays as-is.

**2. Verification dispatcher**

Add a central helper, e.g. `lib/verifyPayment.ts`:

- Input: `{ x402Version, paymentPayload, paymentRequirements }`.
- Pseudo-signature:

```ts
type VerifyContext = {
  x402Version: number;
  paymentPayload: {
    scheme: 'evm-txhash' | 'exact';
    network: string;
    payload: any;
  };
  paymentRequirements: PaymentRequirements;
};

type VerifyResult = {
  valid: boolean;
  scheme: string;
  reason?: string;
  // Normalized data we can reuse for settle:
  txHash?: string;
  authorization?: Eip3009Authorization;
  signature?: `0x${string}`;
};

export async function verifyPayment(ctx: VerifyContext): Promise<VerifyResult>;
```

- Behavior:
  - If `scheme === 'evm-txhash'`:
    - Extract `txHash` from `payload.txHash`.
    - Call existing `verifyBaseUsdcTx` and return `{ valid, reason, txHash }`.
  - If `scheme === 'exact'`:
    - Extract `authorization` + `signature`.
    - Call new `verifyEip3009Authorization(authorization, signature, paymentRequirements)`.
    - Return `{ valid, reason, authorization, signature }`.

**3. EIP-3009 verification helper**

Create `lib/eip3009.ts` with:

- Types:

```ts
export type Eip3009Authorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
};
```

- `verifyEip3009Authorization(...)`:

Inputs:

- `authorization: Eip3009Authorization`
- `signature: string`
- `paymentRequirements: PaymentRequirements`
- Optionally `now = Date.now()/1000` for time checks.

Checks:

- Rebuild EIP-712 typed data for USDC on Base (`domain`, types, `message`).
- `verifyTypedData` / `recoverTypedDataAddress` to get signer; ensure `signer.toLowerCase() === authorization.from.toLowerCase()`.
- Enforce:
  - `authorization.to === paymentRequirements.recipient`.
  - `value === parseUnits(paymentRequirements.amount, 6).toString()` (for USDC).
  - `validAfter <= now < validBefore`.
- Optionally: basic nonce sanity check (format, length) and leave actual replay protection to later (e.g. DB or on-chain check).

Return `LocalVerifyResult` as we outlined.

**4. Settler: executing transferWithAuthorization**

Extend or add `lib/settlePayment.ts`:

- Inputs: `scheme`, `authorization`, `signature`, `paymentRequirements`.
- Behavior:
  - `evm-txhash`: keep as today (no-op or store for analytics).
  - `exact`:
    - Construct a `walletClient` with `SETTLEMENT_PRIVATE_KEY` on Base.
    - Call USDC’s `transferWithAuthorization` (or correct method for the deployed USDC):
      - `transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)`.
    - Return `{ txHash, status: 'submitted' | 'confirmed' }`.

Guard all EIP-3009 paths with e.g. `ENABLE_EIP3009=true` in env.

**5. Wire server routes to dispatcher**

- route.ts:
  - After parsing header → instead of hand-rolling txHash logic:
    - Call `verifyPayment(parsed)`.
    - If `valid`:
      - Optionally call `settlePayment` for `scheme: 'exact'` (or keep settle separate; your choice).
      - Return 200 with secret.
    - If not valid → 402 with `reason`.

- route.ts:
  - Parse body as the same envelope.
  - Call `verifyPayment`.
  - Return:

```jsonc
{ "isValid": true, "scheme": "exact", "authorization": { ... } }
```

  - For tx-hash scheme, mirror current `isValid` shape.

- route.ts:
  - Accepts the same envelope.
  - Option A:
    - Re-run `verifyPayment` inside `/settle` and fail if invalid.
  - Then branch on `scheme`:
    - `exact` → `settleEip3009Authorization` and respond with `{ settled: true, txHash }`.

**6. `/supported` to advertise both schemes**

Update route.ts so it can advertise:

- `evm-txhash` entry (current behavior).
- `exact` entry (EIP-3009) when `ENABLE_EIP3009` is true.

Example response:

```jsonc
{
  "x402Version": 1,
  "supported": [
    {
      "paymentRequirements": {
        "scheme": "evm-txhash",
        "network": "base",
        "asset": "USDC",
        "resource": "/api/secret",
        "amount": "0.0001",
        "recipient": "0xRecipient",
        "tokenAddress": "0xUSDC",
        "description": "Access to /api/secret once"
      }
    },
    {
      "paymentRequirements": {
        "scheme": "exact",
        "network": "base",
        "asset": "USDC",
        "resource": "/api/secret",
        "amount": "0.0001",
        "recipient": "0xRecipient",
        "tokenAddress": "0xUSDC",
        "description": "Access to /api/secret once",
        "extra": { "kind": "eip3009" }
      }
    }
  ]
}
```

External clients can then choose a scheme they support.

**7. Client/agent evolution strategy**

To avoid a huge diff, I’d flip things on in this order:

1. Implement `verifyPayment` + `verifyEip3009Authorization` + `/supported` changes, all **behind `ENABLE_EIP3009`**.
2. Extend `/settle` to support `"exact"` (still behind flag).
3. Add an **agent-only EIP-3009 path**:
   - In agentClientCore.ts, if `USE_EIP3009`:
     - Build an authorization + signature instead of doing a USDC `transfer`.
     - Send `scheme: "exact"` to `/api/payments/verify` and `/settle`.
4. Once stable, consider a browser UX toggle to choose between tx-hash and exact.

