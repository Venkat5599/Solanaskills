/**
 * Provenance for `test/solana-vectors.test.ts`.
 *
 * Regenerates the real Solana ciphertext vectors using the production
 * `@solana/zk-sdk` (the same crypto that runs on-chain). Not part of CI or the
 * package deps — run manually to refresh the fixtures:
 *
 *   bun add -d @solana/zk-sdk
 *   bun run scripts/gen-solana-fixtures.ts
 *
 * A deterministic auditor key is derived from a fixed seed; the amount is split
 * into a 16-bit low + 32-bit high value, each encrypted with the real
 * `ElGamalPubkey.encryptU64`, matching a Token-2022 confidential transfer's
 * auditor amount. The emitted hex is what the test decrypts with this engine's
 * own solver (no zk-sdk at test time).
 */
// @ts-expect-error optional dev-only dependency, not in package.json
import { ElGamalKeypair } from "@solana/zk-sdk/node";

const hex = (u: Uint8Array) => Buffer.from(u).toString("hex");

const seed = new Uint8Array(32).fill(7);
const kp = ElGamalKeypair.fromSeed(seed);
const pub = kp.pubkey();
const sec = kp.secret();

const amount = 7_777_777n;
const lo = amount & 0xffffn;
const hi = amount >> 16n;

const enc = (v: bigint) => {
  const c = pub.encryptU64(v);
  return { hex: hex(c.toBytes()), self: sec.decrypt(c).toString() };
};
const L = enc(lo);
const H = enc(hi);

console.log(
  JSON.stringify(
    {
      secretHex: hex(sec.toBytes()),
      amount: amount.toString(),
      lo: lo.toString(),
      hi: hi.toString(),
      loCtHex: L.hex,
      loSelfDecrypt: L.self,
      hiCtHex: H.hex,
      hiSelfDecrypt: H.self,
    },
    null,
    2,
  ),
);
