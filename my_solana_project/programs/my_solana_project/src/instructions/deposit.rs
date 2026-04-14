use anchor_lang::prelude::*;
use crate::state::VaultState;

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

    // Gunakan .key() alih-alih .to_account_info() untuk argumen pertama
    let cpi_ctx = CpiContext::new(ctx.accounts.system_program.key(), cpi_accounts);

    anchor_lang::system_program::transfer(cpi_ctx, amount)?;

    let vault = &mut ctx.accounts.vault_state;
    vault.total_funds = vault.total_funds.checked_add(amount).unwrap();

    msg!("Successfully Deposit, total vault: {}", vault.total_funds);
    Ok(())
}
