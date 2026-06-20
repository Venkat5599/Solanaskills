/**
 * Agent tools. Each one executes the REAL solana-confidential-skill engine
 * (../lib) — the agent doesn't describe the skill, it runs it. That is what
 * makes this a live demo rather than a chatbot about docs.
 */
import {
  ComplianceEngine, BudgetLedger, defaultConfig,
  generateAuditorKeypair, encryptAmount, SplAuditorDecryptor,
  ConfidentialComplianceLoop, type ConfidentialTransferRecord, type Flag,
} from "../lib/src/index.ts";
import { buildCorpus, retrieve } from "./rag.ts";
import { join } from "node:path";

const SKILL_DIR = join(import.meta.dir, "..", "skill");
const corpus = buildCorpus(SKILL_DIR);

const unit = 1_000_000n; // 6 decimals

export const toolDefs = [
  {
    name: "run_compliance_demo",
    description:
      "Run the full confidential-transfer compliance pipeline end-to-end on a synthetic transfer stream. " +
      "Generates a real auditor ElGamal keypair, ElGamal-encrypts each transfer amount, then REALLY decrypts " +
      "them with the auditor key, runs the AML engine, and returns the flags + a hashed compliance report. " +
      "Use when the user wants to see the skill actually work, or asks to 'run the demo' / 'show me'.",
    input_schema: {
      type: "object",
      properties: {
        scenario: {
          type: "string",
          enum: ["mixed", "structuring", "sanctions", "clean"],
          description:
            "Which synthetic pattern to generate. 'mixed' trips several rules; 'structuring' = smurfing; " +
            "'sanctions' = a denylisted counterparty; 'clean' = nothing flagged.",
        },
      },
      required: ["scenario"],
    },
  },
  {
    name: "assess_amounts",
    description:
      "Score an explicit list of decrypted transfer amounts (in whole tokens) through the AML rule engine and " +
      "return the flags. Use when the user gives concrete amounts and asks whether they'd be flagged.",
    input_schema: {
      type: "object",
      properties: {
        amounts: {
          type: "array",
          items: { type: "number" },
          description: "Transfer amounts in whole tokens, in block order.",
        },
        source: { type: "string", description: "Optional source account label." },
      },
      required: ["amounts"],
    },
  },
  {
    name: "search_skill_docs",
    description:
      "Retrieve the most relevant passages from the skill's own modules (SKILL.md + primer, compliance-loop, " +
      "aml-rules, decryption, etc.) to ground an explanation. Use for 'how does X work', 'why', or 'what is the " +
      "auditor key' style questions before answering.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "What to look up." } },
      required: ["query"],
    },
  },
] as const;

function scenarioStream(scenario: string): { records: ConfidentialTransferRecord[]; secret: bigint } {
  const auditor = generateAuditorKeypair();
  let slot = 100;
  const tx = (source: string, destination: string, amount: bigint, gapMs = 1000): ConfidentialTransferRecord => ({
    signature: `demo-${slot}`,
    slot: slot++,
    blockTime: (slot - 100) * gapMs,
    mint: "DEMOmint",
    source,
    destination,
    auditorCiphertext: encryptAmount(amount, auditor.pubkey), // real ElGamal, under this run's key
  });

  const streams: Record<string, ConfidentialTransferRecord[]> = {
    mixed: [
      tx("alice", "bob", 5n * unit),
      tx("whale", "exchange", 12_000n * unit),
      tx("smurf", "out1", 4_000n * unit),
      tx("smurf", "out2", 4_000n * unit),
      tx("smurf", "out3", 4_000n * unit),
      tx("upstream", "mule", 2_000n * unit),
      tx("mule", "downstream", 2_000n * unit),
    ],
    structuring: [
      tx("smurf", "a", 3_500n * unit),
      tx("smurf", "b", 3_500n * unit),
      tx("smurf", "c", 3_500n * unit),
    ],
    sanctions: [tx("payer", "ofac_listed", 500n * unit)],
    clean: [tx("alice", "bob", 12n * unit), tx("carol", "dave", 8n * unit)],
  };
  return { records: streams[scenario] ?? streams.mixed!, secret: auditor.secret };
}

export async function runTool(name: string, input: any): Promise<string> {
  if (name === "search_skill_docs") {
    const hits = retrieve(corpus, String(input.query ?? ""), 4);
    if (hits.length === 0) return "No relevant passages found in the skill docs.";
    return hits
      .map((h) => `### ${h.source} — ${h.heading} (score ${h.score})\n${h.snippet}`)
      .join("\n\n---\n\n");
  }

  if (name === "assess_amounts") {
    const cfg = defaultConfig(6);
    const engine = new ComplianceEngine(cfg);
    const src = String(input.source ?? "acct");
    const flags: Flag[] = [];
    let t = 0;
    for (const a of input.amounts as number[]) {
      flags.push(
        ...engine.ingest({
          signature: `a${t}`, slot: t, blockTime: t * 1000, mint: "M",
          source: src, destination: `dst${t}`, amount: BigInt(Math.round(a)) * unit,
        }),
      );
      t++;
    }
    return JSON.stringify(
      { transfersReviewed: t, flags: flags.map((f) => ({ rule: f.rule, severity: f.severity, account: f.account, message: f.message })) },
      null, 2,
    );
  }

  if (name === "run_compliance_demo") {
    const scenario = String(input.scenario ?? "mixed");
    const cfg = defaultConfig(6);
    if (scenario === "sanctions") cfg.sanctioned = new Set(["ofac_listed"]);
    else cfg.sanctioned = new Set(["exchange"]);

    const { records, secret } = scenarioStream(scenario);
    const engine = new ComplianceEngine(cfg);
    let served = false;
    const collected: Flag[] = [];
    const loop = new ConfidentialComplianceLoop({
      mint: "DEMOmint",
      auditorPubkey: "demo-pub",
      decryptor: new SplAuditorDecryptor({ auditorElGamalSecret: secret }),
      engine,
      budget: new BudgetLedger({ maxIterations: 4, maxConsecutiveErrors: 3 }),
      observe: async () => (served ? [] : ((served = true), records)),
      onFlags: (f) => collected.push(...f),
      sleep: async () => {},
    });
    const report = await loop.run();
    return JSON.stringify(
      {
        scenario,
        transfersReviewed: report.transfersReviewed,
        totalVolumeBaseUnits: report.totalVolume.toString(),
        flags: collected.map((f) => ({ rule: f.rule, severity: f.severity, account: f.account, message: f.message })),
        flagsBySeverity: report.flagsBySeverity,
        reportHash: report.reportHash,
        note: "Every amount above was ElGamal-encrypted then really decrypted with the auditor key — not faked.",
      },
      null, 2,
    );
  }

  return `Unknown tool: ${name}`;
}
