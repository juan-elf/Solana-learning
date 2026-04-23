use anchor_lang::prelude::*;

#[error_code]
pub enum MyError {
    #[msg("Saldo di dalam catatan tidak mencukupi.")]
    InsufficientFunds,

    #[msg("Akses ditolak: Anda bukan admin vault ini.")]
    Unauthorized,

    #[msg("Vault sedang tidak aktif.")]
    VaultNotActive,

    #[msg("Jumlah tidak valid (harus > 0).")]
    InvalidAmount,

    #[msg("Arithmetic overflow.")]
    ArithmeticOverflow,

    #[msg("Slippage melebihi batas maksimum.")]
    SlippageExceeded,

    #[msg("Data akun tidak valid atau panjang tidak mencukupi.")]
    InvalidAccountData,

    #[msg("Pair tidak aktif.")]
    PairNotActive,

    #[msg("Amount melebihi max alokasi yang diizinkan untuk pair ini.")]
    ExceedsMaxAllocation,

    #[msg("Program ID Jupiter tidak valid.")]
    InvalidJupiterProgram,

    #[msg("Pair sudah dalam state yang sama.")]
    PairStateUnchanged,
}
