import type { AuditorDecryptor, ConfidentialTransferRecord } from "./types.ts";
import { bytesToScalar } from "./crypto/ristretto.ts";
import {
  decryptAmount, decryptAmountLoHi, DEFAULT_LIMBS, LOHI_SPLIT, type LimbConfig,
} from "./crypto/twisted-elgamal.ts";
import { decryptSolanaAmountLoHi } from "./crypto/solana-elgamal.ts";
import { babyTable, warmTable } from "./crypto/dlog.ts";

/**
 * Ciphertext amount encoding:
 *   "limbed" — N equal limbs of `limbs.limbBits` (this engine's native format,
 *              used by the demo, tests, and `encryptAmount`).
 *   "lohi"   — Solana's PRODUCTION on-chain split: a 16-bit low ciphertext +
 *              a 32-bit high ciphertext (CT09). Matches `encryptAmountLoHi` and
 *              the real auditor ciphertext wire layout.
 */
export type CiphertextLayout = "limbed" | "lohi";

/**
 * Decrypt convention:
 *   "engine" — this skill's own twisted-ElGamal (pubkey s·H, decrypt C − s⁻¹·D).
 *   "solana" — `@solana/zk-sdk`-compatible (pubkey s⁻¹·H, decrypt C − s·D). This
 *              is the convention that decrypts REAL on-chain confidential-transfer
 *              auditor ciphertext. Verified against real zk-sdk bytes.
 */
export type DecryptConvention = "engine" | "solana";

/**
 * Real auditor decryptor. Twisted-ElGamal over Ristretto255 (the same group
 * Solana confidential transfers use) + chunked discrete log. The auditor secret
 * key decrypts the auditor ciphertext attached to each transfer into a u48
 * amount. This is genuine cryptography, not a stub — see crypto/.
 */
export interface SplAuditorDecryptorOptions {
  /** Auditor ElGamal secret. Bytes (little-endian scalar) or a scalar bigint. */
  auditorElGamalSecret: Uint8Array | bigint;
  /** Limb layout. Default 16-bit × 3 = 48-bit amount cap (matches Solana). */
  limbs?: LimbConfig;
  /**
   * Adapter from on-chain instruction bytes to the serialized limb ciphertext
   * the engine expects. Default is identity (works with `encryptAmount` output
   * and the demo). To consume REAL on-chain transfers, supply a parser that maps
   * the installed @solana/spl-token / zk-sdk auditor-ciphertext wire layout into
   * `[C0‖D0, C1‖D1, ...]` (32-byte Ristretto points). That layout is the only
   * version-dependent seam; the crypto below is fixed.
   */
  parseAuditorCiphertext?: (raw: Uint8Array) => Uint8Array;
  /**
   * Amount encoding. Default "limbed". Set "lohi" to decrypt Solana's real
   * on-chain 16-bit-low + 32-bit-high split (CT09). The 32-bit high limb needs
   * a one-time ~9s discrete-log table build (Solana ships this precomputed);
   * it is warmed in the constructor so per-transfer decryption stays fast.
   */
  layout?: CiphertextLayout;
  /**
   * Decrypt convention. Default "engine". Set "solana" to decrypt REAL on-chain
   * `@solana/zk-sdk` auditor ciphertext (pubkey s⁻¹·H, amount·G = C − s·D). Use
   * with `layout: "lohi"` for the production 16-bit-low + 32-bit-high split.
   */
  convention?: DecryptConvention;
}

export class SplAuditorDecryptor implements AuditorDecryptor {
  private readonly secret: bigint;
  private readonly cfg: LimbConfig;
  private readonly parse: (raw: Uint8Array) => Uint8Array;
  private readonly layout: CiphertextLayout;
  private readonly convention: DecryptConvention;

  constructor(opts: SplAuditorDecryptorOptions) {
    this.secret =
      typeof opts.auditorElGamalSecret === "bigint"
        ? opts.auditorElGamalSecret
        : bytesToScalar(opts.auditorElGamalSecret);
    this.cfg = opts.limbs ?? DEFAULT_LIMBS;
    this.parse = opts.parseAuditorCiphertext ?? ((raw) => raw);
    this.layout = opts.layout ?? "limbed";
    this.convention = opts.convention ?? "engine";
    if (this.convention === "solana" || this.layout === "lohi") {
      warmTable(LOHI_SPLIT.loBits); // 16-bit low table (instant)
      warmTable(LOHI_SPLIT.hiBits); // 32-bit high table (one-time build, then cached)
    } else {
      babyTable(this.cfg.limbBits); // warm the discrete-log table once
    }
  }

  async decrypt(record: ConfidentialTransferRecord): Promise<bigint> {
    const ciphertext = this.parse(record.auditorCiphertext);
    if (this.convention === "solana") {
      // Real on-chain auditor amount: lo(16) + hi(32) Solana ElGamal ciphertext.
      return decryptSolanaAmountLoHi(ciphertext, this.secret);
    }
    return this.layout === "lohi"
      ? decryptAmountLoHi(ciphertext, this.secret)
      : decryptAmount(ciphertext, this.secret, this.cfg);
  }
}

/**
 * Deterministic mock decryptor for tests and dry-runs that don't exercise the
 * crypto. Reads a little-endian u64 from `auditorCiphertext`, or an injected map.
 */
export class MockAuditorDecryptor implements AuditorDecryptor {
  constructor(private readonly bySignature?: Map<string, bigint>) {}

  async decrypt(record: ConfidentialTransferRecord): Promise<bigint> {
    const injected = this.bySignature?.get(record.signature);
    if (injected !== undefined) return injected;
    let amount = 0n;
    const buf = record.auditorCiphertext;
    for (let i = 0; i < Math.min(8, buf.length); i++) amount |= BigInt(buf[i]!) << BigInt(8 * i);
    return amount;
  }
}

/** Helper: little-endian u64 bytes for the mock decryptor. */
export function encodeAmountLE(amount: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  let v = amount;
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}
