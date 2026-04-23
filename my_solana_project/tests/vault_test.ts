import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { expect } from "chai";

describe("my_solana_project", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MySolanaProject as Program<any>;

  // Unique seed per test run — avoids stale on-chain state from prior sessions
  const vaultSeed = `vault_${Date.now()}`;

  let vaultPDA: anchor.web3.PublicKey;

  before(async () => {
    [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), Buffer.from(vaultSeed)],
      program.programId
    );
  });

  it("Initializes the vault", async () => {
    await program.methods
      .initialize(vaultSeed)
      .accounts({
        vaultState: vaultPDA,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await (program.account as any).vaultState.fetch(vaultPDA);
    expect(account.admin.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    expect(account.totalFunds.toNumber()).to.equal(0);
    expect(account.isActive).to.equal(true);
  });

  it("Deposits funds into the vault", async () => {
    const depositAmount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);

    await program.methods
      .deposit(vaultSeed, depositAmount)
      .accounts({
        vaultState: vaultPDA,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await (program.account as any).vaultState.fetch(vaultPDA);
    expect(account.totalFunds.toNumber()).to.equal(depositAmount.toNumber());
  });

  it("Withdraws funds from the vault", async () => {
    const withdrawAmount = new anchor.BN(0.5 * anchor.web3.LAMPORTS_PER_SOL);

    await program.methods
      .withdraw(vaultSeed, withdrawAmount)
      .accounts({
        vaultState: vaultPDA,
        admin: provider.wallet.publicKey,
      })
      .rpc();

    const account = await (program.account as any).vaultState.fetch(vaultPDA);
    expect(account.totalFunds.toNumber()).to.equal(0.5 * anchor.web3.LAMPORTS_PER_SOL);
  });

  it("Should fail when a non-admin tries to withdraw", async () => {
    const attacker = anchor.web3.Keypair.generate();

    // Fund attacker from provider wallet (avoids devnet airdrop rate limits)
    const fundTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: attacker.publicKey,
        lamports: 0.01 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(fundTx);

    try {
      await program.methods
        .withdraw(vaultSeed, new anchor.BN(0.1 * anchor.web3.LAMPORTS_PER_SOL))
        .accounts({
          vaultState: vaultPDA,
          admin: attacker.publicKey,
        })
        .signers([attacker])
        .rpc();

      expect.fail("Withdraw harus gagal untuk non-admin");
    } catch (err: any) {
      expect(err.toString()).to.contain("ConstraintHasOne");
      console.log("Security check passed: Non-admin tidak bisa withdraw!");
    }
  });
});
