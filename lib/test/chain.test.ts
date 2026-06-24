import { describe, expect, test } from "bun:test";
import { RpcConfidentialObserver } from "../src/chain/observer.ts";
import { parseConfidentialMintExtension } from "../src/chain/mint-config.ts";

describe("Token-2022 confidential-transfer instruction detection", () => {
  test("matches the CT extension discriminator + transfer subtypes", () => {
    const ok = (subtype: number) =>
      RpcConfidentialObserver.isConfidentialTransfer(true, new Uint8Array([27, subtype, 0, 0]));
    expect(ok(7)).toBe(true); // Transfer
    expect(ok(12)).toBe(true); // TransferWithSplitProofs
  });

  test("rejects non-CT / non-Token-2022 instructions", () => {
    // wrong program
    expect(RpcConfidentialObserver.isConfidentialTransfer(false, new Uint8Array([27, 7]))).toBe(false);
    // wrong outer discriminator
    expect(RpcConfidentialObserver.isConfidentialTransfer(true, new Uint8Array([12, 7]))).toBe(false);
    // CT extension but not a transfer subtype
    expect(RpcConfidentialObserver.isConfidentialTransfer(true, new Uint8Array([27, 1]))).toBe(false);
    // too short
    expect(RpcConfidentialObserver.isConfidentialTransfer(true, new Uint8Array([27]))).toBe(false);
  });
});

describe("ConfidentialTransferMint extension parsing (real on-chain layout)", () => {
  // 65-byte extension: authority(32) || autoApprove(1) || auditorElGamalPubkey(32)
  const auth = new Uint8Array(32).fill(0xab);
  const auditor = new Uint8Array(32).map((_, i) => i + 1);

  test("parses authority, auto-approve flag, and auditor key", () => {
    const ext = new Uint8Array(65);
    ext.set(auth, 0);
    ext[32] = 1;
    ext.set(auditor, 33);
    const cfg = parseConfidentialMintExtension(ext);
    expect(cfg.autoApproveNewAccounts).toBe(true);
    expect(cfg.authority).not.toBeNull();
    expect(cfg.auditorElGamalPubkeyHex).toBe(Buffer.from(auditor).toString("hex"));
  });

  test("treats an all-zero auditor key as 'no auditor'", () => {
    const ext = new Uint8Array(65);
    ext.set(auth, 0);
    ext[32] = 0;
    // auditor left all-zero
    const cfg = parseConfidentialMintExtension(ext);
    expect(cfg.autoApproveNewAccounts).toBe(false);
    expect(cfg.auditorElGamalPubkey).toBeNull();
    expect(cfg.auditorElGamalPubkeyHex).toBeNull();
  });

  test("rejects a truncated extension", () => {
    expect(() => parseConfidentialMintExtension(new Uint8Array(40))).toThrow();
  });
});
