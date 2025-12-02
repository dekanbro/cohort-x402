# Resources for x402 / OpenX402

A curated list of the documentation pages I reviewed while building the implementation checklist and reviewing the high-level plan.

- https://x402.gitbook.io/x402#how-does-it-work
  - Summary: The x402 GitBook is the canonical open standard docs for x402. The "How Does It Work" section describes the high-level flow: client requests resource → server returns `402 Payment Required` with payment instructions → client submits payment payload → server verifies/settles using a facilitator `/verify` and `/settle` → resource delivered. Also contains quickstarts for Sellers and Buyers and links to core concepts.

- https://x402.gitbook.io/x402
  - Summary: Top-level GitBook for x402 covering purpose, actors (Buyers, Sellers, Facilitators), use cases (API billing, micropayments, AI agents), roadmap and links to quickstarts and deeper core-concepts (HTTP 402 semantics for programmatic payments).

- https://docs.openx402.ai/
  - Summary: OpenX402 official docs site. Contains facilitator concepts, quickstarts, network-specific guidance (Base, Solana, X Layer), and API examples. Helpful for practical integration patterns and starter repos.

- https://open.x402.host/
  - Summary: Live OpenX402 facilitator host. Lists available endpoints (e.g. `GET /supported`, `GET /open`, `GET /test`, `POST /verify`, `POST /settle`). Useful for quick integration and point-of-contact for the production facilitator.

- Quickstart - x402 Starter Server (OpenX402 docs quickstart)
  - URL: https://docs.openx402.ai/quickstart
  - Summary: Hands-on tutorial showing a minimal Express starter that returns `402` when payment is missing and verifies a payment via `https://open.x402.host/verify`. Includes examples for local testing, using a mock flow, and deploying the starter.

- OpenX402 Base Network page
  - URL: https://docs.openx402.ai/networks/base
  - Summary: Base-specific guidance (chain ID, RPC URL, USDC token address on Base, testnet details). Shows amount units are represented as decimal strings in facilitator payloads and gives examples for verifying via `txHash` and `expectedAmount`. Notes on a Base Sepolia test endpoint and tiny test amounts for development.

- OpenX402 starter repositories (examples referenced in docs)
  - Example: https://github.com/openx402/x402-ipfs-starter-server
  - Summary: Reference implementations (Express/Node) demonstrating how to check for `X-402-Payment` headers and call OpenX402 `/verify` to validate payments before serving content. Useful code patterns to adapt for `GET /api/secret`.

- Live demo / production example
  - URL: https://ipfs.openx402.ai/ (referenced in the quickstart and docs)
  - Summary: A real deployment of the starter demonstrating the 402 paywall flow in production — useful as a behavioural reference for exact 402 JSON structure and fields returned to clients.

Notes / usage guidance
- Canonical header used in the starter: `X-402-Payment` (server access via `req.headers['x-402-payment']`). Adopt this header name for compatibility with the starter and OpenX402 examples.
- Use the network-specific facilitator URL returned in the 402 `paymentRequirements` rather than hardcoding facilitator domains; docs show both `open.x402.host` and `openx402.ai` patterns and network paths like `https://openx402.ai/base`.
- For local testing and CI, prefer the facilitator test endpoints (e.g. `/test` or Base Sepolia facilitator URLs) or a mock facilitator to avoid real on-chain costs.

---
File created: `docs/resources.md`
