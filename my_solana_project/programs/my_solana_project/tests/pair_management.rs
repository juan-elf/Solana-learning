// Tests for add_pair and toggle_pair: PDA creation, max_bps validation,
// admin guard, and the vault-active constraint that gates add_pair.

mod common;
use common::*;

use solana_keypair::Keypair;
use solana_signer::Signer;

// Use a deterministic random Pubkey as the "target_mint" — add_pair stores
// target_mint as UncheckedAccount, so the mint doesn't need to be a real Mint
// for the on-chain logic. We only need it as a seed for the pair_config PDA.
fn fake_mint() -> anchor_lang::prelude::Pubkey {
    Keypair::new().pubkey()
}

fn fresh_vault() -> (TestEnv, String, anchor_lang::prelude::Pubkey) {
    let mut env = setup();
    let seed = vault_seed(&env.admin.pubkey());
    let vault = vault_pda(&seed);
    send_ix(
        &mut env.svm,
        ix_initialize(seed.clone(), vault, env.admin.pubkey()),
        &[&env.admin],
    )
    .unwrap();
    (env, seed, vault)
}

#[test]
fn add_pair_creates_pair_config_with_defaults() {
    let (mut env, seed, vault) = fresh_vault();
    let mint = fake_mint();
    let pair = pair_pda(&vault, &mint);

    send_ix(
        &mut env.svm,
        ix_add_pair(seed, vault, mint, pair, env.admin.pubkey(), 3_000),
        &[&env.admin],
    )
    .unwrap();

    let p = fetch_pair(&env.svm, &pair);
    assert_eq!(p.target_mint, mint);
    assert!(p.is_active);
    assert_eq!(p.max_bps, 3_000);
    assert_eq!(p.total_swapped, 0);
    assert_eq!(p.swap_count, 0);
    assert_eq!(p.last_swapped_at, 0);
}

#[test]
fn add_pair_rejects_zero_max_bps() {
    let (mut env, seed, vault) = fresh_vault();
    let mint = fake_mint();
    let pair = pair_pda(&vault, &mint);

    let r = send_ix(
        &mut env.svm,
        ix_add_pair(seed, vault, mint, pair, env.admin.pubkey(), 0),
        &[&env.admin],
    );
    assert!(r.is_err(), "max_bps=0 should fail (is_valid_bps requires > 0)");
}

#[test]
fn add_pair_rejects_max_bps_above_10000() {
    let (mut env, seed, vault) = fresh_vault();
    let mint = fake_mint();
    let pair = pair_pda(&vault, &mint);

    let r = send_ix(
        &mut env.svm,
        ix_add_pair(seed, vault, mint, pair, env.admin.pubkey(), 10_001),
        &[&env.admin],
    );
    assert!(r.is_err(), "max_bps>10000 should fail (>100% allocation)");
}

#[test]
fn add_pair_at_max_bps_10000_succeeds() {
    // 10000 = 100% allocation — edge of the valid range, should be allowed.
    let (mut env, seed, vault) = fresh_vault();
    let mint = fake_mint();
    let pair = pair_pda(&vault, &mint);

    send_ix(
        &mut env.svm,
        ix_add_pair(seed, vault, mint, pair, env.admin.pubkey(), 10_000),
        &[&env.admin],
    )
    .unwrap();
    assert_eq!(fetch_pair(&env.svm, &pair).max_bps, 10_000);
}

#[test]
fn add_pair_by_non_admin_fails() {
    let (mut env, seed, vault) = fresh_vault();
    let mint = fake_mint();
    let pair = pair_pda(&vault, &mint);

    let attacker = fund(&mut env.svm, 5_000_000_000);
    let r = send_ix(
        &mut env.svm,
        ix_add_pair(seed, vault, mint, pair, attacker.pubkey(), 5_000),
        &[&attacker],
    );
    assert!(r.is_err(), "non-admin add_pair should fail (has_one violation)");
}

#[test]
fn add_pair_duplicate_fails() {
    let (mut env, seed, vault) = fresh_vault();
    let mint = fake_mint();
    let pair = pair_pda(&vault, &mint);

    send_ix(
        &mut env.svm,
        ix_add_pair(seed.clone(), vault, mint, pair, env.admin.pubkey(), 5_000),
        &[&env.admin],
    )
    .unwrap();

    let second = send_ix(
        &mut env.svm,
        ix_add_pair(seed, vault, mint, pair, env.admin.pubkey(), 5_000),
        &[&env.admin],
    );
    assert!(second.is_err(), "duplicate add_pair should fail (init constraint)");
}

#[test]
fn add_pair_blocked_when_vault_paused() {
    // The Accounts struct on add_pair has `constraint = vault_state.is_active`
    // — so if the admin pauses the vault, no further pairs can be registered.
    let (mut env, seed, vault) = fresh_vault();
    send_ix(
        &mut env.svm,
        ix_set_vault_active(seed.clone(), vault, env.admin.pubkey(), false),
        &[&env.admin],
    )
    .unwrap();

    let mint = fake_mint();
    let pair = pair_pda(&vault, &mint);
    let r = send_ix(
        &mut env.svm,
        ix_add_pair(seed, vault, mint, pair, env.admin.pubkey(), 5_000),
        &[&env.admin],
    );
    assert!(r.is_err(), "add_pair on paused vault should fail (VaultNotActive)");
}

#[test]
fn toggle_pair_flips_is_active() {
    let (mut env, seed, vault) = fresh_vault();
    let mint = fake_mint();
    let pair = pair_pda(&vault, &mint);
    send_ix(
        &mut env.svm,
        ix_add_pair(seed.clone(), vault, mint, pair, env.admin.pubkey(), 5_000),
        &[&env.admin],
    )
    .unwrap();
    assert!(fetch_pair(&env.svm, &pair).is_active);

    send_ix(
        &mut env.svm,
        ix_toggle_pair(seed.clone(), vault, mint, pair, env.admin.pubkey(), false),
        &[&env.admin],
    )
    .unwrap();
    assert!(!fetch_pair(&env.svm, &pair).is_active);

    send_ix(
        &mut env.svm,
        ix_toggle_pair(seed, vault, mint, pair, env.admin.pubkey(), true),
        &[&env.admin],
    )
    .unwrap();
    assert!(fetch_pair(&env.svm, &pair).is_active);
}

#[test]
fn toggle_pair_by_non_admin_fails() {
    let (mut env, seed, vault) = fresh_vault();
    let mint = fake_mint();
    let pair = pair_pda(&vault, &mint);
    send_ix(
        &mut env.svm,
        ix_add_pair(seed.clone(), vault, mint, pair, env.admin.pubkey(), 5_000),
        &[&env.admin],
    )
    .unwrap();

    let attacker = fund(&mut env.svm, 1_000_000_000);
    let r = send_ix(
        &mut env.svm,
        ix_toggle_pair(seed, vault, mint, pair, attacker.pubkey(), false),
        &[&attacker],
    );
    assert!(r.is_err(), "non-admin toggle_pair should fail (has_one violation)");
    assert!(fetch_pair(&env.svm, &pair).is_active, "pair must remain active");
}
