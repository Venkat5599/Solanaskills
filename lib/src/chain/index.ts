// Real on-chain wiring — Solana RPC observer + confidential-mint config reader.
// Pulls @solana/web3.js; import from here (not the engine root) to keep the
// offline core dependency-light.
export {
  RpcConfidentialObserver,
  CONFIDENTIAL_TRANSFER_EXTENSION,
  CT_TRANSFER_SUBTYPES,
  TOKEN_2022_PROGRAM,
  type RpcObserverOptions,
} from "./observer.ts";
export {
  readConfidentialMintConfig,
  parseConfidentialMintExtension,
  type ConfidentialMintConfig,
} from "./mint-config.ts";
