"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as anchor from "@anchor-lang/core";
import { getProgram, isAlreadyProcessedError, sendTx } from "@/lib/program";
import { toastSuccess, toastError } from "@/lib/toast";

interface Props {
  vaultPDA: PublicKey | null;
  vaultSeed: string;
  isAdmin: boolean;
  onSuccess: () => void;
}

type Tab = "deposit" | "withdraw";

export default function DepositWithdraw({ vaultPDA, vaultSeed, isAdmin, onSuccess }: Props) {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !vaultPDA || !vaultSeed) return;
    const sol = parseFloat(amount);
    if (isNaN(sol) || sol <= 0) { setError("Masukkan jumlah yang valid"); return; }
    const lamports = Math.floor(sol * LAMPORTS_PER_SOL);

    setLoading(true);
    setError("");
    try {
      const browserWallet = wallet as unknown as import("@/lib/program").BrowserWallet;
      const program = getProgram(browserWallet);
      const builder = tab === "deposit"
        ? program.methods.deposit(vaultSeed, new anchor.BN(lamports))
            .accounts({ vaultState: vaultPDA, user: wallet.publicKey })
        : program.methods.withdraw(vaultSeed, new anchor.BN(lamports))
            .accounts({ vaultState: vaultPDA, admin: wallet.publicKey });
      const result = await sendTx(builder, browserWallet);
      toastSuccess(
        tab === "deposit" ? "Deposit confirmed" : "Withdraw confirmed",
        `${sol} SOL`,
        result.explorer,
      );
      setAmount("");
      onSuccess();
    } catch (e: any) {
      if (isAlreadyProcessedError(e)) {
        toastSuccess(
          tab === "deposit" ? "Deposit confirmed" : "Withdraw confirmed",
          `${sol} SOL`,
        );
        setAmount("");
        onSuccess();
      } else {
        const msg = e.message ?? "Transaction failed";
        setError(msg);
        toastError(tab === "deposit" ? "Deposit failed" : "Withdraw failed", e);
      }
    } finally {
      setLoading(false);
    }
  };

  const connected = wallet.connected && vaultPDA && vaultSeed;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
      <div className="flex rounded-lg bg-slate-800 p-1 gap-1">
        {(["deposit", "withdraw"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(""); setAmount(""); }}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-300"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2">
          <input
            type="number"
            min="0"
            step="0.001"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!connected || loading}
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
          />
          <span className="text-slate-400 text-sm font-medium">SOL</span>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {tab === "withdraw" && !isAdmin && (
          <p className="text-amber-400 text-xs">Hanya admin vault yang bisa withdraw</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!connected || loading || (tab === "withdraw" && !isAdmin)}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg ${tab === "deposit" ? "bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/20" : "bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white shadow-emerald-500/20"}`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing…
            </span>
          ) : (
            tab === "deposit" ? "Deposit SOL" : "Withdraw SOL"
          )}
        </button>
      </div>
    </div>
  );
}
