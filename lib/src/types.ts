/**
 * Core types for the confidential-transfer compliance loop.
 *
 * The auditor (regulator / issuer compliance officer) holds the mint's auditor
 * ElGamal secret key. That key can decrypt the auditor ciphertext attached to
 * every confidential transfer for the mint — and ONLY that key can. Everything
 * downstream of decryption (this whole module) is ordinary, deterministic,
 * fully-testable code.
 */

/** A confidential transfer as observed on-chain, before auditor decryption. */
export interface ConfidentialTransferRecord {
  /** Transaction signature — stable unique id. */
  signature: string;
  slot: number;
  /** Unix ms (block time). */
  blockTime: number;
  mint: string;
  /** Confidential-transfer source token account. */
  source: string;
  /** Confidential-transfer destination token account. */
  destination: string;
  /**
   * The auditor ciphertext bytes pulled from the transfer instruction
   * (transfer amount encrypted under the mint's auditor ElGamal pubkey).
   * Opaque here; the AuditorDecryptor turns it into an amount.
   */
  auditorCiphertext: Uint8Array;
}

/** A confidential transfer after the auditor key has decrypted the amount. */
export interface DecryptedTransfer {
  signature: string;
  slot: number;
  blockTime: number;
  mint: string;
  source: string;
  destination: string;
  /** Decrypted transfer amount in base units (u64-range, smallest denomination). */
  amount: bigint;
}

export type Severity = "info" | "low" | "medium" | "high";

/** A single AML/compliance finding raised against a transfer. */
export interface Flag {
  rule: string;
  severity: Severity;
  signature: string;
  account: string;
  message: string;
  /** Rule-specific evidence (windows, counts, totals). */
  evidence?: Record<string, unknown>;
}

/**
 * Decryption boundary. A real implementation wraps the mint's auditor ElGamal
 * secret key and the @solana/spl-token / zk-sdk decrypt + discrete-log solve.
 * Tests inject a deterministic mock. See decryptor.ts.
 */
export interface AuditorDecryptor {
  decrypt(record: ConfidentialTransferRecord): Promise<bigint>;
}

/** Tunable AML thresholds. All amounts in base units. */
export interface ComplianceConfig {
  /** Single-transfer report threshold (CTR-style). Default 10_000 * 10^decimals. */
  reportThreshold: bigint;
  /** Structuring detector: band below the threshold that counts as "just under". */
  structuringBand: bigint;
  /** Structuring/velocity rolling window in ms. Default 24h. */
  windowMs: number;
  /** Velocity: max aggregate volume per account per window before flagging. */
  velocityVolumeLimit: bigint;
  /** Velocity: max transfer count per account per window before flagging. */
  velocityCountLimit: number;
  /** Counterparty concentration: flag if one peer is >= this fraction of volume. */
  concentrationRatio: number;
  /** Layering: in-then-out within this ms counts as pass-through. */
  layeringWindowMs: number;
  /** Dormancy: idle longer than this, then a large transfer, is suspicious. */
  dormancyMs: number;
  /** Minimum out-events in window before the concentration rule applies. */
  concentrationMinEvents: number;
  /** Sanctioned / denylisted account addresses. */
  sanctioned: Set<string>;
}

export function defaultConfig(decimals = 6): ComplianceConfig {
  const unit = 10n ** BigInt(decimals);
  return {
    reportThreshold: 10_000n * unit,
    structuringBand: 1_000n * unit,
    windowMs: 24 * 60 * 60 * 1000,
    velocityVolumeLimit: 50_000n * unit,
    velocityCountLimit: 50,
    concentrationRatio: 0.9,
    layeringWindowMs: 60 * 60 * 1000,
    dormancyMs: 90 * 24 * 60 * 60 * 1000,
    concentrationMinEvents: 5,
    sanctioned: new Set<string>(),
  };
}
