"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, getMint, getAccount } from "@solana/spl-token";
import * as anchor from "@anchor-lang/core";
import { getProgram, getVaultAta, getUserAta, getPairPDA, isAlreadyProcessedError, mintLabel, sendTx, RPC_URL, PROGRAM_ID, TOKEN_PROGRAM_ID } from "@/lib/program";
import { toastSuccess, toastError } from "@/lib/toast";

interface Props {
  vaultPDA: PublicKey;
  vaultSeed: string;
  mint: PublicKey;
  symbol: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WithdrawPairModal({ vaultPDA, vaultSeed, mint, symbol, onClose, onSuccess }: Props) {
  const wallet = useWallet();
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [decimals, setDecimals] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetching(true);
      try {
        const conn = new Connection(RPC_URL, "confirmed");
        const mintInfo = await getMint(conn, mint);
        if (cancelled) return;
        setDecimals(mintInfo.decimals);

        const vaultAta = getVaultAta(vaultPDA, mint);
        try {
          const acc = await getAccount(conn, vaultAta);
          if (!cancelled) setBalance(acc.amount);
        } catch {
          if (!cancelled) setBalance(0n);
        }
      } catch (e: any) {
        if (!cancelled) setError("Gagal memuat info token: " + (e.message ?? "unknown"));
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vaultPDA, mint]);

  const displayBalance = balance !== null
    ? (Number(balance) / 10 ** decimals).toFixed(Math.min(decimals, 6))
    : "—";

  const setMax = () => {
    if (balance === null) return;
    setAmount((Number(balance) / 10 ** decimals).toString());
  };

  const handleWithdraw = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) { setError("Masukkan jumlah yang valid"); return; }
    if (balance === null) { setError("Balance belum termuat"); return; }
    if (!wallet.publicKey || !wallet.signTransaction) return;

    const raw = BigInt(Math.floor(value * 10 ** decimals));
    if (raw > balance) { setError("Jumlah melebihi saldo vault"); return; }

    setLoading(true);
    setError("");
    try {
      const browserWallet = wallet as unknown as import("@/lib/program").BrowserWallet;
      const program = getProgram(browserWallet);
      const vaultAta = getVaultAta(vaultPDA, mint);
      const adminAta = getUserAta(wallet.publicKey, mint);
      const pairPDA = getPairPDA(PROGRAM_ID, vaultPDA, mint);

      // Prepend an idempotent "create admin ATA" instruction — no-op if it already exists.
      const createAdminAta = createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey, adminAta, wallet.publicKey, mint,
      );

      const result = await sendTx(
        program.methods
          .withdrawPairTokens(vaultSeed, new anchor.BN(raw.toString()))
          .accounts({
            vaultState: vaultPDA,
            targetMint: mint,
            pairConfig: pairPDA,
            vaultTokenAccount: vaultAta,
            adminTokenAccount: adminAta,
            admin: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .preInstructions([createAdminAta]),
        browserWallet,
      );
      toastSuccess(`${symbol} withdrawn`, `${value} ${symbol}`, result.explorer);

      onSuccess();
      onClose();
    } catch (e: any) {
      if (isAlreadyProcessedError(e)) {
        toastSuccess(`${symbol} withdrawn`, `${value} ${symbol}`);
        onSuccess();
        onClose();
        return;
      }
      let msg = e.message ?? "Transaction failed";
      if (typeof e.getLogs === "function") {
        try { const logs = await e.getLogs(); msg = logs.join("\n"); } catch {}
      } else if (e.logs) {
        msg = e.logs.join("\n");
      }
      setError(msg);
      toastError(`Withdraw ${symbol} failed`, e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Withdraw {symbol}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">&times;</button>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Token</span>
              <span className="text-slate-200 font-mono">{mintLabel(mint.toBase58())}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Saldo vault</span>
              <span className="text-slate-200 font-mono">{fetching ? "loading…" : `${displayBalance} ${symbol}`}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 text-xs">Jumlah withdraw</label>
              <button type="button" onClick={setMax}
                disabled={balance === null || balance === 0n}
                className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-40">
                Max
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2">
              <input type="number" min="0" step="any" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={loading || fetching}
                className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm" />
              <span className="text-slate-400 text-sm">{symbol}</span>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs whitespace-pre-wrap break-words">{error}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-colors">
            Cancel
          </button>
          <button onClick={handleWithdraw} disabled={loading || fetching || balance === 0n}
            className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {loading ? "Withdrawing…" : "Withdraw"}
          </button>
        </div>
      </div>
    </div>
  );
}
