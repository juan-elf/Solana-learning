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

#### Sesi 4 — Frontend Debug Marathon (Vercel + camelCase + invalid mint)

Setelah deploy ke Vercel, vault muncul "Paused", balance 0.0000 SOL, Max Slippage NaN%, deposit/withdraw/add-pair tidak ada respon. Investigasi ketemu 3 bug berlapis:

**Bug 1: Vault lama 49 bytes, tidak kompatibel struct baru (60 bytes)**
- Commit awal (`2a1e135`) struct `VaultState` cuma `admin + total_funds + bump` (49 bytes). Commit `75e8a54` ekspansi jadi 60 bytes (`+ is_active + created_at + max_slippage_bps`).
- Akun vault lama di devnet (seed `my_test_vault`) masih 49 bytes → program sekarang gagal deserialize, frontend baca byte offset 49 (is_active) → out of bounds → undefined → render "Paused".
- Fix: sudah dibereskan di commit `b38aa31` dengan per-wallet seed (`vault_${pubkey.slice(0,8)}`) — vault lama ditinggalkan, user initialize vault baru 60-byte yang valid.

**Bug 2: `@anchor-lang/core` v1 semuanya camelCase, bukan snake_case**
- Asumsi sebelumnya salah. `Program` constructor jalanin `convertIdlToCamelCase(idl)` internal, jadi semua nama yang reachable via `program.account.*`, `program.methods.*`, `.accounts({...})`, dan field hasil decode itu **camelCase** — walau IDL asli pakai snake_case.
- Verifikasi langsung decode dari devnet account `6RcMW8s...`:
  ```
  Decoded keys: admin, totalFunds, bump, isActive, createdAt, maxSlippageBps
  acc.total_funds  → undefined
  acc.totalFunds   → 19000000 ✓
  ```
- Dampak: seluruh field multi-kata (`total_funds`, `is_active`, `max_slippage_bps`, `total_swapped`, `swap_count`, `last_swapped_at`, `max_bps`) kebaca `undefined` → `?.toNumber() ?? 0` = 0, `undefined/100` = NaN, falsy bool → "Paused". Account names di `.accounts({...})` juga harus camelCase (`vaultState`, `targetMint`, `pairConfig`).
- Fix (commit `620c3d0`): revert semua field access dan account keys ke camelCase di `VaultCard.tsx`, `PairsTable.tsx`, `DepositWithdraw.tsx`, `AddPairModal.tsx`.

**Bug 3: Mint MET tidak valid → silent throw di luar try block**
- Address `METADDFL6wWMWEoKDFJwpmV4gVgELib96hYKUaVL5a` cuma 42 karakter (Solana pubkey 43-44). `new PublicKey(mint)` throw `"Invalid public key input"`.
- Throw-nya di baris `const mintPubkey = new PublicKey(mint)` — **di luar** `try {}` di `AddPairModal.handleAdd`. Akibatnya: error uncaught, `setLoading(true)` tidak pernah jalan, tidak ada spinner, tidak ada pesan merah di UI. Klik "Add Pair" kelihatan hang.
- Fix (commit `174d9e4`): ganti MET → USDC devnet (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`), dan pindahkan semua konstruksi `PublicKey` ke dalam try block supaya input invalid ke depan pun surface di UI.

**Bug 4: Infinite re-render dari useWallet() object reference**
- `useWallet()` return object reference baru setiap render. Kalau masuk ke `useCallback`/`useEffect` deps langsung, fetch loop tanpa henti.
- Fix: extract primitive deps (`walletKey = publicKey?.toBase58() ?? ""`, `canSign = !!signTransaction`) dan pakai `walletRef.current` di dalam callback untuk baca snapshot wallet yang up-to-date tanpa retrigger.

**Polishing lain-lain (commits 690e258 → 352c9c4 → 1b6efc6)**
- Next.js 16 App Router SSR: `WalletMultiButton` di-load via `next/dynamic({ ssr: false })` + mounted gate untuk eliminasi hydration mismatch.
- Buffer polyfill: `window.Buffer = Buffer` di `WalletProvider.tsx` — Anchor & web3.js bergantung pada Buffer global, Next.js App Router tidak auto-polyfill.
- `app/error.tsx` error boundary dengan stack trace visible untuk debug runtime error Vercel.
- Wrap semua `.toNumber()` dengan optional chaining (`?.toNumber() ?? 0`) untuk hindari crash saat baca field dari PDA yang belum ready.

**Lesson learned**
- Selalu cek real runtime behavior library (konversi nama, decoder output) daripada asumsi dari dokumentasi atau training data. Satu `node` script decode langsung dari devnet nyelesain spiral debugging panjang.
- Akun on-chain yang tidak bisa dihapus tetap jadi bagian permanen state — kalau struct layout berubah, pertimbangkan instruksi `migrate`/`realloc` dari awal, atau seed versioning.
- `new PublicKey(...)` di luar try block = bom silent. Bungkus semua user-derived input parsing dalam try/catch.

#### Sesi 5 — DCA Withdraw Feature (target token → admin)

User minta cara untuk ambil hasil DCA — token yang sudah ter-swap (JUP/USDC/BONK/WIF) menumpuk di ATA milik vault PDA tapi belum ada jalur keluar. Pilihan:

- **Opsi A** — withdraw langsung token ke admin (SPL transfer)
- **Opsi B** — swap balik ke SOL via Jupiter, lalu withdraw

Opsi B butuh Jupiter CPI yang **tidak jalan di devnet**, jadi pilih Opsi A dulu (testable di devnet, no slippage). Opsi B disisakan sebagai placeholder untuk mainnet.

**Instruksi baru — `withdraw_pair_tokens(vault_seed, amount)`**
- File: `instructions/withdraw_pair_tokens.rs`
- Accounts: `vault_state` (has_one = admin), `target_mint` (Mint), `pair_config` (validasi seed), `vault_token_account` (TokenAccount, authority = vault_state), `admin_token_account`, `admin` (signer), `token_program`
- Handler: `token::transfer` CPI dengan `CpiContext::new_with_signer` — vault PDA sign sebagai authority, seeds `[b"vault", vault_seed, bump]`
- Validasi: `amount > 0` + `vault_token_account.amount >= amount`

**Cargo.toml — anchor-spl + idl-build cascade**
- Tambah `anchor-spl = { version = "1.0.0", features = ["token"] }`
- **Trap**: `idl-build = ["anchor-lang/idl-build"]` saja tidak cukup. Saat `anchor build` enable feature `idl-build`, struct `Mint` & `TokenAccount` dari anchor-spl butuh trait `create_type`/`DISCRIMINATOR`/`insert_types` yang cuma muncul kalau anchor-spl punya `idl-build` aktif juga. Fix di commit `fbfcf17`: cascade ke `["anchor-lang/idl-build", "anchor-spl/idl-build"]`.
- Trap kedua: `CpiContext::new_with_signer` di Anchor v1 expect `Pubkey` bukan `AccountInfo` (sama dengan `CpiContext::new` di deposit.rs). Fix: `Token::id()` instead of `token_program.to_account_info()`.

**Frontend — `WithdrawPairModal` + Balance/Actions columns**
- `lib/program.ts`: helper `getVaultAta()` (allowOwnerOffCurve=true, vault PDA tidak on-curve), `getUserAta()`
- `WithdrawPairModal.tsx`: fetch ATA balance + mint decimals via `@solana/spl-token`, tombol Max, prepend `createAssociatedTokenAccountIdempotentInstruction` untuk admin ATA (no-op kalau sudah ada), call `.withdrawPairTokens()`
- `PairsTable.tsx`: kolom baru **Balance** (raw → human via `decimals`) dan **Actions** dengan tombol **↓ Withdraw** (admin-only, disabled saat `tokenBalance === 0n`)
- `tsconfig.json`: bump target ES2017 → ES2020 (perlu untuk BigInt literal `0n`)

**Devnet redeploy — extend ProgramData dulu**
- `cargo check` lokal sukses, tapi `anchor deploy` fail: `account data too small for instruction; ProgramData account not large enough`.
- Sebab: program lama 260,864 bytes deployed dengan ProgramData yang persis pas. Binary baru dengan anchor-spl jadi **286,576 bytes** (+25.7KB).
- Fix: `solana program extend FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX 30000 -u devnet` (cost ~0.21 SOL untuk rent-exempt reserve, 0.00000696 SOL/byte). Setelah extend, `anchor deploy` sukses di slot ~457432637.
- IDL yang ada di frontend di-overwrite dari `target/idl/my_solana_project.json` hasil `anchor build` (commit `cdde932`) — discriminator `withdraw_pair_tokens`: `[229,233,203,235,84,73,70,225]`.

**End-to-end smoke test (CLI, commit `frontend/test-withdraw-pair.mjs`)**
- Skrip pakai keypair CLI `D2NYszYS...` sebagai admin (vault baru di seed `vault_D2NYszYS`)
- Buat fresh SPL mint 6 desimal → register pair (max 50%) → mint 100 token ke vault ATA → call `withdrawPairTokens(60_000_000)` → verifikasi
- Hasil: vault ATA `100M → 40M`, admin ATA `0 → 60M`. **PASS**. Tx: `5r7SR3W4...`

**Test UI di Phantom vault**
- `D2NYszYS` (CLI) bukan admin vault Phantom (`6RcMW8s...`, admin `4GYyLGYg...`), jadi `add_pair` harus dari UI dulu.
- Tambah TEST mint `3GVkwedvppx6MjnC7JmupwGFCbsE8fxz4iNvSmF7ZS1f` ke `TOKEN_MINTS` (commit `12c0e07`) supaya muncul di dropdown Add Pair.
- Setelah user add pair via UI, jalankan `mint-to-phantom-vault.mjs` — mint 100 TEST ke vault ATA Phantom (`6X4gj7Q2MPwFzkX2CU1jaoa2HG9QReZt3vqZEWHgEpiC`). Tombol Withdraw di UI aktif, withdraw via Phantom sukses.

**Bug fix bonus: "Transaction has already been processed" toast palsu (commit `448d3c6`)**
- Setelah deposit sukses, kadang muncul error toast "Simulation failed... already been processed" — padahal SOL benar-benar masuk ke vault.
- Akar masalah: `@anchor-lang/core` `provider.js:262` — `sendAndConfirmRawTransaction` loop on `TimeoutError` dengan `continue` yang **re-send raw tx yang sama**. First send sukses landed, retry-send gagal preflight karena tx sudah on-chain.
- Fix: helper `isAlreadyProcessedError(e)` di `lib/program.ts` (deteksi substring `"already been processed"` / `"already processed"`). Diaplikasikan ke catch block di semua component yang fire tx via `.rpc()`: `VaultCard.initializeVault`, `DepositWithdraw`, `AddPairModal`, `PairsTable.togglePair`, `WithdrawPairModal`. Treat as success (refresh + close modal) instead of error toast.

**Lesson learned**
- Anchor v1 `idl-build` feature **harus di-cascade manual** ke setiap dependency yang punya tipe yang dipakai di `#[derive(Accounts)]`. Tanpa cascade, pesan error compile-nya membingungkan ("no associated item DISCRIMINATOR").
- Setiap perubahan struct/instruksi yang bikin binary lebih besar = wajib cek `solana program show` size-nya, kalau perlu `solana program extend` sebelum redeploy. Cost ~0.00000696 SOL/byte rent reserve.
- `provider.sendAndConfirm` di SDK Anchor v1 punya bug retry loop yang membuat tx sukses kelihatan failed di UI. Helper deteksi error string adalah workaround paling murah; fix sungguhnya butuh manual `transaction()` + `sendRawTransaction({ maxRetries: 0 })` + polling status.

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
- [x] Deployed ke Vercel + live debug (camelCase IDL, invalid MET mint, Buffer polyfill, SSR hydration, per-wallet seed)
- [x] DCA withdraw (Opsi A): `withdraw_pair_tokens` instruksi + WithdrawPairModal UI — verified end-to-end di devnet (test mint, CLI smoke + Phantom UI)
- [x] Workaround "already processed" retry-loop bug di Anchor v1 SDK
- [ ] DCA withdraw (Opsi B): swap-back ke SOL via Jupiter (mainnet only)
- [ ] LiteSVM unit tests (Rust)
- [ ] Meteora DLMM integration (Phase 2)
