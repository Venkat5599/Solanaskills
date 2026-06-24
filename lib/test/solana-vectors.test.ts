import { describe, expect, test } from "bun:test";
import { bytesToScalar } from "../src/crypto/ristretto.ts";
import { decryptSolanaLimb, decryptSolanaAmountLoHi } from "../src/crypto/solana-elgamal.ts";
import { SplAuditorDecryptor } from "../src/decryptor.ts";
import type { ConfidentialTransferRecord } from "../src/types.ts";

/**
 * REAL Solana ciphertext vectors.
 *
 * Generated with the production `@solana/zk-sdk` (the exact crypto that produces
 * on-chain confidential-transfer ciphertext): a deterministic auditor key from a
 * fixed seed, then `ElGamalPubkey.encryptU64` of the low (16-bit) and high
 * (32-bit) halves of the amount. The bytes below are byte-identical to what an
 * auditor reads from a real Token-2022 confidential transfer. Decrypting them
 * here with the engine's own Ristretto255 + baby-step-giant-step solver proves
 * mainnet wire + crypto compatibility — no zk-sdk dependency at test time.
 *
 * Regenerate / verify provenance with `bun run scripts/gen-solana-fixtures.ts`.
 */
const hex = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));

const VECTOR = {
  secretHex: "02245611d57f4f74b3cd24e887c7983ba5b72fd5146b79f118c7a8fb33ac2c01",
  amount: 7_777_777n,
  lo: 44_529n, // amount & 0xFFFF
  hi: 118n, // amount >> 16
  loCtHex:
    "a8d1565f35f80365bfcb47b61601829a958276e397d2a377ed67fba0c0fd61028ef404902302ea137ebb5929b5d9adedd202c0a35ec37342b3ee0ecd3b7fd769",
  hiCtHex:
    "86bf6da6dbe9ad9c655ed6b499fa19b51d387ff28405216850069d68638393393ed2a20c3acc7b364b90a6ae0fa4cf47957915604629e110ee83462396af093f",
};

describe("real @solana/zk-sdk ciphertext compatibility", () => {
  const secret = bytesToScalar(hex(VECTOR.secretHex));

  test("decrypts a real Solana low (16-bit) ElGamal ciphertext", () => {
    expect(BigInt(decryptSolanaLimb(hex(VECTOR.loCtHex), secret, 16))).toBe(VECTOR.lo);
  });

  test("decrypts a real Solana high (32-bit) ElGamal ciphertext", () => {
    expect(BigInt(decryptSolanaLimb(hex(VECTOR.hiCtHex), secret, 32))).toBe(VECTOR.hi);
  }, 30_000);

  test("combines lo+hi into the full amount (lo | hi<<16)", () => {
    const bytes = new Uint8Array(128);
    bytes.set(hex(VECTOR.loCtHex), 0);
    bytes.set(hex(VECTOR.hiCtHex), 64);
    expect(decryptSolanaAmountLoHi(bytes, secret)).toBe(VECTOR.amount);
  }, 30_000);

  test("SplAuditorDecryptor with convention:'solana' decrypts real bytes", async () => {
    const bytes = new Uint8Array(128);
    bytes.set(hex(VECTOR.loCtHex), 0);
    bytes.set(hex(VECTOR.hiCtHex), 64);
    const decryptor = new SplAuditorDecryptor({
      auditorElGamalSecret: hex(VECTOR.secretHex),
      layout: "lohi",
      convention: "solana",
    });
    const record: ConfidentialTransferRecord = {
      signature: "sol", slot: 1, blockTime: 0, mint: "M", source: "S", destination: "D",
      auditorCiphertext: bytes,
    };
    expect(await decryptor.decrypt(record)).toBe(VECTOR.amount);
  }, 30_000);

  test("the wrong auditor key cannot recover the real amount", () => {
    const wrong = bytesToScalar(new Uint8Array(32).fill(9));
    expect(() => decryptSolanaLimb(hex(VECTOR.loCtHex), wrong, 16)).toThrow();
  });
});
