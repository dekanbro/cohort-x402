
requirments:
1. **API backend** (x402-gated content on Base via `open.x402.host`)
2. **Human UI frontend** (Next.js app where a user pays with a wallet)
3. **Agent client** (script / “skill” that can autonomously pay and call the API)

I’ll outline a **high-level spec** for a Next.js app that supports all three.

---

## 0. Tech Stack Overview

* **Framework:** Next.js (App Router, TypeScript)
* **Runtime:** Node on Vercel / your own server (doesn’t matter)
* **Chain:** Base mainnet
* **Payment Rail:** x402 via `https://open.x402.host` (Base facilitator)
* **Token:** USDC on Base
* **Wallet UX (human):** wagmi + RainbowKit or similar
* **Agent client:** Node.js script (separate from Next app, but hitting the same API)

---

## 1. Core Use Case

**Resource:** `GET /api/secret` – returns some premium JSON (e.g. “secret jokes”, “premium stats”, whatever).

* If **no valid payment**, respond with `402 Payment Required` + `paymentRequirements`.
* If **valid payment** (verified via OpenX402), respond `200 OK` + content.

Human flow:

1. User opens Next.js page `/secret`.
2. Page calls `/api/secret` → gets 402.
3. UI reads `paymentRequirements`, shows a paywall (“Pay 0.0001 USDC on Base”).
4. User clicks “Pay”, signs with wallet → client constructs x402 `X-PAYMENT` header.
5. Client retries `/api/secret` with that header → API verifies + settles with facilitator → returns content.

Agent flow:

1. Agent script calls `/api/secret`.
2. Gets 402 + `paymentRequirements`.
3. Script uses its own private key / smart account to construct `X-PAYMENT`.
4. Retries `/api/secret` and gets content.

---

## 2. Next.js App Structure (High-Level)

### 2.1 Routes / Files

**App router (example layout):**

* `app/page.tsx`
  Landing page, explains the experiment and has links.

* `app/secret/page.tsx`
  React client component:

  * Shows free vs paid content.
  * Has “Load Secret” button that calls `/api/secret`.
  * If it gets 402, shows paywall and wallet flow.

* `app/api/secret/route.ts`
  Server route:

  * On GET, checks for `X-PAYMENT` header.
  * If header missing or invalid → returns 402 with `paymentRequirements`.
  * If valid → calls OpenX402 `/verify` + `/settle`, then returns data.

* `app/api/x402/verify/route.ts` (optional)
  If you want to proxy OpenX402 calls to hide facilitator details from clients; otherwise, backend can talk directly to `https://open.x402.host`.

* `app/api/health/route.ts`
  Simple health check for your agent scripts.

### 2.2 Shared config

Create something like `lib/config.ts`:

```ts
export const X402_FACILITATOR_URL = "https://open.x402.host";
export const X402_NETWORK = "base-mainnet"; // whatever string OpenX402 uses
export const USDC_BASE_ADDRESS = "0x...";   // USDC on Base
export const SERVICE_RECIPIENT_ADDRESS = "0xYourReceivingAddress";
export const PRICE_IN_USDC_UNITS = "100";   // 0.0001 USDC if 6 decimals
```

---

## 3. API Backend: `/api/secret` Behavior

### 3.1 Request handling

On **GET** `/api/secret`:

1. Read `X-PAYMENT` header (or whatever header name x402 spec uses, e.g. `X-Payment`).

2. If **no header**:

   * Return `402` with body:

     ```jsonc
     {
       "paymentRequirements": {
         "accepts": [
           {
             "scheme": "exact",
             "network": "base-mainnet",
             "token": "USDC_BASE_ADDRESS",
             "maxAmount": "100",
             "recipient": "YOUR_ADDRESS",
             "facilitator": "https://open.x402.host",
             "description": "Access to /api/secret once"
           }
         ]
       }
     }
     ```

3. If header is present:

   * Parse JSON payload from header.
   * Call `POST https://open.x402.host/verify` with:

     * the `paymentRequirements` you just used, plus
     * the `payment` payload from the header.
   * If verification fails → return 402 again or 403.
   * If verification OK:

     * Optionally call `POST https://open.x402.host/settle` to actually settle on-chain.
     * Return `200` with your secret content:

       ```json
       { "data": "Super secret message behind x402 paywall" }
       ```

### 3.2 Environmental config

* Add env vars:

  * `X402_FACILITATOR_URL`
  * `SERVICE_RECIPIENT_ADDRESS`
  * `USDC_BASE_ADDRESS`
  * `X402_SECRET_API_KEY` (if you want to sign your calls to facilitator or track them)
* In production, your `SERVICE_RECIPIENT_ADDRESS` should be a wallet you control on Base.

---

## 4. Frontend (Human UI) Spec

### 4.1 Wallet & chain integration

Use:

* `wagmi` for hooks
* `viem` for low-level chain calls (if needed)
* a connector like RainbowKit, Coinbase Wallet SDK, or simple MetaMask connector

Frontend requirements:

* Connect wallet on **Base** network.
* Show wallet addr + balance of USDC (optional, nice for UX).
* When user clicks “Pay & unlock”:

  * Build an x402 payment payload using the wallet:

    * Could be an EIP-3009 / permit2 style authorization depending on x402 client library.
  * Attach payload as `X-PAYMENT` header and retry call.

### 4.2 Page behavior (`/secret`)

State machine on the client side:

1. **idle** – no call made yet.
2. **loading** – calling `/api/secret`.
3. If response `200`:

   * Show content → done.
4. If response `402`:

   * Parse `paymentRequirements`.
   * Set state to `needsPayment`, store the requirements.
5. Show UI:

   * “This costs X USDC on Base. Connect your wallet & pay.”
   * Connect button (if not connected).
   * “Pay & unlock” button:

     * When clicked:

       * Use wallet + x402 client logic to generate payment payload.
       * Retry `/api/secret` with `X-PAYMENT`.
       * If `200` → show content.

You don’t have to re-invent the x402 client logic; long-term, you’d use an official or community SDK. For the spec, it’s enough that the front-end is the one that:

* reads 402,
* talks to the wallet,
* constructs `X-PAYMENT`,
* retries the request.

---

## 5. Agent Client (Script / Skill)

This part is a **separate Node.js script** (not in the Next.js app) that you can hand to an LLM agent.

### 5.1 Responsibilities

* Accept a target URL (e.g. `https://yourapp.com/api/secret`).
* Call it, detect 402.
* Parse `paymentRequirements`.
* Using a private key / smart wallet:

  * Build x402 payment payload.
  * Retry with `X-PAYMENT` header.
* Print out the received content.

### 5.2 Structure

Pseudo-spec for `agent-client.ts`:

* Config:

  * `AGENT_PRIVATE_KEY` (on Base, loaded from env)
  * `AGENT_ADDRESS`
  * `RPC_URL` for Base
* Steps:

  1. `GET https://yourapp.com/api/secret`
  2. If `status === 402`:

     * Parse `paymentRequirements`.
     * Call helper `buildX402Payment(requirements, agentWallet)` that:

       * Prepares permit/authorization for USDC transfer.
       * Returns `paymentPayload` (JSON).
     * `GET /api/secret` again with header:

       * `X-PAYMENT: JSON.stringify(paymentPayload)`
  3. Log the 200 response.

### 5.3 “Skill” usage for LLMs

If you want this script to be used by an LLM (e.g. Claude / GPT) as a “tool”:

* Expose it as a CLI:

  * `node agent-client.js https://yourapp.com/api/secret`
* Define a tool description like:

  > “Given a URL to an x402-protected endpoint, this script will attempt to pay for it using the agent’s Base wallet and return the JSON response.”
* Then the LLM can decide:

  * “I need the premium data → call this tool with that URL.”

---

## 6. “End-to-End Test” Plan

To verify the whole architecture:

1. **Manual human test:**

   * Deploy Next.js app.
   * Load `/secret` in browser.
   * Connect wallet on Base, fund it with a tiny bit of USDC + ETH for gas.
   * Click “Load Secret” → 402 → pay via wallet → see secret data.

2. **Agent test:**

   * Fund agent wallet with tiny USDC on Base.
   * Run `node agent-client.js https://yourapp.com/api/secret`.
   * Confirm it:

     * sees 402,
     * pays,
     * gets the same secret content as the human UI.

3. **Negative tests:**

   * Try calling `/api/secret` without payment → ensure 402.
   * Try sending malformed X-PAYMENT → ensure 402/403.