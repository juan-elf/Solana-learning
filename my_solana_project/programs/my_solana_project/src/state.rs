use anchor_lang::prelude::*;

#[account]
pub struct VaultState {
    pub admin: Pubkey,
    pub total_funds: u64,
    pub bump: u8,
}

impl VaultState {
    pub const LEN: usize = 8 + 32 + 8 + 1; // discriminator (8) + Pubkey (32) + u64 (8) + u8 (1)
}
