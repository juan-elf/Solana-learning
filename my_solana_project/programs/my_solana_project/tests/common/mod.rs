// Shared helpers for LiteSVM tests.
//
// Each test file (vault_lifecycle.rs, pair_management.rs, ...) is its own
// integration-test binary. They all start by calling `setup()` to get a fresh
// LiteSVM with the compiled program loaded and a funded admin keypair.
//
// IMPORTANT: run `anchor build` (or `cargo build-sbf`) before `cargo test`.
// LiteSVM loads the .so produced by that build from target/deploy/.

use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use litesvm::LiteSVM;
use my_solana_project::ID as PROGRAM_ID;
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::instruction::Instruction;

const PROGRAM_SO: &str = "../../target/deploy/my_solana_project.so";

pub struct TestEnv {
    pub svm: LiteSVM,
    pub admin: Keypair,
}

pub fn setup() -> TestEnv {
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(PROGRAM_ID, PROGRAM_SO)
        .expect("loading my_solana_project.so failed — did you run `anchor build`?");

    let admin = Keypair::new();
    svm.airdrop(&admin.pubkey(), 100_000_000_000).unwrap(); // 100 SOL
    TestEnv { svm, admin }
}

/// Make a fresh keypair funded with `lamports`.
pub fn fund(svm: &mut LiteSVM, lamports: u64) -> Keypair {
    let kp = Keypair::new();
    svm.airdrop(&kp.pubkey(), lamports).unwrap();
    kp
}

pub fn vault_seed(pubkey: &Pubkey) -> String {
    format!("vault_{}", &pubkey.to_string()[..8])
}

pub fn vault_pda(seed: &str) -> Pubkey {
    Pubkey::find_program_address(&[b"vault", seed.as_bytes()], &PROGRAM_ID).0
}

pub fn pair_pda(vault: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[b"pair_config", vault.as_ref(), mint.as_ref()],
        &PROGRAM_ID,
    )
    .0
}

/// Send a single instruction signed by `signers` (first signer is fee payer).
pub fn send_ix(
    svm: &mut LiteSVM,
    ix: Instruction,
    signers: &[&Keypair],
) -> Result<(), litesvm::types::FailedTransactionMetadata> {
    let payer = signers[0];
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = Transaction::new(signers, msg, blockhash);
    svm.send_transaction(tx).map(|_| ())
}

pub fn fetch_vault(svm: &LiteSVM, pda: &Pubkey) -> my_solana_project::VaultState {
    let acc = svm.get_account(pda).expect("vault account not found");
    my_solana_project::VaultState::try_deserialize(&mut &acc.data[..]).unwrap()
}

pub fn fetch_pair(svm: &LiteSVM, pda: &Pubkey) -> my_solana_project::PairConfig {
    let acc = svm.get_account(pda).expect("pair_config not found");
    my_solana_project::PairConfig::try_deserialize(&mut &acc.data[..]).unwrap()
}

/// Build the `initialize` instruction.
pub fn ix_initialize(seed: String, vault: Pubkey, user: Pubkey) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: my_solana_project::accounts::Initialize {
            vault_state: vault,
            user,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: my_solana_project::instruction::Initialize { vault_seed: seed }.data(),
    }
}

pub fn ix_deposit(seed: String, vault: Pubkey, user: Pubkey, amount: u64) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: my_solana_project::accounts::Deposit {
            vault_state: vault,
            user,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: my_solana_project::instruction::Deposit {
            _vault_seed: seed,
            amount,
        }
        .data(),
    }
}

pub fn ix_withdraw(seed: String, vault: Pubkey, admin: Pubkey, amount: u64) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: my_solana_project::accounts::Withdraw {
            vault_state: vault,
            admin,
        }
        .to_account_metas(None),
        data: my_solana_project::instruction::Withdraw {
            vault_seed: seed,
            amount,
        }
        .data(),
    }
}

pub fn ix_set_vault_active(
    seed: String,
    vault: Pubkey,
    admin: Pubkey,
    active: bool,
) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: my_solana_project::accounts::SetVaultActive {
            vault_state: vault,
            admin,
        }
        .to_account_metas(None),
        data: my_solana_project::instruction::SetVaultActive {
            vault_seed: seed,
            active,
        }
        .data(),
    }
}

pub fn ix_add_pair(
    seed: String,
    vault: Pubkey,
    target_mint: Pubkey,
    pair: Pubkey,
    admin: Pubkey,
    max_bps: u16,
) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: my_solana_project::accounts::AddPair {
            vault_state: vault,
            target_mint,
            pair_config: pair,
            admin,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: my_solana_project::instruction::AddPair {
            vault_seed: seed,
            max_bps,
        }
        .data(),
    }
}

pub fn ix_toggle_pair(
    seed: String,
    vault: Pubkey,
    target_mint: Pubkey,
    pair: Pubkey,
    admin: Pubkey,
    enabled: bool,
) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: my_solana_project::accounts::TogglePair {
            vault_state: vault,
            target_mint,
            pair_config: pair,
            admin,
        }
        .to_account_metas(None),
        data: my_solana_project::instruction::TogglePair {
            vault_seed: seed,
            enabled,
        }
        .data(),
    }
}
