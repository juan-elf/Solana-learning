use anchor_lang::prelude::*;
use crate::state::VaultState;

#[derive(Accounts)]
#[instruction(vault_seed: String)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = VaultState::LEN,
        seeds = [b"vault", vault_seed.as_bytes()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, vault_seed: String) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    let user = &ctx.accounts.user;

    vault_state.admin = user.key();
    vault_state.total_funds = 0;
    vault_state.bump = ctx.bumps.vault_state;

    msg!("Vault initialized successfully for admin: {}", vault_state.admin);
    Ok(())
}
