import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import SolanaWalletProvider from "@/components/WalletProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aqueduct — DCA vault on Solana",
  description: "Non-custodial multi-pair DCA vault on Solana. Stream SOL into JUP, USDC, BONK, WIF and more with on-chain slippage and allocation caps.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full bg-slate-950 text-white antialiased">
        <SolanaWalletProvider>{children}</SolanaWalletProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!bg-slate-900 !border-slate-700 !text-slate-100",
              title: "!text-slate-100 !font-medium",
              description: "!text-slate-400",
              actionButton: "!bg-cyan-500/20 !text-cyan-300 !border !border-cyan-500/30",
              success: "!border-emerald-500/30",
              error: "!border-red-500/30",
            },
          }}
        />
      </body>
    </html>
  );
}
