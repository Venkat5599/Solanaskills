import { describe, expect, test } from "bun:test";
import {
  generateAuditorKeypair, encryptAmount, decryptAmount, DEFAULT_LIMBS,
} from "../src/crypto/twisted-elgamal.ts";
import { SplAuditorDecryptor } from "../src/decryptor.ts";
import type { ConfidentialTransferRecord } from "../src/types.ts";

const MAX_48 = (1n << 48n) - 1n;

describe("twisted-ElGamal + discrete log (real crypto)", () => {
  test("encrypt → decrypt round-trips across the amount range", () => {
    const { secret, pubkey } = generateAuditorKeypair();
    for (const amount of [0n, 1n, 255n, 256n, 65_535n, 65_536n, 1_000_000n, 10_000n * 1_000_000n, MAX_48]) {
      const ct = encryptAmount(amount, pubkey);
      expect(decryptAmount(ct, secret)).toBe(amount);
    }
  });

  test("ciphertext is randomized (semantic security): same amount, different bytes", () => {
    const { pubkey } = generateAuditorKeypair();
    const a = encryptAmount(123_456n, pubkey);
    const b = encryptAmount(123_456n, pubkey);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  test("wrong auditor key cannot recover the amount", () => {
    const alice = generateAuditorKeypair();
    const mallory = generateAuditorKeypair();
    const ct = encryptAmount(42_000n, alice.pubkey);
    expect(() => decryptAmount(ct, mallory.secret)).toThrow();
  });

  test("rejects amounts beyond the 48-bit cap", () => {
    const { pubkey } = generateAuditorKeypair();
    expect(() => encryptAmount(MAX_48 + 1n, pubkey)).toThrow();
  });

  test("SplAuditorDecryptor decrypts a real record end-to-end", async () => {
    const { secret, pubkey } = generateAuditorKeypair();
    const amount = 7_500n * 1_000_000n;
    const record: ConfidentialTransferRecord = {
      signature: "sigZ", slot: 10, blockTime: 0, mint: "MINT",
      source: "S", destination: "D",
      auditorCiphertext: encryptAmount(amount, pubkey, DEFAULT_LIMBS),
    };
    const decryptor = new SplAuditorDecryptor({ auditorElGamalSecret: secret });
    expect(await decryptor.decrypt(record)).toBe(amount);
  });
});
