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

#### Sesi 3 — Multi-Pair Smart Swap Vault + Signal Bot

**Arsitektur baru: signal-based swap vault**
- Base token: SOL
- Target pairs: JUP, MET, BONK, WIF (pump.fun token dihindari — terlalu volatile)
- Signal: EMA 9/21 cross + RSI < 65 via Pyth price feed
- Execution: CPI ke Jupiter v6 dari vault PDA

**State baru — `PairConfig` (64 bytes)**
- PDA seeds: `[b"pair_config", vault_state.key(), target_mint.key()]`
- Fields: `target_mint`, `is_active`, `max_bps`, `total_swapped`, `swap_count`, `last_swapped_at`, `bump`
- `max_bps`: batas alokasi per pair dari vault (basis points, maks 10000 = 100%)

**Instruksi baru**
- `add_pair`: Admin mendaftarkan trading pair baru + set max_bps alokasi
- `toggle_pair`: Admin pause/resume pair tanpa hapus config
- `execute_swap`: Jupiter CPI inti — validasi max_bps, signing PDA vault, forward `remaining_accounts` ke Jupiter, update state

**`execute_swap.rs` — Jupiter CPI via `invoke_signed`**
- Vault PDA bertindak sebagai signer untuk melepas SOL ke Jupiter
- `remaining_accounts` di-forward dinamis ke Jupiter instruction
- Cek `amount_in <= max_bps * total_funds / 10000` on-chain sebelum swap
- Update `total_swapped`, `swap_count`, `last_swapped_at` setelah swap berhasil

**`signal_bot.ts` — off-chain trading bot (private, tidak di-deploy)**
- Pyth price feed: SOL, JUP, MET, BONK, WIF (polling 60 detik)
- EMA 9/21 + RSI 14 dihitung dari price history (max 100 data points)
- BUY signal = EMA9 > EMA21 AND RSI < 65
- Fetch Jupiter `/v6/quote` → build swap tx → simulasi → panggil `execute_swap`
- Hitung amount dari `pairConfig.maxBps * vaultState.totalFunds / 10000`

**Bug fix: `withdraw.rs`**
- Problem: system program `transfer` gagal dengan "from must not carry data" karena vault PDA menyimpan data
- Fix: ganti ke direct lamport manipulation (`try_borrow_mut_lamports`) — pattern standar untuk PDA berdata

**Fix ambiguous glob re-exports (`lib.rs` + `instructions.rs`)**
- Anchor `#[program]` macro butuh `__client_accounts_*` types di crate root via glob re-export
- Solusi: tetap glob re-export, tambah `#[allow(ambiguous_glob_reexports)]` per import

**Deploy & Test**
- Build clean: 0 errors, 0 warnings setelah fixes
- Program di-upgrade ke devnet (binary baru 257KB vs lama 170KB — perlu `solana program extend` +90000 bytes terlebih dahulu)
- 4/4 test passing di devnet:
  - Initialize vault ✔
  - Deposit SOL ✔
  - Withdraw SOL (lamport manipulation) ✔
  - Non-admin withdraw ditolak (ConstraintHasOne) ✔
- Test suite: vault seed unik per run (timestamp-based), attacker funded dari provider wallet (bukan devnet airdrop yang rate-limited)

---

#### Sesi 4 — Frontend Web (Next.js + Vercel)

**Stack frontend**
- Next.js 16.2 (App Router, Turbopack)
- Tailwind CSS — dark theme (slate-950)
- `@solana/wallet-adapter-react` — Phantom & Solflare support
- `@anchor-lang/core` — program interaction dari browser
- Deploy target: Vercel

**Komponen yang dibangun**
- `WalletProvider.tsx` — ConnectionProvider + WalletModalProvider
- `Header.tsx` — logo, Devnet badge, wallet connect button
- `VaultCard.tsx` — tampil balance vault, status, admin info; tombol Initialize jika vault belum ada
- `DepositWithdraw.tsx` — tab deposit/withdraw, input SOL, kirim transaksi
- `PairsTable.tsx` — tabel pair (symbol, max%, total swapped, swap count, last swap, status toggle)
- `AddPairModal.tsx` — modal admin untuk daftarkan pair baru + set max alokasi (%)
- `lib/program.ts` — `BrowserWallet` adapter interface, `getProgram()`, PDA helpers
- `lib/idl.ts` — IDL program untuk Anchor client

**Flow UI**
1. Wallet belum connect → tampil placeholder "Connect wallet"
2. Wallet connect, vault belum ada → tombol "Initialize Vault"
3. Vault ada → tampil balance, status, grid pair
4. Connected wallet = admin → tombol toggle pair + Add Pair aktif
5. Non-admin → read-only view

**Teknikal**
- `BrowserWallet` interface custom untuk bridge `WalletContextState` (wallet-adapter) ke `anchor.Wallet` (AnchorProvider)
- `IDL as unknown as anchor.Idl` — bypass TypeScript readonly conflict pada const IDL object
- `turbopack: {}` di `next.config.ts` — Next.js 16 default Turbopack, webpack config tidak kompatibel
- `.env.local`: `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_VAULT_SEED` — configurable untuk prod
- Build: `✓ Compiled successfully` — 0 errors, 0 type errors

---

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
| On-chain Client | `@anchor-lang/core ^1.0.0` |
| Frontend | Next.js 16 + Tailwind CSS |
| Wallet | `@solana/wallet-adapter-react` (Phantom, Solflare) |
| Test Runner | ts-mocha (devnet) |
| Price Oracle | Pyth Network (`@pythnetwork/pyth-solana-receiver`) |
| Swap Aggregator | Jupiter v6 (`quote-api.jup.ag/v6`) |
| Signal Engine | EMA 9/21 + RSI 14 (off-chain, `signal_bot.ts`) |
| Hosting | Vercel (frontend) |

---

## Status

- [x] Rust, Solana CLI, Anchor Installation
- [x] Program Logic Implementation (Init, Deposit, Withdraw)
- [x] Security Ownership Checks (`has_one`, seeds constraint)
- [x] Arithmetic Safety (`checked_add`, `checked_sub`, custom errors)
- [x] Successful Build (Cargo/Anchor) — 0 errors, 0 warnings
- [x] Successful Deployment to Devnet (v2 — 257KB, extended +90KB)
- [x] Anchor v1 migration (CpiContext, package rename, test script)
- [x] Multi-pair vault (`PairConfig` PDA, `add_pair`, `toggle_pair`)
- [x] Jupiter CPI via `invoke_signed` + PDA signer (`execute_swap`)
- [x] Signal bot: Pyth + EMA 9/21 + RSI (off-chain, private)
- [x] Withdraw fix: direct lamport manipulation untuk PDA berdata
- [x] 4/4 integration tests passing di devnet
- [x] Frontend web (Next.js 16 + wallet connect) — selesai, siap Vercel
- [ ] LiteSVM unit tests (Rust)
- [ ] Meteora DLMM integration (Phase 2)
