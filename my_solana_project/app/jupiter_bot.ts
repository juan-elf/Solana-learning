import * as anchor from "@anchor-lang/core";
import { Connection, PublicKey, VersionedTransaction, Keypair } from "@solana/web3.js";
import axios from "axios";
import fs from "fs";

// Token mint addresses (mainnet)
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUPITER_PROGRAM_ID = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

async function main() {
  const RPC_URL = "https://api.devnet.solana.com";
  const WALLET_PATH = "/home/juanelf/.config/solana/id.json";

  console.log(`Connecting to ${RPC_URL}...`);
  const connection = new Connection(RPC_URL, "confirmed");

  let walletKeypair: Keypair;
  try {
    const secretKeyString = fs.readFileSync(WALLET_PATH, "utf8");
    const secretKey = JSON.parse(secretKeyString);
    walletKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  } catch (e) {
    console.error("Failed to load wallet keypair:", e);
    return;
  }

  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // NOTE: anchor.workspace hanya tersedia di konteks `anchor test`.
  // Untuk script standalone, load IDL secara manual:
  // const idl = JSON.parse(fs.readFileSync("target/idl/my_solana_project.json", "utf8"));
  // const program = new anchor.Program(idl, provider);
  const program = anchor.workspace.MySolanaProject as any;

  const vaultSeed = "my_test_vault";
  const amount = 100_000_000; // 0.1 SOL dalam lamports

  console.log("Starting Jupiter Swap Process...");

  try {
    // 1. Fetch quote dari Jupiter
    console.log("Fetching route dari Jupiter API...");
    const quoteResponse = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount,
        slippageBps: 50,
      },
    });
    const quote = quoteResponse.data;
    console.log(`Quote received! Expected Output: ${quote.outAmount}`);

    // 2. Build swap transaction
    console.log("Building swap transaction...");
    const swapResponse = await axios.post("https://quote-api.jup.ag/v6/swap", {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
    });

    const swapTransactionBase64 = swapResponse.data.swapTransaction;
    const swapTxBytes = Buffer.from(swapTransactionBase64, "base64");
    const swapTx = VersionedTransaction.deserialize(swapTxBytes);

    // 3. Simulasi sebelum sign
    console.log("Simulating transaction...");
    const simulation = await connection.simulateTransaction(swapTx);
    if (simulation.value.err) {
      console.error("Simulation failed:", simulation.value.err);
      return;
    }
    console.log("Simulation successful!");

    // 4. Eksekusi via Vault Program
    console.log("Sending execution request to Vault Program...");
    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), Buffer.from(vaultSeed)],
      program.programId
    );

    await program.methods
      .swap(vaultSeed, Buffer.from([]), new anchor.BN(quote.outAmount))
      .accounts({
        vaultState: vaultPDA,
        admin: wallet.publicKey,
        jupiterProgram: JUPITER_PROGRAM_ID,
      })
      .rpc();

    console.log("Swap executed and Vault updated successfully!");
  } catch (error) {
    console.error("Error in Jupiter Bot:", error);
  }
}

main().catch(console.error);
