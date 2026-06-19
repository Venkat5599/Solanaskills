/**
 * Ristretto255 primitives for twisted-ElGamal — the same prime-order group
 * Solana's confidential-transfer extension uses. Built on @noble/curves.
 *
 * Two independent generators:
 *   G = the standard basepoint (encodes the message / amount)
 *   H = a nothing-up-my-sleeve point (encodes randomness; Pedersen blinding base)
 * H is derived by hashing a fixed domain string to the curve, so nobody knows
 * its discrete log relative to G — that is what gives the commitment its hiding.
 */
import { ristretto255, ristretto255_hasher } from "@noble/curves/ed25519.js";

// Point class for the Ristretto255 prime-order group (the group Solana
// confidential transfers use). API: BASE, ZERO, fromBytes, multiply, add,
// subtract, negate, equals, is0, toBytes, toHex, Fn.ORDER.
const RPoint = ristretto255.Point as unknown as RistrettoPointCtor;

interface RistrettoPointInstance {
  add(o: RistrettoPointInstance): RistrettoPointInstance;
  subtract(o: RistrettoPointInstance): RistrettoPointInstance;
  negate(): RistrettoPointInstance;
  multiply(k: bigint): RistrettoPointInstance;
  equals(o: RistrettoPointInstance): boolean;
  is0(): boolean;
  toBytes(): Uint8Array;
  toHex(): string;
}
interface RistrettoPointCtor {
  BASE: RistrettoPointInstance;
  ZERO: RistrettoPointInstance;
  fromBytes(b: Uint8Array): RistrettoPointInstance;
  Fn: { ORDER: bigint };
}

export type Pt = RistrettoPointInstance;

/** Scalar field order (prime order of the Ristretto group). */
export const L: bigint = RPoint.Fn.ORDER;

/** Message base. */
export const G: Pt = RPoint.BASE;

/**
 * Independent blinding base H = hash-to-curve of a fixed domain string. Nobody
 * knows its discrete log w.r.t. G (nothing-up-my-sleeve), which is what makes the
 * Pedersen commitment binding+hiding.
 */
export const H: Pt = ristretto255_hasher.hashToCurve(
  new TextEncoder().encode("solana-confidential-skill/pedersen-H/v1"),
) as unknown as Pt;

export const ZERO: Pt = RPoint.ZERO;

/** Reduce into [0, L). */
export function modL(k: bigint): bigint {
  const r = k % L;
  return r < 0n ? r + L : r;
}

/** Scalar multiply that tolerates a zero scalar (noble rejects 0). */
export function mul(P: Pt, k: bigint): Pt {
  const s = modL(k);
  return s === 0n ? ZERO : P.multiply(s);
}

/** Modular inverse a^-1 mod L via the extended Euclidean algorithm. */
export function modInv(a: bigint, m: bigint = L): bigint {
  let [old_r, r] = [modL(a), m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1n) throw new Error("modInv: not invertible");
  return modL(old_s);
}

/** Cryptographically random scalar in [1, L). */
export function randScalar(): bigint {
  const bytes = new Uint8Array(64); // wide reduction kills modulo bias
  crypto.getRandomValues(bytes);
  let acc = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) acc = (acc << 8n) | BigInt(bytes[i]!);
  const s = modL(acc);
  return s === 0n ? 1n : s;
}

/** Little-endian bytes → scalar mod L (ed25519 scalars are little-endian). */
export function bytesToScalar(bytes: Uint8Array): bigint {
  let acc = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) acc = (acc << 8n) | BigInt(bytes[i]!);
  return modL(acc);
}

export function pointToBytes(p: Pt): Uint8Array {
  return p.toBytes();
}

export function pointFromBytes(b: Uint8Array): Pt {
  return RPoint.fromBytes(b);
}

export function pointKey(p: Pt): string {
  return p.toHex();
}
