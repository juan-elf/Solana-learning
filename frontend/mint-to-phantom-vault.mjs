// Mint 100 TEST tokens to the Phantom vault's ATA on devnet.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  mintTo, getAccount, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

const PHANTOM_VAULT = new PublicKey("6RcMW8s647Ez3QNiwjRf2SqriLe8a3ZJTq9RV17WCpV");
const TEST_MINT = new PublicKey("3GVkwedvppx6MjnC7JmupwGFCbsE8fxz4iNvSmF7ZS1f");
const RPC = "https://api.devnet.solana.com";

const keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8")))
);
console.log("Mint authority:", keypair.publicKey.toBase58());
const conn = new Connection(RPC, "confirmed");

// Verify pair_config exists for this mint on Phantom vault
const PROGRAM_ID = new PublicKey("FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX");
const [pairPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("pair_config"), PHANTOM_VAULT.toBuffer(), TEST_MINT.toBuffer()], PROGRAM_ID,
);
const pairInfo = await conn.getAccountInfo(pairPDA);
if (!pairInfo) {
  console.error("FAIL  pair_config not found at", pairPDA.toBase58());
  console.error("       Did you add the TEST pair via the UI?");
  process.exit(1);
}
console.log("pair_config OK:", pairPDA.toBase58());

// Vault ATA — vault PDA is owner-off-curve, so allowOwnerOffCurve = true
const vaultAta = getAssociatedTokenAddressSync(TEST_MINT, PHANTOM_VAULT, true);
console.log("Vault ATA:     ", vaultAta.toBase58());

const ataInfo = await conn.getAccountInfo(vaultAta);
if (!ataInfo) {
  console.log("Creating vault ATA…");
  const ix = createAssociatedTokenAccountInstruction(keypair.publicKey, vaultAta, PHANTOM_VAULT, TEST_MINT);
  const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [keypair]);
  console.log("  create ATA tx:", sig);
}

const before = ataInfo ? (await getAccount(conn, vaultAta)).amount : 0n;
console.log("Balance BEFORE:", before.toString());

const amount = 100_000_000n; // 100.000000 with 6 decimals
console.log(`Minting ${amount} raw units (= 100 tokens)…`);
const sig = await mintTo(conn, keypair, TEST_MINT, vaultAta, keypair.publicKey, Number(amount));
console.log("  mint_to tx:", sig);
console.log("    explorer:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);

const after = (await getAccount(conn, vaultAta)).amount;
console.log("Balance AFTER: ", after.toString());

if (after - before === amount) {
  console.log("\nPASS  100 TEST tokens minted to Phantom vault ATA");
  console.log("      Refresh the frontend, the TEST row should now show 100 balance + active Withdraw button.");
} else {
  console.log("\nFAIL  unexpected delta");
  process.exit(1);
}
