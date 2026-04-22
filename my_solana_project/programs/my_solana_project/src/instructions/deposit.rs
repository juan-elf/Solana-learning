use anchor_lang::prelude::*;
use crate::state::VaultState;
use crate::error::MyError;

#[derive(Accounts)]
#[instruction(vault_seed: String)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault_seed.as_bytes()],
        bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let cpi_accounts = anchor_lang::system_program::Transfer {
        from: ctx.accounts.user.to_account_info(),
        to: ctx.accounts.vault_state.to_account_info(),
    };

    // Anchor v1: CpiContext::new menerima Pubkey, bukan AccountInfo
    let cpi_ctx = CpiContext::new(System::id(), cpi_accounts);

    anchor_lang::system_program::transfer(cpi_ctx, amount)?;

    let vault = &mut ctx.accounts.vault_state;
    vault.total_funds = vault.total_funds
        .checked_add(amount)
        .ok_or(error!(MyError::ArithmeticOverflow))?;

    msg!("Deposit berhasil, total vault: {}", vault.total_funds);
    Ok(())
}
