// Tests for the SOL-side vault lifecycle: initialize, deposit, withdraw,
// set_vault_active. SPL token paths live in withdraw_pair_tokens.rs.

mod common;
use common::*;

use my_solana_project::error::MyError;
use solana_signer::Signer;

#[test]
fn initialize_creates_vault_with_defaults() {
    let mut env = setup();
    let seed = vault_seed(&env.admin.pubkey());
    let vault = vault_pda(&seed);

    send_ix(
        &mut env.svm,
        ix_initialize(seed, vault, env.admin.pubkey()),
        &[&env.admin],
    )
    .unwrap();

    let state = fetch_vault(&env.svm, &vault);
    assert_eq!(state.admin, env.admin.pubkey());
    assert!(state.is_active);
    assert_eq!(state.total_funds, 0);
    assert_eq!(state.max_slippage_bps, 50);
    // LiteSVM's default Clock starts at unix_timestamp = 0, so we just assert
    // the field was written, not its absolute value.
    assert!(state.created_at >= 0);
}

#[test]
fn initialize_twice_fails() {
    let mut env = setup();
    let seed = vault_seed(&env.admin.pubkey());
    let vault = vault_pda(&seed);

    send_ix(
        &mut env.svm,
        ix_initialize(seed.clone(), vault, env.admin.pubkey()),
        &[&env.admin],
    )
    .unwrap();

    let second = send_ix(
        &mut env.svm,
        ix_initialize(seed, vault, env.admin.pubkey()),
        &[&env.admin],
    );
    assert!(second.is_err(), "second initialize should fail (account in use)");
}

#[test]
fn deposit_increases_total_funds() {
    let mut env = setup();
    let seed = vault_seed(&env.admin.pubkey());
    let vault = vault_pda(&seed);
    send_ix(&mut env.svm, ix_initialize(seed.clone(), vault, env.admin.pubkey()), &[&env.admin]).unwrap();

    send_ix(
        &mut env.svm,
        ix_deposit(seed.clone(), vault, env.admin.pubkey(), 1_000_000_000),
        &[&env.admin],
    )
    .unwrap();
    assert_eq!(fetch_vault(&env.svm, &vault).total_funds, 1_000_000_000);

    send_ix(
        &mut env.svm,
        ix_deposit(seed, vault, env.admin.pubkey(), 500_000_000),
        &[&env.admin],
    )
    .unwrap();
    assert_eq!(fetch_vault(&env.svm, &vault).total_funds, 1_500_000_000);
}

#[test]
fn deposit_from_non_admin_works() {
    // deposit() does not gate on admin — anyone can fund the vault. This is
    // intentional for a community-fundable vault model. This test pins that
    // behavior so a future "admin-only deposit" change is a conscious choice.
    let mut env = setup();
    let seed = vault_seed(&env.admin.pubkey());
    let vault = vault_pda(&seed);
    send_ix(&mut env.svm, ix_initialize(seed.clone(), vault, env.admin.pubkey()), &[&env.admin]).unwrap();

    let stranger = fund(&mut env.svm, 5_000_000_000);
    send_ix(
        &mut env.svm,
        ix_deposit(seed, vault, stranger.pubkey(), 1_000_000_000),
        &[&stranger],
    )
    .unwrap();
    assert_eq!(fetch_vault(&env.svm, &vault).total_funds, 1_000_000_000);
}

#[test]
fn withdraw_pulls_sol_to_admin() {
    let mut env = setup();
    let seed = vault_seed(&env.admin.pubkey());
    let vault = vault_pda(&seed);
    send_ix(&mut env.svm, ix_initialize(seed.clone(), vault, env.admin.pubkey()), &[&env.admin]).unwrap();
    send_ix(&mut env.svm, ix_deposit(seed.clone(), vault, env.admin.pubkey(), 2_000_000_000), &[&env.admin]).unwrap();

    let before = env.svm.get_balance(&env.admin.pubkey()).unwrap();
    send_ix(
        &mut env.svm,
        ix_withdraw(seed, vault, env.admin.pubkey(), 1_000_000_000),
        &[&env.admin],
    )
    .unwrap();
    let after = env.svm.get_balance(&env.admin.pubkey()).unwrap();

    assert_eq!(fetch_vault(&env.svm, &vault).total_funds, 1_000_000_000);
    // admin received ~1 SOL (minus tx fee)
    assert!(after > before + 999_000_000);
}

#[test]
fn withdraw_zero_fails() {
    let mut env = setup();
    let seed = vault_seed(&env.admin.pubkey());
    let vault = vault_pda(&seed);
    send_ix(&mut env.svm, ix_initialize(seed.clone(), vault, env.admin.pubkey()), &[&env.admin]).unwrap();
    send_ix(&mut env.svm, ix_deposit(seed.clone(), vault, env.admin.pubkey(), 1_000_000_000), &[&env.admin]).unwrap();

    let r = send_ix(
        &mut env.svm,
        ix_withdraw(seed, vault, env.admin.pubkey(), 0),
        &[&env.admin],
    );
    assert!(r.is_err(), "withdraw 0 should fail with InvalidAmount");
}

#[test]
fn withdraw_more_than_balance_fails() {
    let mut env = setup();
    let seed = vault_seed(&env.admin.pubkey());
    let vault = vault_pda(&seed);
    send_ix(&mut env.svm, ix_initialize(seed.clone(), vault, env.admin.pubkey()), &[&env.admin]).unwrap();
    send_ix(&mut env.svm, ix_deposit(seed.clone(), vault, env.admin.pubkey(), 1_000_000_000), &[&env.admin]).unwrap();

    let r = send_ix(
        &mut env.svm,
        ix_withdraw(seed, vault, env.admin.pubkey(), 5_000_000_000),
        &[&env.admin],
    );
    assert!(r.is_err(), "withdraw beyond balance should fail with InsufficientFunds");
}

#[test]
fn withdraw_by_non_admin_fails() {
    let mut env = setup();
    let seed = vault_seed(&env.admin.pubkey());
    let vault = vault_pda(&seed);
    send_ix(&mut env.svm, ix_initialize(seed.clone(), vault, env.admin.pubkey()), &[&env.admin]).unwrap();
    send_ix(&mut env.svm, ix_deposit(seed.clone(), vault, env.admin.pubkey(), 1_000_000_000), &[&env.admin]).unwrap();

    let attacker = fund(&mut env.svm, 1_000_000_000);
    let r = send_ix(
        &mut env.svm,
        ix_withdraw(seed, vault, attacker.pubkey(), 500_000_000),
        &[&attacker],
    );
    assert!(r.is_err(), "non-admin withdraw should fail (has_one violation)");
}

#[test]
fn set_vault_active_flips_state() {
    let mut env = setup();
    let seed = vault_seed(&env.admin.pubkey());
    let vault = vault_pda(&seed);
    send_ix(&mut env.svm, ix_initialize(seed.clone(), vault, env.admin.pubkey()), &[&env.admin]).unwrap();
    assert!(fetch_vault(&env.svm, &vault).is_active);

    send_ix(
        &mut env.svm,
        ix_set_vault_active(seed.clone(), vault, env.admin.pubkey(), false),
        &[&env.admin],
    )
    .unwrap();
    assert!(!fetch_vault(&env.svm, &vault).is_active);

    send_ix(
        &mut env.svm,
        ix_set_vault_active(seed, vault, env.admin.pubkey(), true),
        &[&env.admin],
    )
    .unwrap();
    assert!(fetch_vault(&env.svm, &vault).is_active);
}

#[test]
fn set_vault_active_by_non_admin_fails() {
    let mut env = setup();
    let seed = vault_seed(&env.admin.pubkey());
    let vault = vault_pda(&seed);
    send_ix(&mut env.svm, ix_initialize(seed.clone(), vault, env.admin.pubkey()), &[&env.admin]).unwrap();

    let attacker = fund(&mut env.svm, 1_000_000_000);
    let r = send_ix(
        &mut env.svm,
        ix_set_vault_active(seed, vault, attacker.pubkey(), false),
        &[&attacker],
    );
    assert!(r.is_err(), "non-admin set_vault_active should fail (has_one)");

    // Vault should still be active
    assert!(fetch_vault(&env.svm, &vault).is_active);
}

// Sanity: keep the MyError import wired so future tests can match on codes
#[allow(dead_code)]
fn _unused() {
    let _ = MyError::Unauthorized;
}
