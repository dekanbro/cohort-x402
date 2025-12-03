# Implementation Checklist for x402 Next.js + Agent

This checklist maps the high-level spec in `high-level-plan.md` to concrete implementation tasks, verification steps, and decisions to confirm against the x402 docs/`open.x402.host` behavior.

## Quick review notes (spec vs docs)
- The high-level flow in `high-level-plan.md` matches x402 docs: client requests resource → server returns `402` + payment instructions → client submits payment payload → server calls facilitator `/verify` and `/settle` → server returns resource on success.
- Items to confirm before coding:
  - **Payment payload shape & header name**: confirm the canonical header/field name (your spec uses `X-PAYMENT`) and the exact JSON shape expected by `open.x402.host` `/verify` and `/settle` endpoints.
  - **Scheme support for Base/USDC**: confirm which payment schemes (e.g., `exact`, `upto`) are supported on the Base facilitator and how the `amount` units should be expressed (raw token units vs decimals).
  - **Facilitator auth / keys**: confirm if the facilitator requires API keys, origin allowlisting, or signed metadata for `verify`/`settle` calls.
  - **Testnet vs mainnet**: prefer local mock facilitator or a Base testnet flow for CI/development to avoid on-chain costs.

  ## Facilitator details (confirmed from OpenX402 docs)

  - **Facilitator endpoints (Base)**:
    - `GET /supported` — list supported networks (public)
    - `GET /open` — production payment endpoint (protected)
    - `GET /test` — test endpoint (protected, low-cost testing)
    - `POST /verify` — verify payment authorization (public)
    - `POST /settle` — settle payment on-chain (public)

  - **Canonical request header**: the starter uses `X-402-Payment` (accessed in Node as `req.headers['x-402-payment']`).

  - **Verify payloads (examples)**:

    - Quickstart example (proof-based):

  ```js
  const verification = await fetch('https://open.x402.host/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proof: paymentProof,
      network: 'base'
    })
  });
  ```

    - Base-specific example (txHash + expectedAmount):

  ```js
  const response = await fetch('https://openx402.ai/base/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      txHash: txHash,
      network: 'base',
      expectedAmount: '1.00' // decimal string in USDC units
    })
  });
  ```

  - **Amount units**: amounts are represented as decimal strings (e.g. `'0.01'` USDC). When building on-chain transfers in code, convert to token base units (for USDC on Base, 6 decimals) with `ethers.parseUnits(amount, 6)`.

  - **Auth / protected endpoints**:
    - `/verify` and `/settle` are public according to the docs (no API key required for verification/settlement).
    - `/open` and `/test` are marked as protected — use them for production/test payment entry points as documented.

  - **Testnet guidance**:
    - Base Sepolia is supported for development. Example facilitator test URL: `https://openx402.ai/base/test` and a tiny test amount (`$0.0001` USDC) is available for experimentation.

  - **Facilitator URLs / DNS**: the docs show a couple of domain patterns (`open.x402.host`, `openx402.ai`) and network-specific paths like `https://openx402.ai/base` — prefer the network-specific facilitator URL returned in your 402 `paymentRequirements` to avoid hardcoding domains.


## Project scaffolding
- [x] Create repo and root README (this repo already exists; add README note)
- [x] Scaffold Next.js app (App Router + TypeScript)
  - Suggested command:

```bash
npx create-next-app@latest app --ts --import-alias "@/*"
cd app
```

- [x] Add `docs/high-level-plan.md` and `docs/implementation-checklist.md` (this file)

## Env & config
- [X] Add `lib/config.ts` (or `.env local`) entries:
  - `X402_FACILITATOR_URL` (default: `https://open.x402.host`)
  - `X402_NETWORK` (e.g., `base-mainnet` or testnet name)
  - `USDC_BASE_ADDRESS`
  - `SERVICE_RECIPIENT_ADDRESS`
  - `PRICE_IN_USDC_UNITS` (expressed in raw token units; confirm with facilitator)
  - `AGENT_PRIVATE_KEY` (for local agent testing)
- [X] Add `.env.example` with placeholder values

## Backend: `app/api/secret/route.ts`
- [X] Implement GET handler that:
  - Reads `X-PAYMENT` header (or agreed header name)
  - If missing or invalid → returns `402` JSON with `paymentRequirements`
  - If present → parse payload and call facilitator `/verify`
  - On verify success → optionally call `/settle` → return `200` with content
  - On verify failure → return `402` (or `403`) with reason
- [X] Define `paymentRequirements` structure in code to match docs; centralize in `lib/x402.ts` or `lib/payment.ts`
- [X] Implement error handling and idempotency for repeated attempts

## Facilitator integration
- [X] Inspect `open.x402.host` docs (or fetch open API spec) to confirm endpoints:
  - `/verify` — payload and response shape
  - `/settle` — whether separate call required or optional
- [X] Implement server-side helpers to call the facilitator (with retries and timeouts)
- [X] For development, create a **Mock Facilitator** (Express or internal route) with `/verify` and `/settle` that simulates success/failure; use this for unit/E2E tests to avoid on-chain costs:
  - `/mock-facilitator/verify` accepts the same request shape and responds with `{ valid: true, ... }`
  - `/mock-facilitator/settle` responds with simulated tx info

## Frontend (Human UI)
- [ ] Add wallet integration (wagmi + RainbowKit recommended)
- [ ] Page `app/secret/page.tsx` client component:
  - Calls `/api/secret` to load content
  - If `402` is returned, parse `paymentRequirements` and render a paywall
  - Allow wallet connection and show pay button
  - On pay: build x402 payment payload using wallet (or call a helper endpoint to construct it), attach as header, retry request
- [ ] Implement fallback UX for wallet not on Base network and for insufficient balance
- [ ] Consider backend proxy for any operations that should not be done client-side

## Agent client (script)
- [ ] Implement `agent-client.ts` (Node.js) that:
  - Accepts URL of target endpoint
  - GETs the endpoint, reads `402` + `paymentRequirements`
  - Using `AGENT_PRIVATE_KEY`, builds a payment payload (using `viem` or ethers) and signs/transfers as required
  - Retries request with `X-PAYMENT` header and prints result
- [ ] Make agent CLI friendly:
  - `node agent-client.js https://app.example.com/api/secret`
- [ ] Add notes for LLM tool integration (tool description, input/output contract)

## Tests
- Unit tests:
  - [ ] Backend helpers: `paymentRequirements` generation, facilitator request formatting
  - [ ] Mock facilitator tests
- Integration / E2E tests (recommended approach):
  - [ ] Local integration using mock facilitator and supertest/Playwright to exercise the whole flow without real transactions
  - [ ] Optional: run against Base testnet & `open.x402.host` if testnet support is available
- Test scenarios:
  - [ ] No payment → 402
  - [ ] Correct payment → 200 & content
  - [ ] Malformed payment → 402/403
  - [ ] Replay attack / double-spend protection (if applicable)

## Security & operational
- [ ] Ensure `SERVICE_RECIPIENT_ADDRESS` is configurable per-environment and not hard-coded
- [ ] Rate limiting on `/api/secret` to prevent abuse
- [ ] Logging and observability for facilitator interactions
- [ ] Secrets management for `AGENT_PRIVATE_KEY` and any API keys

## Deployment & CI
- [ ] Add CI job to run unit tests and E2E tests against mock facilitator
- [ ] Add deploy instructions (Vercel or your host)
- [ ] For production, verify gas/token top-up automation or manual process for `SERVICE_RECIPIENT_ADDRESS`

## Decisions to make (before implementation)
- [ ] Confirm the canonical request header name for payment payload (e.g., `X-PAYMENT`) or use a request body-based flow.
- [ ] Confirm payment scheme (`exact` vs `upto`) to use for Base + USDC with `open.x402.host`.
- [ ] Decide whether frontend builds the payment payload entirely client-side or requests a pre-signed payload from backend.
- [ ] Decide whether to call `/settle` from backend immediately or defer until some post-condition.

## Next steps
1. Confirm the facilitator API details (header name, payload shape, scheme support) — I can fetch the `Core Concepts` and `Facilitator` pages next.
2. If you approve this checklist, I can scaffold the Next.js app and create a simple mock facilitator and a minimal `/api/secret` implementation with tests.

---

*File created: `docs/implementation-checklist.md`*
