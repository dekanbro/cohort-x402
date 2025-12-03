import { createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const erc20TransferAbi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export async function runAgentClient() {
  const nodeProcess = process as NodeJS.Process;

  const baseUrl = nodeProcess.argv[2] || nodeProcess.env.BASE_URL || 'http://localhost:3000';
  const apiKey = nodeProcess.env.LOCAL_FACILITATOR_API_KEY || 'changeme-local-facilitator-key';
  const secretUrl = `${baseUrl.replace(/\/$/, '')}/api/secret`;
  const verifyUrl = `${baseUrl.replace(/\/$/, '')}/api/payments/verify`;
  const settleUrl = `${baseUrl.replace(/\/$/, '')}/api/payments/settle`;

  console.log('Base URL:', baseUrl);

  const res = await fetch(secretUrl);
  if (res.status === 200) {
    console.log('Already unlocked:', await res.text());
    return;
  }
  if (res.status !== 402) {
    console.error('Unexpected status', res.status);
    console.error(await res.text());
    return;
  }

  const body = await res.json();
  const paymentReq = body.paymentRequirements || body;
  console.log('Payment required', paymentReq);

  const pk = nodeProcess.env.AGENT_PRIVATE_KEY;
  if (!pk) {
    console.error('AGENT_PRIVATE_KEY is not set in env');
    return;
  }

  const account = privateKeyToAccount(pk as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(nodeProcess.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org'),
  });

  const amountDecimal = paymentReq.amount as string | undefined;
  if (!amountDecimal) {
    console.error('paymentRequirements.amount is missing; cannot construct on-chain payment');
    return;
  }
  const decimals = 6;
  const amount = parseUnits(amountDecimal, decimals);
  const usdcAddress = paymentReq.tokenAddress as `0x${string}`;
  const recipient = paymentReq.recipient as `0x${string}`;

  console.log('Sending real USDC transfer from agent wallet...');
  const txHashReal = await walletClient.writeContract({
    address: usdcAddress,
    abi: erc20TransferAbi,
    functionName: 'transfer',
    args: [recipient, amount],
  });
  console.log('Sent tx hash:', txHashReal);

  const payment = {
    x402Version: 1,
    paymentPayload: {
      scheme: paymentReq.scheme || 'evm-txhash',
      network: paymentReq.network || 'base',
      payload: {
        txHash: txHashReal,
      },
    },
    paymentRequirements: paymentReq,
  };

  console.log('Calling /api/payments/verify as external agent...');
  const verifyRes = await fetch(verifyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(payment),
  });
  const verifyBody = await verifyRes.json().catch(() => ({}));
  console.log('Verify status:', verifyRes.status, verifyBody);

  if (verifyRes.status !== 200 || !verifyBody.isValid) {
    console.log('Verification did not succeed; stopping before settle/secret fetch.');
    return;
  }

  console.log('Calling /api/payments/settle as external agent...');
  const settleRes = await fetch(settleUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ txHash: payment.paymentPayload.payload.txHash }),
  });
  const settleBody = await settleRes.json().catch(() => ({}));
  console.log('Settle status:', settleRes.status, settleBody);

  console.log('Fetching /api/secret with X-402-Payment header...');
  const retry = await fetch(secretUrl, {
    headers: { 'X-402-Payment': JSON.stringify(payment) },
  });
  console.log('Retry status:', retry.status);
  console.log(await retry.text());
}
