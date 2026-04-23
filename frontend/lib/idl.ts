export const IDL = {
  address: "FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX",
  metadata: { name: "my_solana_project", version: "0.1.0", spec: "0.1.0" },
  instructions: [
    {
      name: "initialize",
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237],
      accounts: [
        { name: "vault_state", writable: true, pda: { seeds: [{ kind: "const", value: [118, 97, 117, 108, 116] }, { kind: "arg", path: "vault_seed" }] } },
        { name: "user", writable: true, signer: true },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [{ name: "vault_seed", type: "string" }],
    },
    {
      name: "deposit",
      discriminator: [242, 35, 198, 137, 82, 225, 242, 182],
      accounts: [
        { name: "vault_state", writable: true, pda: { seeds: [{ kind: "const", value: [118, 97, 117, 108, 116] }, { kind: "arg", path: "vault_seed" }] } },
        { name: "user", writable: true, signer: true },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [{ name: "_vault_seed", type: "string" }, { name: "amount", type: "u64" }],
    },
    {
      name: "withdraw",
      discriminator: [183, 18, 70, 156, 148, 109, 161, 34],
      accounts: [
        { name: "vault_state", writable: true, pda: { seeds: [{ kind: "const", value: [118, 97, 117, 108, 116] }, { kind: "arg", path: "vault_seed" }] } },
        { name: "admin", writable: true, signer: true, relations: ["vault_state"] },
      ],
      args: [{ name: "vault_seed", type: "string" }, { name: "amount", type: "u64" }],
    },
    {
      name: "add_pair",
      discriminator: [209, 230, 17, 236, 218, 162, 86, 118],
      accounts: [
        { name: "vault_state", pda: { seeds: [{ kind: "const", value: [118, 97, 117, 108, 116] }, { kind: "arg", path: "vault_seed" }] } },
        { name: "target_mint" },
        { name: "pair_config", writable: true, pda: { seeds: [{ kind: "const", value: [112, 97, 105, 114, 95, 99, 111, 110, 102, 105, 103] }, { kind: "account", path: "vault_state" }, { kind: "account", path: "target_mint" }] } },
        { name: "admin", writable: true, signer: true, relations: ["vault_state"] },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [{ name: "vault_seed", type: "string" }, { name: "max_bps", type: "u16" }],
    },
    {
      name: "toggle_pair",
      discriminator: [198, 41, 231, 202, 106, 165, 6, 223],
      accounts: [
        { name: "vault_state", pda: { seeds: [{ kind: "const", value: [118, 97, 117, 108, 116] }, { kind: "arg", path: "vault_seed" }] } },
        { name: "target_mint" },
        { name: "pair_config", writable: true, pda: { seeds: [{ kind: "const", value: [112, 97, 105, 114, 95, 99, 111, 110, 102, 105, 103] }, { kind: "account", path: "vault_state" }, { kind: "account", path: "target_mint" }] } },
        { name: "admin", signer: true, relations: ["vault_state"] },
      ],
      args: [{ name: "vault_seed", type: "string" }, { name: "enabled", type: "bool" }],
    },
  ],
  accounts: [
    { name: "PairConfig", discriminator: [119, 167, 13, 129, 136, 228, 151, 77] },
    { name: "VaultState", discriminator: [228, 196, 82, 165, 98, 210, 235, 152] },
  ],
  types: [
    {
      name: "VaultState",
      type: {
        kind: "struct",
        fields: [
          { name: "admin", type: "pubkey" },
          { name: "total_funds", type: "u64" },
          { name: "bump", type: "u8" },
          { name: "is_active", type: "bool" },
          { name: "created_at", type: "i64" },
          { name: "max_slippage_bps", type: "u16" },
        ],
      },
    },
    {
      name: "PairConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "target_mint", type: "pubkey" },
          { name: "is_active", type: "bool" },
          { name: "max_bps", type: "u16" },
          { name: "total_swapped", type: "u64" },
          { name: "swap_count", type: "u32" },
          { name: "last_swapped_at", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
} as const;
