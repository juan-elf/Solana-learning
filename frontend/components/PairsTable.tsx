"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Connection } from "@solana/web3.js";
import { getAccount, getMint } from "@solana/spl-token";
import * as anchor from "@anchor-lang/core";
import { getProgram, getPairPDA, getVaultAta, isAlreadyProcessedError, mintLabel, lamportsToSol, sendTx, RPC_URL, PROGRAM_ID, TOKEN_MINTS } from "@/lib/program";
import { fetchTokenPrices, formatUsd, formatPct, SOL_MINT, type PriceMap } from "@/lib/prices";
import WithdrawPairModal from "./WithdrawPairModal";

interface PairRow {
  symbol: string;
  mint: PublicKey;
  pairPDA: PublicKey;
  isActive: boolean;
  maxBps: number;
  totalSwapped: anchor.BN;
  swapCount: number;
  lastSwappedAt: anchor.BN;
  tokenBalance: bigint;
  tokenDecimals: number;
}

interface Props {
  vaultPDA: PublicKey | null;
  vaultSeed: string;
  isAdmin: boolean;
  refreshTrigger: number;
  onOpenAddPair: () => void;
}

interface PnL {
  investedUsd: number;
  currentUsd: number;
  pnlUsd: number;
  pnlPct: number;
  priced: boolean; // false if either price unknown
}

function computePnL(row: PairRow, prices: PriceMap): PnL {
  const solPrice = prices[SOL_MINT]?.usdPrice;
  const tokenPrice = prices[row.mint.toBase58()]?.usdPrice;
  const investedSol = (row.totalSwapped?.toNumber() ?? 0) / 1e9;
  const tokenAmount = Number(row.tokenBalance) / 10 ** row.tokenDecimals;

  if (!solPrice || !tokenPrice) {
    return {
      investedUsd: solPrice ? investedSol * solPrice : 0,
      currentUsd: 0,
      pnlUsd: 0,
      pnlPct: 0,
      priced: false,
    };
  }
  const investedUsd = investedSol * solPrice;
  const currentUsd = tokenAmount * tokenPrice;
  const pnlUsd = currentUsd - investedUsd;
  const pnlPct = investedUsd > 0 ? (pnlUsd / investedUsd) * 100 : 0;
  return { investedUsd, currentUsd, pnlUsd, pnlPct, priced: true };
}

export default function PairsTable({ vaultPDA, vaultSeed, isAdmin, refreshTrigger, onOpenAddPair }: Props) {
  const wallet = useWallet();
  const [pairs, setPairs] = useState<PairRow[]>([]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<PairRow | null>(null);

  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  const vaultKey = vaultPDA?.toBase58() ?? "";
  const walletKey = wallet.publicKey?.toBase58() ?? "";
  const canSign = !!wallet.signTransaction;

  const fetchPairs = useCallback(async () => {
    const w = walletRef.current;
    if (!w.publicKey || !w.signTransaction || !vaultKey) return;
    const vaultPDALocal = new PublicKey(vaultKey);
    const conn = new Connection(RPC_URL, "confirmed");
    setLoading(true);
    try {
      const program = getProgram(w as unknown as import("@/lib/program").BrowserWallet);
      const rows: PairRow[] = [];
      for (const [symbol, { mint }] of Object.entries(TOKEN_MINTS)) {
        const mintPubkey = new PublicKey(mint);
        const pairPDA = getPairPDA(PROGRAM_ID, vaultPDALocal, mintPubkey);
        try {
          const acc = await (program.account as any).pairConfig.fetch(pairPDA);
          const vaultAta = getVaultAta(vaultPDALocal, mintPubkey);
          const [tokenBalance, tokenDecimals] = await Promise.all([
            getAccount(conn, vaultAta).then((a) => a.amount).catch(() => 0n),
            getMint(conn, mintPubkey).then((m) => m.decimals).catch(() => 0),
          ]);
          rows.push({
            symbol, mint: mintPubkey, pairPDA,
            isActive: acc.isActive, maxBps: acc.maxBps,
            totalSwapped: acc.totalSwapped, swapCount: acc.swapCount, lastSwappedAt: acc.lastSwappedAt,
            tokenBalance, tokenDecimals,
          });
        } catch { /* pair not registered */ }
      }
      setPairs(rows);

      // Fetch prices in parallel for SOL + every registered mint
      const priceMints = [SOL_MINT, ...rows.map((r) => r.mint.toBase58())];
      const priceMap = await fetchTokenPrices(priceMints);
      setPrices(priceMap);
    } catch (e) {
      console.error("[PairsTable] fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [vaultKey]);

  useEffect(() => {
    if (!walletKey || !canSign || !vaultKey) return;
    fetchPairs();
  }, [walletKey, canSign, vaultKey, refreshTrigger, fetchPairs]);

  const togglePair = async (row: PairRow) => {
    if (!wallet.publicKey || !wallet.signTransaction || !vaultPDA || !vaultSeed) return;
    setToggling(row.symbol);
    try {
      const browserWallet = wallet as unknown as import("@/lib/program").BrowserWallet;
      const program = getProgram(browserWallet);
      const result = await sendTx(
        program.methods.togglePair(vaultSeed, !row.isActive)
          .accounts({ vaultState: vaultPDA, targetMint: row.mint, pairConfig: row.pairPDA, admin: wallet.publicKey }),
        browserWallet,
      );
      console.log(`[togglePair ${row.symbol}=${!row.isActive}] confirmed:`, result.explorer);
      await fetchPairs();
    } catch (e: any) {
      if (isAlreadyProcessedError(e)) {
        await fetchPairs();
      } else {
        alert("Toggle failed: " + e.message);
      }
    } finally {
      setToggling(null);
    }
  };

  const formatTokenBalance = (amount: bigint, decimals: number) => {
    if (amount === 0n) return "0";
    const display = Number(amount) / 10 ** decimals;
    return display < 0.0001 ? display.toExponential(2) : display.toFixed(Math.min(decimals, 4));
  };

  const summary = useMemo(() => {
    let invested = 0;
    let current = 0;
    let anyPriced = false;
    for (const row of pairs) {
      const p = computePnL(row, prices);
      if (p.priced) {
        invested += p.investedUsd;
        current += p.currentUsd;
        anyPriced = true;
      }
    }
    const pnl = current - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    return { invested, current, pnl, pnlPct, anyPriced };
  }, [pairs, prices]);

  if (!vaultPDA) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-4">
          <h2 className="text-slate-300 text-sm font-medium uppercase tracking-wider">Trading Pairs</h2>
          {summary.anyPriced && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">
                Invested <span className="text-slate-200 font-mono">{formatUsd(summary.invested)}</span>
              </span>
              <span className="text-slate-500">
                Now <span className="text-slate-200 font-mono">{formatUsd(summary.current)}</span>
              </span>
              <span className={`font-mono font-semibold ${summary.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {summary.pnl >= 0 ? "+" : ""}{formatUsd(summary.pnl)} ({formatPct(summary.pnlPct)})
              </span>
            </div>
          )}
        </div>
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
                <th className="px-4 py-3 text-right font-medium">SOL In</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 text-right font-medium">P&amp;L</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((row) => {
                const hasBalance = row.tokenBalance > 0n;
                const pnl = computePnL(row, prices);
                const pnlColor = pnl.pnlUsd >= 0 ? "text-emerald-400" : "text-red-400";
                return (
                  <tr key={row.symbol} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-white">{row.symbol}</span>
                      <span className="ml-2 text-slate-500 text-xs">{mintLabel(row.mint.toBase58())}</span>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-300">{(row.maxBps / 100).toFixed(0)}%</td>
                    <td className="px-4 py-4 text-right text-slate-300">{lamportsToSol(row.totalSwapped?.toNumber() ?? 0)}</td>
                    <td className="px-4 py-4 text-right font-mono text-slate-200">
                      {formatTokenBalance(row.tokenBalance, row.tokenDecimals)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {pnl.priced ? (
                        <div className="flex flex-col items-end">
                          <span className={`font-mono ${pnlColor} font-semibold`}>
                            {pnl.pnlUsd >= 0 ? "+" : ""}{formatUsd(pnl.pnlUsd)}
                          </span>
                          <span className={`text-xs font-mono ${pnlColor}`}>{formatPct(pnl.pnlPct)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs" title="Token tidak punya market price">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {isAdmin ? (
                        <button onClick={() => togglePair(row)} disabled={toggling === row.symbol}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors disabled:opacity-50 ${row.isActive ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30" : "bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700"}`}>
                          {toggling === row.symbol ? "…" : row.isActive ? "● ON" : "○ OFF"}
                        </button>
                      ) : (
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${row.isActive ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-slate-700/50 text-slate-400 border-slate-600"}`}>
                          {row.isActive ? "● ON" : "○ OFF"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isAdmin && (
                        <button
                          onClick={() => setWithdrawTarget(row)}
                          disabled={!hasBalance}
                          title={hasBalance ? `Withdraw ${row.symbol}` : "Belum ada saldo"}
                          className="text-xs px-2.5 py-1 rounded-lg border bg-emerald-600/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          ↓ Withdraw
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {withdrawTarget && (
        <WithdrawPairModal
          vaultPDA={vaultPDA}
          vaultSeed={vaultSeed}
          mint={withdrawTarget.mint}
          symbol={withdrawTarget.symbol}
          onClose={() => setWithdrawTarget(null)}
          onSuccess={fetchPairs}
        />
      )}
    </div>
  );
}
