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

pub fn handler(ctx: Context<Initialize>, _vault_seed: String) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    let user = &ctx.accounts.user;
    let clock = Clock::get()?; // Mengambil waktu blockchain

    vault_state.admin = user.key();
    vault_state.total_funds = 0;
    vault_state.bump = ctx.bumps.vault_state;
    vault_state.is_active = true; // Default: Vault aktif saat dibuat
    vault_state.created_at = clock.unix_timestamp; // Simpan timestamp pembuatan
    vault_state.max_slippage_bps = 50; // Default 0.5%

    msg!("Vault initialized successfully for admin: {}", vault_state.admin);
    msg!("Created at: {}", vault_state.created_at);
    Ok(())
}
