// Tests for withdraw_pair_tokens — moves accumulated SPL tokens from the
// vault's ATA back to the admin's ATA. Vault PDA signs the token::transfer
// CPI as authority. Covers happy path, zero/over-balance amounts, and
// has_one admin guard.

mod common;
use common::*;

use anchor_lang::{InstructionData, ToAccountMetas};
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::instruction::Instruction;
use solana_keypair::Keypair;
use solana_signer::Signer;
use spl_associated_token_account_client::address::get_associated_token_address_with_program_id;
use spl_associated_token_account_client::instruction::create_associated_token_account;
use spl_token::instruction as token_ix;
use spl_token::solana_program::program_pack::Pack;
use spl_token::state::{Account as TokenAccountState, Mint as MintState};

const MINT_DECIMALS: u8 = 6;

/// spl-token uses an older solana-pubkey crate version than anchor-lang.
/// Re-wrap any Pubkey crossing that boundary.
fn to_anchor_pk(p: spl_token::solana_program::pubkey::Pubkey) -> Pubkey {
    Pubkey::new_from_array(p.to_bytes())
}

fn to_token_pk(p: Pubkey) -> spl_token::solana_program::pubkey::Pubkey {
    spl_token::solana_program::pubkey::Pubkey::new_from_array(p.to_bytes())
}

/// Create a fresh SPL mint where `authority` is mint+freeze authority.
fn create_mint(env: &mut TestEnv, authority: &Keypair) -> Pubkey {
    let mint = Keypair::new();
    let rent = env.svm.minimum_balance_for_rent_exemption(MintState::LEN);
    let create_ix = anchor_lang::solana_program::system_instruction::create_account(
        &authority.pubkey(),
        &mint.pubkey(),
        rent,
        MintState::LEN as u64,
        &to_anchor_pk(spl_token::ID),
    );
    let init_ix_t = token_ix::initialize_mint(
        &spl_token::ID,
        &to_token_pk(mint.pubkey()),
        &to_token_pk(authority.pubkey()),
        Some(&to_token_pk(authority.pubkey())),
        MINT_DECIMALS,
    )
    .unwrap();
    let init_ix = Instruction {
        program_id: to_anchor_pk(init_ix_t.program_id),
        accounts: init_ix_t
            .accounts
            .into_iter()
            .map(|m| anchor_lang::solana_program::instruction::AccountMeta {
                pubkey: to_anchor_pk(m.pubkey),
                is_signer: m.is_signer,
                is_writable: m.is_writable,
            })
            .collect(),
        data: init_ix_t.data,
    };

    let blockhash = env.svm.latest_blockhash();
    let msg = solana_message::Message::new_with_blockhash(
        &[create_ix, init_ix],
        Some(&authority.pubkey()),
        &blockhash,
    );
    let tx = solana_transaction::Transaction::new(&[authority, &mint], msg, blockhash);
    env.svm.send_transaction(tx).unwrap();
    mint.pubkey()
}

fn create_ata(env: &mut TestEnv, payer: &Keypair, owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    let ata_t = get_associated_token_address_with_program_id(
        &to_token_pk(*owner),
        &to_token_pk(*mint),
        &spl_token::ID,
    );
    let ix_t = create_associated_token_account(
        &to_token_pk(payer.pubkey()),
        &to_token_pk(*owner),
        &to_token_pk(*mint),
        &spl_token::ID,
    );
    let ix = Instruction {
        program_id: to_anchor_pk(ix_t.program_id),
        accounts: ix_t
            .accounts
            .into_iter()
            .map(|m| anchor_lang::solana_program::instruction::AccountMeta {
                pubkey: to_anchor_pk(m.pubkey),
                is_signer: m.is_signer,
                is_writable: m.is_writable,
            })
            .collect(),
        data: ix_t.data,
    };
    send_ix(&mut env.svm, ix, &[payer]).unwrap();
    to_anchor_pk(ata_t)
}

fn mint_to(env: &mut TestEnv, mint: &Pubkey, dest: &Pubkey, authority: &Keypair, amount: u64) {
    let ix_t = token_ix::mint_to(
        &spl_token::ID,
        &to_token_pk(*mint),
        &to_token_pk(*dest),
        &to_token_pk(authority.pubkey()),
        &[],
        amount,
    )
    .unwrap();
    let ix = Instruction {
        program_id: to_anchor_pk(ix_t.program_id),
        accounts: ix_t
            .accounts
            .into_iter()
            .map(|m| anchor_lang::solana_program::instruction::AccountMeta {
                pubkey: to_anchor_pk(m.pubkey),
                is_signer: m.is_signer,
                is_writable: m.is_writable,
            })
            .collect(),
        data: ix_t.data,
    };
    send_ix(&mut env.svm, ix, &[authority]).unwrap();
}

fn token_balance(env: &TestEnv, ata: &Pubkey) -> u64 {
    let acc = env.svm.get_account(ata).expect("ATA not found");
    TokenAccountState::unpack(&acc.data).unwrap().amount
}

/// Build the `withdraw_pair_tokens` ix. Defined here (not common.rs) since
/// it's the only test file using SPL types.
fn ix_withdraw_pair_tokens(
    seed: String,
    vault: Pubkey,
    target_mint: Pubkey,
    pair: Pubkey,
    vault_ata: Pubkey,
    admin_ata: Pubkey,
    admin: Pubkey,
    amount: u64,
) -> Instruction {
    Instruction {
        program_id: my_solana_project::ID,
        accounts: my_solana_project::accounts::WithdrawPairTokens {
            vault_state: vault,
            target_mint,
            pair_config: pair,
            vault_token_account: vault_ata,
            admin_token_account: admin_ata,
            admin,
            token_program: to_anchor_pk(spl_token::ID),
        }
        .to_account_metas(None),
        data: my_solana_project::instruction::WithdrawPairTokens {
            vault_seed: seed,
            amount,
        }
        .data(),
    }
}

/// Setup: vault initialized, pair registered, mint created, vault ATA funded
/// with `vault_amount`, admin ATA created (empty).
struct Scenario {
    env: TestEnv,
    seed: String,
    vault: Pubkey,
    mint: Pubkey,
    pair: Pubkey,
    vault_ata: Pubkey,
    admin_ata: Pubkey,
}

fn setup_scenario(vault_amount: u64) -> Scenario {
    let mut env = setup();
    let seed = vault_seed(&env.admin.pubkey());
    let vault = vault_pda(&seed);
    send_ix(
        &mut env.svm,
        ix_initialize(seed.clone(), vault, env.admin.pubkey()),
        &[&env.admin],
    )
    .unwrap();

    // Mint authority is admin (just for test convenience — not the on-chain authority for vault)
    let admin_kp = env.admin.insecure_clone();
    let mint = create_mint(&mut env, &admin_kp);
    let pair = pair_pda(&vault, &mint);
    send_ix(
        &mut env.svm,
        ix_add_pair(seed.clone(), vault, mint, pair, env.admin.pubkey(), 5_000),
        &[&env.admin],
    )
    .unwrap();

    let admin_pk = env.admin.pubkey();
    let vault_ata = create_ata(&mut env, &admin_kp, &vault, &mint);
    let admin_ata = create_ata(&mut env, &admin_kp, &admin_pk, &mint);
    if vault_amount > 0 {
        mint_to(&mut env, &mint, &vault_ata, &admin_kp, vault_amount);
    }

    Scenario { env, seed, vault, mint, pair, vault_ata, admin_ata }
}

#[test]
fn withdraw_pair_tokens_transfers_to_admin_ata() {
    let mut s = setup_scenario(100_000_000); // 100 tokens with 6 decimals

    let amount = 60_000_000u64; // 60 tokens
    send_ix(
        &mut s.env.svm,
        ix_withdraw_pair_tokens(
            s.seed,
            s.vault,
            s.mint,
            s.pair,
            s.vault_ata,
            s.admin_ata,
            s.env.admin.pubkey(),
            amount,
        ),
        &[&s.env.admin],
    )
    .unwrap();

    assert_eq!(token_balance(&s.env, &s.vault_ata), 40_000_000);
    assert_eq!(token_balance(&s.env, &s.admin_ata), 60_000_000);
}

#[test]
fn withdraw_pair_tokens_zero_fails() {
    let mut s = setup_scenario(100_000_000);
    let r = send_ix(
        &mut s.env.svm,
        ix_withdraw_pair_tokens(
            s.seed,
            s.vault,
            s.mint,
            s.pair,
            s.vault_ata,
            s.admin_ata,
            s.env.admin.pubkey(),
            0,
        ),
        &[&s.env.admin],
    );
    assert!(r.is_err(), "withdraw 0 tokens should fail with InvalidAmount");
}

#[test]
fn withdraw_pair_tokens_more_than_balance_fails() {
    let mut s = setup_scenario(100_000_000);
    let r = send_ix(
        &mut s.env.svm,
        ix_withdraw_pair_tokens(
            s.seed,
            s.vault,
            s.mint,
            s.pair,
            s.vault_ata,
            s.admin_ata,
            s.env.admin.pubkey(),
            500_000_000,
        ),
        &[&s.env.admin],
    );
    assert!(r.is_err(), "withdraw beyond balance should fail with InsufficientFunds");
    // No partial transfer
    assert_eq!(token_balance(&s.env, &s.vault_ata), 100_000_000);
    assert_eq!(token_balance(&s.env, &s.admin_ata), 0);
}

#[test]
fn withdraw_pair_tokens_by_non_admin_fails() {
    let mut s = setup_scenario(100_000_000);
    let attacker = fund(&mut s.env.svm, 1_000_000_000);
    // Give the attacker their own ATA so we can prove they don't get tokens
    let attacker_ata = create_ata(&mut s.env, &attacker, &attacker.pubkey(), &s.mint);

    let r = send_ix(
        &mut s.env.svm,
        ix_withdraw_pair_tokens(
            s.seed,
            s.vault,
            s.mint,
            s.pair,
            s.vault_ata,
            attacker_ata,
            attacker.pubkey(),
            10_000_000,
        ),
        &[&attacker],
    );
    assert!(r.is_err(), "non-admin withdraw should fail (has_one violation)");
    assert_eq!(token_balance(&s.env, &s.vault_ata), 100_000_000);
    assert_eq!(token_balance(&s.env, &attacker_ata), 0);
}

#[test]
fn withdraw_pair_tokens_works_when_vault_paused() {
    // withdraw_pair_tokens does NOT carry the `is_active` constraint on the
    // vault. Intentional: admin must always be able to recover funds even
    // when the vault is paused for emergency reasons. This test pins that.
    let mut s = setup_scenario(100_000_000);
    send_ix(
        &mut s.env.svm,
        ix_set_vault_active(s.seed.clone(), s.vault, s.env.admin.pubkey(), false),
        &[&s.env.admin],
    )
    .unwrap();

    send_ix(
        &mut s.env.svm,
        ix_withdraw_pair_tokens(
            s.seed,
            s.vault,
            s.mint,
            s.pair,
            s.vault_ata,
            s.admin_ata,
            s.env.admin.pubkey(),
            25_000_000,
        ),
        &[&s.env.admin],
    )
    .unwrap();
    assert_eq!(token_balance(&s.env, &s.admin_ata), 25_000_000);
}
