use anchor_lang::prelude::*;
use crate::state::{VaultState, PairConfig};
use crate::error::MyError;

#[derive(Accounts)]
#[instruction(vault_seed: String)]
pub struct TogglePair<'info> {
    #[account(
        seeds = [b"vault", vault_seed.as_bytes()],
        bump = vault_state.bump,
        has_one = admin,
    )]
    pub vault_state: Account<'info, VaultState>,

    /// CHECK: Token mint — dipakai untuk verifikasi seeds pair_config.
    pub target_mint: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"pair_config", vault_state.key().as_ref(), target_mint.key().as_ref()],
        bump = pair_config.bump,
    )]
    pub pair_config: Account<'info, PairConfig>,

    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<TogglePair>, _vault_seed: String, enabled: bool) -> Result<()> {
    let pair_config = &mut ctx.accounts.pair_config;

    require!(
        pair_config.is_active != enabled,
        MyError::PairStateUnchanged
    );

    pair_config.is_active = enabled;

    msg!(
        "Pair {} | {}",
        ctx.accounts.target_mint.key(),
        if enabled { "ACTIVE" } else { "PAUSED" }
    );

    Ok(())
}
