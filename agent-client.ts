import fetch from 'node-fetch';

async function main() {
  const url = process.argv[2] || 'http://localhost:3000/api/secret';
  console.log('Target:', url);

  // First request
  const res = await fetch(url);
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

  // Build a fake txHash as proof for the mock facilitator
  const fakeTx = '0x' + Math.floor(Math.random()*1e16).toString(16).padStart(16, '0');
  const payment = { txHash: fakeTx, network: paymentReq.network || 'base' };

  // Retry with header
  const retry = await fetch(url, { headers: { 'X-402-Payment': JSON.stringify(payment) } });
  console.log('Retry status:', retry.status);
  console.log(await retry.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
