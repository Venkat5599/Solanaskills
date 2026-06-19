/**
 * On-chain auditor-ciphertext parser.
 *
 * Solana's confidential-transfer extension encrypts the auditor's view of the
 * amount as one or more `ElGamalCiphertext`s. The canonical zk-token-sdk wire
 * layout of a single ElGamal ciphertext is:
 *
 *     commitment (32 bytes, Ristretto point) || handle (32 bytes, Ristretto point)
 *
 * which is exactly this engine's per-limb encoding `C || D` (C = commitment,
 * D = decrypt handle). So mapping on-chain bytes to the engine is a validated
 * pass-through of fixed-size 64-byte ciphertexts — no re-encoding.
 *
 * Two amount splits are supported:
 *   - "limbed"  — N equal limbs of `limbBits` (this engine's native, demo/tests).
 *   - "lohi"    — Solana's production split: a 16-bit low ciphertext + a 32-bit
 *                 high ciphertext. We expose the slicing; pair it with a decryptor
 *                 configured for the matching limb widths.
 *
 * This is the ONLY version-dependent seam (guardrail CT09). If a future
 * @solana/spl-token release ships a different on-chain framing, override
 * `parseAuditorCiphertext` on the decryptor — the cryptography never changes.
 */

export const RISTRETTO_POINT_BYTES = 32;
export const ELGAMAL_CIPHERTEXT_BYTES = 2 * RISTRETTO_POINT_BYTES; // commitment||handle

/**
 * Validate and pass through `N` concatenated 64-byte ElGamal ciphertexts as the
 * engine's `[C||D]*N` limb bytes. Throws on a malformed length so a wrong wire
 * format fails loudly (CT03) instead of silently decrypting garbage.
 */
export function splAuditorCiphertextParser(nLimbs: number): (raw: Uint8Array) => Uint8Array {
  const expected = nLimbs * ELGAMAL_CIPHERTEXT_BYTES;
  return (raw: Uint8Array): Uint8Array => {
    if (raw.length < expected) {
      throw new Error(
        `auditor ciphertext: expected >= ${expected} bytes (${nLimbs} ElGamal ciphertexts), got ${raw.length}`,
      );
    }
    // Already commitment||handle per limb == C||D per limb. Take the exact span.
    return raw.subarray(0, expected);
  };
}

/**
 * Slice Solana's low(16-bit)+high(32-bit) production split into its two
 * ElGamal ciphertexts. Returns [loCiphertext, hiCiphertext], each 64 bytes.
 */
export function sliceLoHi(raw: Uint8Array): [Uint8Array, Uint8Array] {
  const need = 2 * ELGAMAL_CIPHERTEXT_BYTES;
  if (raw.length < need) {
    throw new Error(`lo/hi auditor ciphertext: expected >= ${need} bytes, got ${raw.length}`);
  }
  return [
    raw.subarray(0, ELGAMAL_CIPHERTEXT_BYTES),
    raw.subarray(ELGAMAL_CIPHERTEXT_BYTES, need),
  ];
}
