// End-to-end test for withdraw_pair_tokens on devnet.
// Run: node test-withdraw-pair.mjs (from /frontend)
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  createMint, mintTo, getOrCreateAssociatedTokenAccount, getAccount,
  getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as anchor from "@anchor-lang/core";
import { IDL } from "./lib/idl.ts";

const PROGRAM_ID = new PublicKey("FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX");
const RPC = "https://api.devnet.solana.com";

const log = (label, ...rest) => console.log(`\n${label}`, ...rest);

const keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8")))
);
log("Admin:", keypair.publicKey.toBase58());

const connection = new Connection(RPC, "confirmed");
const wallet = {
  publicKey: keypair.publicKey,
  signTransaction: async (tx) => { tx.partialSign(keypair); return tx; },
  signAllTransactions: async (txs) => txs.map((tx) => { tx.partialSign(keypair); return tx; }),
};
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
const program = new anchor.Program(IDL, provider);

const seed = `vault_${keypair.publicKey.toBase58().slice(0, 8)}`;
log("Vault seed:", seed);

const [vaultPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), Buffer.from(seed)], PROGRAM_ID
);
log("Vault PDA:", vaultPDA.toBase58());

// ---------- 1. Initialize vault if missing ----------
{
  const info = await connection.getAccountInfo(vaultPDA);
  if (!info) {
    log("Initializing vault…");
    const sig = await program.methods.initialize(seed)
      .accounts({ vaultState: vaultPDA, user: keypair.publicKey })
      .rpc();
    log("  init tx:", sig);
  } else {
    log("Vault already exists, skip init");
  }
}

// ---------- 2. Create test SPL mint (6 decimals, we are mint authority) ----------
log("Creating test SPL mint (6 decimals)…");
const mint = await createMint(connection, keypair, keypair.publicKey, null, 6);
log("  mint:", mint.toBase58());

// ---------- 3. Register pair (max_bps = 5000 = 50%) ----------
const [pairPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("pair_config"), vaultPDA.toBuffer(), mint.toBuffer()], PROGRAM_ID,
);
log("Registering pair config (max 50%)…");
{
  const sig = await program.methods.addPair(seed, 5000)
    .accounts({
      vaultState: vaultPDA, targetMint: mint, pairConfig: pairPDA,
      admin: keypair.publicKey,
    })
    .rpc();
  log("  add_pair tx:", sig);
}

// ---------- 4. Mint 100 tokens to vault ATA ----------
const vaultAta = getAssociatedTokenAddressSync(mint, vaultPDA, true);
log("Vault ATA:", vaultAta.toBase58());

// Vault ATA needs to exist; getOrCreate handles owner-off-curve via allowOwnerOffCurve flag
// but spl-token's helper doesn't expose that — create manually.
{
  const info = await connection.getAccountInfo(vaultAta);
  if (!info) {
    const { createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
    const ix = createAssociatedTokenAccountInstruction(keypair.publicKey, vaultAta, vaultPDA, mint);
    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
    log("  vault ATA created tx:", sig);
  }
}

const mintAmount = 100_000_000n; // 100.000000 with 6 decimals
log(`Minting ${mintAmount} raw units (= 100 tokens) to vault ATA…`);
{
  const sig = await mintTo(connection, keypair, mint, vaultAta, keypair.publicKey, Number(mintAmount));
  log("  mint_to tx:", sig);
}

const beforeVault = (await getAccount(connection, vaultAta)).amount;
log("Vault ATA balance BEFORE withdraw:", beforeVault.toString());

// ---------- 5. Call withdraw_pair_tokens (withdraw 60 tokens) ----------
const adminAta = getAssociatedTokenAddressSync(mint, keypair.publicKey, false);
const adminAtaInfo = await connection.getAccountInfo(adminAta);
if (!adminAtaInfo) {
  const adminAtaResult = await getOrCreateAssociatedTokenAccount(connection, keypair, mint, keypair.publicKey);
  log("  admin ATA created:", adminAtaResult.address.toBase58());
}

const withdrawAmount = 60_000_000n; // 60.000000
log(`Calling withdraw_pair_tokens for ${withdrawAmount} raw units (= 60 tokens)…`);
{
  const sig = await program.methods.withdrawPairTokens(seed, new anchor.BN(withdrawAmount.toString()))
    .accounts({
      vaultState: vaultPDA,
      targetMint: mint,
      pairConfig: pairPDA,
      vaultTokenAccount: vaultAta,
      adminTokenAccount: adminAta,
      admin: keypair.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  log("  withdraw_pair_tokens tx:", sig);
  log("    explorer:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

// ---------- 6. Verify ----------
const afterVault = (await getAccount(connection, vaultAta)).amount;
const afterAdmin = (await getAccount(connection, adminAta)).amount;
log("--- RESULT ---");
console.log("  vault ATA: ", beforeVault.toString(), "->", afterVault.toString(), "(expected drop 60_000_000)");
console.log("  admin ATA: 0 ->", afterAdmin.toString(), "(expected 60_000_000)");

const vaultDelta = beforeVault - afterVault;
if (vaultDelta === withdrawAmount && afterAdmin === withdrawAmount) {
  log("PASS  withdraw_pair_tokens works end-to-end");
  process.exit(0);
} else {
  log("FAIL  unexpected balances");
  process.exit(1);
}
