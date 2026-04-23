"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@anchor-lang/core";
import { getProgram, getVaultPDA, getVaultSeed, lamportsToSol, PROGRAM_ID } from "@/lib/program";

interface VaultState {
  admin: PublicKey;
  total_funds: anchor.BN;
  bump: number;
  is_active: boolean;
  created_at: anchor.BN;
  max_slippage_bps: number;
}

interface Props {
  onVaultLoaded: (vaultPDA: PublicKey, isAdmin: boolean, seed: string) => void;
  refreshTrigger: number;
}

export default function VaultCard({ onVaultLoaded, refreshTrigger }: Props) {
  const wallet = useWallet();
  const [vault, setVault] = useState<VaultState | null>(null);
  const [vaultPDA, setVaultPDA] = useState<PublicKey | null>(null);
  const [vaultSeed, setVaultSeed] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const fetchVault = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setLoading(true);
    setNotFound(false);
    try {
      const seed = getVaultSeed(wallet.publicKey);
      setVaultSeed(seed);
      const program = getProgram(wallet as unknown as import("@/lib/program").BrowserWallet);
      const pda = getVaultPDA(PROGRAM_ID, seed);
      setVaultPDA(pda);
      const acc = await (program.account as any).vaultState.fetch(pda);
      setVault(acc);
      const isAdmin = acc.admin.toBase58() === wallet.publicKey.toBase58();
      onVaultLoaded(pda, isAdmin, seed);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [wallet, onVaultLoaded]);

  useEffect(() => { fetchVault(); }, [fetchVault, refreshTrigger]);

  const initializeVault = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setInitializing(true);
    try {
      const seed = getVaultSeed(wallet.publicKey);
      const program = getProgram(wallet as unknown as import("@/lib/program").BrowserWallet);
      const pda = getVaultPDA(PROGRAM_ID, seed);
      await program.methods
        .initialize(seed)
        .accounts({ vaultState: pda, user: wallet.publicKey })
        .rpc();
      await fetchVault();
    } catch (e: any) {
      let msg = e.message ?? "Unknown error";
      if (typeof e.getLogs === "function") {
        try { const logs = await e.getLogs(); msg = logs.join("\n"); } catch {}
      } else if (e.logs) {
        msg = e.logs.join("\n");
      }
      alert("Initialize failed:\n\n" + msg);
    } finally {
      setInitializing(false);
    }
  };

  if (!wallet.connected) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-col items-center justify-center gap-3 min-h-[140px]">
        <p className="text-slate-400 text-sm">Connect your wallet to view vault</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 flex items-center justify-center min-h-[140px]">
        <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    const seed = wallet.publicKey ? getVaultSeed(wallet.publicKey) : "";
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-col items-center gap-4 min-h-[140px] justify-center">
        <p className="text-slate-400 text-sm">Vault belum diinisialisasi</p>
        <p className="text-slate-500 text-xs font-mono">seed: {seed}</p>
        <button
          onClick={initializeVault}
          disabled={initializing}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {initializing ? "Initializing…" : "Initialize Vault"}
        </button>
      </div>
    );
  }

  if (!vault || !vaultPDA) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-slate-300 text-sm font-medium uppercase tracking-wider">Vault</h2>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${vault.is_active ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"}`}>
          {vault.is_active ? "Active" : "Paused"}
        </span>
      </div>

      <div>
        <p className="text-slate-500 text-xs mb-1">Balance</p>
        <p className="text-3xl font-bold text-white">
          {lamportsToSol(vault.total_funds.toNumber())}
          <span className="text-lg text-slate-400 ml-1">SOL</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
        <div>
          <p className="text-slate-500 text-xs">Admin</p>
          <p className="text-slate-300 text-xs font-mono truncate">{vault.admin.toBase58().slice(0, 16)}…</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs">Max Slippage</p>
          <p className="text-slate-300 text-xs">{vault.max_slippage_bps / 100}%</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs">PDA</p>
          <p className="text-slate-300 text-xs font-mono truncate">{vaultPDA.toBase58().slice(0, 16)}…</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs">Seed</p>
          <p className="text-slate-300 text-xs font-mono">{vaultSeed}</p>
        </div>
      </div>
    </div>
  );
}
