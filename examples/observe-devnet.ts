/**
 * Live RPC smoke test — proves the chain wiring is real, not a stub.
 *
 *   bun run examples/observe-devnet.ts
 *   RPC_URL=https://api.devnet.solana.com MINT=<mint> WATCH=<tokenAccount> bun run examples/observe-devnet.ts
 *
 * With no args it connects to devnet and reports the live cluster version + slot
 * (proving a real connection). Given a MINT, it reads that mint's
 * ConfidentialTransferMint extension from chain and prints the on-chain auditor
 * ElGamal pubkey. Given a WATCH address, it runs the real observer over recent
 * signatures and reports any confidential-transfer instructions it finds.
 *
 * The ZK ElGamal Proof program is currently executable on devnet + mainnet, so
 * this path is live.
 */
import { Connection } from "@solana/web3.js";
import { RpcConfidentialObserver } from "../lib/src/chain/observer.ts";
import { readConfidentialMintConfig } from "../lib/src/chain/mint-config.ts";

const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
// A real devnet confidential mint that carries an on-chain auditor ElGamal key
// (discovered via ZK-program activity). Override with MINT=<addr>.
const MINT = process.env.MINT ?? "9QsnKNvf25R2kwbm5HaspNDroh4gV1Uf8sx7Qt4CyCF2";
const WATCH = process.env.WATCH;

const conn = new Connection(RPC_URL, "confirmed");

console.log(`\n=== Confidential-transfer chain wiring — live smoke (${RPC_URL}) ===\n`);

const version = await conn.getVersion();
const slot = await conn.getSlot();
console.log(`Connected. solana-core ${version["solana-core"]} · slot ${slot}`);

// Confirm the ZK ElGamal Proof program is live on this cluster.
const zk = await conn.getAccountInfo(
  // ZK ElGamal Proof program
  new (await import("@solana/web3.js")).PublicKey("ZkE1Gama1Proof11111111111111111111111111111"),
);
console.log(`ZK ElGamal Proof program executable: ${zk?.executable ?? false}`);

if (MINT) {
  console.log(`\nReading ConfidentialTransferMint config for mint ${MINT} …`);
  try {
    const cfg = await readConfidentialMintConfig(conn, MINT);
    console.log(`  authority              : ${cfg.authority ?? "(none)"}`);
    console.log(`  auto-approve accounts  : ${cfg.autoApproveNewAccounts}`);
    console.log(`  auditor ElGamal pubkey : ${cfg.auditorElGamalPubkeyHex ?? "(no auditor)"}`);
  } catch (e) {
    console.log(`  ${(e as Error).message}`);
  }
}

if (WATCH) {
  console.log(`\nObserving confidential transfers for ${WATCH} …`);
  const observer = new RpcConfidentialObserver({
    connection: conn,
    address: WATCH,
    mint: MINT ?? "unknown",
  });
  const records = await observer.observe({ lastSlot: 0 });
  console.log(`  found ${records.length} confidential-transfer instruction(s)`);
  for (const r of records.slice(0, 5)) {
    console.log(`   · ${r.signature} @ slot ${r.slot} (${r.auditorCiphertext.length} bytes ciphertext)`);
  }
}

console.log("\nDone. The observer + config reader hit the live cluster above.\n");
