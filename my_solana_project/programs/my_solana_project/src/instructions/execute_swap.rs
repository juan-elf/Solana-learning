use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke_signed;
use crate::state::{VaultState, PairConfig};
use crate::error::MyError;

/// Jupiter v6 program ID
const JUPITER_PROGRAM_ID: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

#[derive(Accounts)]
#[instruction(vault_seed: String)]
pub struct ExecuteSwap<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault_seed.as_bytes()],
        bump = vault_state.bump,
        constraint = vault_state.is_active @ MyError::VaultNotActive,
    )]
    pub vault_state: Account<'info, VaultState>,

    /// CHECK: Token mint — dipakai untuk verifikasi seeds pair_config.
    pub target_mint: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"pair_config", vault_state.key().as_ref(), target_mint.key().as_ref()],
        bump = pair_config.bump,
        constraint = pair_config.is_active @ MyError::PairNotActive,
    )]
    pub pair_config: Account<'info, PairConfig>,

    /// CHECK: Jupiter aggregator program — divalidasi via constraint program ID.
    #[account(
        constraint = jupiter_program.key() == JUPITER_PROGRAM_ID @ MyError::InvalidJupiterProgram
    )]
    pub jupiter_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// `swap_data`     : instruction data dari Jupiter (hasil /v6/swap, field `swapInstruction.data`)
/// `amount_in`     : SOL yang akan di-swap dari vault (lamports)
/// `min_amount_out`: minimum token output setelah slippage (dari Jupiter quote `otherAmountThreshold`)
pub fn handler(
    ctx: Context<ExecuteSwap>,
    vault_seed: String,
    swap_data: Vec<u8>,
    amount_in: u64,
    min_amount_out: u64,
) -> Result<()> {
    // 1. Validasi amount
    require!(amount_in > 0, MyError::InvalidAmount);
    require!(min_amount_out > 0, MyError::InvalidAmount);

    // 2. Pastikan amount tidak melebihi max_bps alokasi vault
    let vault_funds = ctx.accounts.vault_state.total_funds;
    let max_allowed = (vault_funds as u128)
        .checked_mul(ctx.accounts.pair_config.max_bps as u128)
        .ok_or(error!(MyError::ArithmeticOverflow))?
        .checked_div(10_000)
        .ok_or(error!(MyError::ArithmeticOverflow))? as u64;

    require!(amount_in <= max_allowed, MyError::ExceedsMaxAllocation);

    // 3. Siapkan PDA signer seeds untuk signing atas nama vault
    let seeds = &[
        b"vault".as_ref(),
        vault_seed.as_bytes(),
        &[ctx.accounts.vault_state.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // 4. Bangun instruction Jupiter dari swap_data yang dikirim bot
    //    remaining_accounts berisi semua akun yang dibutuhkan Jupiter
    let account_metas: Vec<anchor_lang::solana_program::instruction::AccountMeta> = ctx
        .remaining_accounts
        .iter()
        .map(|acc| {
            if acc.is_writable {
                anchor_lang::solana_program::instruction::AccountMeta::new(
                    *acc.key, acc.is_signer,
                )
            } else {
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                    *acc.key, acc.is_signer,
                )
            }
        })
        .collect();

    let jupiter_ix = Instruction {
        program_id: JUPITER_PROGRAM_ID,
        accounts: account_metas,
        data: swap_data,
    };

    // 5. Eksekusi CPI ke Jupiter, vault PDA sebagai signer
    let remaining_account_infos: Vec<AccountInfo> = ctx
        .remaining_accounts
        .iter()
        .cloned()
        .collect();

    invoke_signed(&jupiter_ix, &remaining_account_infos, signer_seeds)?;

    // 6. Update state vault
    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_funds = vault_state.total_funds
        .checked_sub(amount_in)
        .ok_or(error!(MyError::ArithmeticOverflow))?;

    let pair_config = &mut ctx.accounts.pair_config;
    pair_config.total_swapped = pair_config.total_swapped
        .checked_add(amount_in)
        .ok_or(error!(MyError::ArithmeticOverflow))?;
    pair_config.swap_count = pair_config.swap_count
        .checked_add(1)
        .ok_or(error!(MyError::ArithmeticOverflow))?;
    pair_config.last_swapped_at = Clock::get()?.unix_timestamp;

    msg!(
        "Swap executed | amount_in: {} lamports | min_out: {} | pair swap #{} | total_swapped: {}",
        amount_in,
        min_amount_out,
        pair_config.swap_count,
        pair_config.total_swapped
    );

    Ok(())
}
