"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Reveal, MaskLines, Stagger, StaggerItem } from "./components/motion";

const RULES = [
  ["Sanctioned", "OFAC / denylisted counterparty"],
  ["Structuring", "a big payment split into sub-threshold pieces"],
  ["Velocity", "bursts beyond a per-window limit"],
  ["Concentration", "funnel / mule — most volume to one peer"],
  ["Layering", "rapid in-then-out pass-through"],
  ["Dormancy", "long-idle account suddenly moves funds"],
];

const STEPS = [
  ["Observe", "Pull confidential transfers for one mint — oldest first."],
  ["Decrypt", "The auditor ElGamal key recovers the amount. No account keys touched."],
  ["Assess", "Deterministic AML rules score each decrypted amount against rolling state."],
  ["Report", "Flags page out; a SHA-256 hashed, append-only report is emitted."],
];

const EASE = [0.22, 1, 0.36, 1] as const;

export default function Page() {
  return (
    <>
      <div className="wrap">
        <motion.nav
          className="nav"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="wordmark">
            Confidential<span className="green">Audit</span>
          </div>
          <div className="right">
            <a className="ghost" href="https://github.com/Venkat5599/Solanaskills" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <Link className="ghost" href="/dashboard">
              Console
            </Link>
            <span className="mark">||</span>
          </div>
        </motion.nav>

        <header className="hero">
          <motion.div
            className="meta"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          >
            <span className="lab">2026 Edition</span>
            <span className="lab">solana-confidential-skill · live agent</span>
          </motion.div>

          <h1 className="display">
            <MaskLines lines={["Compliance", "without", "surveillance."]} lineClassName="line" />
          </h1>

          <motion.p
            className="strap"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
          >
            The auditor-side AML engine for Solana Token-2022 Confidential Transfers. Confidential
            Transfers encrypt amounts on-chain — exactly what regulated payments need, and exactly
            what blocks them. This skill operates the one key that opens it.&nbsp;
            <span className="tick" />
          </motion.p>

          <motion.div
            className="cta-row"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: EASE }}
          >
            <Link className="cta" href="/dashboard">
              Open the console →
            </Link>
            <a className="ghost lg" href="https://github.com/Venkat5599/Solanaskills" target="_blank" rel="noreferrer">
              Read the source
            </a>
          </motion.div>
        </header>

        <section className="intro">
          <Reveal>
            <span className="lab">Introduction</span>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="body">
              Not a chatbot about docs — the agent&apos;s tools <b>are</b> the skill. Real
              twisted-ElGamal over Ristretto255, baby-step-giant-step discrete log, an AML rule
              engine, and SHA-256 hashed reporting. The auditor key decrypts one mint, inside one
              trust boundary, for one lawful purpose. Privacy stays the default for everyone else —
              by cryptography, not by policy.
            </div>
          </Reveal>
        </section>

        <section className="sec">
          <div className="shead">
            <span className="no">01</span>
            <Reveal>
              <h2>How it runs</h2>
            </Reveal>
          </div>
          <Stagger className="steps">
            {STEPS.map(([t, d], i) => (
              <StaggerItem className="step" key={i}>
                <span className="step-no lab">{String(i + 1).padStart(2, "0")}</span>
                <span className="step-t">{t}</span>
                <span className="step-d">{d}</span>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <section className="sec">
          <div className="shead">
            <span className="no">02</span>
            <Reveal>
              <h2>What only the auditor can see</h2>
            </Reveal>
            <span className="tick stat" />
          </div>
          <Stagger className="rules" step={0.06}>
            {RULES.map(([t, d], i) => (
              <StaggerItem className="rule" key={i}>
                <span className="rule-t">{t}</span>
                <span className="rule-d">{d}</span>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <section className="closer">
          <Reveal>
            <h2 className="closer-h">See it really run.</h2>
          </Reveal>
          <Reveal delay={0.12}>
            <Link className="cta" href="/dashboard">
              Open the console →
            </Link>
          </Reveal>
        </section>
      </div>

      <footer>
        <div className="fwrap">
          <div className="cols">
            <div>
              <h4>Engine</h4>
              <p>twisted-ElGamal · Ristretto255 · baby-step-giant-step DLOG · 30 tests passing</p>
            </div>
            <div>
              <h4>Model</h4>
              <p>tool-use loop · BM25 retrieval over the skill&apos;s own modules</p>
            </div>
            <div>
              <h4>License</h4>
              <p>MIT · built for the Solana AI Kit</p>
            </div>
          </div>
          <div className="cc">© 2026 · SOLANA-CONFIDENTIAL-SKILL · #WEARESTILLEARLY</div>
        </div>
      </footer>
    </>
  );
}
