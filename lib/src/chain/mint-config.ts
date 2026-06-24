/**
 * Read a Token-2022 mint's ConfidentialTransferMint extension straight from the
 * chain and parse the auditor ElGamal public key out of the real on-chain TLV.
 *
 * This is genuine on-chain wiring: given a live `Connection` and a mint, it
 * fetches the account and decodes the extension at the real byte offsets the
 * runtime writes. The auditor pubkey it returns is the key whose secret (held in
 * an HSM/TEE) decrypts that mint's confidential transfers.
 *
 * ConfidentialTransferMint extension layout (65 bytes):
 *   authority                : Pubkey (32)  — OptionalNonZeroPubkey
 *   auto_approve_new_accounts: bool   (1)
 *   auditor_elgamal_pubkey   : [u8;32]      — OptionalNonZeroElGamalPubkey
 */
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getMint,
  getExtensionData,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

export interface ConfidentialMintConfig {
  mint: string;
  /** Confidential-transfer config authority, or null if none. */
  authority: string | null;
  autoApproveNewAccounts: boolean;
  /** The mint's auditor ElGamal pubkey (32 bytes), or null if no auditor set. */
  auditorElGamalPubkey: Uint8Array | null;
  auditorElGamalPubkeyHex: string | null;
}

const ZERO32 = new Uint8Array(32);
const isZero = (b: Uint8Array) => b.every((x) => x === 0);
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

/**
 * Pure parser for the 65-byte ConfidentialTransferMint extension value. Split
 * out from the RPC fetch so it's unit-testable offline with crafted bytes.
 */
export function parseConfidentialMintExtension(
  ext: Uint8Array,
): Omit<ConfidentialMintConfig, "mint"> {
  if (ext.length < 65) {
    throw new Error(`ConfidentialTransferMint extension too short: ${ext.length} bytes`);
  }
  const authorityBytes = ext.subarray(0, 32);
  const autoApprove = ext[32] !== 0;
  const auditorBytes = Uint8Array.from(ext.subarray(33, 65));
  const auditor = isZero(auditorBytes) ? null : auditorBytes;
  return {
    authority: isZero(authorityBytes) ? null : new PublicKey(authorityBytes).toBase58(),
    autoApproveNewAccounts: autoApprove,
    auditorElGamalPubkey: auditor,
    auditorElGamalPubkeyHex: auditor ? hex(auditor) : null,
  };
}

/**
 * Fetch + parse the ConfidentialTransferMint extension for `mint` from chain.
 * Throws if the mint is not Token-2022 or carries no confidential-transfer config.
 */
export async function readConfidentialMintConfig(
  connection: Connection,
  mint: PublicKey | string,
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): Promise<ConfidentialMintConfig> {
  const mintPk = typeof mint === "string" ? new PublicKey(mint) : mint;
  const mintInfo = await getMint(connection, mintPk, undefined, programId);

  const ext = getExtensionData(ExtensionType.ConfidentialTransferMint, mintInfo.tlvData);
  if (!ext) {
    throw new Error(`mint ${mintPk.toBase58()} has no ConfidentialTransferMint extension`);
  }
  return { mint: mintPk.toBase58(), ...parseConfidentialMintExtension(ext) };
}

export { ZERO32 };
