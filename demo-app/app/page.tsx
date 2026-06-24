"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Reveal, MaskLines, Stagger, StaggerItem } from "./components/motion";
import { ScrollProgress } from "./components/chrome";
import { Magnetic, Parallax, WordReveal, Counter } from "./components/awwwards";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Link to the dedicated install screen — secondary outlined bracket button. */
function InstallButton() {
  return (
    <Link href="/install" className="brk brk-install">
      Install the skill
    </Link>
  );
}

const KEYWORDS = [
  "Confidential Transfers",
  "Token-2022",
  "Auditor ElGamal Key",
  "twisted-ElGamal",
  "Ristretto255",
  "BSGS Discrete Log",
  "AML Engine",
  "Structuring",
  "Zero-Knowledge",
  "SHA-256 Reports",
  "Solana",
];

const CAPS: [string, string][] = [
  ["Sanctioned", "OFAC / denylisted counterparty"],
  ["Structuring", "a big payment split into sub-threshold pieces"],
  ["Velocity", "bursts beyond a per-window limit"],
  ["Concentration", "funnel / mule — most volume to one peer"],
  ["Layering", "rapid in-then-out pass-through"],
  ["Dormancy", "long-idle account suddenly moves funds"],
];

const SPECS: [string, string][] = [
  ["Group", "Ristretto255"],
  ["Scheme", "twisted-ElGamal"],
  ["Decrypt", "BSGS discrete log"],
  ["Reports", "SHA-256 append-only"],
  ["Tests", "30 passing / 0 failing"],
  ["Runtime", "deterministic loop"],
];

const TIMELINE: [string, string, string][] = [
  ["01", "Observe", "Pull confidential transfers for one mint — oldest first."],
  ["02", "Decrypt", "The auditor ElGamal key recovers the amount. No account keys touched."],
  ["03", "Assess", "Deterministic AML rules score each amount against rolling state."],
  ["04", "Report", "Flags page out; a SHA-256 hashed, append-only report is emitted."],
];

function Loaders() {
  return (
    <div className="loaders" aria-hidden>
      <span className="braille b1">⣿⣿⣿⣿⣿⣿⣿</span>
      <span className="braille b2">⣿⣿⣿⣿</span>
    </div>
  );
}

function SectionHead({ idx, kicker, title }: { idx: string; kicker: string; title: string }) {
  return (
    <div className="ahead">
      <div className="ahead-row">
        <span className="tri" aria-hidden>▶</span>
        <h2 className="ahead-title">
          <span className="mono kicker">{kicker}</span>
          <span className="bar">|</span>
          <WordReveal text={title} />
          <span className="neg">¬</span>
        </h2>
        <span className="ahead-no mono">{idx}</span>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <div className="aptos">
      <ScrollProgress />

      <div className="awrap">
        <motion.header
          className="atop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="brandline mono">
            <span className="tri" aria-hidden>▶</span>
            Confidential<span className="teal">Audit</span>
            <span className="ver">v1.01</span>
          </div>
          <div className="atop-right mono">
            <a href="https://github.com/Venkat5599/Solanaskills" target="_blank" rel="noreferrer" className="brk">
              GitHub
            </a>
            <Link href="/dashboard" className="brk">
              Console
            </Link>
          </div>
        </motion.header>

        {/* 00 — hero */}
        <section className="ahero acc-teal">
          <div className="ahero-top mono">
            <span>00</span>
            <span>Start now</span>
            <Loaders />
          </div>

          <h1 className="adisplay">
            <MaskLines lines={["Compliance", "without", "surveillance."]} lineClassName="aline" />
          </h1>

          <div className="ahero-band">
            <div className="ahero-left">
              <motion.p
                className="alead"
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
              >
                The auditor-side AML engine for Solana Token-2022 Confidential Transfers. Encrypted
                amounts on-chain are exactly what regulated payments need — and exactly what blocks
                them. This skill operates the one key that opens it.
              </motion.p>
              <motion.div
                className="acta mono"
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.65, ease: EASE }}
              >
                <Magnetic>
                  <Link href="/dashboard" className="brk brk-fill">
                    Open the console
                  </Link>
                </Magnetic>
                <InstallButton />
                <a href="https://github.com/Venkat5599/Solanaskills" target="_blank" rel="noreferrer" className="brk">
                  Read the source
                </a>
              </motion.div>
            </div>

            <Parallax distance={28} className="lin-card-wrap">
            <motion.div
              className="lin-card"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8, ease: EASE }}
            >
              <div className="lin-card-top">
                <span className="lin-dot3"><i /><i /><i /></span>
                <span className="lin-card-title mono">auditor · flagged transfers</span>
              </div>
              {([
                ["AML-2703", "Structuring — 3 sub-threshold splits", "High", "pd-crim"],
                ["AML-2702", "Sanctioned counterparty", "High", "pd-crim"],
                ["AML-2698", "Velocity burst over window", "Review", "pd-cyan"],
                ["AML-2691", "Layering pass-through", "Review", "pd-cyan"],
                ["AML-2680", "Clean — within thresholds", "Clear", "pd-em"],
              ] as const).map(([id, title, st, dot]) => (
                <div className="lin-row" key={id}>
                  <span className="lin-id">{id}</span>
                  <span className="lin-title">{title}</span>
                  <span className="lin-pill"><span className={"pd " + dot} />{st}</span>
                </div>
              ))}
            </motion.div>
            </Parallax>
          </div>
        </section>

        {/* keyword ticker */}
        <div className="scrollband mono" aria-hidden>
          <div className="scrollband-track">
            {Array.from({ length: 2 }).flatMap((_, r) =>
              KEYWORDS.map((k, i) => (
                <span key={`${r}-${i}`}>
                  {k}
                  <span className="kw-sep">◆</span>
                </span>
              )),
            )}
          </div>
        </div>

        {/* 01 — about */}
        <section className="asec acc-pink">
          <SectionHead idx="01" kicker="About" title="Who we are" />
          <Reveal>
            <p className="abody">
              Not a chatbot about docs — the agent&apos;s tools <b>are</b> the skill. Real
              twisted-ElGamal over Ristretto255, baby-step-giant-step discrete log, an AML rule
              engine, and SHA-256 hashed reporting. The auditor key decrypts one mint, inside one
              trust boundary, for one lawful purpose. Privacy stays the default for everyone else —
              by cryptography, not by policy.
            </p>
          </Reveal>
        </section>

        {/* 02 — capabilities */}
        <section className="asec acc-coral">
          <SectionHead idx="02" kicker="Detection" title="What only the auditor can see" />
          <Stagger className="caps" step={0.06}>
            {CAPS.map(([t, d], i) => (
              <StaggerItem className="cap" key={i}>
                <span className="cap-no mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="cap-t">{t}</span>
                <span className="cap-d">{d}</span>
                <span className="cap-arrow mono">→</span>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal className="caps-cta">
            <Magnetic>
              <Link href="/dashboard" className="brk brk-fill mono">
                Run a scenario
              </Link>
            </Magnetic>
          </Reveal>
        </section>

        {/* 03 — engine specs */}
        <section className="asec acc-teal">
          <SectionHead idx="03" kicker="Engine" title="Built on real cryptography" />
          <Stagger className="specs" step={0.05}>
            {SPECS.map(([k, v], i) => (
              <StaggerItem className="spec" key={i}>
                <span className="spec-k mono">{k}</span>
                <span className="spec-v">
                  {k === "Tests" ? (
                    <>
                      <Counter to={30} /> passing / 0 failing
                    </>
                  ) : (
                    v
                  )}
                </span>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* 04 — timeline */}
        <section className="asec acc-peach">
          <SectionHead idx="04" kicker="Timeline" title="How it runs" />
          <div className="tl">
            {TIMELINE.map(([n, t, d], i) => (
              <Reveal key={i} delay={i * 0.05}>
                <div className="tl-row">
                  <span className="tl-no mono">{n}</span>
                  <span className="tl-t">{t}</span>
                  <span className="tl-d">{d}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* closer */}
        <section className="acloser acc-teal">
          <Reveal>
            <h2 className="acloser-h">See it really run.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <Magnetic strength={0.4}>
              <Link href="/dashboard" className="brk brk-fill brk-lg mono">
                Open the console
              </Link>
            </Magnetic>
          </Reveal>
        </section>

        <footer className="afoot mono">
          <div className="afoot-cols">
            <div>
              <span className="afoot-k">Engine</span>
              <p>twisted-ElGamal · Ristretto255 · BSGS DLOG · 30 tests</p>
            </div>
            <div>
              <span className="afoot-k">Model</span>
              <p>tool-use loop · BM25 retrieval over the skill</p>
            </div>
            <div>
              <span className="afoot-k">License</span>
              <p>MIT · built for the Solana AI Kit</p>
            </div>
          </div>
          <div className="afoot-cc">© 2026 — SOLANA-CONFIDENTIAL-SKILL — v1.01</div>
        </footer>
      </div>
    </div>
  );
}
