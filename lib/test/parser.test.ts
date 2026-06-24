import { describe, expect, test } from "bun:test";
import {
  generateAuditorKeypair, encryptAmount, encryptAmountLoHi, DEFAULT_LIMBS,
} from "../src/crypto/twisted-elgamal.ts";
import {
  splAuditorCiphertextParser, splLoHiCiphertextParser, sliceLoHi, ELGAMAL_CIPHERTEXT_BYTES,
} from "../src/crypto/parser.ts";
import { SplAuditorDecryptor } from "../src/decryptor.ts";
import type { ConfidentialTransferRecord } from "../src/types.ts";

describe("on-chain auditor-ciphertext parser", () => {
  test("commitment||handle layout == engine C||D: parser round-trips through decrypt", async () => {
    const { secret, pubkey } = generateAuditorKeypair();
    const amount = 9_001n * 1_000_000n;
    const onChainBytes = encryptAmount(amount, pubkey, DEFAULT_LIMBS); // C||D per limb

    const decryptor = new SplAuditorDecryptor({
      auditorElGamalSecret: secret,
      parseAuditorCiphertext: splAuditorCiphertextParser(DEFAULT_LIMBS.limbs),
    });
    const record: ConfidentialTransferRecord = {
      signature: "p1", slot: 1, blockTime: 0, mint: "M", source: "S", destination: "D",
      auditorCiphertext: onChainBytes,
    };
    expect(await decryptor.decrypt(record)).toBe(amount);
  });

  test("parser rejects malformed (too short) ciphertext loudly", () => {
    const parse = splAuditorCiphertextParser(3);
    expect(() => parse(new Uint8Array(10))).toThrow();
  });

  test("sliceLoHi splits two 64-byte ElGamal ciphertexts", () => {
    const buf = new Uint8Array(2 * ELGAMAL_CIPHERTEXT_BYTES).map((_, i) => i & 0xff);
    const [lo, hi] = sliceLoHi(buf);
    expect(lo.length).toBe(ELGAMAL_CIPHERTEXT_BYTES);
    expect(hi.length).toBe(ELGAMAL_CIPHERTEXT_BYTES);
    expect(hi[0]).toBe(ELGAMAL_CIPHERTEXT_BYTES & 0xff);
  });
});

describe("Solana lo(16)/hi(32) production layout (CT09)", () => {
  // Build the 32-bit high-limb table once for the whole suite.
  const { secret, pubkey } = generateAuditorKeypair();
  const decryptor = new SplAuditorDecryptor({
    auditorElGamalSecret: secret,
    layout: "lohi",
    parseAuditorCiphertext: splLoHiCiphertextParser(),
  });

  const rec = (auditorCiphertext: Uint8Array): ConfidentialTransferRecord => ({
    signature: "lh", slot: 1, blockTime: 0, mint: "M", source: "S", destination: "D",
    auditorCiphertext,
  });

  test("decrypts across low-only and high-bearing amounts", async () => {
    // 0 + 65535 stay in the low limb; the rest exercise the 32-bit high limb.
    for (const amount of [0n, 65_535n, 70_000n, 1_000_000n, 10_000n * 1_000_000n]) {
      const ct = encryptAmountLoHi(amount, pubkey);
      expect(await decryptor.decrypt(rec(ct))).toBe(amount);
    }
  }, 30_000);

  test("wrong auditor key cannot recover a lo/hi amount", async () => {
    const mallory = new SplAuditorDecryptor({
      auditorElGamalSecret: generateAuditorKeypair().secret,
      layout: "lohi",
      parseAuditorCiphertext: splLoHiCiphertextParser(),
    });
    const ct = encryptAmountLoHi(123_456n, pubkey);
    await expect(mallory.decrypt(rec(ct))).rejects.toThrow();
  }, 30_000);

  test("lo/hi parser rejects a short ciphertext", () => {
    const parse = splLoHiCiphertextParser();
    expect(() => parse(new Uint8Array(64))).toThrow();
  });

  test("encryptAmountLoHi rejects amounts beyond the 48-bit cap", () => {
    expect(() => encryptAmountLoHi(1n << 48n, pubkey)).toThrow();
  });
});
