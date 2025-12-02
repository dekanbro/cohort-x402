import React from 'react';

export default function Page() {
  return (
    <main style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>x402 Demo — cohortx402</h1>
      <p>
        Demo: a small Next.js app that protects `/api/secret` behind an x402 paywall.
      </p>
      <p>
        Open <a href="/secret">/secret</a> to try the flow.
      </p>
    </main>
  );
}
