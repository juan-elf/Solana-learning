use anchor_lang::prelude::*;

#[error_code]
pub enum MyError {
    #[msg("Saldo di dalam catatan tidak mencukupi.")]
    InsufficientFunds,

    #[msg("Akses ditolak: Anda bukan admin vault ini.")]
    Unauthorized,
}
