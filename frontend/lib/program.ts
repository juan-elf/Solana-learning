import { Connection, PublicKey, clusterApiUrl, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@anchor-lang/core";
import { IDL } from "./idl";

export const PROGRAM_ID = new PublicKey("FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX");
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? clusterApiUrl("devnet");

export const TOKEN_MINTS: Record<string, { mint: string; label: string }> = {
  JUP:  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", label: "Jupiter" },
  USDC: { mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", label: "USDC (devnet)" },
  BONK: { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", label: "Bonk" },
  WIF:  { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", label: "dogwifhat" },
  TEST: { mint: "3GVkwedvppx6MjnC7JmupwGFCbsE8fxz4iNvSmF7ZS1f", label: "Test token (devnet)" },
};

// Derive vault seed otomatis dari wallet pubkey — setiap wallet punya vault sendiri
export function getVaultSeed(pubkey: PublicKey): string {
  return `vault_${pubkey.toBase58().slice(0, 8)}`;
}

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
  if (!wallet || !wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not ready: publicKey or signTransaction missing");
  }
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    wallet as unknown as anchor.Wallet,
    { commitment: "confirmed" }
  );
  return new anchor.Program(IDL as unknown as anchor.Idl, provider);
}

export function getVaultPDA(programId: PublicKey, seed: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), Buffer.from(seed)],
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

// @anchor-lang/core's sendAndConfirmRawTransaction retries the raw send when
// confirmTransaction times out. The retry hits "already processed" because the
// first send actually landed on-chain. Treat that specific message as success.
export function isAlreadyProcessedError(e: unknown): boolean {
  const msg = (e as { message?: string })?.message ?? String(e);
  return msg.includes("already been processed") || msg.includes("already processed");
}

// ATA owned by the vault PDA — where DCA-swapped tokens accumulate.
// `allowOwnerOffCurve = true` because vault PDA is not on the ed25519 curve.
export function getVaultAta(vaultPDA: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, vaultPDA, true);
}

// ATA owned by a regular wallet (admin).
export function getUserAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, false);
}

export { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID };

// MethodsBuilder is the chainable object returned by program.methods.X(...). We
// only need .transaction() from it; type it loose to avoid pulling internal
// generics from @anchor-lang/core.
type AnchorMethodsBuilder = { transaction(): Promise<Transaction> };

export interface SendTxOk {
  signature: string;
  explorer: string;
}

/**
 * Build, sign, send, and poll a transaction without falling into
 * @anchor-lang/core's sendAndConfirmRawTransaction retry loop.
 *
 * - skipPreflight: false so on-chain errors fail fast at simulation time
 * - maxRetries: 0 so a confirm timeout never resends the same raw tx
 * - Polls getSignatureStatuses every second up to 60s, then gives up
 *
 * Throws with logs included whenever possible so the caller can surface the
 * real Anchor error message.
 */
export async function sendTx(
  builder: AnchorMethodsBuilder,
  wallet: BrowserWallet,
): Promise<SendTxOk> {
  const connection = new Connection(RPC_URL, "confirmed");
  const tx = await builder.transaction();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

  const signed = await wallet.signTransaction(tx);
  const raw = signed.serialize();

  const signature = await connection.sendRawTransaction(raw, {
    skipPreflight: false,
    maxRetries: 0,
  });

  const startTime = Date.now();
  while (Date.now() - startTime < 60_000) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) {
      let detail = JSON.stringify(status.err);
      try {
        const parsed = await connection.getTransaction(signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        if (parsed?.meta?.logMessages) detail = parsed.meta.logMessages.join("\n");
      } catch { /* ignore */ }
      const err = new Error(`Transaction failed: ${detail}`) as Error & { signature?: string };
      err.signature = signature;
      throw err;
    }
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return { signature, explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet` };
    }
    // Bail out early if the blockhash is dead — the tx will never land
    const currentBlock = await connection.getBlockHeight("confirmed").catch(() => 0);
    if (currentBlock > lastValidBlockHeight + 50) {
      const err = new Error(`Transaction expired (blockhash too old). Signature: ${signature}`) as Error & { signature?: string };
      err.signature = signature;
      throw err;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const err = new Error(`Transaction not confirmed in 60s. Signature: ${signature}`) as Error & { signature?: string };
  err.signature = signature;
  throw err;
}
