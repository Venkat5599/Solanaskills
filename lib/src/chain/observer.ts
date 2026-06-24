/**
 * Real RPC observer for the compliance loop.
 *
 * Replaces the hand-wavy `observe()` stub with genuine chain wiring: it queries
 * a Solana RPC for transactions touching a watched mint / token account,
 * identifies Token-2022 confidential-transfer instructions, and yields
 * `ConfidentialTransferRecord`s the loop can decrypt. Transfers are returned
 * oldest-first (guardrail CT08) and only past the cursor's last slot.
 *
 * The Token-2022 confidential-transfer instruction family lives under outer
 * discriminator 27 (`ConfidentialTransferExtension`); the transfer sub-types are
 * `Transfer` (7) and `TransferWithSplitProofs` (12). The exact byte position of
 * the auditor ciphertext inside the instruction is the one version-dependent
 * seam (CT09): supply `extractAuditorCiphertext` for your installed spl-token,
 * or pair it with `splLoHiCiphertextParser()` once you have the span.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import type { ConfidentialTransferRecord } from "../types.ts";

export const CONFIDENTIAL_TRANSFER_EXTENSION = 27;
export const CT_TRANSFER_SUBTYPES = new Set<number>([7, 12]); // Transfer, TransferWithSplitProofs
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export interface RpcObserverOptions {
  connection: Connection;
  /** Token account or mint to watch (drives getSignaturesForAddress). */
  address: PublicKey | string;
  mint: string;
  /** Token program. Default Token-2022. */
  programId?: PublicKey;
  /** Max signatures to pull per poll. Default 100. */
  limit?: number;
  /**
   * Pull the auditor ciphertext bytes out of a confidential-transfer
   * instruction's data. Version-dependent (CT09). If omitted, the raw
   * instruction data is passed through as `auditorCiphertext` and a
   * `parseAuditorCiphertext` on the decryptor must finish the job.
   */
  extractAuditorCiphertext?: (instructionData: Uint8Array) => Uint8Array;
}

interface CompiledIx {
  programIdIndex: number;
  data: Uint8Array;
}

export class RpcConfidentialObserver {
  private readonly connection: Connection;
  private readonly address: PublicKey;
  private readonly mint: string;
  private readonly programId: PublicKey;
  private readonly limit: number;
  private readonly extract: (d: Uint8Array) => Uint8Array;

  constructor(opts: RpcObserverOptions) {
    this.connection = opts.connection;
    this.address = typeof opts.address === "string" ? new PublicKey(opts.address) : opts.address;
    this.mint = opts.mint;
    this.programId = opts.programId ?? new PublicKey(TOKEN_2022_PROGRAM);
    this.limit = opts.limit ?? 100;
    this.extract = opts.extractAuditorCiphertext ?? ((d) => d);
  }

  /** True if this compiled instruction is a Token-2022 confidential transfer. */
  static isConfidentialTransfer(programIsToken2022: boolean, data: Uint8Array): boolean {
    return (
      programIsToken2022 &&
      data.length >= 2 &&
      data[0] === CONFIDENTIAL_TRANSFER_EXTENSION &&
      CT_TRANSFER_SUBTYPES.has(data[1]!)
    );
  }

  /** Fetch confidential transfers newer than the cursor, oldest-first. */
  async observe(cursor: { lastSlot: number }): Promise<ConfidentialTransferRecord[]> {
    const sigs = await this.connection.getSignaturesForAddress(this.address, { limit: this.limit });
    const fresh = sigs
      .filter((s) => !s.err && s.slot > cursor.lastSlot)
      .sort((a, b) => a.slot - b.slot); // oldest-first (CT08)

    const records: ConfidentialTransferRecord[] = [];
    for (const s of fresh) {
      const tx = await this.connection.getTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) continue;
      const keys = tx.transaction.message.getAccountKeys({
        accountKeysFromLookups: tx.meta?.loadedAddresses,
      });
      const ixs = tx.transaction.message.compiledInstructions as CompiledIx[];
      let n = 0;
      for (const ix of ixs) {
        const programIsT22 = keys.get(ix.programIdIndex)?.equals(this.programId) ?? false;
        if (!RpcConfidentialObserver.isConfidentialTransfer(programIsT22, ix.data)) continue;
        records.push({
          signature: `${s.signature}:${n++}`,
          slot: s.slot,
          blockTime: (s.blockTime ?? Math.floor(Date.now() / 1000)) * 1000,
          mint: this.mint,
          source: this.address.toBase58(),
          destination: keys.get(ix.programIdIndex)?.toBase58() ?? "",
          auditorCiphertext: this.extract(ix.data),
        });
      }
    }
    return records;
  }
}
