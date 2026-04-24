use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::state::{VaultState, PairConfig};
use crate::error::MyError;

#[derive(Accounts)]
#[instruction(vault_seed: String)]
pub struct WithdrawPairTokens<'info> {
    #[account(
        seeds = [b"vault", vault_seed.as_bytes()],
        bump = vault_state.bump,
        has_one = admin,
    )]
    pub vault_state: Account<'info, VaultState>,

    pub target_mint: Account<'info, Mint>,

    #[account(
        seeds = [b"pair_config", vault_state.key().as_ref(), target_mint.key().as_ref()],
        bump = pair_config.bump,
    )]
    pub pair_config: Account<'info, PairConfig>,

    #[account(
        mut,
        token::mint = target_mint,
        token::authority = vault_state,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = target_mint,
        token::authority = admin,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<WithdrawPairTokens>, vault_seed: String, amount: u64) -> Result<()> {
    require!(amount > 0, MyError::InvalidAmount);
    require!(
        ctx.accounts.vault_token_account.amount >= amount,
        MyError::InsufficientFunds
    );

    let seeds = &[
        b"vault".as_ref(),
        vault_seed.as_bytes(),
        &[ctx.accounts.vault_state.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.admin_token_account.to_account_info(),
        authority: ctx.accounts.vault_state.to_account_info(),
    };
    // Anchor v1: CpiContext::new_with_signer menerima Pubkey, bukan AccountInfo
    let cpi_ctx = CpiContext::new_with_signer(
        Token::id(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_ctx, amount)?;

    msg!(
        "Withdrew {} tokens of mint {} from vault to admin",
        amount,
        ctx.accounts.target_mint.key()
    );
    Ok(())
}
