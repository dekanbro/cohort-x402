# x402 Demo Happy Path

This document walks through the full successful flow for unlocking the secret, both from the browser (MetaMask) and from an external agent script.

## Prerequisites

- `.env` (or `.env.local`) configured with at least:
  - `USDC_BASE_ADDRESS` (Base USDC contract address)
  - `SERVICE_RECIPIENT_ADDRESS` (your service wallet to receive USDC)
  - `PRICE_IN_USDC` (e.g. `0.0001`)
  - `LOCAL_FACILITATOR_API_KEY` (e.g. `changeme-local-facilitator-key`)
  - `AGENT_PRIVATE_KEY` (funded Base wallet for the agent script)
  - Optional: `BASE_URL` (defaults to `http://localhost:3000`)
- A bit of Base ETH and Base USDC in:
  - Your MetaMask wallet (for the browser flow)
  - The `AGENT_PRIVATE_KEY` wallet (for the agent flow)

---

## 1. Browser + MetaMask Flow

### 1.1 Start the Next app

```bash
cd /home/dekanjbrown/Projects/playground/cohortx402
pnpm dev
```

This starts the app at `http://localhost:3000`.

### 1.2 Open the secret page

- Navigate to `http://localhost:3000/secret` in your browser.
- Connect your wallet (MetaMask) to Base via the UI header.

### 1.3 Request access (get paymentRequirements)

- Click **"Load Secret"**.
- The page calls `GET /api/secret`.
  - If the secret is not yet unlocked, the API responds with `402` and a `paymentRequirements` object, including:
    - `scheme: "evm-txhash"`
    - `network: "base"`
    - `asset: "USDC"`
    - `resource: "/api/secret"`
    - `amount` (e.g. `"0.0001"`)
    - `recipient` (your `SERVICE_RECIPIENT_ADDRESS`)
    - `tokenAddress` (Base USDC address)
- The UI shows a small card with:
  - `Scheme: evm-txhash`
  - `Amount: 0.0001 USDC`

### 1.4 Pay with wallet

- Click **"Pay with Wallet"**.
- The client (`app/secret/page.tsx`) does the following:
  1. Ensures you are on Base (8453), asking MetaMask to switch if needed.
  2. Encodes an ERC-20 `transfer(recipient, amount)` call against `tokenAddress` (USDC).
  3. Sends a transaction via MetaMask:
     - `eth_sendTransaction` with `to = USDC_BASE_ADDRESS`, `data = transfer(recipient, amount)`.
  4. Receives a real `txHash` from MetaMask once you confirm.
  5. Builds an x402-style payment object:

     ```json
     {
       "x402Version": 1,
       "paymentPayload": {
         "scheme": "evm-txhash",
         "network": "base",
         "payload": { "txHash": "0x…" }
       },
       "paymentRequirements": { … }
     }
     ```

  6. Calls `GET /api/secret` again with an `X-402-Payment` header containing that JSON.

### 1.5 Server-side verification and secret unlock

- `app/api/secret/route.ts`:
  1. Parses the `X-402-Payment` header.
  2. Extracts `txHash` from `paymentPayload.payload.txHash`.
  3. Uses `paymentRequirements` to determine the expected:
     - USDC contract (`tokenAddress`)
     - recipient (`recipient`)
     - amount in USDC (`amount`)
  4. Calls `verifyBaseUsdcTx` to:
     - Fetch the transaction and receipt from Base.
     - Ensure the transaction is a successful `transfer` from USDC to the expected recipient for the expected amount.
  5. If valid:
     - Responds `200` with:

       ```json
       { "data": "Super secret message behind x402 paywall" }
       ```

- The browser updates the UI to show the unlocked secret.

---

## 2. External Agent Task Flow

This flow simulates an external agent (server-to-server) that pays on-chain, verifies via the local facilitator endpoints, and then unlocks the same secret.

### 2.1 Agent script and task

- Script: `scripts/agent-client.mjs`
- Task: `.vscode/tasks.json` entry:

```jsonc
{
  "label": "Test Secret API (agent-client)",
  "type": "shell",
  "command": "node",
  "args": ["scripts/agent-client.mjs"],
  "isBackground": false,
  "problemMatcher": [],
  "group": "test"
}
```

`scripts/agent-client.mjs`:
- Uses `dotenv` (`import 'dotenv/config'`) so it reads `.env`.
- Uses `AGENT_PRIVATE_KEY` and `LOCAL_FACILITATOR_API_KEY` from env.

### 2.2 Run the demo

With the Next app still running:

```bash
cd /home/dekanjbrown/Projects/playground/cohortx402
# .env already contains AGENT_PRIVATE_KEY, LOCAL_FACILITATOR_API_KEY, BASE_URL
# so nothing else is required here

# From VS Code: Tasks → Run Task → "Test Secret API (agent-client)"
# Or from terminal:
node scripts/agent-client.mjs
```

### 2.3 What the agent does

1. **Discover requirements**
   - Calls `GET /api/secret` at `BASE_URL` (default `http://localhost:3000`).
   - Receives `402` with `paymentRequirements` (same shape as in the browser flow).

2. **Send an on-chain Base USDC payment**
   - Loads `AGENT_PRIVATE_KEY` from env.
   - Constructs a viem `walletClient` on Base:
     - `createWalletClient({ account, chain: base, transport: http(RPC_URL) })`.
   - Parses `paymentRequirements.amount` as a USDC `amount` using 6 decimals.
   - Sends an ERC-20 `transfer(recipient, amount)` on USDC:

     ```js
     const txHashReal = await walletClient.writeContract({
       address: usdcAddress,
       abi: erc20TransferAbi,
       functionName: 'transfer',
       args: [recipient, amount],
     });
     ```

3. **Build the x402 payment payload**

   ```json
   {
     "x402Version": 1,
     "paymentPayload": {
       "scheme": "evm-txhash",
       "network": "base",
       "payload": { "txHash": "0x…" }
     },
     "paymentRequirements": { … }
   }
   ```

4. **Verify via local facilitator**
   - Calls `POST /api/payments/verify` with headers:
     - `Content-Type: application/json`
     - `x-api-key: LOCAL_FACILITATOR_API_KEY`
   - Body: the payment object above.
   - Server:
     - Extracts `txHash` and `paymentRequirements`.
     - Calls `verifyBaseUsdcTx` (same logic as `/api/secret`).
     - Responds with:

       ```json
       { "isValid": true }
       ```

   - Agent logs: `Verify status: 200 { isValid: true }`.

5. **Settle via local facilitator**
   - Calls `POST /api/payments/settle` with same API key and body `{ txHash }`.
   - Current implementation is a no-op that returns:

     ```json
     { "success": true, "txHash": "0x…" }
     ```

   - Agent logs: `Settle status: 200 { success: true, txHash: "0x…" }`.

6. **Unlock the secret via X-402-Payment header**
   - Agent then calls `GET /api/secret` again with:
     - Header: `X-402-Payment: <stringified payment object>`.
   - `/api/secret` performs the same verification as in the browser flow and, seeing a valid payment, returns:

     ```json
     { "data": "Super secret message behind x402 paywall" }
     ```

   - Agent logs:
     - `Retry status: 200`
     - `{"data":"Super secret message behind x402 paywall"}`

---

## 3. What this demonstrates

- A **unified payment model**:
  - Both browser and agent flows use the same `paymentRequirements` and the same x402-style `paymentPayload` (`scheme`, `network`, `payload.txHash`).
- **On-chain verification**:
  - The secret is only released when a real Base USDC transfer is observed on-chain matching the `paymentRequirements`.
- **Facilitator-style API**:
  - `/api/payments/verify` and `/api/payments/settle` provide an x402-like server-to-server interface with API key auth.
- **Two clients, one contract**:
  - Human user with MetaMask.
  - Automated agent with a private key and API key.
