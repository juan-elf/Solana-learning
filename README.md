# Solana DCA Vault

A non-custodial DCA (Dollar-Cost-Averaging) vault on Solana. Users deposit SOL into a per-wallet PDA, register target token pairs (JUP, USDC, BONK, WIF, ...) with allocation caps, and let an off-chain signal bot execute swaps through Jupiter v6 when EMA + RSI conditions trigger. Resulting tokens accumulate in the vault's ATAs and can be withdrawn back to the admin wallet at any time.

- **Program ID (devnet):** [`FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX`](https://explorer.solana.com/address/FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX?cluster=devnet)
- **Frontend:** Next.js 16 + Tailwind, deployable to Vercel
- **Framework:** Anchor 1.0.0 (Rust 2021)
- **Off-chain:** TypeScript bot with Pyth price feeds + Jupiter v6 quote API

## What it does

1. User connects a wallet (Phantom / Solflare via wallet-adapter)
2. Initializes a per-wallet vault PDA (`vault_<8 chars of pubkey>`)
3. Deposits SOL into the vault
4. Registers DCA pairs with `max_bps` allocation cap (e.g., `JUP @ 30%` = at most 30% of vault SOL ever swapped to JUP)
5. Off-chain bot watches Pyth, detects EMA-9/21 cross + RSI signals, and calls `execute_swap` with a Jupiter quote — vault PDA signs the Jupiter CPI as authority
6. Admin sees per-pair USD P&L in real time, can pause/resume the vault, toggle pairs, or withdraw accumulated tokens

## Architecture

```
                                                    Pyth Price Feed
                                                        │
                                                        ▼
                                                ┌───────────────┐
                                                │  signal_bot   │  EMA 9/21
                                                │  (off-chain)  │  RSI 14
                                                └───────┬───────┘
                                                        │
                                       Jupiter v6 quote │ /v6/quote
                                                        ▼
                                                ┌───────────────┐
                                                │ execute_swap  │
                          ┌───────────────────► │  (CPI signed  │
                          │                     │   by Vault    │
                          │                     │   PDA)        │
                          │                     └───────┬───────┘
                          │                             │
                          │                  invoke_signed CPI
                          │                             ▼
   Browser (Phantom)      │                     ┌───────────────┐
        │                 │                     │  Jupiter v6   │ swap
        │ deposit         │                     │   program     │ on-chain
        │ withdraw        │                     └───────┬───────┘
        │ add_pair        │                             │
        │ toggle_pair     │                             │
        │ withdraw_pair   │                             ▼
        │ set_vault_active│                     ┌───────────────┐
        ▼                 │                     │ Vault ATA     │
   ┌───────────────┐ ◄────┘                     │ (per-mint)    │
   │ Anchor Program│                            └───────────────┘
   │  (Vault PDA)  │
   │  + PairConfig │
   │    PDAs       │
   └───────┬───────┘
           │
           ▼
   ┌───────────────┐
   │ Frontend UI   │  Vault card (balance, status toggle, slippage)
   │ Next.js 16    │  Pairs table (max %, balance, P&L, withdraw)
   │ + wallet-     │  Modals: Deposit/Withdraw, Add Pair, Withdraw token
   │   adapter     │  Aggregate USD P&L via Jupiter Price API v3
   └───────────────┘
```

## Features

**On-chain (Anchor program)**
- Per-wallet vault PDA with admin guard (`has_one = admin`)
- Native SOL deposit/withdraw with checked arithmetic (no overflow panics)
- Multi-pair config (one `PairConfig` PDA per (vault, mint))
- Allocation cap enforcement (`amount_in <= total_funds * max_bps / 10000`)
- Vault-wide slippage cap (`(expected_out - min_amount_out) / expected_out <= max_slippage_bps`)
- Admin pause/resume (`set_vault_active`)
- Jupiter v6 swap CPI with PDA signer (`execute_swap`)
- DCA token withdrawal back to admin (`withdraw_pair_tokens` via `token::transfer`)
- Custom error variants for every failure path (`MyError::*`)

**Frontend (Next.js 16)**
- Wallet-adapter (Phantom, Solflare) with auto-connect + SSR-safe loading
- Vault card with balance, admin badge, clickable pause/resume
- Pairs table with per-pair USD P&L (color-coded ±%) + aggregate summary
- Inline Add Pair / Withdraw modals
- Manual tx flow (`sendTx` helper) instead of `.rpc()` to avoid Anchor v1's retry-loop bug
- Live prices via Jupiter Price API v3 (lite tier, no auth)
- Error boundary + Buffer polyfill for App Router compatibility

**Off-chain (TypeScript)**
- `signal_bot.ts` — Pyth-backed EMA + RSI signal generator with Jupiter quote → `execute_swap` invocation
- `jupiter_bot.ts` — manual Jupiter quote / swap helper for development

## Repo layout

```
solana-portofolio/
├── DEVLOG.md                     # Session-by-session development journal
├── README.md                     # ← you are here
├── my_solana_project/            # Anchor workspace
│   ├── Anchor.toml
│   ├── programs/my_solana_project/src/
│   │   ├── lib.rs                # #[program] dispatch
│   │   ├── state.rs              # VaultState, PairConfig
│   │   ├── error.rs              # MyError enum
│   │   └── instructions/         # one file per instruction
│   ├── app/
│   │   ├── signal_bot.ts         # EMA+RSI signal bot (Pyth + Jupiter)
│   │   └── jupiter_bot.ts        # manual Jupiter dev helper
│   └── tests/vault_test.ts       # ts-mocha integration tests (devnet)
└── frontend/                     # Next.js 16 web app
    ├── app/                      # App Router pages
    ├── components/               # VaultCard, PairsTable, modals, ...
    └── lib/
        ├── program.ts            # Anchor client + sendTx helper
        ├── prices.ts             # Jupiter Price API v3 fetcher
        └── idl.ts                # Generated IDL (mirror of target/idl/*.json)
```

## Quick start (devnet, run the frontend)

Prereqs: Node 20+, a Solana wallet (Phantom or Solflare), some devnet SOL ([faucet](https://faucet.solana.com)).

```bash
git clone https://github.com/juan-elf/Solana-learning.git
cd Solana-learning/frontend
npm install
echo 'NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com' > .env.local
npm run dev
# open http://localhost:3000
```

The deployed program at `FtUGETc...sjX` is shared across users — you'll get your own per-wallet vault on first connect.

## Deploy your own program

Prereqs: Rust 1.75+, Solana CLI 3.x, Anchor 1.0.0 (`avm install 1.0.0 && avm use 1.0.0`).

```bash
cd my_solana_project

# Generate a new program keypair (replace declare_id! and Anchor.toml accordingly)
solana-keygen new -o target/deploy/my_solana_project-keypair.json

# Build + deploy
anchor build
anchor deploy --provider.cluster devnet

# Sync the generated IDL into the frontend
node -e "const i=require('./target/idl/my_solana_project.json');\
  require('fs').writeFileSync('../frontend/lib/idl.ts',\
  'export const IDL = '+JSON.stringify(i,null,2)+' as const;\n')"
```

If a future redeploy fails with `account data too small for instruction`, the binary outgrew its `ProgramData` reserve — extend it:

```bash
solana program extend <PROGRAM_ID> 30000 -u devnet  # ~0.21 SOL rent reserve
anchor deploy --provider.cluster devnet
```

## Run the test suite

The Anchor program ships with a LiteSVM-based integration suite covering every
instruction except `execute_swap` (Jupiter CPI is mainnet-only). All 24 tests
run in-process — no validator required.

```bash
cd my_solana_project
anchor build                            # produces target/deploy/*.so
cargo test --features no-entrypoint     # runs vault_lifecycle, pair_management, withdraw_pair_tokens
```

The `--features no-entrypoint` flag is required: without it, both the program
and `spl-token` register a `solana_program::entrypoint` symbol and the test
binary fails to link.

What's covered (24 tests across 3 files):

- `vault_lifecycle.rs` — initialize defaults, double-init rejection, deposit/withdraw with admin guard, withdraw zero/over-balance error paths, set_vault_active flip + non-admin rejection
- `pair_management.rs` — add_pair happy path, max_bps boundaries (0 / 10001 / 10000), duplicate rejection, has_one guard, vault-paused gate
- `withdraw_pair_tokens.rs` — full SPL setup (mint creation, ATA, mint_to), happy path, zero/over-balance/non-admin errors, plus the "still works when vault paused" pin (admin must always be able to recover funds)

## Run the signal bot (off-chain DCA executor)

Prereq: filled vault, registered pair(s) with `max_bps`, wallet keypair at `~/.config/solana/id.json`.

```bash
cd my_solana_project
yarn install
yarn ts-node app/signal_bot.ts
```

The bot polls Pyth, computes EMA-9/21 + RSI-14, and when conditions trigger calls `execute_swap` with a fresh Jupiter quote. It respects `vault.max_slippage_bps` and `pair_config.max_bps` — both enforced on-chain, so the bot can't drift outside those caps even if compromised.

> Jupiter v6 is **mainnet-only**. On devnet the bot will produce signals but the swap CPI will fail at the Jupiter side. To exercise the full DCA loop, deploy to mainnet (see `DEVLOG.md` for the redeploy walkthrough).

## Instruction reference

| Instruction | Args | Who can call | What it does |
|---|---|---|---|
| `initialize` | `vault_seed` | anyone (becomes admin) | Create the vault PDA, set `is_active=true`, `max_slippage_bps=50` |
| `deposit` | `_vault_seed, amount` | anyone | Transfer SOL from caller into vault PDA |
| `withdraw` | `vault_seed, amount` | admin | Pull SOL back to admin via direct lamport manipulation |
| `add_pair` | `vault_seed, max_bps` | admin | Create `PairConfig` PDA for `(vault, target_mint)` |
| `toggle_pair` | `vault_seed, enabled` | admin | Pause / resume an individual pair |
| `set_vault_active` | `vault_seed, active` | admin | Pause / resume the entire vault |
| `execute_swap` | `vault_seed, swap_data, amount_in, expected_out, min_amount_out` | anyone (with valid Jupiter quote) | Forward Jupiter swap CPI signed by vault PDA |
| `withdraw_pair_tokens` | `vault_seed, amount` | admin | Transfer SPL tokens from vault ATA back to admin ATA |

## Stack

| Layer | Tool |
|---|---|
| Language | Rust 2021 |
| Framework | Anchor 1.0.0 |
| Solana CLI | 3.x (Agave) |
| On-chain client | `@anchor-lang/core ^1.0.1` |
| Frontend | Next.js 16 + Tailwind CSS 4 + React 19 |
| Wallet | `@solana/wallet-adapter-react` (Phantom, Solflare) |
| SPL | `@solana/spl-token ^0.4` |
| Price oracle | Pyth (off-chain, in `signal_bot.ts`) |
| Price display | Jupiter Price API v3 lite (`lite-api.jup.ag/price/v3`) |
| Swap aggregator | Jupiter v6 (`quote-api.jup.ag/v6`) |
| Hosting | Vercel (frontend) |

## Known limitations

- **Devnet ≠ mainnet:** Jupiter v6 only runs on mainnet. The `execute_swap` instruction works fine, but on devnet the inner Jupiter CPI has nothing to route against. The DCA loop must be exercised on mainnet to be fully validated.
- **`expected_out` is bot-supplied:** The slippage check trusts `expected_out` from the caller. A malicious bot operator could pass a low `expected_out` to bypass `vault.max_slippage_bps`. The hardened version pulls `expected_out` from a Pyth on-chain feed, but that is not yet implemented.
- **49-byte legacy vaults:** Vaults created by very early versions of the program (before `is_active` was added to `VaultState`) are now read as `Paused`. There is no on-chain migration; users on those vaults need to withdraw and re-initialize. Per-wallet seeds keep new users on the correct layout.

## Development journal

See [`DEVLOG.md`](./DEVLOG.md) for a chronological account of what was built, what broke, and what was learned. Major milestones:

- **Sesi 1-3** — Initial Anchor program, multi-pair vault + Jupiter CPI, signal bot
- **Sesi 4** — Frontend debug marathon (camelCase IDL trap, Buffer polyfill, SSR)
- **Sesi 5** — DCA withdraw feature (`withdraw_pair_tokens`)
- **Sesi 6** — Quick wins: slippage enforcement, pause/resume, manual tx flow, P&L dashboard

## Roadmap

- [x] LiteSVM unit tests for every instruction + error path (24/24 passing)
- [ ] Pyth on-chain `expected_out` lookup (replace bot-supplied value)
- [ ] DCA swap-back to SOL via Jupiter (Opsi B from Sesi 5)
- [ ] Mainnet deploy + live signal bot
- [ ] Meteora DLMM integration as alternative routing source

## License

MIT — feel free to fork, adapt, or learn from.
