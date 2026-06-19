import { describe, expect, test } from "bun:test";
import {
  generateAuditorKeypair, encryptAmount, DEFAULT_LIMBS,
} from "../src/crypto/twisted-elgamal.ts";
import {
  splAuditorCiphertextParser, sliceLoHi, ELGAMAL_CIPHERTEXT_BYTES,
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
