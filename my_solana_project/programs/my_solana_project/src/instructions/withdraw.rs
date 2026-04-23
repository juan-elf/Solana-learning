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
}

pub fn handler(ctx: Context<Withdraw>, _vault_seed: String, amount: u64) -> Result<()> {
    require!(amount > 0, MyError::InvalidAmount);
    require!(
        ctx.accounts.vault_state.total_funds >= amount,
        MyError::InsufficientFunds
    );

    // PDA accounts yang punya data tidak bisa di-transfer via system program.
    // Gunakan direct lamport manipulation agar bisa withdraw dari PDA berisi data.
    {
        let vault_info = ctx.accounts.vault_state.to_account_info();
        let current = vault_info.lamports();
        **vault_info.try_borrow_mut_lamports()? = current
            .checked_sub(amount)
            .ok_or(error!(MyError::ArithmeticOverflow))?;
    }
    {
        let admin_info = ctx.accounts.admin.to_account_info();
        let current = admin_info.lamports();
        **admin_info.try_borrow_mut_lamports()? = current
            .checked_add(amount)
            .ok_or(error!(MyError::ArithmeticOverflow))?;
    }

    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_funds = vault_state.total_funds
        .checked_sub(amount)
        .ok_or(error!(MyError::ArithmeticOverflow))?;

    msg!("Withdrew {} lamports from vault", amount);
    Ok(())
}
