const express = require('express');
const app = express();
// Use built-in JSON parser to avoid an extra dependency on `body-parser`
app.use(express.json());

const PORT = process.env.FACILITATOR_PORT || 9000;

app.get('/supported', (req, res) => {
  res.json({ networks: ['base', 'xlayer', 'solana'] });
});

app.get('/open', (req, res) => {
  res.json({ message: 'production open endpoint (mock)', amount: '1.00' });
});

app.get('/test', (req, res) => {
  res.json({ message: 'test endpoint', amount: '0.0001' });
});

app.post('/verify', (req, res) => {
  const body = req.body || {};
  // Accept either proof.txHash or body.txHash
  const proof = body.proof || body;
  const txHash = proof && proof.txHash ? proof.txHash : body.txHash;

  // Very simple validation: txHash that starts with 0x is "valid"
  if (txHash && typeof txHash === 'string' && txHash.startsWith('0x')) {
    return res.json({ valid: true, transactionId: txHash, network: body.network || 'base' });
  }

  // Also accept a small magic string for local testing
  if (proof && proof === 'LOCAL_VALID_PROOF') {
    return res.json({ valid: true, transactionId: '0xlocal', network: body.network || 'base' });
  }

  return res.json({ valid: false });
});

app.post('/settle', (req, res) => {
  const body = req.body || {};
  // Simulate settlement
  return res.json({ settled: true, transactionId: (body.proof && body.proof.txHash) || body.txHash || '0xsettle' });
});

app.listen(PORT, () => {
  console.log(`Mock OpenX402 facilitator running on http://localhost:${PORT}`);
});
