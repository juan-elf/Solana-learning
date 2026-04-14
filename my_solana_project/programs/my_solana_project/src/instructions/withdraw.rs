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
    // 1. Cek saldo menggunakan referensi immutable sementara
    require!(
        ctx.accounts.vault_state.total_funds >= amount,
        MyError::InsufficientFunds
    );

    // 2. Siapkan seeds untuk PDA signing
    let seeds = &[
        b"vault".as_ref(),
        vault_seed.as_bytes(),
        &[ctx.accounts.vault_state.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // 3. Eksekusi Transfer (meminjam account secara immutable)
    let cpi_accounts = anchor_lang::system_program::Transfer {
        from: ctx.accounts.vault_state.to_account_info(),
        to: ctx.accounts.admin.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.key(),
        cpi_accounts,
        signer_seeds,
    );

    anchor_lang::system_program::transfer(cpi_ctx, amount)?;

    // 4. Update saldo (baru pinjam secara mutable di sini)
    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_funds = vault_state.total_funds.checked_sub(amount).unwrap();

    Ok(())
}
