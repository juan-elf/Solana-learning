use anchor_lang::prelude::*;
use crate::state::VaultState;
use crate::error::MyError;

#[derive(Accounts)]
#[instruction(vault_seed: String)]
pub struct Swap<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault_seed.as_bytes()],
        bump = vault_state.bump,
        has_one = admin,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Jupiter aggregator program — pemanggil wajib memastikan program ID yang benar.
    pub jupiter_program: UncheckedAccount<'info>,
}

pub fn handler(
    ctx: Context<Swap>,
    _vault_seed: String,
    _swap_instructions: Vec<u8>,
    min_amount_out: u64,
) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;

    require!(vault_state.is_active, MyError::VaultNotActive);

    msg!("Menjalankan Jupiter Swap via CPI...");

    // TODO: Implementasi Jupiter CPI menggunakan ctx.remaining_accounts
    // untuk meneruskan akun-akun yang dibutuhkan oleh swap instruction.
    let actual_amount = min_amount_out; // placeholder

    check_slippage(min_amount_out, actual_amount, vault_state.max_slippage_bps)?;

    msg!("Slippage check passed.");
    Ok(())
}

pub fn check_slippage(expected_amount: u64, actual_amount: u64, max_bps: u16) -> Result<()> {
    require!(expected_amount > 0, MyError::InvalidAmount);

    let slippage = (expected_amount.saturating_sub(actual_amount))
        .checked_mul(10000)
        .ok_or(error!(MyError::ArithmeticOverflow))?
        .checked_div(expected_amount)
        .ok_or(error!(MyError::ArithmeticOverflow))?;

    require!(slippage <= max_bps as u64, MyError::SlippageExceeded);

    msg!("Slippage: {} bps (max {})", slippage, max_bps);
    Ok(())
}
