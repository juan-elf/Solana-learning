use anchor_lang::prelude::*;

#[account]
pub struct VaultState {
    pub admin: Pubkey,        // 32
    pub total_funds: u64,     // 8  — native SOL balance (lamports)
    pub bump: u8,             // 1
    pub is_active: bool,      // 1
    pub created_at: i64,      // 8
    pub max_slippage_bps: u16, // 2 — global slippage limit
}

impl VaultState {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 1 + 8 + 2; // 60 bytes
}

/// Konfigurasi per trading pair (1 akun per token target).
/// PDA seeds: [b"pair_config", vault_state.key(), target_mint.key()]
#[account]
pub struct PairConfig {
    pub target_mint: Pubkey,   // 32 — token tujuan swap (USDC, JUP, MET, dll)
    pub is_active: bool,       // 1  — bisa di-toggle admin
    pub max_bps: u16,          // 2  — max alokasi dari vault (1000 = 10%)
    pub total_swapped: u64,    // 8  — total SOL yang sudah di-swap ke pair ini (lamports)
    pub swap_count: u32,       // 4  — jumlah swap yang pernah terjadi
    pub last_swapped_at: i64,  // 8  — timestamp swap terakhir
    pub bump: u8,              // 1
}

impl PairConfig {
    pub const LEN: usize = 8 + 32 + 1 + 2 + 8 + 4 + 8 + 1; // 64 bytes

    /// Validasi max_bps tidak melebihi 100% (10000 bps)
    pub fn is_valid_bps(bps: u16) -> bool {
        bps > 0 && bps <= 10_000
    }
}
