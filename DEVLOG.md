# 🚀 Solana Vault Development Log

## 📅 Project Overview
Project: Solana Vault
Goal: Implement a secure vault for depositing and withdrawing SOL using Anchor Framework.
Network: Solana Devnet
Program ID: `FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX`

## 🛠️ Implementation Journey

### 1. Environment Setup
- **Rust**: Installed via rustup (v1.94.1).
- **Solana CLI**: Faced SSL errors with `release.solana.com`. Resolved by switching to `release.anza.xyz`.
- **Anchor**: Installed via AVM.

### 2. Program Development
- **State Model**: Created `VaultState` to store `admin`, `total_funds`, and `bump`.
- **Instructions**:
    - `initialize`: Implemented PDA derivation using seeds `[b"vault", vault_seed]`.
    - `deposit`: Implemented SOL transfer from user to PDA Vault.
    - `withdraw`: Implemented PDA signing for secure withdrawals, restricted to the `admin`.

### 3. Technical Challenges & Fixes
- **Borrow Checker**: Solved "mutable vs immutable borrow" conflict in `withdraw.rs` by reordering account access.
- **CpiContext**: Fixed `mismatched types` error by correctly using `system_program::transfer` and `CpiContext::new` with the correct arguments.
- **Ownership Check**: Implemented `has_one = admin` to prevent unauthorized withdrawals.
- **Program Identity**: Discovered that the program was using the wallet's keypair. Generated a new unique keypair for the program and updated `declare_id!`.
- **Infrastructure**: Solved `localnet` connection errors by updating `Anchor.toml` to target `devnet`.

### 4. Testing & Deployment
- **Local Tests**: Wrote comprehensive TypeScript tests in `tests/vault_test.ts`.
- **Deployment**: Successfully deployed to Solana Devnet after resolving airdrop rate limits via web faucets.

## ✅ Final Status
- [x] Rust, Solana CLI, Anchor Installation
- [x] Program Logic Implementation (Init, Deposit, Withdraw)
- [x] Security Ownership Checks
- [x] Successful Build (Cargo/Anchor)
- [x] Successful Deployment to Devnet
