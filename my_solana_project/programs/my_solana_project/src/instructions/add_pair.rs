use anchor_lang::prelude::*;
use crate::state::{VaultState, PairConfig};
use crate::error::MyError;

#[derive(Accounts)]
#[instruction(vault_seed: String, max_bps: u16)]
pub struct AddPair<'info> {
    /// Vault milik admin — dipakai sebagai scope PDA pair_config
    #[account(
        seeds = [b"vault", vault_seed.as_bytes()],
        bump = vault_state.bump,
        has_one = admin,
        constraint = vault_state.is_active @ MyError::VaultNotActive,
    )]
    pub vault_state: Account<'info, VaultState>,

    /// CHECK: Token mint tujuan swap (USDC, JUP, MET, dll).
    /// Validasi dilakukan oleh Jupiter pada saat execute_swap.
    pub target_mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = PairConfig::LEN,
        seeds = [b"pair_config", vault_state.key().as_ref(), target_mint.key().as_ref()],
        bump
    )]
    pub pair_config: Account<'info, PairConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AddPair>, _vault_seed: String, max_bps: u16) -> Result<()> {
    require!(PairConfig::is_valid_bps(max_bps), MyError::InvalidAmount);

    let pair_config = &mut ctx.accounts.pair_config;
    pair_config.target_mint    = ctx.accounts.target_mint.key();
    pair_config.is_active      = true;
    pair_config.max_bps        = max_bps;
    pair_config.total_swapped  = 0;
    pair_config.swap_count     = 0;
    pair_config.last_swapped_at = 0;
    pair_config.bump           = ctx.bumps.pair_config;

    msg!(
        "Pair registered | mint: {} | max_bps: {} ({}%)",
        ctx.accounts.target_mint.key(),
        max_bps,
        max_bps / 100
    );

    Ok(())
}
