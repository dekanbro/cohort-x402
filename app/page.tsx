import React from 'react';
import Link from 'next/link';

export default function Page() {
  return (
    <main style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>x402 Demo — cohortx402</h1>
      <p>
        Demo: a small Next.js app that protects `/api/secret` behind an x402 paywall.
      </p>
      <p>
        Open <Link href="/secret">/secret</Link> to try the flow.
      </p>
    </main>
  );
}
