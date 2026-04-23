"use client";

import { useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import Header from "@/components/Header";
import VaultCard from "@/components/VaultCard";
import DepositWithdraw from "@/components/DepositWithdraw";
import PairsTable from "@/components/PairsTable";
import AddPairModal from "@/components/AddPairModal";

export default function Home() {
  const [vaultPDA, setVaultPDA] = useState<PublicKey | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddPair, setShowAddPair] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  const handleVaultLoaded = useCallback((pda: PublicKey, admin: boolean) => {
    setVaultPDA(pda);
    setIsAdmin(admin);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <VaultCard onVaultLoaded={handleVaultLoaded} refreshTrigger={refreshTick} />
          <DepositWithdraw vaultPDA={vaultPDA} isAdmin={isAdmin} onSuccess={refresh} />
        </div>

        <PairsTable
          vaultPDA={vaultPDA}
          isAdmin={isAdmin}
          refreshTrigger={refreshTick}
          onOpenAddPair={() => setShowAddPair(true)}
        />

        <p className="text-center text-slate-600 text-xs pb-4">
          Program{" "}
          <a
            href="https://explorer.solana.com/address/FtUGETcAzSFmdjf6gzZKwBYKqp7CoYjykiw8gQ4ZgsjX?cluster=devnet"
            target="_blank"
            rel="noreferrer"
            className="text-slate-500 hover:text-slate-300 underline font-mono"
          >
            FtUGETc…sjX
          </a>{" "}
          · Devnet · Anchor v1 &amp; Jupiter v6
        </p>
      </main>

      {showAddPair && vaultPDA && (
        <AddPairModal
          vaultPDA={vaultPDA}
          onClose={() => setShowAddPair(false)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
