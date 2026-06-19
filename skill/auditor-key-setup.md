# Issuer Setup: a Mint with an Auditor Key

Goal: create a Token-2022 mint that (a) supports confidential transfers and
(b) carries a global auditor ElGamal pubkey so a compliance officer can decrypt
amounts later. Uses `@solana/spl-token`.

> Verify exact signatures against the installed `@solana/spl-token` version and
> the official guide (`resources.md`). Confidential-transfer helpers move fast;
> treat this as the correct shape, not a frozen API.

## 1. Generate the auditor ElGamal keypair (off-chain, kept secret)

The auditor keypair is an ElGamal keypair, separate from any Solana signer. The
**public** key goes on the mint; the **secret** key stays in an HSM/TEE and is
used only by the compliance loop (`decryption.md`).

```ts
// from @solana/spl-token zk helpers / @solana/zk-sdk
const auditorElGamal = ElGamalKeypair.new();              // generate once
const auditorElGamalPubkey = auditorElGamal.publicKey();  // -> goes on the mint
// persist auditorElGamal.secretKey() to an HSM. NEVER commit or log it.
```

## 2. Create the mint with both extensions

You initialize **two** extensions before `createInitializeMintInstruction`:
`ConfidentialTransferMint` (carrying the auditor pubkey) and the base mint.

```ts
import {
  ExtensionType, getMintLen, TOKEN_2022_PROGRAM_ID,
  createInitializeConfidentialTransferMintInstruction,
  createInitializeMintInstruction,
} from "@solana/spl-token";

const extensions = [ExtensionType.ConfidentialTransferMint];
const mintLen = getMintLen(extensions);

const tx = new Transaction().add(
  SystemProgram.createAccount({ /* fund mint account, mintLen */ }),
  createInitializeConfidentialTransferMintInstruction(
    mint.publicKey,
    authority.publicKey,        // confidential-transfer authority
    /* autoApproveNewAccounts */ false, // false = manual approval (regulated)
    auditorElGamalPubkey,       // <-- the global auditor key
    TOKEN_2022_PROGRAM_ID,
  ),
  createInitializeMintInstruction(mint.publicKey, decimals, authority.publicKey, null, TOKEN_2022_PROGRAM_ID),
);
```

Key decisions:
- `autoApproveNewAccounts = false` → holders must be approved (manual policy).
- Pass the **auditor pubkey**, not the secret. Setting it at init means every
  transfer thereafter includes the auditor ciphertext.

## 3. Account onboarding (holders)

Each holder configures their account (`configureAccount` /
`createConfigureAccountInstruction`), then `deposit` → `applyPendingBalance`
before transacting confidentially. See `primer.md` lifecycle.

## 4. Hand the secret key to the compliance loop

The loop in `compliance-loop.md` takes the auditor **secret** key via
`SplAuditorDecryptor`. Provision it from the HSM at runtime — never as plaintext
config. Continue to `compliance-loop.md`.
