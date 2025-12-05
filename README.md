# cohortx402 — x402 demo scaffold

This repository provides a minimal scaffold to implement and test an x402-style paywall flow **without** any external facilitator:

- A minimal Next.js app (TypeScript, App Router)
- `/api/secret` route that returns `402` when unpaid and verifies Base USDC payments locally via on-chain txHash checks
- Local facilitator-style endpoints `/api/payments/verify` and `/api/payments/settle` with API key auth
- A browser flow on `/secret` that uses MetaMask to send a real Base USDC transfer
- A Node agent script (`scripts/agent-client.mjs`) and VS Code task that simulate an external agent paying and unlocking the same secret

Quick start (Linux / bash)

0. Set up env and funding:
	- Copy `.env.example` to `.env`.
	- Set `USDC_BASE_ADDRESS` to the real Base USDC contract (default is mainnet).
	- Set `SERVICE_RECIPIENT_ADDRESS` to a wallet you control.
	- Set `LOCAL_FACILITATOR_API_KEY` to any non-empty string.
	- For the browser flow, fund your MetaMask Base account with a bit of Base ETH and Base USDC.
	- For the agent flow, set `AGENT_PRIVATE_KEY` (funded on Base) and optionally `NEXT_PUBLIC_RPC_URL` if you need a custom Base RPC.

1. Install `pnpm` (if you don't have it):

```bash
npm install -g pnpm
```

2. Install dependencies with `pnpm`:

```bash
pnpm install
```

3. Run the Next.js app in dev mode:

```bash
pnpm dev
```

4. Open the demo page at `http://localhost:3000/secret` and click **"Load Secret"** → **"Pay with Wallet"** to pay with MetaMask and unlock the secret via on-chain verification.

5. To run the external agent demo (from VS Code):
	- Use the task **"Test Secret API (agent-client)"**, which runs `node scripts/agent-client.mjs`.
	- The agent reads config from `.env`, sends a real Base USDC transfer from `AGENT_PRIVATE_KEY`, calls `/api/payments/verify` and `/settle`, then unlocks `/api/secret` with the same x402-style payload.

For a detailed walkthrough of both flows, see `docs/demo-happy-path.md`.

Notes
- This scaffold is a starting point for local E2E tests and demonstrates **real** on-chain Base USDC payments.
- You can still experiment with external facilitators later by pointing your own server-side code at them, but the default flow here uses local verification only.
- The browser flow already uses real wallet integration (wagmi + viem + MetaMask).

Environment variables
- Copy `.env.example` to `.env` and update values as needed before running in other environments.
- `PRICE_IN_USDC` is a human-friendly decimal string (e.g. `0.0001`). When making on-chain transfers convert with 6 decimals for USDC on Base.
- Set `LOCAL_FACILITATOR_API_KEY` to any non-empty string to protect `/api/payments/*`.
- Set `AGENT_PRIVATE_KEY` in your `.env` for the agent script (do **not** commit private keys).

Startup validation
- The server includes a small `requireConfig()` helper (in `lib/config.ts`) that will assert critical env vars in production. You can call it at startup if you want to fail-fast on missing config.

Next steps
- I can also add automated integration tests next (supertest + jest/playwright) that use the mock facilitator.
