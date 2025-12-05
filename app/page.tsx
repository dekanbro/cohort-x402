"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import styles from './landing.module.css';

const features = [
  {
    title: 'Hosted facilitator, zero signup',
    body: 'Drop-in toll gate for any API. No accounts, no KYC, just x402 on Base with RaidGuild craft.',
    chips: ['Base-native', 'Open access', 'Developer-first'],
  },
  {
    title: 'Micropayments that feel invisible',
    body: 'Charge as low as $0.0001 per call. Perfect for agents, AI workloads, data lookups, and tiny automations.',
    chips: ['USDC', 'Low-friction', 'Autonomous'],
  },
  {
    title: 'Temporary keys in seconds',
    body: 'Issue short-lived keys tied to wallets. Great for demos, cohorts, hackathons, and onboarding builders fast.',
    chips: ['No platform lock-in', 'Wallet-native'],
  },
  {
    title: 'Built for the RaidGuild funnel',
    body: 'Every integration meets the brand: clear docs, sharp UX, and a path into the RaidGuild orbit.',
    chips: ['BD engine', 'Brand-forward'],
  },
];

const steps = [
  { title: 'Price your endpoint', detail: 'Pick a micro price (e.g. $0.0001). The facilitator enforces it.' },
  { title: 'Developers pay as they go', detail: 'Requests route through the facilitator; x402 handles settlement.' },
  { title: 'You receive only paid traffic', detail: 'No bots, no freeloaders—just usage-based monetization by default.' },
];

const useCases = [
  'AI inference and automations',
  'Data and on-chain lookups',
  'Agent-to-agent workflows',
  'Usage-based SaaS endpoints',
  'Hackathon and cohort demos',
  'Workshops and tech talks',
];

const cohortMembers = [
  { name: 'Forge Finch', github: 'https://github.com/forge-finch' },
  { name: 'Moloch Mage', github: 'https://github.com/moloch-mage' },
  { name: 'Chainwright', github: 'https://github.com/chainwright' },
  { name: 'Signal Seeker', github: 'https://github.com/signal-seeker' },
  { name: 'Base Barbarian', github: 'https://github.com/base-barbarian' },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

export default function Page() {
  const [showDeployModal, setShowDeployModal] = useState(false);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div>
            <div className={styles.badge}>RaidGuild Cohort Facilitator</div>
            <h1 className={styles.title}>Hosted x402 gateway for APIs, agents, and cohorts</h1>
            <p className={styles.lede}>
              Turn any endpoint into a pay-per-use toll gate. RaidGuild-branded, Base-native, and ready for builders who
              want instant monetization without platform lock-in.
            </p>
            <div className={styles.ctaRow}>
              <Link href="/secret" className={`${styles.button} ${styles.primary}`}>Launch the demo</Link>
              <a className={`${styles.button} ${styles.secondary}`} href="mailto:hello@raidguild.org?subject=RaidGuild x402 Facilitator">
                Talk to RaidGuild
              </a>
            </div>
            <p className={styles.microcopy}>Zero signup. Real USDC on Base. Built for autonomous agents and dev teams.</p>
          </div>
          <div className={styles.heroArt}>
            <div>
              <Image
                src="/illustrations/portal-arch-c.webp"
                alt="RaidGuild portal illustration"
                width={520}
                height={420}
                priority
                style={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)' }}
              />
              <button className={styles.heroCard} onClick={() => setShowDeployModal(true)}>
                <Image src="/logos/logo-mark-m500.svg" alt="RaidGuild mark" width={40} height={40} />
                <div>
                  <div className={styles.heroCardTitle}>Host your own</div>
                  <div className={styles.heroCardSub}>One-click Vercel deploy (coming soon)</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.kicker}>Why this</div>
          <h2>Built for devs and the agentic economy</h2>
          <p className={styles.lede}>The easiest way to add pay-per-use monetization, with RaidGuild flavor baked in.</p>
        </div>
        <div className={styles.grid}>
          {features.map((item) => (
            <div key={item.title} className={styles.card}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <div className={styles.chipList}>
                {item.chips.map((chip) => (
                  <span key={chip} className={styles.chip}>{chip}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.kicker}>How it works</div>
          <h2>From “idea” to paid traffic in minutes</h2>
        </div>
        <div className={styles.grid}>
          {steps.map((step) => (
            <div key={step.title} className={styles.card}>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.kicker}>Where it shines</div>
          <h2>Use cases we designed for</h2>
        </div>
        <div className={styles.card}>
          <div className={styles.list}>
            {useCases.map((item) => (
              <div key={item}>• {item}</div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.kicker}>What&apos;s included</div>
          <h2>Testnet and production facilitators, plus docs and examples</h2>
          <p className={styles.lede}>Temporary key generator, ready-to-run demo flows, and a clear path to production tiers.</p>
        </div>
        <div className={styles.cohortSection}>
          <div className={styles.kicker}>Built by</div>
          <h2>RaidGuild × December 2025 Cohort</h2>
          <p className={styles.cohortBody}>
            The RaidGuild Cohort is a monthly, adventure-style accelerator where members learn, build, and ship real products.
            Each themed run mixes deep dives, workshops, team formation, and a Demo Day that unlocks new guild talent.
            It&apos;s part bootcamp, part hackathon, part quest — designed to strengthen the Guild and activate builders.
          </p>
          <div className={styles.avatarRow}>
            {cohortMembers.map((member) => (
              <a key={member.github} href={member.github} className={styles.avatar} target="_blank" rel="noreferrer">
                <span>{initials(member.name)}</span>
              </a>
            ))}
          </div>
        </div>
        <div className={styles.ctaPanel}>
          <div className={styles.logoRow}>
            <Image src="/logos/full-orange-floating-m500.svg" alt="RaidGuild wordmark" width={140} height={36} />
            <span>Made by RaidGuild cohorts. Crafted for the ecosystem.</span>
          </div>
          <div className={styles.ctaRow}>
            <Link href="/secret" className={`${styles.button} ${styles.primary}`}>Try the hosted demo</Link>
            <a className={`${styles.button} ${styles.secondary}`} href="mailto:hello@raidguild.org?subject=RaidGuild x402 Facilitator">
              Get access or integrations help
            </a>
          </div>
          <p className={styles.microcopy}>Need a white-labeled facilitator or custom pricing logic? Let’s talk.</p>
        </div>
      </section>

      {showDeployModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h3>One-click Vercel deploy</h3>
            <p>This demo will soon support a one-click Vercel deploy so you can host your own facilitator. For now, reach out and we’ll help you spin up a hosted instance.</p>
            <div className={styles.modalActions}>
              <button className={`${styles.button} ${styles.secondary}`} onClick={() => setShowDeployModal(false)}>Close</button>
              <a className={`${styles.button} ${styles.primary}`} href="mailto:hello@raidguild.org?subject=Host my own x402 facilitator" onClick={() => setShowDeployModal(false)}>
                Talk to RaidGuild
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
