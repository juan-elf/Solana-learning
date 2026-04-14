pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use state::*;
pub use instructions::initialize::*;
pub use instructions::deposit::*;
pub use instructions::withdraw::*;

declare_id!("FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX");

#[program]
pub mod my_solana_project {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, vault_seed: String) -> Result<()> {
        instructions::initialize::handler(ctx, vault_seed)
    }

    pub fn deposit(ctx: Context<Deposit>, vault_seed: String, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, vault_seed: String, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, vault_seed, amount)
    }
}
