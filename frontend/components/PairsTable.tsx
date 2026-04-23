"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@anchor-lang/core";
import { getProgram, getPairPDA, mintLabel, lamportsToSol, PROGRAM_ID, TOKEN_MINTS } from "@/lib/program";

interface PairRow {
  symbol: string;
  mint: PublicKey;
  pairPDA: PublicKey;
  is_active: boolean;
  max_bps: number;
  total_swapped: anchor.BN;
  swap_count: number;
  last_swapped_at: anchor.BN;
}

interface Props {
  vaultPDA: PublicKey | null;
  vaultSeed: string;
  isAdmin: boolean;
  refreshTrigger: number;
  onOpenAddPair: () => void;
}

export default function PairsTable({ vaultPDA, vaultSeed, isAdmin, refreshTrigger, onOpenAddPair }: Props) {
  const wallet = useWallet();
  const [pairs, setPairs] = useState<PairRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchPairs = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !vaultPDA) return;
    setLoading(true);
    try {
      const program = getProgram(wallet as unknown as import("@/lib/program").BrowserWallet);
      const rows: PairRow[] = [];
      for (const [symbol, { mint }] of Object.entries(TOKEN_MINTS)) {
        const mintPubkey = new PublicKey(mint);
        const pairPDA = getPairPDA(PROGRAM_ID, vaultPDA, mintPubkey);
        try {
          const acc = await (program.account as any).pairConfig.fetch(pairPDA);
          rows.push({ symbol, mint: mintPubkey, pairPDA, is_active: acc.is_active, max_bps: acc.max_bps, total_swapped: acc.total_swapped, swap_count: acc.swap_count, last_swapped_at: acc.last_swapped_at });
        } catch { /* pair not registered */ }
      }
      setPairs(rows);
    } finally {
      setLoading(false);
    }
  }, [wallet, vaultPDA]);

  useEffect(() => { fetchPairs(); }, [fetchPairs, refreshTrigger]);

  const togglePair = async (row: PairRow) => {
    if (!wallet.publicKey || !wallet.signTransaction || !vaultPDA || !vaultSeed) return;
    setToggling(row.symbol);
    try {
      const program = getProgram(wallet as unknown as import("@/lib/program").BrowserWallet);
      await program.methods
        .togglePair(vaultSeed, !row.is_active)
        .accounts({ vaultState: vaultPDA, targetMint: row.mint, pairConfig: row.pairPDA, admin: wallet.publicKey })
        .rpc();
      await fetchPairs();
    } catch (e: any) {
      alert("Toggle failed: " + e.message);
    } finally {
      setToggling(null);
    }
  };

  if (!vaultPDA) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <h2 className="text-slate-300 text-sm font-medium uppercase tracking-wider">Trading Pairs</h2>
        {isAdmin && (
          <button onClick={onOpenAddPair} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-500/30 transition-colors">
            + Add Pair
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pairs.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-sm">
          Belum ada pair terdaftar.{" "}
          {isAdmin && <button onClick={onOpenAddPair} className="text-purple-400 underline">Tambah pair</button>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="px-6 py-3 text-left font-medium">Pair</th>
                <th className="px-4 py-3 text-right font-medium">Max %</th>
                <th className="px-4 py-3 text-right font-medium">Swapped</th>
                <th className="px-4 py-3 text-right font-medium">Count</th>
                <th className="px-4 py-3 text-right font-medium">Last Swap</th>
                <th className="px-6 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((row) => {
                const lastSwap = row.last_swapped_at.toNumber();
                const lastSwapStr = lastSwap === 0 ? "—" : new Date(lastSwap * 1000).toLocaleDateString();
                return (
                  <tr key={row.symbol} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-white">{row.symbol}</span>
                      <span className="ml-2 text-slate-500 text-xs">{mintLabel(row.mint.toBase58())}</span>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-300">{(row.max_bps / 100).toFixed(0)}%</td>
                    <td className="px-4 py-4 text-right text-slate-300">{lamportsToSol(row.total_swapped.toNumber())} SOL</td>
                    <td className="px-4 py-4 text-right text-slate-300">{row.swap_count}</td>
                    <td className="px-4 py-4 text-right text-slate-400 text-xs">{lastSwapStr}</td>
                    <td className="px-6 py-4 text-right">
                      {isAdmin ? (
                        <button onClick={() => togglePair(row)} disabled={toggling === row.symbol}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors disabled:opacity-50 ${row.is_active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30" : "bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700"}`}>
                          {toggling === row.symbol ? "…" : row.is_active ? "● ON" : "○ OFF"}
                        </button>
                      ) : (
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${row.is_active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-slate-700/50 text-slate-400 border-slate-600"}`}>
                          {row.is_active ? "● ON" : "○ OFF"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
