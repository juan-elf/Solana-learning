# Solana Vault Development Log

## Project Overview
Project: Solana Vault
Goal: Implement a secure vault for depositing and withdrawing SOL using Anchor Framework.
Network: Solana Devnet
Program ID: `FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX`

---

## Implementation Journey

### 1. Environment Setup
- **Rust**: Installed via rustup (v1.94.1).
- **Solana CLI**: Faced SSL errors with `release.solana.com`. Resolved by switching to `release.anza.xyz`.
- **Anchor**: Installed via AVM, target version `1.0.0`.

### 2. Program Development
- **State Model**: Created `VaultState` to store `admin`, `total_funds`, `bump`, `is_active`, `created_at`, `max_slippage_bps`.
- **Instructions**:
    - `initialize`: PDA derivation dengan seeds `[b"vault", vault_seed]`.
    - `deposit`: Transfer SOL dari user ke PDA Vault via CPI.
    - `withdraw`: PDA signing untuk withdraw, restricted ke `admin` via `has_one`.
    - `swap`: Stub Jupiter CPI dengan slippage check dan seeds constraint.
    - `read_pool`: Read data Orca Whirlpool pool dengan ownership validation.

### 3. Technical Challenges & Fixes

#### Sesi 1 — Initial Build
- **Borrow Checker**: Solved "mutable vs immutable borrow" conflict di `withdraw.rs` dengan reordering account access.
- **CpiContext**: Fixed `mismatched types` error dengan `system_program::transfer` dan `CpiContext::new`.
- **Ownership Check**: Implementasi `has_one = admin` untuk mencegah unauthorized withdrawals.
- **Program Identity**: Generated keypair baru untuk program, update `declare_id!`.
- **Infrastructure**: Solved `localnet` connection errors dengan update `Anchor.toml` ke `devnet`.

#### Sesi 2 — Code Review & Hardening
- **`lib.rs`**: Tambah `pub mod state;` yang hilang; hapus `pub mod swap;` yang salah path (swap ada di dalam `instructions/`); expose instruksi `swap` dan `read_pool` ke `#[program]` block.
- **`instructions.rs`**: Tambah deklarasi `pub mod read_pool;` dan `pub mod swap;`.
- **`deposit.rs` & `withdraw.rs`**: Update `CpiContext::new` / `CpiContext::new_with_signer` menggunakan `System::id()` (Anchor v1 menerima `Pubkey`, bukan `AccountInfo`). Ganti `.unwrap()` pada `checked_add`/`checked_sub` dengan `ok_or(error!(MyError::ArithmeticOverflow))`.
- **`swap.rs`**: Hapus `remaining_accounts` dari struct `#[derive(Accounts)]` — diakses via `ctx.remaining_accounts`. Ganti `jupiter_program` dari tipe invalid ke `UncheckedAccount`. Tambah seeds constraint + `has_one = admin`. Fix error types ke custom errors.
- **`read_pool.rs`**: Tambah ownership check (validasi akun dimiliki Whirlpool program ID sebelum parsing). Ganti `AccountInfo` ke `UncheckedAccount`. Ganti `.expect()` ke `.map_err(|_| error!(...))` untuk mencegah panic on-chain.
- **`error.rs`**: Tambah error variants: `VaultNotActive`, `InvalidAmount`, `ArithmeticOverflow`, `SlippageExceeded`, `InvalidAccountData`.
- **`Cargo.toml` (workspace)**: Hapus `[dependencies]` dan `[dependencies.whirlpool-cpi]` yang konflik dengan deps di program crate (`anchor-lang = "1.0.0"`).
- **`Anchor.toml`**: Tambah `anchor_version = "1.0.0"`, fix test script dari `cargo test` ke `yarn ts-mocha`, tambah `[programs.localnet]`, ubah cluster ke `localnet` untuk testing.
- **`package.json`**: Hapus `@coral-xyz/anchor` (package Anchor 0.x); standardize ke `@anchor-lang/core ^1.0.0` sesuai Anchor v1.
- **`vault_test.ts`**: Update import ke `@anchor-lang/core`. Fix error assertion dari `"ConstraintRaw"` ke `"ConstraintHasOne"` (sesuai Anchor v1).
- **`jupiter_bot.ts`**: Fix ketiga address yang rusak (SOL mint, USDC mint, Jupiter program ID). Ganti `Transaction` ke `VersionedTransaction` (Jupiter API v6 mengembalikan versioned transaction). Update import ke `@anchor-lang/core`.

### 4. Testing & Deployment
- **Local Tests**: Wrote comprehensive TypeScript tests in `tests/vault_test.ts`.
- **Deployment**: Successfully deployed to Solana Devnet after resolving airdrop rate limits via web faucets.

---

## Stack

| Layer | Tool |
|---|---|
| Language | Rust (edition 2021) |
| Framework | Anchor v1.0.0 |
| Solana CLI | 3.x (Agave) |
| JS Client | `@anchor-lang/core ^1.0.0` |
| Test Runner | ts-mocha via `anchor test` |
| Local Network | Localnet / Surfpool |
| Jupiter | API v6 (`quote-api.jup.ag/v6`) |
| Whirlpool | Orca Whirlpool (`whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc`) |

---

## Status

- [x] Rust, Solana CLI, Anchor Installation
- [x] Program Logic Implementation (Init, Deposit, Withdraw)
- [x] Security Ownership Checks (`has_one`, seeds constraint)
- [x] Arithmetic Safety (`checked_add`, `checked_sub`, custom errors)
- [x] Successful Build (Cargo/Anchor)
- [x] Successful Deployment to Devnet
- [x] Anchor v1 migration (CpiContext, package rename, test script)
- [ ] Jupiter CPI full implementation (swap masih stub)
- [ ] LiteSVM unit tests (Rust)
- [ ] Whirlpool devnet integration test
