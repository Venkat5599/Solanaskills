/**
 * Discrete-log recovery for a single limb via Baby-Step Giant-Step (BSGS).
 *
 * After ElGamal decryption a limb is a point `M = v·G` with `v < 2^limbBits`.
 * Solana caps confidential transfer amounts at 48 bits and decrypts in 16-bit
 * limbs precisely so this stays tractable; we mirror that.
 *
 * BSGS recovers v in O(2^(limbBits/2)) time and space instead of O(2^limbBits):
 * for a 16-bit limb that is a 256-entry table + ≤256 steps, versus a 65 536-entry
 * table. Build is effectively instant and cached per `limbBits`.
 */
import { G, mul, pointKey, ZERO, type Pt } from "./ristretto.ts";

interface Bsgs {
  m: number; // baby-step count = giant-step stride
  baby: Map<string, number>; // hex(j·G) -> j, for j in [0, m)
  giant: Pt; // m·G, subtracted each giant step
}

const cache = new Map<number, Bsgs>();

function build(limbBits: number): Bsgs {
  const cached = cache.get(limbBits);
  if (cached) return cached;
  // 2**limbBits, NOT 1 << limbBits — the bitwise shift wraps at 32 bits and
  // would silently produce a 1-entry table for the 32-bit hi limb (CT09).
  const n = 2 ** limbBits;
  const m = Math.ceil(Math.sqrt(n));
  const baby = new Map<string, number>();
  let cur: Pt = ZERO;
  for (let j = 0; j < m; j++) {
    baby.set(pointKey(cur), j);
    cur = cur.add(G);
  }
  const bsgs: Bsgs = { m, baby, giant: mul(G, BigInt(m)) };
  cache.set(limbBits, bsgs);
  return bsgs;
}

/** Recover v from M = v·G for v in [0, 2^limbBits). Throws if no solution. */
export function solveLimb(M: Pt, limbBits: number, table = build(limbBits)): number {
  const { m, baby, giant } = table;
  const max = 2 ** limbBits;
  let gamma = M;
  for (let i = 0; i < m; i++) {
    const j = baby.get(pointKey(gamma));
    if (j !== undefined) {
      const v = i * m + j;
      if (v < max) return v;
    }
    gamma = gamma.subtract(giant); // γ -= m·G
  }
  throw new Error(
    `dlog: no solution for limb in [0, 2^${limbBits}) — wrong auditor key or amount overflow`,
  );
}

/** Pre-build the BSGS table ahead of the loop. */
export function warmTable(limbBits: number): void {
  build(limbBits);
}

/** Exposed for tests / callers that want the table directly. */
export function babyTable(limbBits: number): void {
  build(limbBits);
}
