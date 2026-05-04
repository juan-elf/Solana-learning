"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@anchor-lang/core";
import { Wallet } from "lucide-react";
import { getProgram, getVaultPDA, getVaultSeed, isAlreadyProcessedError, lamportsToSol, sendTx, PROGRAM_ID } from "@/lib/program";
import { toastSuccess, toastError } from "@/lib/toast";
import { HelpHint } from "./Tooltip";
import { VaultCardSkeleton } from "./Skeleton";

interface VaultState {
  admin: PublicKey;
  totalFunds: anchor.BN;
  bump: number;
  isActive: boolean;
  createdAt: anchor.BN;
  maxSlippageBps: number;
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
  const [togglingActive, setTogglingActive] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const walletKey = wallet.publicKey?.toBase58() ?? "";
  const canSign = !!wallet.signTransaction;

  useEffect(() => {
    if (!walletKey || !canSign) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const pubkey = new PublicKey(walletKey);
        const seed = getVaultSeed(pubkey);
        const pda = getVaultPDA(PROGRAM_ID, seed);
        if (cancelled) return;
        setVaultSeed(seed);
        setVaultPDA(pda);
        const program = getProgram(wallet as unknown as import("@/lib/program").BrowserWallet);
        const acc = await (program.account as any).vaultState.fetch(pda);
        if (cancelled) return;
        setVault(acc);
        const isAdmin = acc.admin.toBase58() === walletKey;
        onVaultLoaded(pda, isAdmin, seed);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKey, canSign, refreshTrigger, reloadTick]);

  const initializeVault = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setInitializing(true);
    try {
      const seed = getVaultSeed(wallet.publicKey);
      const browserWallet = wallet as unknown as import("@/lib/program").BrowserWallet;
      const program = getProgram(browserWallet);
      const pda = getVaultPDA(PROGRAM_ID, seed);
      const result = await sendTx(
        program.methods.initialize(seed).accounts({ vaultState: pda, user: wallet.publicKey }),
        browserWallet,
      );
      toastSuccess("Vault initialized", "Per-wallet PDA created", result.explorer);
      setReloadTick((n) => n + 1);
    } catch (e: any) {
      if (isAlreadyProcessedError(e)) {
        setReloadTick((n) => n + 1);
        return;
      }
      toastError("Initialize failed", e);
    } finally {
      setInitializing(false);
    }
  };

  const setActive = async (active: boolean) => {
    if (!wallet.publicKey || !wallet.signTransaction || !vaultPDA || !vaultSeed) return;
    setTogglingActive(true);
    try {
      const browserWallet = wallet as unknown as import("@/lib/program").BrowserWallet;
      const program = getProgram(browserWallet);
      const result = await sendTx(
        program.methods.setVaultActive(vaultSeed, active).accounts({ vaultState: vaultPDA, admin: wallet.publicKey }),
        browserWallet,
      );
      toastSuccess(active ? "Vault resumed" : "Vault paused", undefined, result.explorer);
      setReloadTick((n) => n + 1);
    } catch (e: any) {
      if (isAlreadyProcessedError(e)) {
        setReloadTick((n) => n + 1);
        return;
      }
      toastError(active ? "Resume failed" : "Pause failed", e);
    } finally {
      setTogglingActive(false);
    }
  };

  if (!wallet.connected) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-col items-center justify-center gap-3 min-h-[140px]">
        <Wallet className="w-6 h-6 text-slate-500" />
        <p className="text-slate-400 text-sm">Connect your wallet to view vault</p>
      </div>
    );
  }

  if (loading) {
    return <VaultCardSkeleton />;
  }

  if (notFound) {
    const seed = wallet.publicKey ? getVaultSeed(wallet.publicKey) : "";
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-col items-center gap-3 min-h-[140px] justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-1">
          <Wallet className="w-5 h-5" />
        </div>
        <p className="text-slate-200 text-sm font-medium">Vault belum aktif</p>
        <p className="text-slate-500 text-xs font-mono">seed: {seed}</p>
        <button
          onClick={initializeVault}
          disabled={initializing}
          className="mt-1 px-4 py-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white text-sm font-medium shadow-lg shadow-cyan-500/20 transition-all"
        >
          {initializing ? "Initializing…" : "Initialize Vault"}
        </button>
      </div>
    );
  }

  if (!vault || !vaultPDA) return null;
  const isAdmin = vault.admin.toBase58() === walletKey;
  const badgeClass = vault.isActive
    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
    : "bg-red-500/15 text-red-400 border border-red-500/30";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-slate-300 text-sm font-medium uppercase tracking-wider">Vault</h2>
        {isAdmin ? (
          <button
            onClick={() => setActive(!vault.isActive)}
            disabled={togglingActive}
            title={vault.isActive ? "Click to pause" : "Click to resume"}
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors disabled:opacity-50 ${badgeClass} hover:brightness-125`}
          >
            {togglingActive ? "…" : vault.isActive ? "● Active" : "○ Paused"}
          </button>
        ) : (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
            {vault.isActive ? "Active" : "Paused"}
          </span>
        )}
      </div>

      <div>
        <p className="text-slate-500 text-xs mb-1">Balance</p>
        <p className="text-3xl font-bold text-white">
          {lamportsToSol(vault.totalFunds?.toNumber() ?? 0)}
          <span className="text-lg text-slate-400 ml-1">SOL</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
        <div>
          <p className="text-slate-500 text-xs">Admin</p>
          <p className="text-slate-300 text-xs font-mono truncate">{vault.admin.toBase58().slice(0, 16)}…</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs flex items-center gap-1">
            Max Slippage
            <HelpHint text="Maximum slippage tolerance the bot can use per swap. Enforced on-chain — swaps exceeding this cap are rejected." />
          </p>
          <p className="text-slate-300 text-xs">{vault.maxSlippageBps / 100}%</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs flex items-center gap-1">
            PDA
            <HelpHint text="Program Derived Address — the on-chain account holding your vault state. Derived deterministically from the seed." />
          </p>
          <p className="text-slate-300 text-xs font-mono truncate">{vaultPDA.toBase58().slice(0, 16)}…</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs flex items-center gap-1">
            Seed
            <HelpHint text="Per-wallet seed (vault_<8 chars of pubkey>) so each wallet gets its own isolated vault." />
          </p>
          <p className="text-slate-300 text-xs font-mono">{vaultSeed}</p>
        </div>
      </div>
    </div>
  );
}
