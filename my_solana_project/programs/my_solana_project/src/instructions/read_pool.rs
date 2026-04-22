use anchor_lang::prelude::*;
use crate::error::MyError;

// Orca Whirlpool program ID (mainnet)
const WHIRLPOOL_PROGRAM_ID: Pubkey = pubkey!("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");

#[derive(Accounts)]
pub struct ReadPool<'info> {
    /// CHECK: Whirlpool account — ownership divalidasi di handler sebelum parsing data.
    pub whirlpool: UncheckedAccount<'info>,
    pub user: Signer<'info>,
}

pub fn handler(ctx: Context<ReadPool>) -> Result<()> {
    let whirlpool_info = ctx.accounts.whirlpool.to_account_info();

    // Validasi: pastikan akun dimiliki oleh Whirlpool program
    require!(
        whirlpool_info.owner == &WHIRLPOOL_PROGRAM_ID,
        MyError::InvalidAccountData
    );

    let data = whirlpool_info.try_borrow_data()?;

    // Pastikan data cukup panjang sebelum parsing
    require!(data.len() >= 32, MyError::InvalidAccountData);

    let sqrt_price = u128::from_le_bytes(
        data[0..16]
            .try_into()
            .map_err(|_| error!(MyError::InvalidAccountData))?,
    );
    let liquidity = u128::from_le_bytes(
        data[16..32]
            .try_into()
            .map_err(|_| error!(MyError::InvalidAccountData))?,
    );

    msg!("--- Orca Pool Data ---");
    msg!("Whirlpool Address: {}", whirlpool_info.key());
    msg!("Sqrt Price: {}", sqrt_price);
    msg!("Liquidity: {}", liquidity);
    msg!("----------------------");

    Ok(())
}
