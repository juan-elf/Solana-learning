"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function Header() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-cyan-500/20">
            A
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-white tracking-tight">Aqueduct</span>
            <span className="text-xs text-slate-500 hidden sm:inline">DCA vault</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono">
            Devnet
          </span>
        </div>
        {mounted ? (
          <WalletMultiButton style={{}} />
        ) : (
          <div className="h-11 w-40 rounded-lg bg-slate-800 animate-pulse" />
        )}
      </div>
    </header>
  );
}
