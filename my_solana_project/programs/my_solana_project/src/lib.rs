pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use state::*;

#[allow(ambiguous_glob_reexports)]
pub use instructions::initialize::*;
#[allow(ambiguous_glob_reexports)]
pub use instructions::deposit::*;
#[allow(ambiguous_glob_reexports)]
pub use instructions::withdraw::*;
#[allow(ambiguous_glob_reexports)]
pub use instructions::swap::*;
#[allow(ambiguous_glob_reexports)]
pub use instructions::read_pool::*;
#[allow(ambiguous_glob_reexports)]
pub use instructions::add_pair::*;
#[allow(ambiguous_glob_reexports)]
pub use instructions::toggle_pair::*;
#[allow(ambiguous_glob_reexports)]
pub use instructions::execute_swap::*;
#[allow(ambiguous_glob_reexports)]
pub use instructions::withdraw_pair_tokens::*;

declare_id!("FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX");

#[program]
pub mod my_solana_project {
    use super::*;

    // --- Vault core ---
    pub fn initialize(ctx: Context<Initialize>, vault_seed: String) -> Result<()> {
        instructions::initialize::handler(ctx, vault_seed)
    }

    pub fn deposit(ctx: Context<Deposit>, _vault_seed: String, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, vault_seed: String, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, vault_seed, amount)
    }

    // --- Pair management ---
    pub fn add_pair(ctx: Context<AddPair>, vault_seed: String, max_bps: u16) -> Result<()> {
        instructions::add_pair::handler(ctx, vault_seed, max_bps)
    }

    pub fn toggle_pair(ctx: Context<TogglePair>, vault_seed: String, enabled: bool) -> Result<()> {
        instructions::toggle_pair::handler(ctx, vault_seed, enabled)
    }

    // --- Swap execution ---
    pub fn execute_swap(
        ctx: Context<ExecuteSwap>,
        vault_seed: String,
        swap_data: Vec<u8>,
        amount_in: u64,
        min_amount_out: u64,
    ) -> Result<()> {
        instructions::execute_swap::handler(ctx, vault_seed, swap_data, amount_in, min_amount_out)
    }

    // --- DCA result withdrawal (SPL token) ---
    pub fn withdraw_pair_tokens(
        ctx: Context<WithdrawPairTokens>,
        vault_seed: String,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_pair_tokens::handler(ctx, vault_seed, amount)
    }

    // --- Read-only / utilities ---
    pub fn read_pool(ctx: Context<ReadPool>) -> Result<()> {
        instructions::read_pool::handler(ctx)
    }

    pub fn swap(ctx: Context<Swap>, vault_seed: String, swap_instructions: Vec<u8>, min_amount_out: u64) -> Result<()> {
        instructions::swap::handler(ctx, vault_seed, swap_instructions, min_amount_out)
    }
}
