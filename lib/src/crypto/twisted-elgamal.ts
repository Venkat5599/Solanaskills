/**
 * Twisted ElGamal over Ristretto255 — the scheme behind Solana confidential
 * transfers, implemented end-to-end so decryption is real and testable.
 *
 * Keypair: secret scalar s, public key P = s·H.
 * Encrypt(x): pick random r; ciphertext = (C, D) where
 *     C = r·H + x·G        (Pedersen commitment to x)
 *     D = r·P              (decrypt handle)
 * Decrypt: C − s⁻¹·D = r·H + x·G − s⁻¹·(r·s·H) = x·G.
 *     Recover x from x·G by discrete log (see dlog.ts).
 *
 * Amounts are encrypted limb-by-limb (default 16-bit limbs, 48-bit total — the
 * confidential-transfer amount cap) so each discrete log stays a table lookup.
 */
import {
  G, H, modInv, mul, pointFromBytes, pointToBytes, randScalar, type Pt,
} from "./ristretto.ts";
import { solveLimb, babyTable } from "./dlog.ts";

export interface ElGamalKeypair {
  /** Secret scalar (keep in HSM/TEE). */
  secret: bigint;
  /** Public key P = s·H (goes on the mint). */
  pubkey: Pt;
}

export interface LimbCiphertext {
  C: Pt;
  D: Pt;
}

export interface LimbConfig {
  limbBits: number;
  limbs: number;
}

export const DEFAULT_LIMBS: LimbConfig = { limbBits: 16, limbs: 3 }; // 48-bit cap

export function generateAuditorKeypair(): ElGamalKeypair {
  const secret = randScalar();
  return { secret, pubkey: mul(H, secret) };
}

/** Public key from a known secret scalar. */
export function pubkeyFromSecret(secret: bigint): Pt {
  return mul(H, secret);
}

/** Encrypt one limb value (0 ≤ v < 2^limbBits) under pubkey P. */
export function encryptLimb(v: bigint, pubkey: Pt): LimbCiphertext {
  const r = randScalar();
  return {
    C: mul(H, r).add(mul(G, v)), // r·H + v·G
    D: mul(pubkey, r), //            r·P
  };
}

/** Decrypt one limb ciphertext to the point v·G. */
export function decryptLimbToPoint(ct: LimbCiphertext, secret: bigint): Pt {
  const sInv = modInv(secret);
  return ct.C.subtract(mul(ct.D, sInv)); // C − s⁻¹·D = v·G
}

const POINT = 32;
const LIMB = 2 * POINT; // C || D

/** Serialize limb ciphertexts to bytes (C‖D per limb). */
export function serializeCiphertext(limbs: LimbCiphertext[]): Uint8Array {
  const out = new Uint8Array(limbs.length * LIMB);
  limbs.forEach((ct, i) => {
    out.set(pointToBytes(ct.C), i * LIMB);
    out.set(pointToBytes(ct.D), i * LIMB + POINT);
  });
  return out;
}

/** Parse bytes back into limb ciphertexts. */
export function deserializeCiphertext(bytes: Uint8Array, nLimbs: number): LimbCiphertext[] {
  if (bytes.length < nLimbs * LIMB) {
    throw new Error(`ciphertext too short: need ${nLimbs * LIMB} bytes, got ${bytes.length}`);
  }
  const limbs: LimbCiphertext[] = [];
  for (let i = 0; i < nLimbs; i++) {
    const base = i * LIMB;
    limbs.push({
      C: pointFromBytes(bytes.subarray(base, base + POINT)),
      D: pointFromBytes(bytes.subarray(base + POINT, base + LIMB)),
    });
  }
  return limbs;
}

/** Encrypt a full amount into serialized limb ciphertext bytes. */
export function encryptAmount(
  amount: bigint,
  pubkey: Pt,
  cfg: LimbConfig = DEFAULT_LIMBS,
): Uint8Array {
  const max = 1n << BigInt(cfg.limbBits * cfg.limbs);
  if (amount < 0n || amount >= max) {
    throw new Error(`amount ${amount} out of range [0, 2^${cfg.limbBits * cfg.limbs})`);
  }
  const mask = (1n << BigInt(cfg.limbBits)) - 1n;
  const limbs: LimbCiphertext[] = [];
  for (let i = 0; i < cfg.limbs; i++) {
    const limbVal = (amount >> BigInt(i * cfg.limbBits)) & mask;
    limbs.push(encryptLimb(limbVal, pubkey));
  }
  return serializeCiphertext(limbs);
}

/** Decrypt serialized limb ciphertext bytes back to the amount. */
export function decryptAmount(
  bytes: Uint8Array,
  secret: bigint,
  cfg: LimbConfig = DEFAULT_LIMBS,
): bigint {
  babyTable(cfg.limbBits); // warm cache
  const limbs = deserializeCiphertext(bytes, cfg.limbs);
  let amount = 0n;
  limbs.forEach((ct, i) => {
    const point = decryptLimbToPoint(ct, secret);
    const v = solveLimb(point, cfg.limbBits);
    amount |= BigInt(v) << BigInt(i * cfg.limbBits);
  });
  return amount;
}

/* ------------------------------------------------------------------ */
/* Solana production lo/hi split (CT09)                                */
/*                                                                    */
/* The on-chain confidential-transfer extension does NOT encode the   */
/* amount as N equal limbs. It splits the 48-bit transfer amount into  */
/* a 16-bit LOW ciphertext and a 32-bit HIGH ciphertext, each a single */
/* ElGamal ciphertext (commitment‖handle). This is the real wire       */
/* layout `parseAuditorCiphertext` must feed; we implement + test it   */
/* against our own crypto so the seam is exercised before the on-chain */
/* ZK program re-enables.                                              */
/* ------------------------------------------------------------------ */

/** Solana CT amount split: low 16 bits + high 32 bits = 48-bit cap. */
export const LOHI_SPLIT = { loBits: 16, hiBits: 32 } as const;

/** Encrypt an amount in Solana's lo(16)/hi(32) framing → `[loC‖loD, hiC‖hiD]`. */
export function encryptAmountLoHi(amount: bigint, pubkey: Pt): Uint8Array {
  const max = 1n << BigInt(LOHI_SPLIT.loBits + LOHI_SPLIT.hiBits); // 2^48
  if (amount < 0n || amount >= max) {
    throw new Error(`amount ${amount} out of range [0, 2^48) for lo/hi split`);
  }
  const loMask = (1n << BigInt(LOHI_SPLIT.loBits)) - 1n;
  const lo = amount & loMask;
  const hi = amount >> BigInt(LOHI_SPLIT.loBits); // up to 32 bits
  return serializeCiphertext([encryptLimb(lo, pubkey), encryptLimb(hi, pubkey)]);
}

/** Decrypt Solana lo(16)/hi(32) framing back to the amount. */
export function decryptAmountLoHi(bytes: Uint8Array, secret: bigint): bigint {
  babyTable(LOHI_SPLIT.loBits); // warm the 16-bit table
  babyTable(LOHI_SPLIT.hiBits); // warm the 32-bit table (built once, cached)
  const [loCt, hiCt] = deserializeCiphertext(bytes, 2);
  const lo = BigInt(solveLimb(decryptLimbToPoint(loCt!, secret), LOHI_SPLIT.loBits));
  const hi = BigInt(solveLimb(decryptLimbToPoint(hiCt!, secret), LOHI_SPLIT.hiBits));
  return lo | (hi << BigInt(LOHI_SPLIT.loBits));
}
