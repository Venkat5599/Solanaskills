/**
 * Solana-native twisted-ElGamal decryption — byte- and convention-compatible
 * with `@solana/zk-sdk` (the exact crypto that produces on-chain confidential
 * transfer ciphertext).
 *
 * Solana's ElGamal uses the INVERSE secret convention from this engine's own
 * `twisted-elgamal.ts`:
 *
 *   Solana:  pubkey P = s⁻¹·H,  handle D = r·P,  decrypt  amount·G = C − s·D
 *   (ours):  pubkey P = s·H,    handle D = r·P,  decrypt  amount·G = C − s⁻¹·D
 *
 * Both recover `amount·G` over the SAME Ristretto255 group with the SAME
 * basepoint G, so the existing baby-step-giant-step solver (`dlog.ts`) recovers
 * the amount unchanged. The only difference is multiplying the decrypt handle by
 * `s` instead of `s⁻¹`. Verified by round-tripping real `@solana/zk-sdk`
 * ciphertext bytes (see `test/solana-vectors.test.ts`).
 *
 * A Solana ElGamal ciphertext is `commitment(32) ‖ handle(32)` = 64 bytes — the
 * same `C‖D` framing this engine already parses. A confidential-transfer auditor
 * amount is two of them: a 16-bit low ciphertext + a 32-bit high ciphertext.
 */
import { pointFromBytes, mul, type Pt } from "./ristretto.ts";
import { solveLimb, warmTable } from "./dlog.ts";

const POINT = 32;
const CIPHERTEXT = 2 * POINT; // commitment ‖ handle

/** Recover the message point amount·G from one Solana ElGamal ciphertext. */
function messagePoint(ct64: Uint8Array, secret: bigint): Pt {
  const C = pointFromBytes(ct64.subarray(0, POINT));
  const D = pointFromBytes(ct64.subarray(POINT, CIPHERTEXT));
  return C.subtract(mul(D, secret)); // amount·G = C − s·D  (Solana convention)
}

/** Decrypt one Solana ElGamal ciphertext (64 bytes) to a value in [0, 2^bits). */
export function decryptSolanaLimb(ct64: Uint8Array, secret: bigint, bits: number): number {
  if (ct64.length < CIPHERTEXT) {
    throw new Error(`solana ElGamal ciphertext: need ${CIPHERTEXT} bytes, got ${ct64.length}`);
  }
  return solveLimb(messagePoint(ct64, secret), bits);
}

/**
 * Decrypt Solana's production auditor amount: a 16-bit LOW ciphertext followed
 * by a 32-bit HIGH ciphertext (128 bytes total) → `lo | (hi << 16)`.
 */
export function decryptSolanaAmountLoHi(bytes: Uint8Array, secret: bigint): bigint {
  if (bytes.length < 2 * CIPHERTEXT) {
    throw new Error(`solana lo/hi auditor ciphertext: need ${2 * CIPHERTEXT} bytes, got ${bytes.length}`);
  }
  warmTable(16); // low limb table (instant)
  warmTable(32); // high limb table (one-time build, then cached)
  const lo = BigInt(decryptSolanaLimb(bytes.subarray(0, CIPHERTEXT), secret, 16));
  const hi = BigInt(decryptSolanaLimb(bytes.subarray(CIPHERTEXT, 2 * CIPHERTEXT), secret, 32));
  return lo | (hi << 16n);
}
