"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { ScrollProgress } from "../components/chrome";
import { MaskLines, Reveal } from "../components/motion";
import { Magnetic } from "../components/awwwards";

const EASE = [0.22, 1, 0.36, 1] as const;

/** A mono command block with a one-click copy affordance. */
function Cmd({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
    } catch {
      /* clipboard blocked — the command stays visible to copy by hand */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="cmd">
      <code className="cmd-text mono">
        <span className="cmd-prompt">$</span> {children}
      </code>
      <button type="button" className="cmd-copy mono" onClick={copy} aria-label="Copy command">
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

const STEPS: { no: string; title: string; body: string; cmd: string }[] = [
  {
    no: "01",
    title: "Clone & install",
    body: "Drops the skill into ~/.claude/skills/ so Claude Code can load it on demand.",
    cmd: "git clone https://github.com/Venkat5599/Solanaskills && cd Solanaskills && ./install.sh",
  },
  {
    no: "02",
    title: "Run the core",
    body: "Real twisted-ElGamal + the AML engine — 39 tests, then the end-to-end demo.",
    cmd: "cd lib && bun install && bun test && bun run demo",
  },
  {
    no: "03",
    title: "Typecheck",
    body: "Confirm the TypeScript core is clean before you wire it into your pipeline.",
    cmd: "bunx tsc --noEmit",
  },
];

export default function InstallPage() {
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
            <Link href="/docs" className="brk">Docs</Link>
            <a href="https://github.com/Venkat5599/Solanaskills" target="_blank" rel="noreferrer" className="brk">
              GitHub
            </a>
            <Link href="/dashboard" className="brk">Console</Link>
          </div>
        </motion.header>

        <section className="ahero acc-teal">
          <div className="ahero-top mono">
            <span>Install</span>
            <span>solana-confidential-skill</span>
          </div>

          <h1 className="inst-display">
            <MaskLines lines={["Install", "the skill."]} lineClassName="aline" />
          </h1>

          <motion.p
            className="alead inst-lead"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
          >
            The auditor-side AML engine for Solana Token-2022 Confidential Transfers. Progressive,
            MIT, ready to submodule. Requires <b>bun ≥ 1.1</b> and Claude Code.
          </motion.p>

          <div className="inst-steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.no} delay={i * 0.06}>
                <div className="inst-step">
                  <div className="inst-step-head">
                    <span className="inst-no mono">{s.no}</span>
                    <span className="inst-t">{s.title}</span>
                  </div>
                  <p className="inst-b">{s.body}</p>
                  <Cmd>{s.cmd}</Cmd>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <div className="inst-alt">
              <span className="inst-alt-k mono">Prefer to choose location + run tests interactively?</span>
              <Cmd>./install-custom.sh</Cmd>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="acta mono inst-cta">
              <Magnetic>
                <Link href="/dashboard" className="brk brk-fill">Open the console</Link>
              </Magnetic>
              <a href="https://github.com/Venkat5599/Solanaskills" target="_blank" rel="noreferrer" className="brk">
                Read the source
              </a>
            </div>
          </Reveal>
        </section>

        <footer className="afoot mono">
          <div className="afoot-cc">© 2026 — SOLANA-CONFIDENTIAL-SKILL — MIT — v1.01</div>
        </footer>
      </div>
    </div>
  );
}
