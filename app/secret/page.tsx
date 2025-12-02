"use client";
import React, { useState } from 'react';

export default function SecretPage() {
  const [status, setStatus] = useState<'idle'|'loading'|'needsPayment'|'unlocked'>('idle');
  const [paymentReq, setPaymentReq] = useState<any>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadSecret(withPayment?: any) {
    setStatus('loading');
    setErrorMsg(null);
    try {
      const headers: Record<string,string> = {};
      if (withPayment) {
        headers['X-402-Payment'] = JSON.stringify(withPayment);
      }
      const res = await fetch('/api/secret', { headers });
      if (res.status === 200) {
        const body = await res.json();
        setSecret(body.data);
        setStatus('unlocked');
        return;
      }
      if (res.status === 402) {
        const body = await res.json();
        setPaymentReq(body.paymentRequirements || body);
        setStatus('needsPayment');
        return;
      }
      // Try to parse JSON error from server
      let bodyText = '';
      try {
        const json = await res.json();
        bodyText = (json && json.error) ? JSON.stringify(json) : JSON.stringify(json);
      } catch (e) {
        bodyText = await res.text().catch(() => String(res.status));
      }
      console.error('unexpected', res.status, bodyText);
      setErrorMsg(`Server error (${res.status}): ${bodyText}`);
      setStatus('idle');
    } catch (e) {
      console.error(e);
      setErrorMsg(`Request failed: ${String(e)}`);
      setStatus('idle');
    }
  }

  // For local testing we construct a dummy payment proof (no real wallet)
  async function payAndUnlock() {
    if (!paymentReq) return;
    // Create a fake txHash as the "proof" for mock facilitator
    const fakeTx = '0x' + Math.floor(Math.random()*1e16).toString(16).padStart(16, '0');
    const payment = { txHash: fakeTx, network: paymentReq.network || 'base' };
    await loadSecret(payment);
  }

  return (
    <main className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Secret Page</h2>
      </div>

      <p className="mb-4">Click "Load Secret" to request the protected resource.</p>
      <div className="mb-4">
        <button className="px-4 py-2 bg-accent text-white rounded" onClick={() => loadSecret()} disabled={status==='loading'}>Load Secret</button>
      </div>

      {status === 'loading' && <p>Loading…</p>}

      {status === 'needsPayment' && paymentReq && (
        <div className="card">
          <p className="font-semibold">Payment required</p>
          <p>Facilitator: {paymentReq.facilitator || paymentReq.facilitatorUrl || 'unknown'}</p>
          <p>Amount: {paymentReq.amount || paymentReq.price || 'unknown'} USDC</p>
          <div className="mt-3">
            <button className="px-3 py-1 border rounded" onClick={payAndUnlock}>Pay (dummy proof) & Unlock</button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 p-3 border border-muted card">
          <p className="font-semibold">Error</p>
          <pre className="whitespace-pre-wrap">{errorMsg}</pre>
          <div className="mt-2">
            <button className="px-3 py-1 border rounded" onClick={() => { setErrorMsg(null); loadSecret(); }}>Retry</button>
          </div>
        </div>
      )}

      {status === 'unlocked' && secret && (
        <div className="mt-6">
          <h3 className="text-lg font-medium">Secret</h3>
          <pre className="mt-2 p-3 card">{secret}</pre>
        </div>
      )}
    </main>
  );
}
