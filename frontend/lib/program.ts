import { Connection, PublicKey, clusterApiUrl, Transaction, VersionedTransaction } from "@solana/web3.js";
import * as anchor from "@anchor-lang/core";
import { IDL } from "./idl";

export const PROGRAM_ID = new PublicKey("FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX");
export const VAULT_SEED = process.env.NEXT_PUBLIC_VAULT_SEED ?? "my_test_vault";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? clusterApiUrl("devnet");

export const TOKEN_MINTS: Record<string, { mint: string; label: string }> = {
  JUP:  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", label: "Jupiter" },
  MET:  { mint: "METADDFL6wWMWEoKDFJwpmV4gVgELib96hYKUaVL5a",  label: "Meteora" },
  BONK: { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", label: "Bonk" },
  WIF:  { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", label: "dogwifhat" },
};

export function mintLabel(mintAddress: string): string {
  const entry = Object.entries(TOKEN_MINTS).find(([, v]) => v.mint === mintAddress);
  return entry ? entry[0] : mintAddress.slice(0, 6) + "…";
}

export interface BrowserWallet {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
}

export function getProgram(wallet: BrowserWallet) {
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    wallet as unknown as anchor.Wallet,
    { commitment: "confirmed" }
  );
  return new anchor.Program(IDL as unknown as anchor.Idl, provider);
}

export function getVaultPDA(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), Buffer.from(VAULT_SEED)],
    programId
  );
  return pda;
}

export function getPairPDA(programId: PublicKey, vaultPDA: PublicKey, mintPubkey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pair_config"), vaultPDA.toBuffer(), mintPubkey.toBuffer()],
    programId
  );
  return pda;
}

export function lamportsToSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4);
}
