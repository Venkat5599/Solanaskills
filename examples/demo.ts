/**
 * End-to-end demo: real twisted-ElGamal crypto + the full compliance loop.
 *
 *   bun run examples/demo.ts        (from lib/, or `bun run demo`)
 *
 * No network, no localnet required — it encrypts a synthetic stream of transfers
 * under a freshly generated auditor key, then runs the REAL auditor decryptor +
 * AML engine + loop over them and prints the flags and a hashed report. Every
 * amount you see decrypted was genuinely ElGamal-encrypted and recovered by
 * discrete log; nothing is faked.
 */
import {
  ConfidentialComplianceLoop, ComplianceEngine, BudgetLedger,
  defaultConfig, generateAuditorKeypair, encryptAmount,
  SplAuditorDecryptor, type ConfidentialTransferRecord,
} from "../lib/src/index.ts";

const unit = 1_000_000n; // 6 decimals
const MINT = "DEMOmint1111111111111111111111111111111111";

// 1. Auditor key. Public key would go on the mint; secret stays in HSM/TEE.
const auditor = generateAuditorKeypair();

// 2. A synthetic transfer stream that trips several AML rules on purpose.
let slot = 100;
const tx = (
  source: string, destination: string, amount: bigint, gapMs = 1000,
): ConfidentialTransferRecord => ({
  signature: `demo-sig-${slot}`,
  slot: slot++,
  blockTime: (slot - 100) * gapMs,
  mint: MINT,
  source,
  destination,
  // REAL ElGamal ciphertext under the auditor public key:
  auditorCiphertext: encryptAmount(amount, auditor.pubkey),
});

const stream: ConfidentialTransferRecord[] = [
  // clean baseline
  tx("alice", "bob", 5n * unit),
  // CTR threshold breach
  tx("whale", "exchange", 12_000n * unit),
  // structuring: three sub-threshold transfers summing over the line
  tx("smurf", "out1", 4_000n * unit),
  tx("smurf", "out2", 4_000n * unit),
  tx("smurf", "out3", 4_000n * unit),
  // layering: receive then immediately forward
  tx("mule", "downstream", 2_000n * unit),
];
// the "in" leg that makes `mule` a pass-through:
stream.splice(5, 0, tx("upstream", "mule", 2_000n * unit, 1000));

// 3. Wire the real decryptor + engine + bounded loop.
const cfg = defaultConfig(6);
cfg.sanctioned = new Set(["exchange"]); // pretend this address is denylisted

const engine = new ComplianceEngine(cfg);
let served = false;

const loop = new ConfidentialComplianceLoop({
  mint: MINT,
  auditorPubkey: "demo-auditor-pubkey",
  decryptor: new SplAuditorDecryptor({ auditorElGamalSecret: auditor.secret }),
  engine,
  budget: new BudgetLedger({ maxIterations: 4, maxConsecutiveErrors: 3 }),
  observe: async () => {
    if (served) return [];
    served = true;
    return stream;
  },
  onFlags: (flags) => {
    for (const f of flags) {
      console.log(`  🚩 [${f.severity.toUpperCase()}] ${f.rule} — ${f.account}: ${f.message}`);
    }
  },
  sleep: async () => {},
});

console.log("\n=== Solana Confidential Transfers — Compliance Loop (live demo) ===\n");
console.log(`Auditing mint ${MINT}`);
console.log(`Transfers in stream: ${stream.length} (amounts ElGamal-encrypted under auditor key)\n`);
console.log("Flags raised (each amount was really decrypted from ciphertext):");

const report = await loop.run();

console.log("\n--- Compliance report ---");
console.log(`  transfers reviewed : ${report.transfersReviewed}`);
console.log(`  total volume       : ${report.totalVolume} base units`);
console.log(`  flags              : ${report.flags.length}`);
console.log(`  by severity        : ${JSON.stringify(report.flagsBySeverity)}`);
console.log(`  report hash        : ${report.reportHash}`);
console.log(`  loop stop reason   : ${loop.stopStatus}`);
console.log("\nPrivacy preserved: only this loop, holding the auditor key, saw any amount.\n");
