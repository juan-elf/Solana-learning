export const IDL = {
  "address": "FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX",
  "metadata": {
    "name": "my_solana_project",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "add_pair",
      "discriminator": [
        209,
        230,
        17,
        236,
        218,
        162,
        86,
        118
      ],
      "accounts": [
        {
          "name": "vault_state",
          "docs": [
            "Vault milik admin — dipakai sebagai scope PDA pair_config"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vault_seed"
              }
            ]
          }
        },
        {
          "name": "target_mint",
          "docs": [
            "Validasi dilakukan oleh Jupiter pada saat execute_swap."
          ]
        },
        {
          "name": "pair_config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  105,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "target_mint"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vault_state"
          ]
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "vault_seed",
          "type": "string"
        },
        {
          "name": "max_bps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "vault_state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vault_seed"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "_vault_seed",
          "type": "string"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "execute_swap",
      "discriminator": [
        56,
        182,
        124,
        215,
        155,
        140,
        157,
        102
      ],
      "accounts": [
        {
          "name": "vault_state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vault_seed"
              }
            ]
          }
        },
        {
          "name": "target_mint"
        },
        {
          "name": "pair_config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  105,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "target_mint"
              }
            ]
          }
        },
        {
          "name": "jupiter_program"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "vault_seed",
          "type": "string"
        },
        {
          "name": "swap_data",
          "type": "bytes"
        },
        {
          "name": "amount_in",
          "type": "u64"
        },
        {
          "name": "expected_out",
          "type": "u64"
        },
        {
          "name": "min_amount_out",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "vault_state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vault_seed"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "vault_seed",
          "type": "string"
        }
      ]
    },
    {
      "name": "read_pool",
      "discriminator": [
        70,
        2,
        66,
        3,
        9,
        86,
        80,
        53
      ],
      "accounts": [
        {
          "name": "whirlpool"
        },
        {
          "name": "user",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "set_vault_active",
      "discriminator": [
        191,
        167,
        28,
        251,
        174,
        123,
        25,
        113
      ],
      "accounts": [
        {
          "name": "vault_state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vault_seed"
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "vault_state"
          ]
        }
      ],
      "args": [
        {
          "name": "vault_seed",
          "type": "string"
        },
        {
          "name": "active",
          "type": "bool"
        }
      ]
    },
    {
      "name": "swap",
      "discriminator": [
        248,
        198,
        158,
        145,
        225,
        117,
        135,
        200
      ],
      "accounts": [
        {
          "name": "vault_state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vault_seed"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vault_state"
          ]
        },
        {
          "name": "jupiter_program"
        }
      ],
      "args": [
        {
          "name": "vault_seed",
          "type": "string"
        },
        {
          "name": "swap_instructions",
          "type": "bytes"
        },
        {
          "name": "min_amount_out",
          "type": "u64"
        }
      ]
    },
    {
      "name": "toggle_pair",
      "discriminator": [
        198,
        41,
        231,
        202,
        106,
        165,
        6,
        223
      ],
      "accounts": [
        {
          "name": "vault_state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vault_seed"
              }
            ]
          }
        },
        {
          "name": "target_mint"
        },
        {
          "name": "pair_config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  105,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "target_mint"
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "vault_state"
          ]
        }
      ],
      "args": [
        {
          "name": "vault_seed",
          "type": "string"
        },
        {
          "name": "enabled",
          "type": "bool"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "vault_state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vault_seed"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vault_state"
          ]
        }
      ],
      "args": [
        {
          "name": "vault_seed",
          "type": "string"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw_pair_tokens",
      "discriminator": [
        229,
        233,
        203,
        235,
        84,
        73,
        70,
        225
      ],
      "accounts": [
        {
          "name": "vault_state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vault_seed"
              }
            ]
          }
        },
        {
          "name": "target_mint"
        },
        {
          "name": "pair_config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  105,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "target_mint"
              }
            ]
          }
        },
        {
          "name": "vault_token_account",
          "writable": true
        },
        {
          "name": "admin_token_account",
          "writable": true
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vault_state"
          ]
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "vault_seed",
          "type": "string"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "PairConfig",
      "discriminator": [
        119,
        167,
        13,
        129,
        136,
        228,
        151,
        77
      ]
    },
    {
      "name": "VaultState",
      "discriminator": [
        228,
        196,
        82,
        165,
        98,
        210,
        235,
        152
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InsufficientFunds",
      "msg": "Saldo di dalam catatan tidak mencukupi."
    },
    {
      "code": 6001,
      "name": "Unauthorized",
      "msg": "Akses ditolak: Anda bukan admin vault ini."
    },
    {
      "code": 6002,
      "name": "VaultNotActive",
      "msg": "Vault sedang tidak aktif."
    },
    {
      "code": 6003,
      "name": "InvalidAmount",
      "msg": "Jumlah tidak valid (harus > 0)."
    },
    {
      "code": 6004,
      "name": "ArithmeticOverflow",
      "msg": "Arithmetic overflow."
    },
    {
      "code": 6005,
      "name": "SlippageExceeded",
      "msg": "Slippage melebihi batas maksimum."
    },
    {
      "code": 6006,
      "name": "InvalidAccountData",
      "msg": "Data akun tidak valid atau panjang tidak mencukupi."
    },
    {
      "code": 6007,
      "name": "PairNotActive",
      "msg": "Pair tidak aktif."
    },
    {
      "code": 6008,
      "name": "ExceedsMaxAllocation",
      "msg": "Amount melebihi max alokasi yang diizinkan untuk pair ini."
    },
    {
      "code": 6009,
      "name": "InvalidJupiterProgram",
      "msg": "Program ID Jupiter tidak valid."
    },
    {
      "code": 6010,
      "name": "PairStateUnchanged",
      "msg": "Pair sudah dalam state yang sama."
    }
  ],
  "types": [
    {
      "name": "PairConfig",
      "docs": [
        "Konfigurasi per trading pair (1 akun per token target).",
        "PDA seeds: [b\"pair_config\", vault_state.key(), target_mint.key()]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "target_mint",
            "type": "pubkey"
          },
          {
            "name": "is_active",
            "type": "bool"
          },
          {
            "name": "max_bps",
            "type": "u16"
          },
          {
            "name": "total_swapped",
            "type": "u64"
          },
          {
            "name": "swap_count",
            "type": "u32"
          },
          {
            "name": "last_swapped_at",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "VaultState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "total_funds",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "is_active",
            "type": "bool"
          },
          {
            "name": "created_at",
            "type": "i64"
          },
          {
            "name": "max_slippage_bps",
            "type": "u16"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "SEED",
      "type": "string",
      "value": "\"anchor\""
    }
  ]
} as const;
