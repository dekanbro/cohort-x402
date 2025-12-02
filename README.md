# cohortx402 — x402 demo scaffold

This repository provides a minimal scaffold to implement and test an x402 paywall flow:

- A minimal Next.js app (TypeScript, App Router)
- `/api/secret` route that returns `402` when unpaid and verifies payments with a facilitator when provided
- A Mock Facilitator (Express) exposing `/verify`, `/settle`, `/supported`, `/open`, `/test` for local testing
- An `agent-client.ts` script that demonstrates an autonomous agent paying and retrieving the protected resource

Quick start (Linux / bash)

1. Install `pnpm` (if you don't have it):

```bash
npm install -g pnpm
```

2. Install dependencies with `pnpm`:

```bash
pnpm install
```

3. Start the mock facilitator in one terminal:

```bash
pnpm run mock-facilitator
```

4. In another terminal, run the Next.js app in dev mode:

```bash
pnpm dev
```

5. Open the demo page at `http://localhost:3000/secret` and click "Load Secret" → "Pay (dummy proof) & Unlock" to exercise the local flow.

6. Run the agent script (dev using `ts-node`):

```bash
npx ts-node --esm agent-client.ts http://localhost:3000/api/secret
```

Alternative: compile or run the JS build of the agent if you transpile TypeScript to `dist/`.

Notes
- This scaffold is a starting point for local E2E tests and uses a Mock Facilitator to avoid real on-chain activity.
- The mock facilitator listens on `http://localhost:9000` by default. Update `X402_FACILITATOR_URL` in the environment to point to a real facilitator when you're ready.
- Replace the dummy client payment logic with real wallet integration (wagmi + viem or an x402 SDK) for production usage.

Environment
- Copy `.env.example` to `.env` and update values as needed before running in other environments.

Next steps
- If you want, I can add a `pnpm` lockfile or run `pnpm install` to generate `pnpm-lock.yaml` (I can't run it from here, but I can show the exact command to run locally).
- I can also add automated integration tests next (supertest + jest/playwright) that use the mock facilitator.
