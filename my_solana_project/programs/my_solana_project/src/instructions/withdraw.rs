use anchor_lang::prelude::*;
use crate::state::VaultState;
use crate::error::MyError;

#[derive(Accounts)]
#[instruction(vault_seed: String)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault_seed.as_bytes()],
        bump = vault_state.bump,
        has_one = admin,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Withdraw>, vault_seed: String, amount: u64) -> Result<()> {
    require!(
        ctx.accounts.vault_state.total_funds >= amount,
        MyError::InsufficientFunds
    );

    let seeds = &[
        b"vault".as_ref(),
        vault_seed.as_bytes(),
        &[ctx.accounts.vault_state.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = anchor_lang::system_program::Transfer {
        from: ctx.accounts.vault_state.to_account_info(),
        to: ctx.accounts.admin.to_account_info(),
    };

    // Anchor v1: CpiContext::new_with_signer menerima Pubkey, bukan AccountInfo
    let cpi_ctx = CpiContext::new_with_signer(System::id(), cpi_accounts, signer_seeds);

    anchor_lang::system_program::transfer(cpi_ctx, amount)?;

    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_funds = vault_state.total_funds
        .checked_sub(amount)
        .ok_or(error!(MyError::ArithmeticOverflow))?;

    Ok(())
}
