"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { ScrollProgress } from "../components/chrome";
import { MaskLines, Reveal } from "../components/motion";

const EASE = [0.22, 1, 0.36, 1] as const;

const TOC: [string, string][] = [
  ["overview", "Overview"],
  ["loop", "How it runs"],
  ["rules", "AML rules"],
  ["crypto", "Cryptography"],
  ["guardrails", "Guardrails"],
  ["quickstart", "Quick start"],
  ["api", "API surface"],
  ["modules", "Skill modules"],
];

const RULES: [string, string, string][] = [
  ["sanctioned", "high", "OFAC / denylisted counterparty on either side"],
  ["threshold", "high", "Single transfer at/above the CTR report line"],
  ["structuring", "high", "A big payment split into sub-threshold pieces (smurfing)"],
  ["velocity", "medium", "Out-volume or out-count beyond a per-window limit"],
  ["concentration", "medium", "Funnel / mule — most volume to one counterparty"],
  ["layering", "medium", "Funds received then forwarded fast (pass-through)"],
  ["dormancy", "medium", "Long-idle account suddenly moves material funds"],
];

const GUARDS: [string, string][] = [
  ["CT01 · Key custody", "Auditor secret lives in HSM/TEE, loaded at runtime. Never logged, committed, or in client code."],
  ["CT02 · Trust boundary", "One loop ⇒ one mint ⇒ one key, one process. No shared decryptors."],
  ["CT03 · No silent skips", "A failed decrypt/observe halts via the circuit breaker. Missing a transfer is worse than stopping."],
  ["CT04 · Raw amount hygiene", "Decrypted amounts live in memory only long enough to score; reports carry aggregates + flags."],
  ["CT05 · Determinism", "AML rules are pure functions of (transfer, state, config). No clock/IO/randomness inside a rule."],
  ["CT06 · Termination", "Every loop carries a BudgetLedger — duration/iteration/RPC caps + error breaker."],
  ["CT07 · Report immutability", "Reports are SHA-256 hashed over canonical body; append-only. Supersede, never edit."],
  ["CT08 · Block ordering", "Process transfers oldest-first; the windowed detectors depend on it."],
  ["CT09 · Ciphertext layout", "Real Solana lo(16)/hi(32) ElGamal split + zk-sdk decrypt convention, tested against real bytes."],
];

const API: [string, string][] = [
  ["ConfidentialComplianceLoop", "observe → decrypt → assess → report → repeat, budget-bounded"],
  ["ComplianceEngine", "deterministic AML engine over decrypted transfers"],
  ["SplAuditorDecryptor", "real decrypt; layout: limbed|lohi, convention: engine|solana"],
  ["decryptSolanaAmountLoHi", "decrypt real @solana/zk-sdk lo/hi auditor ciphertext"],
  ["BudgetLedger", "iteration / time / RPC caps + circuit breaker"],
  ["buildReport", "SHA-256 hashed, tamper-evident compliance report"],
  ["defaultConfig(decimals)", "tunable AML thresholds for a mint"],
];

const MODULES: [string, string][] = [
  ["primer.md", "CT + the auditor key from first principles"],
  ["auditor-key-setup.md", "create a mint with confidential transfers + auditor key"],
  ["compliance-loop.md", "architect & operate the monitoring loop"],
  ["aml-rules.md", "tune thresholds, add custom detection rules"],
  ["decryption.md", "wire real ElGamal + lo/hi + Solana-convention decrypt"],
  ["integration-helius.md", "fetch confidential transfers (poll or webhook)"],
  ["reporting.md", "emit hashed, regulator-facing reports"],
  ["budget-and-stops.md", "guarantee termination + circuit breaking"],
  ["resources.md", "official specs, SDKs, status, links"],
];

const REPO = "https://github.com/Venkat5599/Solanaskills";

const QUICKSTART = `import {
  ConfidentialComplianceLoop, ComplianceEngine, BudgetLedger,
  defaultConfig, SplAuditorDecryptor,
} from "solana-confidential-compliance";

const loop = new ConfidentialComplianceLoop({
  mint, auditorPubkey,
  decryptor: new SplAuditorDecryptor({
    auditorElGamalSecret,        // from your HSM / TEE
    layout: "lohi", convention: "solana",   // real on-chain ciphertext
  }),
  engine: new ComplianceEngine(defaultConfig(6)),
  budget: new BudgetLedger({ maxDurationMs: 8 * 3600_000, maxConsecutiveErrors: 5 }),
  observe: fetchNewConfidentialTransfers,    // RPC / Helius, oldest-first
  onFlags: alertSink,
  onReport: persistImmutable,
});

await loop.run();`;

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard blocked — code stays visible */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="codeblock">
      <button type="button" className="codeblock-copy mono" onClick={copy}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
      <pre className="mono">{code}</pre>
    </div>
  );
}

function Head({ id, no, title }: { id: string; no: string; title: string }) {
  return (
    <div className="doc-head" id={id}>
      <span className="doc-head-no mono">{no}</span>
      <h2 className="doc-head-t">{title}</h2>
    </div>
  );
}

export default function DocsPage() {
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
          <Link href="/" className="brandline mono">
            <span className="tri" aria-hidden>▶</span>
            Confidential<span className="teal">Audit</span>
            <span className="ver">v1.01</span>
          </Link>
          <div className="atop-right mono">
            <Link href="/" className="brk">Home</Link>
            <Link href="/install" className="brk">Install</Link>
            <a href={REPO} target="_blank" rel="noreferrer" className="brk">GitHub</a>
            <Link href="/dashboard" className="brk">Console</Link>
          </div>
        </motion.header>

        <section className="ahero acc-teal">
          <div className="ahero-top mono">
            <span>Docs</span>
            <span>solana-confidential-skill</span>
          </div>
          <h1 className="inst-display">
            <MaskLines lines={["Documentation"]} lineClassName="aline" />
          </h1>
          <motion.p
            className="alead inst-lead"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45, ease: EASE }}
          >
            The auditor-side AML engine for Solana Token-2022 Confidential Transfers — how it runs,
            what it detects, the cryptography, and the API.
          </motion.p>
        </section>

        <div className="doc-grid">
          <aside className="doc-toc mono">
            <span className="doc-toc-k">On this page</span>
            {TOC.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="doc-toc-link">{label}</a>
            ))}
          </aside>

          <div className="doc-body">
            <Reveal>
              <section className="doc-sec">
                <Head id="overview" no="01" title="Overview" />
                <p className="doc-p">
                  Confidential Transfers encrypt amounts on-chain with twisted-ElGamal + ZK proofs —
                  exactly what regulated payments need, and exactly what blocks them, because a
                  regulator can&apos;t see amounts. Solana ships the answer: a mint can carry a{" "}
                  <b>global auditor ElGamal key</b> whose holder can decrypt every transfer amount
                  for that mint. This skill is the tooling that operates that key: key setup →
                  continuous decryption loop → AML engine → hashed reports. Privacy stays the default
                  for everyone else, by cryptography, not policy.
                </p>
              </section>
            </Reveal>

            <Reveal>
              <section className="doc-sec">
                <Head id="loop" no="02" title="How it runs" />
                <p className="doc-p">
                  The compliance loop is <b>observe → decrypt → assess → report → repeat</b>:
                </p>
                <ol className="doc-ol">
                  <li><b>Observe</b> — pull confidential transfers for one mint, oldest-first (RPC/Helius).</li>
                  <li><b>Decrypt</b> — the auditor ElGamal key recovers each amount. No account keys touched.</li>
                  <li><b>Assess</b> — deterministic AML rules score each amount against rolling state.</li>
                  <li><b>Report</b> — flags page out; a SHA-256 hashed, append-only report is emitted.</li>
                </ol>
                <p className="doc-p">
                  Termination is guaranteed by a <code>BudgetLedger</code> (caps + circuit breaker).
                </p>
              </section>
            </Reveal>

            <Reveal>
              <section className="doc-sec">
                <Head id="rules" no="03" title="AML rules" />
                <p className="doc-p">
                  These are precisely the patterns confidential transfers hide from the public chain
                  — so only the auditor key holder can detect them. Pure functions of
                  (transfer, rolling state, config); every rule ships an offline test.
                </p>
                <div className="doc-table">
                  {RULES.map(([rule, sev, desc]) => (
                    <div className="doc-row" key={rule}>
                      <span className="doc-row-k mono">{rule}</span>
                      <span className={`doc-sev doc-sev-${sev}`}>{sev}</span>
                      <span className="doc-row-d">{desc}</span>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>

            <Reveal>
              <section className="doc-sec">
                <Head id="crypto" no="04" title="Cryptography" />
                <p className="doc-p">
                  Real twisted-ElGamal over <b>Ristretto255</b> (Solana&apos;s group), with a
                  baby-step-giant-step discrete-log solver. The encrypt→decrypt round-trip is tested
                  across the full 48-bit range, with semantic security and wrong-key-fails.
                </p>
                <p className="doc-p">
                  It decrypts <b>real <code>@solana/zk-sdk</code> ciphertext</b>: select{" "}
                  <code>convention: &quot;solana&quot;</code> for Solana&apos;s exact scheme
                  (<code>amount·G = C − s·D</code>) and <code>layout: &quot;lohi&quot;</code> for the
                  production 16-bit-low + 32-bit-high split. Verified against bytes produced by the
                  real Solana library — byte-identical to on-chain — using only this engine&apos;s crypto.
                </p>
              </section>
            </Reveal>

            <Reveal>
              <section className="doc-sec">
                <Head id="guardrails" no="05" title="Guardrails" />
                <div className="doc-table">
                  {GUARDS.map(([id, mandate]) => (
                    <div className="doc-row doc-row-2" key={id}>
                      <span className="doc-row-k mono">{id}</span>
                      <span className="doc-row-d">{mandate}</span>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>

            <Reveal>
              <section className="doc-sec">
                <Head id="quickstart" no="06" title="Quick start" />
                <CodeBlock code={QUICKSTART} />
              </section>
            </Reveal>

            <Reveal>
              <section className="doc-sec">
                <Head id="api" no="07" title="API surface" />
                <div className="doc-table">
                  {API.map(([name, desc]) => (
                    <div className="doc-row doc-row-2" key={name}>
                      <span className="doc-row-k mono">{name}</span>
                      <span className="doc-row-d">{desc}</span>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>

            <Reveal>
              <section className="doc-sec">
                <Head id="modules" no="08" title="Skill modules" />
                <p className="doc-p">
                  The skill is progressive — <code>skill/SKILL.md</code> routes to a module only when
                  it&apos;s needed.
                </p>
                <div className="doc-table">
                  {MODULES.map(([file, desc]) => (
                    <a
                      className="doc-row doc-row-2 doc-row-link"
                      key={file}
                      href={`${REPO}/blob/main/skill/${file}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="doc-row-k mono">{file}</span>
                      <span className="doc-row-d">{desc}<span className="doc-row-arrow mono"> →</span></span>
                    </a>
                  ))}
                </div>
              </section>
            </Reveal>

            <Reveal>
              <div className="acta mono inst-cta">
                <Link href="/install" className="brk brk-fill">Install the skill</Link>
                <Link href="/dashboard" className="brk">Open the console</Link>
              </div>
            </Reveal>
          </div>
        </div>

        <footer className="afoot mono">
          <div className="afoot-cc">© 2026 — SOLANA-CONFIDENTIAL-SKILL — MIT — v1.01</div>
        </footer>
      </div>
    </div>
  );
}
