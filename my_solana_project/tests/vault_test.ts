import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";

describe("my_solana_project", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MySolanaProject as Program<any>;
  const vaultSeed = "my_test_vault";

  it("Initializes the vault", async () => {
    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), Buffer.from(vaultSeed)],
      program.programId
    );

    await program.methods
      .initialize(vaultSeed)
      .accounts({
        vaultState: vaultPDA,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.vaultState.fetch(vaultPDA);
    expect(account.admin.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    expect(account.totalFunds.toNumber()).to.equal(0);
  });

  it("Deposits funds into the vault", async () => {
    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), Buffer.from(vaultSeed)],
      program.programId
    );

    const depositAmount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);

    await program.methods
      .deposit(vaultSeed, depositAmount)
      .accounts({
        vaultState: vaultPDA,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.vaultState.fetch(vaultPDA);
    expect(account.totalFunds.toNumber()).to.equal(depositAmount.toNumber());
  });

  it("Withdraws funds from the vault", async () => {
    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), Buffer.from(vaultSeed)],
      program.programId
    );

    const withdrawAmount = new anchor.BN(0.5 * anchor.web3.LAMPORTS_PER_SOL);

    await program.methods
      .withdraw(vaultSeed, withdrawAmount)
      .accounts({
        vaultState: vaultPDA,
        admin: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.vaultState.fetch(vaultPDA);
    expect(account.totalFunds.toNumber()).to.equal(0.5 * anchor.web3.LAMPORTS_PER_SOL);
  });
});
