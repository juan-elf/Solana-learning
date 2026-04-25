use anchor_lang::prelude::*;
use crate::state::VaultState;

#[derive(Accounts)]
#[instruction(vault_seed: String)]
pub struct SetVaultActive<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault_seed.as_bytes()],
        bump = vault_state.bump,
        has_one = admin,
    )]
    pub vault_state: Account<'info, VaultState>,

    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<SetVaultActive>, _vault_seed: String, active: bool) -> Result<()> {
    ctx.accounts.vault_state.is_active = active;
    msg!("Vault is_active set to: {}", active);
    Ok(())
}
