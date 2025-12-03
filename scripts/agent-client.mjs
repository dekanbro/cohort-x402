import 'dotenv/config';
import crypto from 'node:crypto';
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
];

async function run() {
  const baseUrl = process.argv[2] || process.env.BASE_URL || 'http://localhost:3000';
  const apiKey = process.env.LOCAL_FACILITATOR_API_KEY || 'changeme-local-facilitator-key';
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

  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) {
    console.error('AGENT_PRIVATE_KEY is not set in env');
    return;
  }

  const account = privateKeyToAccount(pk);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org'),
  });

  const amountDecimal = paymentReq.amount;
  if (!amountDecimal) {
    console.error('paymentRequirements.amount is missing; cannot construct on-chain payment');
    return;
  }
  const decimals = 6; // USDC on Base
  const amount = parseUnits(amountDecimal, decimals);
  const usdcAddress = paymentReq.tokenAddress;
  const recipient = paymentReq.recipient;

  const useEip3009 = process.env.ENABLE_EIP3009 === 'true';

  let payment;

  if (useEip3009) {
    console.log('Building EIP-3009 authorization instead of sending tx...');

    const now = Math.floor(Date.now() / 1000);
    const validAfter = BigInt(now);
    const validBefore = BigInt(now + 3600);
    const nonce = `0x${crypto.randomBytes(32).toString('hex')}`; // bytes32 nonce

    const domain = {
      name: process.env.EIP3009_DOMAIN_NAME || 'USD Coin',
      version: process.env.EIP3009_DOMAIN_VERSION || '2',
      chainId: 8453,
      verifyingContract: usdcAddress,
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };

    const message = {
      from: account.address,
      to: recipient,
      value: amount,
      validAfter,
      validBefore,
      nonce,
    };

    const signature = await walletClient.signTypedData({
      account,
      domain,
      types,
      primaryType: 'TransferWithAuthorization',
      message,
    });

    payment = {
      x402Version: 1,
      paymentPayload: {
        scheme: 'exact',
        network: paymentReq.network || 'base',
        payload: {
          authorization: {
            from: message.from,
            to: message.to,
            value: message.value.toString(),
            validAfter: message.validAfter.toString(),
            validBefore: message.validBefore.toString(),
            nonce: message.nonce,
          },
          signature,
        },
      },
      paymentRequirements: {
        ...paymentReq,
        scheme: 'exact',
      },
    };
  } else {
    console.log('Sending real USDC transfer from agent wallet...');
    const txHashReal = await walletClient.writeContract({
      address: usdcAddress,
      abi: erc20TransferAbi,
      functionName: 'transfer',
      args: [recipient, amount],
    });
    console.log('Sent tx hash:', txHashReal);

    payment = {
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
  }

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
    body: JSON.stringify(payment),
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

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
