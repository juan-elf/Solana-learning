use anchor_lang::prelude::*;

#[account]
pub struct VaultState {
    pub admin: Pubkey,
    pub total_funds: u64,
    pub bump: u8,
    pub is_active: bool,
    pub created_at: i64,
    pub max_slippage_bps: u16,
}

impl VaultState {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 1 + 8 + 2; // discriminator (8) + Pubkey (32) + u64 (8) + u8 (1) + bool (1) + i64 (8) + u16 (2) = 60 bytes
}
