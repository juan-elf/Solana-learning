"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@anchor-lang/core";
import { getProgram, getPairPDA, isAlreadyProcessedError, sendTx, PROGRAM_ID, TOKEN_MINTS } from "@/lib/program";

interface Props {
  vaultPDA: PublicKey;
  vaultSeed: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPairModal({ vaultPDA, vaultSeed, onClose, onSuccess }: Props) {
  const wallet = useWallet();
  const [symbol, setSymbol] = useState(Object.keys(TOKEN_MINTS)[0]);
  const [maxPct, setMaxPct] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    const pct = parseFloat(maxPct);
    if (isNaN(pct) || pct <= 0 || pct > 100) { setError("Masukkan persentase 1–100"); return; }
    if (!wallet.publicKey || !wallet.signTransaction) return;

    setLoading(true);
    setError("");
    try {
      const maxBps = Math.round(pct * 100);
      const { mint } = TOKEN_MINTS[symbol];
      const mintPubkey = new PublicKey(mint);
      const pairPDA = getPairPDA(PROGRAM_ID, vaultPDA, mintPubkey);

      const browserWallet = wallet as unknown as import("@/lib/program").BrowserWallet;
      const program = getProgram(browserWallet);
      const result = await sendTx(
        program.methods.addPair(vaultSeed, maxBps)
          .accounts({ vaultState: vaultPDA, targetMint: mintPubkey, pairConfig: pairPDA, admin: wallet.publicKey }),
        browserWallet,
      );
      console.log("[addPair] confirmed:", result.explorer);
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg: string = e.message ?? "Transaction failed";
      if (msg.includes("0x0") || msg.includes("already in use")) {
        setError("Pair ini sudah terdaftar di vault.");
        onSuccess();
        onClose();
      } else if (isAlreadyProcessedError(e)) {
        onSuccess();
        onClose();
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Add Trading Pair</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">&times;</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Token</label>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 outline-none focus:border-purple-500">
              {Object.entries(TOKEN_MINTS).map(([sym, { label }]) => (
                <option key={sym} value={sym}>{sym} — {label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Max Allocation (%)</label>
            <div className="flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2">
              <input type="number" min="1" max="100" step="1" value={maxPct}
                onChange={(e) => setMaxPct(e.target.value)}
                className="flex-1 bg-transparent text-white outline-none text-sm" />
              <span className="text-slate-400 text-sm">%</span>
            </div>
            <p className="text-slate-500 text-xs mt-1">Bot tidak akan swap lebih dari {maxPct || "0"}% dari vault per eksekusi</p>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-colors">
            Cancel
          </button>
          <button onClick={handleAdd} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {loading ? "Adding…" : "Add Pair"}
          </button>
        </div>
      </div>
    </div>
  );
}
